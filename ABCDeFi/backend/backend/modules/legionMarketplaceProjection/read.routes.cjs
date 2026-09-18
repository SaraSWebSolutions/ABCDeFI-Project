const express = require('express');
const models = require('./models.cjs');
const { loadLegionMarketplaceManifest } = require('../../config/legionMarketplaceManifest.cjs');
const { createLegionMarketplaceReadController } = require('./read.controller.cjs');
const router = express.Router();
let controller; let reason;
try { controller = createLegionMarketplaceReadController({ models, manifest: loadLegionMarketplaceManifest() }); } catch (error) { reason = error.message; }
const unavailable = (_req, res) => res.status(503).json({ source: { kind: 'canonical-indexed-on-chain' }, available: false, status: 'UNAVAILABLE', reason: reason || 'Canonical Legion marketplace configuration is unavailable.', data: [] });
router.get('/status', controller?.status || unavailable);
router.get('/sales/active', controller?.active || unavailable);
router.get('/sales/:saleId', controller?.sale || unavailable);
router.get('/sellers/:address/sales', controller?.seller || unavailable);
router.get('/history', controller?.history || unavailable);
module.exports = router;
