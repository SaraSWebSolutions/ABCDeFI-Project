const { Contract, Interface } = require('ethers');
const { projectionRuntimeFields, checkpointRuntimeFields } = require('../../config/projectionRuntimeContext.cjs');

// TreasuryV2 emits both its domain event and the inherited OpenZeppelin event
// for pause transitions. The projection retains both canonical receipt facts.
const EVENTS = [
  'AssetConfigured', 'FunderConfigured', 'RecipientConfigured', 'TreasuryFunded',
  'TreasuryTransferExecuted', 'TreasuryPaused', 'TreasuryUnpaused', 'Paused', 'Unpaused',
];
// A pre-existing checkpoint may predate the inherited event domain. Re-reading
// only these receipt events is idempotent and never rewinds the checkpoint.
const RECONCILIATION_EVENTS = ['Paused', 'Unpaused'];

const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const serialise = (value) => typeof value === 'bigint' ? value.toString() : value;
const logIndexOf = (log) => Number(log.index ?? log.logIndex);
const compareLogs = (left, right) => Number(left.blockNumber) - Number(right.blockNumber) || logIndexOf(left) - logIndexOf(right);

class TreasuryIndexer {
  constructor({ manifest, artifact, provider, models }) {
    this.manifest = manifest;
    this.provider = provider;
    this.models = models;
    this.iface = new Interface(artifact.abi);
    this.contract = new Contract(manifest.treasuryAddress, artifact.abi, provider);
    this.topics = EVENTS.map((name) => this.iface.getEvent(name).topicHash);
    this.reconciliationTopics = RECONCILIATION_EVENTS.map((name) => this.iface.getEvent(name).topicHash);
  }

  identity() {
    return {
      chainId: String(this.manifest.chainId),
      deploymentVersion: this.manifest.deploymentVersion,
      ...projectionRuntimeFields(this.manifest),
      treasuryAddress: this.manifest.treasuryAddress,
    };
  }

  async assertDeployment() {
    const [network, code, configured] = await Promise.all([
      this.provider.getNetwork(),
      this.provider.getCode(this.manifest.treasuryAddress),
      this.contract.supportedAsset(this.manifest.abcdAddress),
    ]);
    if (Number(network.chainId) !== Number(this.manifest.chainId) || code === '0x' || !configured) {
      throw new Error('TreasuryV2 bytecode or ABCD configuration is invalid.');
    }
  }

  async getCanonicalLogs(topics, fromBlock, toBlock) {
    if (toBlock < fromBlock) return [];
    return this.provider.getLogs({
      address: this.manifest.treasuryAddress,
      topics: [topics],
      fromBlock,
      toBlock,
    });
  }

  async projectLogs(logs, identity) {
    const ordered = [...new Map(logs.map((log) => [`${lower(log.transactionHash)}:${logIndexOf(log)}`, log])).values()].sort(compareLogs);
    for (const log of ordered) {
      const parsed = this.iface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) continue;
      const args = Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name || String(index), serialise(parsed.args[index])]));
      const event = {
        ...identity,
        transactionHash: lower(log.transactionHash),
        blockNumber: String(log.blockNumber),
        logIndex: logIndexOf(log),
        blockHash: lower(log.blockHash),
        eventName: parsed.name,
        args,
        indexedAt: new Date(),
      };
      const inserted = await this.models.TreasuryEvent.updateOne(
        { ...identity, transactionHash: event.transactionHash, logIndex: event.logIndex },
        { $setOnInsert: event },
        { upsert: true },
      );
      if (!inserted.upsertedCount) continue;
      if (parsed.name === 'AssetConfigured') {
        await this.models.TreasuryAsset.updateOne(
          { ...identity, asset: lower(args.asset) },
          {
            $set: {
              ...identity,
              asset: lower(args.asset),
              supported: args.enabled,
              accountedBalance: String(await this.contract.accountedBalance(args.asset)),
              latestEvidence: event,
              indexedAt: new Date(),
            },
          },
          { upsert: true },
        );
      }
      if (parsed.name === 'TreasuryFunded' || parsed.name === 'TreasuryTransferExecuted') {
        await this.models.TreasuryAsset.updateOne(
          { ...identity, asset: lower(args.asset) },
          {
            $set: {
              ...identity,
              asset: lower(args.asset),
              supported: true,
              accountedBalance: args.accountedBalance,
              latestEvidence: event,
              indexedAt: new Date(),
            },
          },
          { upsert: true },
        );
      }
    }
    return ordered.length;
  }

  async syncOnce() {
    await this.assertDeployment();
    const identity = this.identity();
    const prior = await this.models.TreasuryCheckpoint.findOne(identity).lean();
    if (prior?.lastProcessedBlock) {
      const block = await this.provider.getBlock(Number(prior.lastProcessedBlock));
      if (!block || lower(block.hash) !== lower(prior.lastProcessedBlockHash)) {
        throw new Error('TreasuryV2 checkpoint does not match active chain.');
      }
    }
    const latest = await this.provider.getBlockNumber();
    const from = prior?.lastProcessedBlock ? Number(prior.lastProcessedBlock) + 1 : this.manifest.deploymentBlock;
    const [forwardLogs, inheritedPauseLogs] = await Promise.all([
      this.getCanonicalLogs(this.topics, from, latest),
      // This domain-only reconciliation admits canonical inherited pause
      // records omitted by older allowlists without changing checkpoint state.
      this.getCanonicalLogs(this.reconciliationTopics, this.manifest.deploymentBlock, latest),
    ]);
    const processed = await this.projectLogs([...forwardLogs, ...inheritedPauseLogs], identity);
    const checkpointBlock = await this.provider.getBlock(latest);
    const runtime = await checkpointRuntimeFields(this.manifest, this.provider, [this.manifest.treasuryAddress, this.manifest.abcdAddress]);
    await this.models.TreasuryCheckpoint.updateOne(
      identity,
      {
        $set: {
          ...identity,
          ...runtime,
          lastProcessedBlock: String(latest),
          lastProcessedBlockHash: lower(checkpointBlock.hash),
          indexedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { checkpoint: String(latest), processed };
  }
}

module.exports = { TreasuryIndexer, EVENTS, RECONCILIATION_EVENTS };
