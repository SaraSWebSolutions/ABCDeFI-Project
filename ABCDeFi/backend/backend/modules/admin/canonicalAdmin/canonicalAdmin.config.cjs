const { loadLendingV2Manifest } = require('../../../config/lendingV2Manifest.cjs');
const { loadIcoV2Manifest } = require('../../../config/icoV2Manifest.cjs');
const { loadLegionNFTV2Manifest } = require('../../../config/legionNFTV2Manifest.cjs');
const { loadFranchiseManifest } = require('../../../config/franchiseManifest.cjs');
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
    attempt('ICO', loadIcoV2Manifest, (m) => [{ ICOManagerV2: { address: m.address, deploymentBlock: m.deploymentBlock } }, ['FINALIZE_CANCEL_PAUSE_WHERE_ROLE_AUTHORIZED']]),
    attempt('Legion', loadLegionNFTV2Manifest, (m) => [{ LegionNFTV2: { address: m.contractAddress, deploymentBlock: m.deploymentBlock } }, ['LEG_44_ONLY', 'READ_ONLY_ROLE_VISIBILITY']]),
    attempt('Franchise', loadFranchiseManifest, (m) => [{ FranchiseNFT: { address: m.nftAddress }, FranchiseRegistry: { address: m.registryAddress, deploymentBlock: m.registryDeploymentBlock } }, ['REGISTRY_CONTROLLED_ONLY', 'READ_ONLY_ROLE_VISIBILITY']]),
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
