const { getAddress, isAddress } = require('ethers');

const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
function normalizeAddress(value) { return typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null; }
function limit(value, fallback = 50) { const parsed = value === undefined ? fallback : Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback; }
function source(manifest) { return { kind: 'canonical-indexed-on-chain', chainId: String(manifest.chainId), network: manifest.network, deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress }; }

function createFranchiseReadController({ models, manifest }) {
  const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress };
  async function availability() {
    const checkpoint = await models.FranchiseCheckpoint.findOne(identity).lean();
    if (!checkpoint?.lastProcessedBlock) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Franchise event indexer has not completed a confirmed sync for this deployment.', checkpoint: null };
    return { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock };
  }
  async function requireAvailable(res, fallback) { const state = await availability(); if (!state.available) { res.json({ source: source(manifest), ...state, data: fallback }); return null; } return state; }
  return {
    status: async (_req, res, next) => { try { res.json({ source: source(manifest), ...(await availability()) }); } catch (error) { next(error); } },
    wallet: async (req, res, next) => { try { const wallet = normalizeAddress(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be a valid Ethereum address.' }); const state = await requireAvailable(res, []); if (!state) return; const data = await models.FranchiseCertificate.find({ chainId: identity.chainId, contractAddress: manifest.contractAddress, owner: wallet }).sort({ tokenId: 1 }).limit(limit(req.query.limit)).lean(); res.json({ source: source(manifest), ...state, wallet, data }); } catch (error) { next(error); } },
    certificate: async (req, res, next) => { try { if (!/^\d+$/.test(req.params.tokenId) || BigInt(req.params.tokenId) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, null); if (!state) return; const data = await models.FranchiseCertificate.findOne({ chainId: identity.chainId, contractAddress: manifest.contractAddress, tokenId: req.params.tokenId }).lean(); if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(manifest), ...state, data }); } catch (error) { next(error); } },
    history: async (req, res, next) => { try { if (!/^\d+$/.test(req.params.tokenId) || BigInt(req.params.tokenId) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, []); if (!state) return; const data = await models.FranchiseHistory.find({ chainId: identity.chainId, contractAddress: manifest.contractAddress, tokenId: req.params.tokenId }).sort({ 'evidence.blockNumber': 1, 'evidence.logIndex': 1 }).limit(limit(req.query.limit)).lean(); res.json({ source: source(manifest), ...state, data }); } catch (error) { next(error); } },
  };
}

module.exports = { createFranchiseReadController, normalizeAddress };
