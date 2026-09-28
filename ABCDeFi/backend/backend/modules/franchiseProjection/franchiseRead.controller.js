const { Contract, getAddress, isAddress, JsonRpcProvider } = require('ethers');

const SCOPE = 'canonical-franchise-foundation-v4';
const REQUIRED_CONFIRMATIONS = 2;
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;

function normalizeAddress(value) { return typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null; }
function limit(value, fallback = 50) { const parsed = value === undefined ? fallback : Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback; }
function source(manifest) { return { kind: 'canonical-indexed-on-chain', chainId: String(manifest.chainId), network: manifest.network, deploymentVersion: manifest.deploymentVersion, nftAddress: manifest.nftAddress, registryAddress: manifest.registryAddress }; }
function canonicalUint(value) { if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Canonical indexed uint value is invalid.'); return value.replace(/^0+(?=\d)/, ''); }
function compareUint(left, right) { const a = canonicalUint(String(left)); const b = canonicalUint(String(right)); return a.length - b.length || a.localeCompare(b); }
function compareHistory(left, right) { return compareUint(left.evidence.blockNumber, right.evidence.blockNumber) || Number(left.evidence.logIndex) - Number(right.evidence.logIndex) || String(left.evidence.transactionHash).localeCompare(String(right.evidence.transactionHash)); }
function compareEvents(left, right) { return compareUint(left.blockNumber, right.blockNumber) || Number(left.logIndex) - Number(right.logIndex) || String(left.transactionHash).localeCompare(String(right.transactionHash)); }
function sortHistory(records) { return [...records].sort(compareHistory); }
function sortEvents(records) { return [...records].sort(compareEvents); }
function encodeCursor(payload) { return Buffer.from(JSON.stringify(payload)).toString('base64url'); }
function decodeCursor(value, expected) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!decoded || decoded.version !== 1 || decoded.kind !== expected.kind || decoded.chainId !== expected.chainId || decoded.deploymentVersion !== expected.deploymentVersion || lower(decoded.registryAddress) !== lower(expected.registryAddress) || (expected.wallet && lower(decoded.wallet) !== lower(expected.wallet)) || (expected.tokenId && decoded.tokenId !== expected.tokenId) || !decoded.anchor) throw new Error('invalid cursor');
    return decoded.anchor;
  } catch { throw new Error('Cursor is invalid for this canonical Franchise deployment and read scope.'); }
}
function paginate(records, requestedLimit, cursor, compare, makeCursor) {
  const ordered = [...records].sort(compare);
  const remaining = cursor ? ordered.filter((record) => compare(record, cursor) > 0) : ordered;
  const data = remaining.slice(0, requestedLimit);
  return { data, nextCursor: remaining.length > data.length ? makeCursor(data[data.length - 1]) : null };
}

