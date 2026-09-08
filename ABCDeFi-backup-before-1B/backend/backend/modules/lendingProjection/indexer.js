const { Interface } = require('ethers');

// A new scope triggers a complete backfill when the canonical event surface expands.
const DEFAULT_SCOPE = 'canonical-lending-v2';
const FRAMEWORK_EVENTS = ['RoleAdminChanged', 'RoleGranted', 'RoleRevoked', 'Paused', 'Unpaused'];
const EVENT_ALLOWLIST = Object.freeze({
  lendingPool: ['CollateralDeposited', 'CollateralWithdrawn', 'TokensBorrowed', 'LoanRepaid', 'LiquidationSettled', ...FRAMEWORK_EVENTS],
  loanMarketplace: ['RequestCreated', 'RequestFunded', 'RequestCancelled', 'EMIManagerUpdated', 'P2PLoanLiquidated', ...FRAMEWORK_EVENTS],
  loanManager: ['LoanCreated', 'LoanRepaid', 'LoanDefaulted', 'LoanLiquidated', ...FRAMEWORK_EVENTS],
  emiManager: ['EMIScheduleCreated', 'EMIPaid', 'EMIDefaulted', ...FRAMEWORK_EVENTS],
  collateralVault: [
    'CollateralETHDeposited', 'CollateralERC20Deposited', 'CollateralETHReleased',
    'CollateralERC20Released', 'CollateralETHLiquidated', 'CollateralERC20Liquidated', ...FRAMEWORK_EVENTS,
  ],
  liquidation: ['PositionLiquidated', 'LiquidationThresholdUpdated', 'LiquidationBonusUpdated', ...FRAMEWORK_EVENTS],
  loanNFT: ['LoanNFTMinted', 'LoanStatusUpdated', 'LoanNFTBurned', 'Transfer', ...FRAMEWORK_EVENTS],
  abcdToken: ['Transfer'],
});

class DeterministicEventError extends Error {}

function toDecimal(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toDecimal);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, toDecimal(child)]));
  }
  return value;
}

