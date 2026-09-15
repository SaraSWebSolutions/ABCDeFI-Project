const { getAddress, isAddress } = require('ethers');

const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const normalizeAddress = (value) => typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null;
const validTokenId = (value) => /^\d+$/.test(value) && BigInt(value) > 0n;
const limit = (value, fallback = 50) => { const parsed = value === undefined ? fallback : Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback; };
const source = (manifest) => ({ kind: 'canonical-indexed-on-chain', chainId: String(manifest.chainId), network: manifest.network, deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress });

function createLegionCredentialReadController({ models, manifestLoader }) {
  function context() {
    try { return { manifest: manifestLoader(), error: null }; } catch (error) { return { manifest: null, error }; }
  }
  async function availability(manifest) {
    const checkpoint = await models.LegionCredentialCheckpoint.findOne({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress, scope: 'canonical-legion-credential-v2' }).lean();
    if (!checkpoint?.lastProcessedBlock) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical LegionCredentialV2 event indexer has not completed a confirmed sync for this deployment.', checkpoint: null };
    return { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock };
  }
  async function requireAvailable(res, manifest, fallback) {
    const state = await availability(manifest);
    if (!state.available) { res.json({ source: source(manifest), ...state, data: fallback }); return null; }
    return state;
  }
  function undeployed(res, fallback, reason) { return res.json({ source: { kind: 'canonical-on-chain', status: 'UNDEPLOYED' }, available: false, status: 'UNDEPLOYED', reason, data: fallback }); }

  return {
    status: async (_req, res, next) => { try { const { manifest, error } = context(); if (!manifest) return undeployed(res, null, error.message); res.json({ source: source(manifest), ...(await availability(manifest)) }); } catch (error) { next(error); } },
    wallet: async (req, res, next) => { try {
      const wallet = normalizeAddress(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be a valid Ethereum address.' });
      const { manifest, error } = context(); if (!manifest) return undeployed(res, [], error.message);
      const state = await requireAvailable(res, manifest, []); if (!state) return;
      const data = await models.LegionCredential.find({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress, owner: wallet }).sort({ tokenId: 1 }).limit(limit(req.query.limit)).lean();
      res.json({ source: source(manifest), ...state, wallet, data });
    } catch (error) { next(error); } },
    credential: async (req, res, next) => { try {
      if (!validTokenId(req.params.tokenId)) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' });
      const { manifest, error } = context(); if (!manifest) return undeployed(res, null, error.message);
      const state = await requireAvailable(res, manifest, null); if (!state) return;
      const data = await models.LegionCredential.findOne({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress, tokenId: req.params.tokenId }).lean();
      if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null });
      res.json({ source: source(manifest), ...state, data });
    } catch (error) { next(error); } },
    history: async (req, res, next) => { try {
      if (!validTokenId(req.params.tokenId)) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Token ID must be a positive uint256 decimal string.' });
      const { manifest, error } = context(); if (!manifest) return undeployed(res, [], error.message);
      const state = await requireAvailable(res, manifest, []); if (!state) return;
      const data = await models.LegionCredentialEvent.find({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, contractAddress: manifest.contractAddress, tokenId: req.params.tokenId, removed: false }).sort({ blockNumber: 1, logIndex: 1 }).limit(limit(req.query.limit)).lean();
      res.json({ source: source(manifest), ...state, data });
    } catch (error) { next(error); } },
  };
}

module.exports = { createLegionCredentialReadController, normalizeAddress, validTokenId, lower };
