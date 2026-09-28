const { getAddress, isAddress, JsonRpcProvider } = require('ethers');
const { projectionRuntimeFields, checkpointRuntimeFields, checkpointRuntimeMatches } = require('../../config/projectionRuntimeContext.cjs');

const SCOPE = 'canonical-legion-nft-v2';
const REQUIRED_CONFIRMATIONS = 2;
const normalizeAddress = (value) => typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null;
const tokenId = (value) => /^\d+$/.test(value) && BigInt(value) > 0n;
const requestId = tokenId;
const limit = (value, fallback = 100) => {
  const parsed = value === undefined ? fallback : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 250) : fallback;
};
const source = (manifest) => ({ kind: 'canonical-indexed-on-chain', chainId: String(manifest.chainId), network: manifest.network, deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress });
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : '';

function canonicalUint(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Canonical indexed uint value is invalid.');
  return value.replace(/^0+(?=\d)/, '');
}
function compareUint(left, right) {
  const a = canonicalUint(String(left)); const b = canonicalUint(String(right));
  return a.length - b.length || a.localeCompare(b);
}
function compareHistory(left, right) {
  return compareUint(left.blockNumber, right.blockNumber)
    || Number(left.transactionIndex) - Number(right.transactionIndex)
    || Number(left.logIndex) - Number(right.logIndex)
    || String(left.transactionHash).localeCompare(String(right.transactionHash));
}
function encodeCursor(payload) { return Buffer.from(JSON.stringify(payload)).toString('base64url'); }
function decodeCursor(value, expected) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!decoded || decoded.version !== 1 || decoded.kind !== expected.kind || decoded.chainId !== expected.chainId || decoded.deploymentVersion !== expected.deploymentVersion || lower(decoded.contractAddress) !== lower(expected.contractAddress) || (expected.wallet && lower(decoded.wallet) !== lower(expected.wallet)) || (expected.tokenId && decoded.tokenId !== expected.tokenId) || !decoded.anchor) throw new Error('invalid cursor');
    return decoded.anchor;
  } catch { throw new Error('Cursor is invalid for this canonical LegionNFTV2 deployment and read scope.'); }
}
function paginate(records, requestedLimit, cursor, compare, makeCursor) {
  const ordered = [...records].sort(compare);
  const remaining = cursor ? ordered.filter((record) => compare(record, cursor) > 0) : ordered;
  const data = remaining.slice(0, requestedLimit);
  return { data, nextCursor: remaining.length > data.length ? makeCursor(data[data.length - 1]) : null };
}

