const express = require('express');
const models = require('./models');
const { loadFranchiseManifest } = require('../../config/franchiseManifest.cjs');
const { createFranchiseReadController } = require('./franchiseRead.controller');

const router = express.Router();
const controller = createFranchiseReadController({ models, manifest: loadFranchiseManifest() });
router.get('/status', controller.status);
router.get('/wallet/:address', controller.wallet);
router.get('/:tokenId/history', controller.history);
router.get('/:tokenId', controller.certificate);
module.exports = router;
