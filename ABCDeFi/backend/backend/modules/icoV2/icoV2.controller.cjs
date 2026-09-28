const { Contract, JsonRpcProvider, getAddress, isAddress } = require('ethers');
const { loadIcoV2Manifest } = require('../../config/icoV2Manifest.cjs');
const defaultModels = require('../icoV2Projection/models.cjs');

const ABI = [
  'function lifecycle() view returns (uint8)',
  'function stage(uint8) view returns (uint256 startTime,uint256 endTime,uint256 inventory,uint256 sold,uint256 priceUsdWad)',
  'function totalAllocated() view returns (uint256)',
  'function totalBnbCollected() view returns (uint256)',
  'function totalBnbRefunded() view returns (uint256)',
  'function totalBnbWithdrawn() view returns (uint256)',
  'function tgeTimestamp() view returns (uint256)',
  'function currentStage() view returns (uint8)',
  'function paused() view returns (bool)',
  'function bnbUsdFeed() view returns (address)',
  'function feedDecimals() view returns (uint8)',
  'function maxPriceAge() view returns (uint256)',
  'function communityWallet() view returns (address)',
  'function proceedsRecipient() view returns (address)',
  'function purchaseOf(address) view returns (uint256 allocation,uint256 bnbPaid,uint256 claimed,uint256 stageOneAllocation,uint256 stageTwoAllocation,bool refunded)',
  'function claimable(address) view returns (uint256)',
  'function eligibleWallet(address) view returns (bool)',
];
const json = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(json) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => Number.isNaN(Number(key))).map(([key, item]) => [key, json(item)])) : value;

/**
 * `ICOManagerV2.claimable` is the cumulative amount vested at the current
 * block.  It is intentionally not the amount a buyer can still withdraw:
 * `claim()` transfers only vestedTotal - purchase.claimed.  Keep those two
 * concepts explicit at this canonical read boundary.
 */
function claimability(purchase, vestedTotal) {
  const total = BigInt(vestedTotal);
  const claimed = BigInt(purchase.claimed);
  return {
    vestedTotal: total,
    claimableNow: total > claimed ? total - claimed : 0n,
  };
}

function unavailable(res, reason) {
  return res.status(503).json({ source: 'canonical-ico-v2-on-chain', status: 'UNAVAILABLE', reason, data: null });
}