function createLegionNFTV2ReadController({ models, manifestLoader, providerFactory = (manifest) => new JsonRpcProvider(manifest.rpcUrl) }) {
  const context = () => { try { return { manifest: manifestLoader(), error: null }; } catch (error) { return { manifest: null, error }; } };
  const identity = (manifest) => ({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, ...projectionRuntimeFields(manifest), contractAddress: manifest.contractAddress });
  const availability = async (manifest) => {
    const checkpoint = await models.LegionNFTV2Checkpoint.findOne({ ...identity(manifest), scope: SCOPE }).lean();
    if (!checkpoint?.lastProcessedBlock || !checkpoint?.lastProcessedBlockHash) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical LegionNFTV2 indexer has not completed a hash-verified sync for this deployment.', checkpoint: null, paused: false };
    try {
      const provider = providerFactory(manifest);
      const [network, block, latest, runtime] = await Promise.all([provider.getNetwork(), provider.getBlock(Number(checkpoint.lastProcessedBlock)), provider.getBlockNumber(), checkpointRuntimeFields(manifest, provider, [manifest.contractAddress])]);
      if (Number(network.chainId) !== Number(manifest.chainId)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical LegionNFTV2 RPC chain does not match the deployment manifest.', checkpoint: null, paused: false };
      if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical LegionNFTV2 checkpoint block hash does not match the live chain.', checkpoint: null, paused: false };
      if (!checkpointRuntimeMatches(checkpoint, runtime)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical LegionNFTV2 checkpoint runtime identity does not match the live deployment.', checkpoint: null, paused: false };
      if (Number(checkpoint.lastProcessedBlock) < Math.max(0, Number(latest) - REQUIRED_CONFIRMATIONS)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical LegionNFTV2 indexer checkpoint is stale.', checkpoint: null, paused: false };
    } catch { return { available: false, status: 'UNAVAILABLE', reason: 'The canonical LegionNFTV2 checkpoint cannot be verified against the live chain.', checkpoint: null, paused: false }; }
    return { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock, paused: Boolean(checkpoint.paused) };
  };
  const undeployed = (res, data, reason) => res.json({ source: { kind: 'canonical-on-chain', status: 'UNDEPLOYED' }, available: false, status: 'UNDEPLOYED', paused: false, reason, data, page: null });
  const requireAvailable = async (res, manifest, fallback) => { const state = await availability(manifest); if (!state.available) { res.json({ source: source(manifest), ...state, data: fallback, page: null }); return null; } return state; };
  const invalidCursor = (res, error) => res.status(400).json({ status: 'INVALID_REQUEST', message: error.message });
  return {
    status: async (_req, res, next) => { try { const { manifest, error } = context(); if (!manifest) return undeployed(res, null, error.message); res.json({ source: source(manifest), roles: manifest.roles, ...(await availability(manifest)) }); } catch (error) { next(error); } },
    wallet: async (req, res, next) => { try { const wallet = normalizeAddress(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be valid.' }); const { manifest, error } = context(); if (!manifest) return undeployed(res, [], error.message); const state = await requireAvailable(res, manifest, []); if (!state) return; const pageLimit = limit(req.query.limit); const expected = { kind: 'wallet', ...identity(manifest), wallet }; let cursor; try { cursor = decodeCursor(req.query.cursor, expected); } catch (cursorError) { return invalidCursor(res, cursorError); } const records = await models.LegionNFTV2Territory.find({ ...identity(manifest), owner: wallet }).lean(); const page = paginate(records, pageLimit, cursor, (left, right) => compareUint(left.tokenId, right.tokenId), (record) => encodeCursor({ version: 1, ...expected, anchor: { tokenId: canonicalUint(record.tokenId) } })); res.json({ source: source(manifest), ...state, wallet, data: page.data, page: { limit: pageLimit, nextCursor: page.nextCursor } }); } catch (error) { next(error); } },
    territory: async (req, res, next) => { try { if (!tokenId(req.params.tokenId)) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be positive.' }); const { manifest, error } = context(); if (!manifest) return undeployed(res, null, error.message); const state = await requireAvailable(res, manifest, null); if (!state) return; const data = await models.LegionNFTV2Territory.findOne({ ...identity(manifest), tokenId: req.params.tokenId }).lean(); if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(manifest), ...state, data }); } catch (error) { next(error); } },
    history: async (req, res, next) => { try { if (!tokenId(req.params.tokenId)) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be positive.' }); const { manifest, error } = context(); if (!manifest) return undeployed(res, [], error.message); const state = await requireAvailable(res, manifest, []); if (!state) return; const pageLimit = limit(req.query.limit); const expected = { kind: 'history', ...identity(manifest), tokenId: req.params.tokenId }; let cursor; try { cursor = decodeCursor(req.query.cursor, expected); } catch (cursorError) { return invalidCursor(res, cursorError); } const records = await models.LegionNFTV2Event.find({ ...identity(manifest), tokenId: req.params.tokenId, removed: false }).lean(); const page = paginate(records, pageLimit, cursor, compareHistory, (record) => encodeCursor({ version: 1, ...expected, anchor: { blockNumber: canonicalUint(record.blockNumber), transactionIndex: Number(record.transactionIndex), logIndex: Number(record.logIndex), transactionHash: String(record.transactionHash) } })); res.json({ source: source(manifest), ...state, data: page.data, page: { limit: pageLimit, nextCursor: page.nextCursor } }); } catch (error) { next(error); } },
    request: async (req, res, next) => { try { if (!requestId(req.params.requestId)) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Request ID must be positive.' }); const { manifest, error } = context(); if (!manifest) return undeployed(res, null, error.message); const state = await requireAvailable(res, manifest, null); if (!state) return; const data = await models.LegionNFTV2TransferRequest.findOne({ ...identity(manifest), requestId: req.params.requestId }).lean(); if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(manifest), ...state, data }); } catch (error) { next(error); } },
  };
}
module.exports = { createLegionNFTV2ReadController, normalizeAddress, tokenId, compareUint, compareHistory, encodeCursor, decodeCursor, REQUIRED_CONFIRMATIONS };
