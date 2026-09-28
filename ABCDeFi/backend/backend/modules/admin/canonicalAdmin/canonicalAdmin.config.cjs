const { loadLendingV2Manifest } = require('../../../config/lendingV2Manifest.cjs');
const { loadIcoV3Manifest } = require('../../../config/icoV3Manifest.cjs');
const { loadLegionNFTV2Manifest } = require('../../../config/legionNFTV2Manifest.cjs');
const { loadFranchiseV2Manifest } = require('../../../config/franchiseV2Manifest.cjs');
const { loadABCDMarketplaceManifest } = require('../../../config/abcdMarketplaceManifest.cjs');
const { loadLegionMarketplaceManifest } = require('../../../config/legionMarketplaceManifest.cjs');
const { loadTreasuryManifest } = require('../../../config/treasuryManifest.cjs');

const unavailable = (name, error) => ({
  name,
  available: false,
  status: 'UNAVAILABLE',
  reason: error instanceof Error ? error.message : String(error),
  source: { kind: 'canonical-manifest' },
});

const configured = (name, manifest, contracts, capabilities) => ({
  name,
  available: true,
  status: 'CONFIGURED',
  source: {
    kind: 'canonical-manifest', chainId: String(manifest.chainId), network: manifest.network,
    deploymentVersion: manifest.deploymentVersion, deploymentBlock: String(manifest.deploymentBlock),
    ...(manifest.deploymentIdentity ? { deploymentIdentity: manifest.deploymentIdentity } : {}),
  },
  contracts,
  capabilities,
});

function attempt(name, loader, map) {
  try {
    const manifest = loader();
    if (!manifest) return unavailable(name, 'No explicitly deployed canonical manifest exists.');
    return configured(name, manifest, ...map(manifest));
  } catch (error) {
    return unavailable(name, error);
  }
}

function canonicalAdminModules() {
  const lending = attempt('Lending V2', loadLendingV2Manifest, (m) => [m.contracts, ['READ_ONLY_ROLE_VISIBILITY']]);
  const lendingContracts = lending.contracts || {};
  const loanNfts = lending.available
    ? configured('Loan NFTs', { chainId: lending.source.chainId, network: lending.source.network, deploymentVersion: lending.source.deploymentVersion, deploymentBlock: lending.source.deploymentBlock }, { LoanNFTV2: lendingContracts.LoanNFTV2 || null }, ['READ_ONLY_ROLE_VISIBILITY'])
    : unavailable('Loan NFTs', lending.reason || 'Lending V2 manifest is unavailable.');
  return [
    attempt('P2P', loadLendingV2Manifest, (m) => [{ LoanMarketplaceV2: m.contracts.LoanMarketplaceV2, EMIManagerV2: m.contracts.EMIManagerV2 }, ['READ_ONLY_ROLE_VISIBILITY']]),
    lending,
    loanNfts,
    attempt('ICO', loadIcoV3Manifest, (m) => [{ ICOManagerV3: { address: m.address, deploymentBlock: m.deploymentBlock }, ABCDTokenV2: { address: m.abcdAddress } }, ['READ_ONLY_ROLE_VISIBILITY']]),
    attempt('Legion', loadLegionNFTV2Manifest, (m) => [{ LegionNFTV2: { address: m.contractAddress, deploymentBlock: m.deploymentBlock } }, ['LEG_44_ONLY', 'READ_ONLY_ROLE_VISIBILITY']]),
    attempt('Franchise', loadFranchiseV2Manifest, (m) => [{ FranchiseNFTV2: { address: m.nftAddress, deploymentBlock: m.nftDeploymentBlock }, FranchiseRegistryV2: { address: m.registryAddress, deploymentBlock: m.registryDeploymentBlock }, LegionNFTV2: { address: m.legionAddress, deploymentBlock: m.legionDeploymentBlock } }, ['LEGION_BOUND_REGISTRY_CONTROLLED_ONLY', 'READ_ONLY_ROLE_VISIBILITY']]),
    attempt('Marketplace', loadABCDMarketplaceManifest, (m) => [{ ABCDNFTMarketplaceV2: { address: m.marketplaceAddress, deploymentBlock: m.deploymentBlock }, ABCDToken: { address: m.abcdAddress } }, ['COLLECTION_CONFIGURE_OR_PAUSE_WHERE_ROLE_AUTHORIZED']]),
    attempt('Legion Marketplace', loadLegionMarketplaceManifest, (m) => [{ LegionMarketplaceSettlementAdapterV2: { address: m.settlementAddress, deploymentBlock: m.deploymentBlock }, LegionNFTV2: { address: m.legionAddress }, ABCDToken: { address: m.abcdAddress } }, ['TARGETED_SETTLEMENT_ONLY', 'READ_ONLY_ROLE_VISIBILITY']]),
    attempt('Treasury', loadTreasuryManifest, (m) => [{ TreasuryV2: { address: m.treasuryAddress, deploymentBlock: m.deploymentBlock }, ABCDToken: { address: m.abcdAddress } }, ['CONFIGURED_ASSET_FUNDER_RECIPIENT_OPERATOR_PAUSE_ONLY']]),
    attempt('Reserve', loadLendingV2Manifest, (m) => [{ InsuranceReserveV2: m.contracts.InsuranceReserveV2 }, ['LOCAL_RESERVE_ROLE_ONLY']]),
    {
      name: 'Fees + Referral', available: false, status: 'UNAVAILABLE',
      reason: 'No independent canonical Phase 12 fee/referral administration surface is approved.',
      source: { kind: 'locked-phase-boundary' }, capabilities: [],
    },
  ];
}

module.exports = { canonicalAdminModules };
