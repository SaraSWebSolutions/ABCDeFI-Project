const { Contract, JsonRpcProvider, getAddress, isAddress } = require('ethers');
const { loadIcoV2Manifest } = require('../../config/icoV2Manifest.cjs');

const ABI = [
  'function lifecycle() view returns (uint8)',
  'function stage(uint8) view returns (uint256 startTime,uint256 endTime,uint256 inventory,uint256 sold,uint256 priceUsdWad)',
  'function totalAllocated() view returns (uint256)',
  'function totalBnbCollected() view returns (uint256)',
  'function totalBnbRefunded() view returns (uint256)',
  'function tgeTimestamp() view returns (uint256)',
  'function communityWallet() view returns (address)',
  'function treasury() view returns (address)',
  'function purchaseOf(address) view returns (uint256 allocation,uint256 bnbPaid,uint256 claimed,bool refunded)',
  'function claimable(address) view returns (uint256)',
];
const json = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(json) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => Number.isNaN(Number(key))).map(([key, item]) => [key, json(item)])) : value;

function unavailable(res, reason) {
  return res.status(503).json({ source: 'canonical-ico-v2-on-chain', status: 'UNAVAILABLE', reason, data: null });
}

function createIcoV2Controller({ loadManifest = loadIcoV2Manifest } = {}) {
  async function contractOrUnavailable(res) {
    const manifest = loadManifest();
    if (!manifest) return { manifest: null, contract: null, response: unavailable(res, 'ICOManagerV2 has not been deployed into the canonical manifest.') };
    const provider = new JsonRpcProvider(manifest.rpcUrl);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== manifest.chainId) return { manifest, contract: null, response: unavailable(res, 'ICO V2 RPC is on the wrong chain.') };
    if (await provider.getCode(manifest.address) === '0x') return { manifest, contract: null, response: unavailable(res, 'ICOManagerV2 bytecode is missing at the canonical manifest address.') };
    return { manifest, contract: new Contract(manifest.address, ABI, provider), response: null };
  }

  const status = async (_req, res, next) => {
    try {
      const { manifest, contract, response } = await contractOrUnavailable(res);
      if (response) return response;
      const [lifecycle, one, two, allocated, collected, refunded, tgeTimestamp, communityWallet, treasury] = await Promise.all([
        contract.lifecycle(), contract.stage(0), contract.stage(1), contract.totalAllocated(), contract.totalBnbCollected(), contract.totalBnbRefunded(), contract.tgeTimestamp(), contract.communityWallet(), contract.treasury(),
      ]);
      return res.json({ source: 'canonical-ico-v2-on-chain', status: 'AVAILABLE', manifest, data: json({ lifecycle, stages: [one, two], totalAllocated: allocated, totalBnbCollected: collected, totalBnbRefunded: refunded, tgeTimestamp, communityWallet, treasury }) });
    } catch (error) { return next(error); }
  };
  const buyer = async (req, res, next) => {
    try {
      if (!isAddress(req.params.address)) return res.status(400).json({ message: 'A valid buyer address is required.' });
      const { manifest, contract, response } = await contractOrUnavailable(res);
      if (response) return response;
      const address = getAddress(req.params.address);
      const [purchase, claimable] = await Promise.all([contract.purchaseOf(address), contract.claimable(address)]);
      return res.json({ source: 'canonical-ico-v2-on-chain', status: 'AVAILABLE', manifest, data: json({ address, purchase, claimable }) });
    } catch (error) { return next(error); }
  };
  return { status, buyer };
}

module.exports = { createIcoV2Controller };
