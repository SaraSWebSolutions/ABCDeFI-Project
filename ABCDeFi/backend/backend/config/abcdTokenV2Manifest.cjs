const { isAddress } = require('ethers');
const { loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ALLOCATIONS = Object.freeze([
  ['ICO', 'icoWallet'],
  ['FOUNDER', 'founderWallet'],
  ['MARKETING', 'marketingWallet'],
  ['ADVISORS', 'advisorsWallet'],
  ['FINANCE_RESOURCE', 'financeResourceWallet'],
  ['CONTINGENCY', 'contingencyWallet'],
  ['RESERVE', 'reserveWallet'],
]);

const lower = (value) => String(value).toLowerCase();
const validAddress = (value) => isAddress(value) && lower(value) !== ZERO_ADDRESS;

function createABCDTokenV2ManifestLoader({ runtimeLoader = loadBackendRuntimeFamily } = {}) {
  return function loadABCDTokenV2Manifest() {
    const runtime = runtimeLoader();
    // The approved read plane is intentionally local-only. BSC uses a separate,
    // explicit family integration and may not inherit a local token authority.
    if (runtime?.family !== '1Q_LOCAL') throw new Error('ABCDTokenV2 Admin reads require the explicit 1Q_LOCAL runtime family.');
    if (Number(runtime.chainId) !== 31337 || runtime.rpcUrl !== 'http://127.0.0.1:8546' || !runtime.deploymentIdentity) {
      throw new Error('ABCDTokenV2 Admin runtime provenance is invalid.');
    }

    const root = runtime.children?.root;
    const token = root?.contracts?.ABCDTokenV2;
    const canonical = runtime.contracts?.ABCDTokenV2;
    if (!token || !canonical || !validAddress(token.address) || !validAddress(canonical.address)
      || lower(token.address) !== lower(canonical.address) || !Number.isInteger(Number(token.deploymentBlock))) {
      throw new Error('1Q_LOCAL root ABCDTokenV2 deployment binding is invalid.');
    }

    const childNames = ['ico', 'lending', 'marketplace10A', 'marketplace10B'];
    for (const childName of childNames) {
      const childToken = runtime.children?.[childName]?.contracts?.ABCDTokenV2;
      if (!childToken || !validAddress(childToken.address) || lower(childToken.address) !== lower(token.address)) {
        throw new Error(`1Q_LOCAL ${childName} ABCDTokenV2 binding is invalid.`);
      }
    }

    const allocations = ALLOCATIONS.map(([name, getter]) => {
      const entry = root?.allocations?.[name];
      if (!entry || !validAddress(entry.wallet) || !/^\d+$/.test(String(entry.amount)) || !Number.isInteger(Number(entry.bps))) {
        throw new Error(`1Q_LOCAL root ${name} allocation is invalid.`);
      }
      return Object.freeze({ name, getter, wallet: lower(entry.wallet), amount: String(entry.amount), bps: Number(entry.bps) });
    });
    if (allocations.reduce((total, entry) => total + entry.bps, 0) !== 10_000) {
      throw new Error('1Q_LOCAL root allocation basis points are invalid.');
    }

    return Object.freeze({
      runtimeFamily: runtime.family,
      manifestPath: runtime.manifestPath,
      chainId: Number(runtime.chainId),
      rpcUrl: runtime.rpcUrl,
      deploymentIdentity: runtime.deploymentIdentity,
      deploymentVersion: root.deploymentVersion,
      deploymentBlock: Number(token.deploymentBlock),
      tokenAddress: lower(token.address),
      allocations: Object.freeze(allocations),
    });
  };
}

const loadABCDTokenV2Manifest = createABCDTokenV2ManifestLoader();

module.exports = { ALLOCATIONS, createABCDTokenV2ManifestLoader, loadABCDTokenV2Manifest };