function lower(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function requiredInteger(value, name, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
}

function readOptions(env = process.env) {
  const parse = (name, fallback, minimum) => {
    const value = env[name] === undefined || env[name] === '' ? fallback : Number(env[name]);
    return requiredInteger(value, name, minimum);
  };
  return Object.freeze({
    confirmationDepth: parse('LENDING_INDEXER_CONFIRMATIONS', 2, 0),
    blockRange: parse('LENDING_INDEXER_BLOCK_RANGE', 250, 1),
    pollIntervalMs: parse('LENDING_INDEXER_POLL_INTERVAL_MS', 5000, 100),
    retryAttempts: parse('LENDING_INDEXER_RETRY_ATTEMPTS', 3, 1),
    retryDelayMs: parse('LENDING_INDEXER_RETRY_DELAY_MS', 250, 0),
    contractScope: env.LENDING_INDEXER_CONTRACT_SCOPE || DEFAULT_SCOPE,
  });
}

function buildEventRegistry(manifest, artifacts) {
  const addresses = manifest.contracts;
  const registry = new Map();
  const definitions = [];
  for (const [artifactKey, eventNames] of Object.entries(EVENT_ALLOWLIST)) {
    const addressKey = artifactKey;
    const contractAddress = lower(addresses[addressKey]);
    if (!contractAddress || !artifacts[artifactKey]) throw new Error(`Missing canonical ${artifactKey} deployment or ABI`);
    const iface = new Interface(artifacts[artifactKey].abi);
    for (const eventName of eventNames) {
      let fragment;
      try {
        fragment = iface.getEvent(eventName);
      } catch {
        throw new Error(`Canonical ${artifactKey} ABI is missing allowlisted event ${eventName}`);
      }
      const topic0 = lower(fragment.topicHash);
      const key = `${contractAddress}:${topic0}`;
      if (registry.has(key)) throw new Error(`Duplicate canonical event registry key ${key}`);
      const definition = { artifactKey, contractAddress, iface, fragment, eventName, topic0 };
      registry.set(key, definition);
      definitions.push(definition);
    }
  }
  return Object.freeze({ registry, definitions, addresses: [...new Set(definitions.map((item) => item.contractAddress))], topics: definitions.map((item) => item.topic0) });
}

function decodeLog(log, registry) {
  const contractAddress = lower(log.address);
  const topic0 = lower(log.topics && log.topics[0]);
  const definition = registry.get(`${contractAddress}:${topic0}`);
  if (!definition) throw new DeterministicEventError(`Unrecognized manifest-bound event at ${contractAddress} topic ${topic0}`);
  let parsed;
  try {
    parsed = definition.iface.parseLog({ topics: log.topics, data: log.data });
  } catch (error) {
    throw new DeterministicEventError(`Cannot decode ${definition.eventName}: ${error.message}`);
  }
  const logIndex = Number(log.index ?? log.logIndex);
  const transactionIndex = Number(log.transactionIndex);
  if (!Number.isInteger(logIndex) || logIndex < 0 || !Number.isInteger(transactionIndex) || transactionIndex < 0) {
    throw new DeterministicEventError(`Malformed ${definition.eventName}: missing transaction or log index`);
  }
  const args = {};
  parsed.fragment.inputs.forEach((input, index) => { args[input.name || String(index)] = toDecimal(parsed.args[index]); });
  return {
    chainId: String(log.chainId),
    contractAddress,
    transactionHash: lower(log.transactionHash),
    blockNumber: String(log.blockNumber),
    transactionIndex,
    logIndex,
    blockHash: lower(log.blockHash),
    eventName: definition.eventName,
    eventSignature: definition.fragment.format('sighash'),
    topic0,
    topics: log.topics.map(lower),
    data: lower(log.data),
    args,
    removed: Boolean(log.removed),
  };
}

async function retry(operation, { attempts, delayMs, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), shouldRetry = () => true, onRetry = () => {} }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetry(error)) throw error;
      onRetry(error, attempt);
      await sleep(delayMs * (2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

function createMongoIndexerStore(models) {
  const { ChainEvent, BlockCheckpoint, Deployment } = models;
  return {
    async recordDeployment(manifest) {
      const contracts = {
        abcdToken: mapDeployment(manifest, 'abcdToken'), lendingPool: mapDeployment(manifest, 'lendingPool'), collateralVault: mapDeployment(manifest, 'collateralVault'),
        loanManager: mapDeployment(manifest, 'loanManager'), loanMarketplace: mapDeployment(manifest, 'loanMarketplace'),
        emiManager: mapDeployment(manifest, 'emiManager'), liquidation: mapDeployment(manifest, 'liquidation'), loanNFT: mapDeployment(manifest, 'loanNFT'),
      };
      await Deployment.updateOne(
        { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion },
        { $set: { network: manifest.network, rpcUrl: manifest.rpcUrl, deploymentBlock: String(manifest.deploymentBlock), deploymentTimestamp: new Date(manifest.deploymentTimestamp), manifestSchemaVersion: manifest.schemaVersion, manifestPath: manifest.manifestPath, contracts, indexedAt: new Date() } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    },
    getCheckpoint(identity) { return BlockCheckpoint.findOne(identity).lean(); },
    async saveCheckpoint(identity, checkpoint) {
      await BlockCheckpoint.updateOne(identity, { $set: { ...checkpoint, indexedAt: new Date() } }, { upsert: true, setDefaultsOnInsert: true });
    },
    async insertRawEvent(event) {
      const { removed, ...eventWithoutRemoved } = event;
      const identity = { chainId: event.chainId, transactionHash: event.transactionHash, logIndex: event.logIndex };
      const existing = await ChainEvent.findOne(identity).select('removed').lean();
      const result = await ChainEvent.updateOne(
        identity,
        {
          $setOnInsert: { ...eventWithoutRemoved, indexedAt: new Date() },
          $set: { removed: Boolean(removed), indexedAt: new Date() },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      return { inserted: result.upsertedCount === 1, restored: Boolean(existing?.removed) && !Boolean(removed) };
    },
    async markRawEventRemoved(identity) {
      await ChainEvent.updateOne(identity, { $set: { removed: true, indexedAt: new Date() } });
    },
    async canonicalEventsDescending(chainId, maxBlock) {
      return ChainEvent.aggregate([
        { $match: { chainId: String(chainId), removed: false } },
        { $addFields: { blockSort: { $convert: { input: '$blockNumber', to: 'long', onError: -1, onNull: -1 } } } },
        { $match: { blockSort: { $lte: maxBlock } } },
        { $sort: { blockSort: -1, logIndex: -1 } },
        { $project: { chainId: 1, blockNumber: 1, blockHash: 1 } },
      ]);
    },
    async markEventsRemovedFromBlock(chainId, firstRemovedBlock) {
      await ChainEvent.updateMany(
        { chainId: String(chainId), removed: false, $expr: { $gte: [{ $convert: { input: '$blockNumber', to: 'long', onError: -1, onNull: -1 } }, firstRemovedBlock] } },
        { $set: { removed: true, indexedAt: new Date() } }
      );
    },
  };
}

function mapDeployment(manifest, key) {
  const sourceKey = { abcdToken: 'ABCDToken', lendingPool: 'LendingPool', collateralVault: 'CollateralVault', loanManager: 'LoanManager', loanMarketplace: 'LoanMarketplace', emiManager: 'EMIManager', liquidation: 'Liquidation', loanNFT: 'LoanNFT' }[key];
  const source = manifest.rawContracts && manifest.rawContracts[sourceKey];
  if (!source) throw new Error(`Manifest is missing raw deployment evidence for ${sourceKey}`);
  return { address: source.address, deploymentTransactionHash: source.deploymentTransactionHash, deploymentBlock: String(source.deploymentBlock) };
}

class LendingIndexer {
  constructor({ manifest, artifacts, provider, store, logger = console, options = {}, eventProcessor = async () => {}, rebuildProjections = async () => {}, sleep }) {
    if (!manifest || !provider || !store) throw new Error('manifest, provider, and store are required for the lending indexer');
    this.manifest = manifest;
    this.provider = provider;
    this.store = store;
    this.logger = logger;
    this.options = { ...readOptions(), ...options };
    this.registry = buildEventRegistry(manifest, artifacts);
    this.eventProcessor = eventProcessor;
    this.rebuildProjections = rebuildProjections;
    this.sleep = sleep;
    this.running = false;
    this.stopping = false;
    this.timer = null;
    this.currentRun = null;
  }

  log(level, message, context = {}) {
    const entry = { component: 'lending-indexer', chainId: this.manifest.chainId, message, ...context };
    if (typeof this.logger[level] === 'function') this.logger[level](entry);
  }

  checkpointIdentity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractScope: this.options.contractScope }; }

  async callRpc(operation, context) {
    return retry(operation, {
      attempts: this.options.retryAttempts, delayMs: this.options.retryDelayMs, sleep: this.sleep,
      shouldRetry: (error) => !(error instanceof DeterministicEventError),
      onRetry: (error, attempt) => this.log('warn', 'RPC retry scheduled', { ...context, attempt, error: error.message }),
    });
  }

  async callDatabase(operation, context) {
    return retry(operation, {
      attempts: this.options.retryAttempts, delayMs: this.options.retryDelayMs, sleep: this.sleep,
      shouldRetry: (error) => !(error instanceof DeterministicEventError),
      onRetry: (error, attempt) => this.log('warn', 'Database retry scheduled', {
        ...context,
        attempt,
        error: error.message,
        stack: error.stack,
      }),
    });
  }

  async assertCanonicalNetwork() {
    const network = await this.callRpc(() => this.provider.getNetwork(), { operation: 'getNetwork' });
    if (Number(network.chainId) !== Number(this.manifest.chainId)) throw new Error(`RPC chainId ${network.chainId} does not match canonical manifest chainId ${this.manifest.chainId}`);
  }

  async getStartBlock() {
    const identity = this.checkpointIdentity();
    const checkpoint = await this.callDatabase(() => this.store.getCheckpoint(identity), { operation: 'getCheckpoint' });
    if (!checkpoint || checkpoint.lastProcessedBlock === null || checkpoint.lastProcessedBlock === undefined) return this.manifest.deploymentBlock;
    const checkpointBlock = Number(checkpoint.lastProcessedBlock);
    const canonicalBlock = await this.callRpc(() => this.provider.getBlock(checkpointBlock), { operation: 'validateCheckpoint', blockNumber: checkpointBlock });
    if (canonicalBlock && lower(canonicalBlock.hash) === lower(checkpoint.lastProcessedBlockHash)) return checkpointBlock + 1;
    return this.recoverFromReorg(checkpointBlock);
  }

  async recoverFromReorg(checkpointBlock) {
    this.log('warn', 'Checkpoint hash diverged; beginning reorg recovery', { checkpointBlock });
    const events = await this.callDatabase(() => this.store.canonicalEventsDescending(String(this.manifest.chainId), checkpointBlock), { operation: 'findReorgAncestor' });
    let ancestor = null;
    for (const event of events) {
      const block = await this.callRpc(() => this.provider.getBlock(Number(event.blockNumber)), { operation: 'findReorgAncestor', blockNumber: event.blockNumber });
      if (block && lower(block.hash) === lower(event.blockHash)) { ancestor = Number(event.blockNumber); break; }
    }
    const firstRemovedBlock = ancestor === null ? this.manifest.deploymentBlock : ancestor + 1;
    await this.callDatabase(() => this.store.markEventsRemovedFromBlock(String(this.manifest.chainId), firstRemovedBlock), { operation: 'markReorgEventsRemoved', firstRemovedBlock });
    await this.callDatabase(() => this.rebuildProjections({ chainId: String(this.manifest.chainId), fromBlock: firstRemovedBlock }), { operation: 'rebuildProjections', firstRemovedBlock });
    if (ancestor === null) {
      await this.callDatabase(() => this.store.saveCheckpoint(this.checkpointIdentity(), { lastProcessedBlock: null, lastProcessedBlockHash: null }), { operation: 'resetCheckpoint' });
    } else {
      const block = await this.callRpc(() => this.provider.getBlock(ancestor), { operation: 'saveReorgCheckpoint', blockNumber: ancestor });
      await this.callDatabase(() => this.store.saveCheckpoint(this.checkpointIdentity(), { lastProcessedBlock: String(ancestor), lastProcessedBlockHash: lower(block.hash) }), { operation: 'saveReorgCheckpoint' });
    }
    return firstRemovedBlock;
  }

  async processEvent(log) {
    let event;
    try { event = decodeLog({ ...log, chainId: String(this.manifest.chainId) }, this.registry.registry); } catch (error) {
      this.log('error', 'Malformed or unrecognized canonical log', { blockNumber: log.blockNumber, transactionHash: log.transactionHash, logIndex: log.index ?? log.logIndex, contractAddress: log.address, error: error.message });
      throw error;
    }
    const identity = { chainId: event.chainId, transactionHash: event.transactionHash, logIndex: event.logIndex };
    if (event.removed) {
      await this.callDatabase(() => this.store.markRawEventRemoved(identity), { operation: 'markRawEventRemoved', ...identity });
      return { event, inserted: false, removed: true };
    }
    const result = await this.callDatabase(() => this.store.insertRawEvent(event), { operation: 'insertRawEvent', ...identity });
    if (result.inserted || result.restored) await this.eventProcessor(event);
    return { event, inserted: result.inserted, restored: Boolean(result.restored), removed: false };
  }

  async processRange(fromBlock, toBlock) {
    requiredInteger(fromBlock, 'fromBlock', 0); requiredInteger(toBlock, 'toBlock', fromBlock);
    if (fromBlock < this.manifest.deploymentBlock) throw new DeterministicEventError(`Range starts before canonical deployment block ${this.manifest.deploymentBlock}`);
    if (toBlock - fromBlock + 1 > this.options.blockRange) throw new Error(`Range ${fromBlock}-${toBlock} exceeds configured block range ${this.options.blockRange}`);
    const logs = await this.callRpc(async () => {
      const allLogs = [];
      for (const definition of this.registry.definitions) {
        const pairLogs = await this.provider.getLogs({
          address: definition.contractAddress,
          topics: [definition.topic0],
          fromBlock,
          toBlock,
        });
        allLogs.push(...pairLogs);
      }
      return allLogs;
    }, { operation: 'getLogs', fromBlock, toBlock });
    const orderedLogs = [...logs].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.transactionIndex) - Number(b.transactionIndex) || Number(a.index ?? a.logIndex) - Number(b.index ?? b.logIndex));
    let cursor = 0;
    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
      while (cursor < orderedLogs.length && Number(orderedLogs[cursor].blockNumber) === blockNumber) {
        await this.processEvent(orderedLogs[cursor]); cursor += 1;
      }
      const block = await this.callRpc(() => this.provider.getBlock(blockNumber), { operation: 'getBlock', blockNumber });
      if (!block || !block.hash) throw new Error(`RPC returned no block hash for ${blockNumber}`);
      await this.callDatabase(() => this.store.saveCheckpoint(this.checkpointIdentity(), { lastProcessedBlock: String(blockNumber), lastProcessedBlockHash: lower(block.hash) }), { operation: 'saveCheckpoint', blockNumber });
    }
    return { fromBlock, toBlock, processedEvents: orderedLogs.length };
  }

  processBlock(blockNumber) { return this.processRange(blockNumber, blockNumber); }

  async syncOnce() {
    await this.assertCanonicalNetwork();
    if (this.store.recordDeployment) await this.callDatabase(() => this.store.recordDeployment(this.manifest), { operation: 'recordDeployment' });
    const latestBlock = await this.callRpc(() => this.provider.getBlockNumber(), { operation: 'getBlockNumber' });
    const targetBlock = latestBlock - this.options.confirmationDepth;
    const startBlock = await this.getStartBlock();
    if (targetBlock < startBlock) return { startBlock, targetBlock, processedRanges: 0 };
    let processedRanges = 0;
    for (let fromBlock = startBlock; fromBlock <= targetBlock; fromBlock += this.options.blockRange) {
      const toBlock = Math.min(fromBlock + this.options.blockRange - 1, targetBlock);
      await this.processRange(fromBlock, toBlock); processedRanges += 1;
    }
    return { startBlock, targetBlock, processedRanges };
  }

  async start() {
    if (this.running) return;
    this.running = true; this.stopping = false;
    const loop = async () => {
      if (this.stopping) return;
      try { this.currentRun = this.syncOnce(); await this.currentRun; this.log('info', 'Synchronization cycle completed'); }
      catch (error) {
        this.log('error', 'Synchronization cycle failed', {
          error: error.message,
          stack: error.stack,
        });
      }
      finally { this.currentRun = null; }
      if (!this.stopping) this.timer = setTimeout(loop, this.options.pollIntervalMs);
    };
    await loop();
  }

  async stop() {
    this.stopping = true; this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.currentRun) await this.currentRun.catch(() => {});
    this.log('info', 'Indexer stopped gracefully');
  }
}

module.exports = { DEFAULT_SCOPE, EVENT_ALLOWLIST, DeterministicEventError, readOptions, buildEventRegistry, decodeLog, retry, createMongoIndexerStore, LendingIndexer };