function createIcoV2Controller({ loadManifest = loadIcoV2Manifest, models = defaultModels, providerFactory = (url) => new JsonRpcProvider(url), contractFactory = (address, provider) => new Contract(address, ABI, provider) } = {}) {
  const indexed = async (manifest, provider) => {
    const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, icoAddress: manifest.address.toLowerCase() };
    const checkpoint = await models.IcoV2Checkpoint.findOne(identity).lean();
    if (!checkpoint) return { identity, checkpoint: null };
    const [block, latest] = await Promise.all([provider.getBlock(Number(checkpoint.lastProcessedBlock)), provider.getBlockNumber()]);
    if (!block || String(block.hash).toLowerCase() !== String(checkpoint.lastProcessedBlockHash).toLowerCase()) throw new Error('Canonical ICO V2 indexer checkpoint does not match the active chain.');
    if (Number(checkpoint.lastProcessedBlock) !== Number(latest)) throw new Error('Canonical ICO V2 indexer checkpoint is stale.');
    return { identity, checkpoint };
  };
  async function contractOrUnavailable(res) {
    const manifest = loadManifest();
    if (!manifest) return { manifest: null, contract: null, response: unavailable(res, 'ICOManagerV2 has not been deployed into the canonical manifest.') };
    if (manifest.contractKind && manifest.contractKind !== 'ICOManagerV2') return { manifest, contract: null, response: unavailable(res, `${manifest.contractKind} requires its canonical read controller; the historical ICO V2 controller is not migrated to 1Q_LOCAL.`) };
    const provider = providerFactory(manifest.rpcUrl);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== manifest.chainId) return { manifest, contract: null, response: unavailable(res, 'ICO V2 RPC is on the wrong chain.') };
    if (await provider.getCode(manifest.address) === '0x') return { manifest, contract: null, response: unavailable(res, 'ICOManagerV2 bytecode is missing at the canonical manifest address.') };
    return { manifest, provider, contract: contractFactory(manifest.address, provider), response: null };
  }

  const aggregates = (events) => events.reduce((result, event) => {
    const args = event.args || {}; const add = (key, value) => { result[key] = (BigInt(result[key]) + BigInt(value || '0')).toString(); };
    if (event.eventName === 'IcoPurchase') { result.purchases += 1; add('purchasedAllocation', args.allocation); add('purchasedBnb', args.bnbPaid); }
    if (event.eventName === 'IcoRefundClaimed') { result.refunds += 1; add('refundedAllocation', args.allocationReversed); add('refundedBnb', args.bnbAmount); }
    if (event.eventName === 'IcoCancelled') result.cancellations += 1;
    if (event.eventName === 'IcoTokensClaimed') { result.claims += 1; add('claimedAbcd', args.amount); }
    if (event.eventName === 'VestingCompleted') result.vestingCompletions += 1;
    return result;
  }, { purchases: 0, purchasedAllocation: '0', purchasedBnb: '0', refunds: 0, refundedAllocation: '0', refundedBnb: '0', cancellations: 0, claims: 0, claimedAbcd: '0', vestingCompletions: 0 });

  const status = async (_req, res, next) => {
    try {
      const { manifest, provider, contract, response } = await contractOrUnavailable(res);
      if (response) return response;
      const projection = await indexed(manifest, provider);
      if (!projection.checkpoint) return unavailable(res, 'Canonical ICO V2 indexer checkpoint is unavailable.');
      const events = await models.IcoV2Event.find(projection.identity).sort({ blockNumber: 1, logIndex: 1 }).lean();
      const [lifecycle, one, two, allocated, collected, refunded, withdrawn, tgeTimestamp, currentStage, paused, feed, feedDecimals, maxPriceAge, communityWallet, proceedsRecipient] = await Promise.all([
        contract.lifecycle(), contract.stage(0), contract.stage(1), contract.totalAllocated(), contract.totalBnbCollected(), contract.totalBnbRefunded(), contract.totalBnbWithdrawn(), contract.tgeTimestamp(), contract.currentStage(), contract.paused(), contract.bnbUsdFeed(), contract.feedDecimals(), contract.maxPriceAge(), contract.communityWallet(), contract.proceedsRecipient(),
      ]);
      return res.json({ source: 'canonical-indexed-on-chain', status: 'AVAILABLE', manifest, checkpoint: projection.checkpoint, data: json({ lifecycle, stages: [one, two], totalAllocated: allocated, totalBnbCollected: collected, totalBnbRefunded: refunded, totalBnbWithdrawn: withdrawn, tgeTimestamp, currentStage, paused, oracle: { feed, feedDecimals, maxPriceAge }, communityWallet, proceedsRecipient, aggregates: aggregates(events) }) });
    } catch (error) { if (/^Canonical ICO V2 indexer checkpoint/.test(error.message || '')) return unavailable(res, error.message); return next(error); }
  };
  const buyer = async (req, res, next) => {
    try {
      if (!isAddress(req.params.address)) return res.status(400).json({ message: 'A valid buyer address is required.' });
      const { manifest, provider, contract, response } = await contractOrUnavailable(res);
      if (response) return response;
      const projection = await indexed(manifest, provider);
      if (!projection.checkpoint) return unavailable(res, 'Canonical ICO V2 indexer checkpoint is unavailable.');
      const address = getAddress(req.params.address);
      const [purchase, vestedTotal, eligibility] = await Promise.all([contract.purchaseOf(address), contract.claimable(address), contract.eligibleWallet(address)]);
      const available = claimability(purchase, vestedTotal);
      const history = await models.IcoV2Event.find({ ...projection.identity, 'args.buyer': address.toLowerCase() }).sort({ blockNumber: 1, logIndex: 1 }).lean();
      return res.json({ source: 'canonical-indexed-on-chain', status: 'AVAILABLE', manifest, checkpoint: projection.checkpoint, data: json({ address, purchase, ...available, eligibility, history }) });
    } catch (error) { if (/^Canonical ICO V2 indexer checkpoint/.test(error.message || '')) return unavailable(res, error.message); return next(error); }
  };
  const history = async (_req, res, next) => { try { const { manifest, provider, response } = await contractOrUnavailable(res); if (response) return response; const projection = await indexed(manifest, provider); if (!projection.checkpoint) return unavailable(res, 'Canonical ICO V2 indexer checkpoint is unavailable.'); const events = await models.IcoV2Event.find(projection.identity).sort({ blockNumber: 1, logIndex: 1 }).lean(); return res.json({ source: 'canonical-indexed-on-chain', status: 'AVAILABLE', manifest, checkpoint: projection.checkpoint, data: json({ events, aggregates: aggregates(events) }) }); } catch (error) { if (/^Canonical ICO V2 indexer checkpoint/.test(error.message || '')) return unavailable(res, error.message); return next(error); } };
  return { status, buyer, history };
}

module.exports = { createIcoV2Controller, claimability };
