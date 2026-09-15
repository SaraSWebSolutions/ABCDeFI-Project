const express = require('express');
const models = require('./models');
const { loadFranchiseManifest } = require('../../config/franchiseManifest.cjs');
const { createFranchiseReadController } = require('./franchiseRead.controller');

const router = express.Router();
let controller;
let unavailableReason = null;
try { controller = createFranchiseReadController({ models, manifest: loadFranchiseManifest() }); } catch (error) { unavailableReason = error.message; }
const unavailable = (_req, res) => res.status(503).json({ source: { kind: 'canonical-indexed-on-chain' }, available: false, status: 'UNAVAILABLE', reason: unavailableReason || 'Canonical Franchise configuration is unavailable.', data: [] });
router.get('/status', controller?.status || unavailable);
router.get('/history', controller?.events || unavailable);
router.get('/wallet/:address', controller?.wallet || unavailable);
router.get('/:tokenId/history', controller?.history || unavailable);
router.get('/:tokenId', controller?.certificate || unavailable);
module.exports = router;