function createFranchiseReadController({ models, manifest, providerFactory = (value) => new JsonRpcProvider(value.rpcUrl) }) {
  const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, registryAddress: manifest.registryAddress };
  async function availability() {
    const checkpoint = await models.FranchiseCheckpoint.findOne(identity).lean();
    if (checkpoint?.projectionScope !== SCOPE || !checkpoint?.lastProcessedBlock || !checkpoint?.lastProcessedBlockHash) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise indexer has not completed a hash-verified sync for this deployment.', checkpoint: null };
    try {
      const provider = providerFactory(manifest);
      const nft = new Contract(manifest.nftAddress, ['function registry() view returns (address)'], provider);
      const [network, block, latest, registryCode, nftCode, boundRegistry] = await Promise.all([
        provider.getNetwork(), provider.getBlock(Number(checkpoint.lastProcessedBlock)), provider.getBlockNumber(), provider.getCode(manifest.registryAddress), provider.getCode(manifest.nftAddress), nft.registry(),
      ]);
      if (Number(network.chainId) !== Number(manifest.chainId)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise RPC chain does not match the deployment manifest.', checkpoint: null };
      if (registryCode === '0x' || nftCode === '0x' || lower(boundRegistry) !== lower(manifest.registryAddress)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise deployment or Registry binding is unavailable.', checkpoint: null };
      if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise checkpoint block hash does not match the live chain.', checkpoint: null };
      if (Number(checkpoint.lastProcessedBlock) < Math.max(0, Number(latest) - REQUIRED_CONFIRMATIONS)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise indexer checkpoint is stale.', checkpoint: null };
    } catch { return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise checkpoint cannot be verified against the live chain.', checkpoint: null }; }
    return { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock };
  }
  async function requireAvailable(res, fallback) { const state = await availability(); if (!state.available) { res.json({ source: source(manifest), ...state, data: fallback, page: null }); return null; } return state; }
  const invalidCursor = (res, error) => res.status(400).json({ status: 'INVALID_REQUEST', message: error.message });
  return {
    status: async (_req, res, next) => { try { res.json({ source: source(manifest), ...(await availability()) }); } catch (error) { next(error); } },
    events: async (req, res, next) => { try {
      const state = await requireAvailable(res, []); if (!state) return;
      const pageLimit = limit(req.query.limit); const expected = { kind: 'events', ...identity }; let cursor;
      try { cursor = decodeCursor(req.query.cursor, expected); } catch (error) { return invalidCursor(res, error); }
      const records = await models.FranchiseEvent.find({ ...identity, removed: false }).lean();
      const page = paginate(records, pageLimit, cursor, compareEvents, (record) => encodeCursor({ version: 1, ...expected, anchor: { blockNumber: canonicalUint(record.blockNumber), logIndex: Number(record.logIndex), transactionHash: String(record.transactionHash) } }));
      res.json({ source: source(manifest), ...state, data: page.data, page: { limit: pageLimit, nextCursor: page.nextCursor } });
    } catch (error) { next(error); } },
    wallet: async (req, res, next) => { try {
      const wallet = normalizeAddress(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be a valid Ethereum address.' });
      const state = await requireAvailable(res, []); if (!state) return;
      const pageLimit = limit(req.query.limit); const expected = { kind: 'wallet', ...identity, wallet }; let cursor;
      try { cursor = decodeCursor(req.query.cursor, expected); } catch (error) { return invalidCursor(res, error); }
      const records = await models.FranchiseCertificate.find({ ...identity, owner: wallet }).lean();
      const page = paginate(records, pageLimit, cursor, (left, right) => compareUint(left.tokenId, right.tokenId), (record) => encodeCursor({ version: 1, ...expected, anchor: { tokenId: canonicalUint(record.tokenId) } }));
      res.json({ source: source(manifest), ...state, wallet, data: page.data, page: { limit: pageLimit, nextCursor: page.nextCursor } });
    } catch (error) { next(error); } },
    certificate: async (req, res, next) => { try { if (!/^\d+$/.test(req.params.tokenId) || BigInt(req.params.tokenId) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, null); if (!state) return; const data = await models.FranchiseCertificate.findOne({ ...identity, tokenId: req.params.tokenId }).lean(); if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(manifest), ...state, data }); } catch (error) { next(error); } },
    history: async (req, res, next) => { try {
      if (!/^\d+$/.test(req.params.tokenId) || BigInt(req.params.tokenId) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' });
      const state = await requireAvailable(res, []); if (!state) return;
      const pageLimit = limit(req.query.limit); const expected = { kind: 'history', ...identity, tokenId: req.params.tokenId }; let cursor;
      try { cursor = decodeCursor(req.query.cursor, expected); } catch (error) { return invalidCursor(res, error); }
      const records = await models.FranchiseHistory.find({ ...identity, tokenId: req.params.tokenId }).lean();
      const page = paginate(records, pageLimit, cursor, compareHistory, (record) => encodeCursor({ version: 1, ...expected, anchor: { evidence: { blockNumber: canonicalUint(record.evidence.blockNumber), logIndex: Number(record.evidence.logIndex), transactionHash: String(record.evidence.transactionHash) } } }));
      res.json({ source: source(manifest), ...state, data: page.data, page: { limit: pageLimit, nextCursor: page.nextCursor } });
    } catch (error) { next(error); } },
  };
}

module.exports = { createFranchiseReadController, normalizeAddress, sortHistory, sortEvents, encodeCursor, decodeCursor, REQUIRED_CONFIRMATIONS, SCOPE };
