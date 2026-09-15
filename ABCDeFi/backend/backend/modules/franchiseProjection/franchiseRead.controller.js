const { getAddress, isAddress } = require('ethers');

const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
function normalizeAddress(value) { return typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null; }
function limit(value, fallback = 50) { const parsed = value === undefined ? fallback : Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback; }
function source(manifest) { return { kind: 'canonical-indexed-on-chain', chainId: String(manifest.chainId), network: manifest.network, deploymentVersion: manifest.deploymentVersion, nftAddress: manifest.nftAddress, registryAddress: manifest.registryAddress }; }
function sortHistory(records) { return [...records].sort((left, right) => {
  const blockOrder = BigInt(left.evidence.blockNumber) - BigInt(right.evidence.blockNumber);
  if (blockOrder !== 0n) return blockOrder < 0n ? -1 : 1;
  return Number(left.evidence.logIndex) - Number(right.evidence.logIndex);
}); }
function sortEvents(records) { return [...records].sort((left, right) => {
  const blockOrder = BigInt(left.blockNumber) - BigInt(right.blockNumber);
  if (blockOrder !== 0n) return blockOrder < 0n ? -1 : 1;
  return Number(left.logIndex) - Number(right.logIndex);
}); }

function createFranchiseReadController({ models, manifest }) {
  const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, registryAddress: manifest.registryAddress };
  async function availability() {
    const checkpoint = await models.FranchiseCheckpoint.findOne(identity).lean();
    if (!checkpoint?.lastProcessedBlock) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise event indexer has not completed a confirmed sync for this deployment.', checkpoint: null };
    return { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock };
  }
  async function requireAvailable(res, fallback) { const state = await availability(); if (!state.available) { res.json({ source: source(manifest), ...state, data: fallback }); return null; } return state; }
  return {
    status: async (_req, res, next) => { try { res.json({ source: source(manifest), ...(await availability()) }); } catch (error) { next(error); } },
    events: async (req, res, next) => { try { const state = await requireAvailable(res, []); if (!state) return; const records = await models.FranchiseEvent.find(identity).lean(); res.json({ source: source(manifest), ...state, data: sortEvents(records).slice(0, limit(req.query.limit)) }); } catch (error) { next(error); } },
    wallet: async (req, res, next) => { try { const wallet = normalizeAddress(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be a valid Ethereum address.' }); const state = await requireAvailable(res, []); if (!state) return; const data = await models.FranchiseCertificate.find({ ...identity, owner: wallet }).sort({ tokenId: 1 }).limit(limit(req.query.limit)).lean(); res.json({ source: source(manifest), ...state, wallet, data }); } catch (error) { next(error); } },
    certificate: async (req, res, next) => { try { if (!/^\d+$/.test(req.params.tokenId) || BigInt(req.params.tokenId) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, null); if (!state) return; const data = await models.FranchiseCertificate.findOne({ ...identity, tokenId: req.params.tokenId }).lean(); if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(manifest), ...state, data }); } catch (error) { next(error); } },
    history: async (req, res, next) => { try { if (!/^\d+$/.test(req.params.tokenId) || BigInt(req.params.tokenId) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, []); if (!state) return; const records = await models.FranchiseHistory.find({ ...identity, tokenId: req.params.tokenId }).lean(); const data = sortHistory(records).slice(0, limit(req.query.limit)); res.json({ source: source(manifest), ...state, data }); } catch (error) { next(error); } },
  };
}

module.exports = { createFranchiseReadController, normalizeAddress, sortHistory, sortEvents };
