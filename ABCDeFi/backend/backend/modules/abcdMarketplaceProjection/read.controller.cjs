const { Contract, JsonRpcProvider, isAddress } = require('ethers');
const { projectionRuntimeFields, checkpointRuntimeFields, checkpointRuntimeMatches } = require('../../config/projectionRuntimeContext.cjs');
const marketplaceArtifact = require('../../../../artifacts/contracts/marketplace/ABCDNFTMarketplaceV2.sol/ABCDNFTMarketplaceV2.json');
const limit = (value, fallback = 50) => { const number = value === undefined ? fallback : Number(value); return Number.isInteger(number) && number > 0 ? Math.min(number, 100) : fallback; };
const sort = (records) => [...records].sort((a, b) => BigInt(a.blockNumber || a.latestEvidence?.blockNumber || 0) === BigInt(b.blockNumber || b.latestEvidence?.blockNumber || 0) ? Number(a.logIndex ?? a.latestEvidence?.logIndex ?? 0) - Number(b.logIndex ?? b.latestEvidence?.logIndex ?? 0) : BigInt(a.blockNumber || a.latestEvidence?.blockNumber || 0) < BigInt(b.blockNumber || b.latestEvidence?.blockNumber || 0) ? -1 : 1);
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const encodeCursor = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decodeCursor = (value) => {
  if (!value || typeof value !== 'string') return null;
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { throw new Error('cursor must be a valid marketplace continuation cursor.'); }
};
function createMarketplaceReadController({ models, manifest, providerFactory = (value) => new JsonRpcProvider(value.rpcUrl), marketplaceFactory = (address, provider) => new Contract(address, marketplaceArtifact.abi, provider) }) {
  const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, ...projectionRuntimeFields(manifest), marketplaceAddress: manifest.marketplaceAddress };
  const source = { kind: 'canonical-indexed-on-chain', chainId: String(manifest.chainId), network: manifest.network, deploymentVersion: manifest.deploymentVersion, marketplaceAddress: manifest.marketplaceAddress, abcdAddress: manifest.abcdAddress };
  const unavailable = (reason) => ({ available: false, status: 'UNAVAILABLE', reason, checkpoint: null });
  const page = (records, query, kind, compare, cursorValue) => {
    const requested = decodeCursor(query.cursor);
    if (requested && (requested.kind !== kind || requested.chainId !== identity.chainId || requested.deploymentVersion !== identity.deploymentVersion || lower(requested.marketplaceAddress) !== lower(identity.marketplaceAddress))) throw new Error('cursor does not belong to this canonical marketplace deployment.');
    const ordered = [...records].sort(compare);
    const after = requested ? ordered.filter((record) => compare(record, requested.value) > 0) : ordered;
    const size = limit(query.limit);
    const data = after.slice(0, size);
    const hasMore = after.length > data.length;
    return {
      data,
      pagination: {
        limit: size,
        nextCursor: hasMore ? encodeCursor({ kind, ...identity, value: cursorValue(data[data.length - 1]) }) : null,
      },
    };
  };
  const listingCompare = (a, b) => BigInt(a.listingId) === BigInt(b.listingId) ? 0 : BigInt(a.listingId) < BigInt(b.listingId) ? -1 : 1;
  const collectionCompare = (a, b) => lower(a.collection).localeCompare(lower(b.collection));
  const eventCompare = (a, b) => {
    const byBlock = BigInt(a.blockNumber) === BigInt(b.blockNumber) ? 0 : BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : 1;
    if (byBlock) return byBlock;
    const byLog = Number(a.logIndex) - Number(b.logIndex);
    return byLog || lower(a.transactionHash).localeCompare(lower(b.transactionHash));
  };
  const available = async () => {
    const checkpoint = await models.MarketplaceCheckpoint.findOne(identity).lean();
    if (!checkpoint?.lastProcessedBlock || !checkpoint?.lastProcessedBlockHash) return unavailable('The canonical ABCD marketplace indexer has not completed a hash-verified sync for this deployment.');
    try {
      const provider = providerFactory(manifest);
      const [network, code, block, latest, runtime] = await Promise.all([
        provider.getNetwork(),
        provider.getCode(manifest.marketplaceAddress),
        provider.getBlock(Number(checkpoint.lastProcessedBlock)),
        provider.getBlockNumber(),
        checkpointRuntimeFields(manifest, provider, [manifest.marketplaceAddress, manifest.abcdAddress]),
      ]);
      if (Number(network.chainId) !== Number(manifest.chainId)) return unavailable('The canonical ABCD marketplace RPC chain does not match the deployment manifest.');
      if (code === '0x' || code === '0x0') return unavailable('Canonical ABCD marketplace bytecode is unavailable on the active chain.');
      if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) return unavailable('The canonical ABCD marketplace checkpoint block hash does not match the live chain.');
      if (!checkpointRuntimeMatches(checkpoint, runtime)) return unavailable('The canonical ABCD marketplace checkpoint runtime identity does not match the live deployment.');
      if (Number(checkpoint.lastProcessedBlock) < Number(latest)) return unavailable('The canonical ABCD marketplace indexer checkpoint is stale.');
      const token = await marketplaceFactory(manifest.marketplaceAddress, provider).abcdToken();
      if (lower(token) !== lower(manifest.abcdAddress)) return unavailable('The canonical ABCD marketplace binding does not match the deployment manifest.');
      return { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock };
    } catch {
      return unavailable('The canonical ABCD marketplace checkpoint cannot be verified against the live chain.');
    }
  };
  const guard = async (res, fallback) => { const state = await available(); if (!state.available) { res.json({ source, ...state, data: fallback }); return null; } return state; };
  return {
    status: async (_req, res, next) => { try { res.json({ source, ...(await available()) }); } catch (error) { next(error); } },
    collections: async (req, res, next) => { try { const state = await guard(res, []); if (!state) return; const result = page(await models.MarketplaceCollection.find(identity).lean(), req.query, 'collections', collectionCompare, (record) => ({ collection: lower(record.collection) })); res.json({ source, ...state, ...result }); } catch (error) { if (/cursor/.test(error.message)) return res.status(400).json({ status: 'INVALID_REQUEST', message: error.message }); next(error); } },
    active: async (req, res, next) => { try { const state = await guard(res, []); if (!state) return; const result = page(await models.MarketplaceListing.find({ ...identity, status: 'ACTIVE' }).lean(), req.query, 'active-listings', listingCompare, (record) => ({ listingId: record.listingId })); res.json({ source, ...state, ...result }); } catch (error) { if (/cursor/.test(error.message)) return res.status(400).json({ status: 'INVALID_REQUEST', message: error.message }); next(error); } },
    listing: async (req, res, next) => { try { if (!/^\d+$/.test(req.params.listingId) || BigInt(req.params.listingId) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'listingId must be a positive uint256 decimal string.' }); const state = await guard(res, null); if (!state) return; const data = await models.MarketplaceListing.findOne({ ...identity, listingId: req.params.listingId }).lean(); if (!data) return res.status(404).json({ source, ...state, status: 'NOT_FOUND', data: null }); res.json({ source, ...state, data }); } catch (error) { next(error); } },
    token: async (req, res, next) => { try { if (!isAddress(req.params.collection) || !/^\d+$/.test(req.params.tokenId)) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'collection and tokenId are invalid.' }); const state = await guard(res, []); if (!state) return; const result = page(await models.MarketplaceListing.find({ ...identity, collection: req.params.collection.toLowerCase(), tokenId: req.params.tokenId }).lean(), req.query, 'collection-token-listings', listingCompare, (record) => ({ listingId: record.listingId })); res.json({ source, ...state, ...result }); } catch (error) { if (/cursor/.test(error.message)) return res.status(400).json({ status: 'INVALID_REQUEST', message: error.message }); next(error); } },
    seller: async (req, res, next) => { try { if (!isAddress(req.params.address)) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'seller must be a valid address.' }); const state = await guard(res, []); if (!state) return; const result = page(await models.MarketplaceListing.find({ ...identity, seller: req.params.address.toLowerCase() }).lean(), req.query, 'seller-listings', listingCompare, (record) => ({ listingId: record.listingId })); res.json({ source, ...state, ...result }); } catch (error) { if (/cursor/.test(error.message)) return res.status(400).json({ status: 'INVALID_REQUEST', message: error.message }); next(error); } },
    history: async (req, res, next) => { try { const state = await guard(res, []); if (!state) return; const result = page(await models.MarketplaceEvent.find(identity).lean(), req.query, 'history', eventCompare, (record) => ({ blockNumber: record.blockNumber, logIndex: record.logIndex, transactionHash: lower(record.transactionHash) })); res.json({ source, ...state, ...result }); } catch (error) { if (/cursor/.test(error.message)) return res.status(400).json({ status: 'INVALID_REQUEST', message: error.message }); next(error); } },
  };
}
module.exports = { createMarketplaceReadController };
