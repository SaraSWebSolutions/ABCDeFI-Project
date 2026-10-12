const { Contract, JsonRpcProvider, getAddress, isAddress } = require('ethers');
const { loadIcoV3Manifest } = require('../../config/icoV3Manifest.cjs');
const models = require('../icoV3Projection/models.cjs');
const { projectionRuntimeFields, checkpointRuntimeFields, checkpointRuntimeMatches } = require('../../config/projectionRuntimeContext.cjs');
// The canonical V3 read surface intentionally exposes only contract state.  It
// never derives sale economics or lifecycle values in MongoDB.
const ABI = [
  'function abcd() view returns (address)',
  'function icoWallet() view returns (address)',
  'function proceedsRecipient() view returns (address)',
  'function bnbUsdFeed() view returns (address)',
  'function feedDecimals() view returns (uint8)',
  'function maxPriceAge() view returns (uint256)',
  'function deploymentInventory() view returns (uint256)',
  'function lifecycle() view returns (uint8)',
  'function tgeTimestamp() view returns (uint256)',
  'function totalAllocated() view returns (uint256)',
  'function totalBnbCollected() view returns (uint256)',
  'function totalBnbRefunded() view returns (uint256)',
  'function totalBnbWithdrawn() view returns (uint256)',
  'function paused() view returns (bool)',
  'function currentStage() view returns (uint8)',
  'function stage(uint8) view returns (uint256 startTime,uint256 endTime,uint256 inventory,uint256 sold,uint256 priceUsdWad)',
  'function purchaseOf(address) view returns (uint256 allocation,uint256 bnbPaid,uint256 claimed,uint256 stageOneAllocation,uint256 stageTwoAllocation,bool refunded)',
  'function claimable(address) view returns (uint256)',
  'function eligibleWallet(address) view returns (bool)',
];
const FEED_ABI = ['function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)'];
const json = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(json) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => Number.isNaN(Number(key))).map(([key, item]) => [key, json(item)])) : value;
// ethers Result is array-like. Keep the public API schema explicit so the
// canonical UI never receives positional purchase fields.
const purchaseRead = (purchase) => ({ allocation: purchase.allocation, bnbPaid: purchase.bnbPaid, claimed: purchase.claimed, stageOneAllocation: purchase.stageOneAllocation, stageTwoAllocation: purchase.stageTwoAllocation, refunded: purchase.refunded });
const unavailable = (res, reason) => res.status(503).json({ source: 'canonical-ico-v3-on-chain', status: 'UNAVAILABLE', reason, data: null });
async function canonicalIcoV3Availability({ manifest = loadIcoV3Manifest(), projectionModels = models, providerFactory = (url) => new JsonRpcProvider(url), contractFactory = (address, provider) => new Contract(address, ABI, provider) } = {}) {
  try {
    if (manifest.runtimeFamily !== '1Q_LOCAL' || !manifest.deploymentIdentity) throw new Error('Canonical ICO V3 requires an explicit 1Q_LOCAL deployment identity.');
    const provider = providerFactory(manifest.rpcUrl);
    const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, ...projectionRuntimeFields(manifest), icoAddress: manifest.address };
    const checkpoint = await projectionModels.IcoV3Checkpoint.findOne(identity).lean();
    if (!checkpoint?.lastProcessedBlock || !checkpoint.lastProcessedBlockHash) throw new Error('Canonical ICO V3 indexer checkpoint is unavailable.');
    const [network, code, token, block, latest, runtime] = await Promise.all([provider.getNetwork(), provider.getCode(manifest.address), contractFactory(manifest.address, provider).abcd(), provider.getBlock(Number(checkpoint.lastProcessedBlock)), provider.getBlockNumber(), checkpointRuntimeFields(manifest, provider, [manifest.address, manifest.abcdAddress])]);
    if (Number(network.chainId) !== Number(manifest.chainId) || code === '0x' || String(token).toLowerCase() !== manifest.abcdAddress || !block || String(block.hash).toLowerCase() !== String(checkpoint.lastProcessedBlockHash).toLowerCase() || !checkpointRuntimeMatches(checkpoint, runtime) || Number(checkpoint.lastProcessedBlock) < Number(latest)) throw new Error('Canonical ICO V3 checkpoint does not match the active 1Q deployment.');
    return { available: true, identity, checkpoint, provider };
  } catch (error) { return { available: false, reason: error instanceof Error ? error.message : String(error) }; }
}
function createIcoV3Controller({ loadManifest = loadIcoV3Manifest, projectionModels = models, providerFactory = (url) => new JsonRpcProvider(url), contractFactory = (address, provider) => new Contract(address, ABI, provider), feedFactory = (address, provider) => new Contract(address, FEED_ABI, provider) } = {}) {
  const context = async (res) => { try { const manifest = loadManifest(); const projection = await canonicalIcoV3Availability({ manifest, projectionModels, providerFactory, contractFactory }); if (!projection.available) throw new Error(projection.reason); return { manifest, provider: projection.provider, contract: contractFactory(manifest.address, projection.provider), projection }; } catch (error) { unavailable(res, error.message); return null; } };
  return {
    status: async (_req, res, next) => {
      try {
        const current = await context(res); if (!current) return;
        const [lifecycle, totalAllocated, totalBnbCollected, totalBnbRefunded, totalBnbWithdrawn, deploymentInventory, tgeTimestamp, paused, currentStage, stageOne, stageTwo, icoWallet, proceedsRecipient, bnbUsdFeed, feedDecimals, maxPriceAge] = await Promise.all([
          current.contract.lifecycle(), current.contract.totalAllocated(), current.contract.totalBnbCollected(), current.contract.totalBnbRefunded(), current.contract.totalBnbWithdrawn(), current.contract.deploymentInventory(), current.contract.tgeTimestamp(), current.contract.paused(), current.contract.currentStage(), current.contract.stage(0), current.contract.stage(1), current.contract.icoWallet(), current.contract.proceedsRecipient(), current.contract.bnbUsdFeed(), current.contract.feedDecimals(), current.contract.maxPriceAge(),
        ]);
        const feed = feedFactory(bnbUsdFeed, current.provider);
        const round = await feed.latestRoundData();
        res.json({ source: 'canonical-indexed-on-chain', status: 'AVAILABLE', manifest: current.manifest, checkpoint: current.projection.checkpoint, data: json({ lifecycle, totalAllocated, totalBnbCollected, totalBnbRefunded, totalBnbWithdrawn, deploymentInventory, tgeTimestamp, paused, currentStage, stages: [stageOne, stageTwo], custody: { icoWallet, proceedsRecipient }, oracle: { feed: bnbUsdFeed, feedDecimals, maxPriceAge, roundId: round.roundId, answer: round.answer, updatedAt: round.updatedAt, answeredInRound: round.answeredInRound } }) });
      } catch (error) { next(error); }
    },
    buyer: async (req, res, next) => { try { if (!isAddress(req.params.address)) return res.status(400).json({ message: 'A valid buyer address is required.' }); const current = await context(res); if (!current) return; const address = getAddress(req.params.address); const [purchase, vestedTotal, eligibility, history] = await Promise.all([current.contract.purchaseOf(address), current.contract.claimable(address), current.contract.eligibleWallet(address), projectionModels.IcoV3Event.find({ ...current.projection.identity, 'args.buyer': address.toLowerCase() }).sort({ blockNumber: 1, logIndex: 1 }).lean()]); const claimed = BigInt(purchase.claimed); const total = BigInt(vestedTotal); res.json({ source: 'canonical-indexed-on-chain', status: 'AVAILABLE', manifest: current.manifest, checkpoint: current.projection.checkpoint, data: json({ address, purchase: purchaseRead(purchase), vestedTotal: total, claimed, claimableNow: total > claimed ? total - claimed : 0n, eligibility, history }) }); } catch (error) { next(error); } },
    history: async (_req, res, next) => { try { const current = await context(res); if (!current) return; const events = await projectionModels.IcoV3Event.find(current.projection.identity).sort({ blockNumber: 1, logIndex: 1 }).lean(); res.json({ source: 'canonical-indexed-on-chain', status: 'AVAILABLE', manifest: current.manifest, checkpoint: current.projection.checkpoint, data: { events } }); } catch (error) { next(error); } },
  };
}
module.exports = { createIcoV3Controller, purchaseRead, canonicalIcoV3Availability };
