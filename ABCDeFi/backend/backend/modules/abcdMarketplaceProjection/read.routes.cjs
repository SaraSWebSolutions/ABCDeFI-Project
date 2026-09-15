const express = require('express');
const models = require('./models.cjs');
const { loadABCDMarketplaceManifest } = require('../../config/abcdMarketplaceManifest.cjs');
const { createMarketplaceReadController } = require('./read.controller.cjs');
const router = express.Router();
let controller; let reason;
try { controller = createMarketplaceReadController({ models, manifest: loadABCDMarketplaceManifest() }); } catch (error) { reason = error.message; }
const unavailable = (_req, res) => res.status(503).json({ source: { kind: 'canonical-indexed-on-chain' }, available: false, status: 'UNAVAILABLE', reason: reason || 'Canonical ABCD marketplace configuration is unavailable.', data: [] });
router.get('/status', controller?.status || unavailable);
router.get('/collections', controller?.collections || unavailable);
router.get('/listings/active', controller?.active || unavailable);
router.get('/listings/:listingId', controller?.listing || unavailable);
router.get('/collections/:collection/tokens/:tokenId', controller?.token || unavailable);
router.get('/sellers/:address/listings', controller?.seller || unavailable);
router.get('/history', controller?.history || unavailable);
module.exports = router;
