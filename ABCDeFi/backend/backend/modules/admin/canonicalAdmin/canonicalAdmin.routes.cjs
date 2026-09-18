const express = require('express');
const auth = require('../../../middleware/authMiddleware');
const { requireAdmin } = require('../../../middleware/authMiddleware');
const { canonicalAdminModules } = require('./canonicalAdmin.config.cjs');
const { createCanonicalAdminController } = require('./canonicalAdmin.controller.cjs');
const treasuryModels = require('../../treasuryProjection/models.cjs');
const marketplaceModels = require('../../abcdMarketplaceProjection/models.cjs');
const legionMarketplaceModels = require('../../legionMarketplaceProjection/models.cjs');
const legionModels = require('../../legionNFTV2Projection/models.cjs');
const franchiseModels = require('../../franchiseProjection/models.js');
const { loadTreasuryManifest } = require('../../../config/treasuryManifest.cjs');
const { loadABCDMarketplaceManifest } = require('../../../config/abcdMarketplaceManifest.cjs');
const { loadLegionMarketplaceManifest } = require('../../../config/legionMarketplaceManifest.cjs');
const { loadLegionNFTV2Manifest } = require('../../../config/legionNFTV2Manifest.cjs');
const { loadFranchiseManifest } = require('../../../config/franchiseManifest.cjs');

const source = (module, loader, model, identity) => ({
  module,
  read: async () => {
    const manifest = loader();
    return model.find(identity(manifest)).lean();
  },
});

const eventSources = [
  source('Treasury', loadTreasuryManifest, treasuryModels.TreasuryEvent, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, treasuryAddress: m.treasuryAddress })),
  source('Marketplace', loadABCDMarketplaceManifest, marketplaceModels.MarketplaceEvent, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, marketplaceAddress: m.marketplaceAddress })),
  source('Legion Marketplace', loadLegionMarketplaceManifest, legionMarketplaceModels.LegionMarketplaceEvent, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, settlementAddress: m.settlementAddress })),
  source('Legion', loadLegionNFTV2Manifest, legionModels.LegionNFTV2Event, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, contractAddress: m.contractAddress })),
  source('Franchise', loadFranchiseManifest, franchiseModels.FranchiseEvent, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, registryAddress: m.registryAddress })),
];

const checkpointSource = (module, loader, model, identity) => ({
  module,
  read: async () => model.findOne(identity(loader())).lean(),
});

const checkpointSources = [
  checkpointSource('Treasury', loadTreasuryManifest, treasuryModels.TreasuryCheckpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, treasuryAddress: m.treasuryAddress })),
  checkpointSource('Marketplace', loadABCDMarketplaceManifest, marketplaceModels.MarketplaceCheckpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, marketplaceAddress: m.marketplaceAddress })),
  checkpointSource('Legion Marketplace', loadLegionMarketplaceManifest, legionMarketplaceModels.LegionMarketplaceCheckpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, settlementAddress: m.settlementAddress })),
  checkpointSource('Legion', loadLegionNFTV2Manifest, legionModels.LegionNFTV2Checkpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, contractAddress: m.contractAddress, scope: 'canonical' })),
  checkpointSource('Franchise', loadFranchiseManifest, franchiseModels.FranchiseCheckpoint, (m) => ({ chainId: String(m.chainId), deploymentVersion: m.deploymentVersion, registryAddress: m.registryAddress })),
];

const controller = createCanonicalAdminController({ moduleRegistry: canonicalAdminModules, eventSources, checkpointSources });
const router = express.Router();
router.get('/status', auth, requireAdmin, controller.status);
router.get('/history', auth, requireAdmin, controller.history);
module.exports = router;
