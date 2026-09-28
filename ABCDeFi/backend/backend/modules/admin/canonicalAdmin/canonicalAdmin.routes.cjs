const express = require('express');
const auth = require('../../../middleware/authMiddleware');
const { requireAdmin } = require('../../../middleware/authMiddleware');
const { canonicalAdminModules } = require('./canonicalAdmin.config.cjs');
const { createCanonicalAdminController } = require('./canonicalAdmin.controller.cjs');
const treasuryModels = require('../../treasuryProjection/models.cjs');
const marketplaceModels = require('../../abcdMarketplaceProjection/models.cjs');
const legionMarketplaceModels = require('../../legionMarketplaceProjection/models.cjs');
const legionModels = require('../../legionNFTV2Projection/models.cjs');
const franchiseV2Models = require('../../franchiseV2Projection/models.cjs');
const { loadTreasuryManifest } = require('../../../config/treasuryManifest.cjs');
const { loadABCDMarketplaceManifest } = require('../../../config/abcdMarketplaceManifest.cjs');
const { loadLegionMarketplaceManifest } = require('../../../config/legionMarketplaceManifest.cjs');
const { loadLegionNFTV2Manifest } = require('../../../config/legionNFTV2Manifest.cjs');
const { loadFranchiseV2Manifest } = require('../../../config/franchiseV2Manifest.cjs');
const { loadLendingV2Manifest } = require('../../../config/lendingV2Manifest.cjs');
const lendingModels = require('../../lendingV2Projection/models.cjs');
const { canonicalLendingV2Availability } = require('../../lendingV2Projection/lendingV2Read.controller.cjs');
const { loadIcoV3Manifest } = require('../../../config/icoV3Manifest.cjs');
const icoV3Models = require('../../icoV3Projection/models.cjs');
const { canonicalIcoV3Availability } = require('../../icoV3/icoV3.controller.cjs');

const source = (module, loader, model, identity) => ({
  module,
  read: async () => {
    const manifest = loader();
    return model.find(identity(manifest)).lean();
  },
});

const eventSources = [
  source('ICO', loadIcoV3Manifest, icoV3Models.IcoV3Event, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, runtimeFamily: m.runtimeFamily, rpcUrl: m.rpcUrl, deploymentIdentity: m.deploymentIdentity, icoAddress: m.address })),
  source('Treasury', loadTreasuryManifest, treasuryModels.TreasuryEvent, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, treasuryAddress: m.treasuryAddress })),
  source('Marketplace', loadABCDMarketplaceManifest, marketplaceModels.MarketplaceEvent, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, marketplaceAddress: m.marketplaceAddress })),
  source('Legion Marketplace', loadLegionMarketplaceManifest, legionMarketplaceModels.LegionMarketplaceEvent, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, settlementAddress: m.settlementAddress })),
  source('Legion', loadLegionNFTV2Manifest, legionModels.LegionNFTV2Event, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, contractAddress: m.contractAddress })),
  source('Franchise', loadFranchiseV2Manifest, franchiseV2Models.FranchiseV2Event, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, registryAddress: m.registryAddress, removed: false })),
];

const checkpointSource = (module, loader, model, identity) => ({
  module,
  read: async () => model.findOne(identity(loader())).lean(),
});

const checkpointSources = [
  {
    module: 'ICO',
    read: async () => {
      const manifest = loadIcoV3Manifest();
      const state = await canonicalIcoV3Availability({ manifest, projectionModels: icoV3Models });
      if (!state.available) throw new Error(state.reason || 'Canonical ICO V3 indexer is unavailable.');
      return { lastProcessedBlock: state.checkpoint.lastProcessedBlock, deploymentIdentity: manifest.deploymentIdentity, deploymentVersion: manifest.deploymentVersion, icoAddress: manifest.address, abcdAddress: manifest.abcdAddress };
    },
  },
  {
    module: 'Lending V2',
    read: async () => {
      const manifest = loadLendingV2Manifest();
      const state = await canonicalLendingV2Availability({ manifest, models: lendingModels });
      if (!state.available) throw new Error(state.reason || 'Canonical Lending V2 indexer is unavailable.');
      return {
        lastProcessedBlock: state.checkpoint,
        deploymentIdentity: manifest.deploymentIdentity,
        deploymentVersion: manifest.deploymentVersion,
        lendingPoolAddress: manifest.contracts.LendingPoolV2.address,
      };
    },
  },
  checkpointSource('Treasury', loadTreasuryManifest, treasuryModels.TreasuryCheckpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, treasuryAddress: m.treasuryAddress })),
  checkpointSource('Marketplace', loadABCDMarketplaceManifest, marketplaceModels.MarketplaceCheckpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, marketplaceAddress: m.marketplaceAddress })),
  checkpointSource('Legion Marketplace', loadLegionMarketplaceManifest, legionMarketplaceModels.LegionMarketplaceCheckpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, settlementAddress: m.settlementAddress })),
  checkpointSource('Legion', loadLegionNFTV2Manifest, legionModels.LegionNFTV2Checkpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, contractAddress: m.contractAddress, scope: 'canonical-legion-nft-v2' })),
  checkpointSource('Franchise', loadFranchiseV2Manifest, franchiseV2Models.FranchiseV2Checkpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, registryAddress: m.registryAddress, scope: 'canonical-franchise-v2-legion-bound' })),
];

const controller = createCanonicalAdminController({ moduleRegistry: canonicalAdminModules, eventSources, checkpointSources });
const router = express.Router();
router.get('/status', auth, requireAdmin, controller.status);
router.get('/history', auth, requireAdmin, controller.history);
module.exports = router;
