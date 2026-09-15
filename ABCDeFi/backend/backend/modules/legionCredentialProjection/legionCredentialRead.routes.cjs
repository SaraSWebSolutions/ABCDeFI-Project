const express = require('express');
const models = require('./models.cjs');
const { loadLegionCredentialManifest } = require('../../config/legionCredentialManifest.cjs');
const { createLegionCredentialReadController } = require('./legionCredentialRead.controller.cjs');

const router = express.Router();
const controller = createLegionCredentialReadController({ models, manifestLoader: loadLegionCredentialManifest });
router.get('/status', controller.status);
router.get('/wallet/:address', controller.wallet);
router.get('/credentials/:tokenId', controller.credential);
router.get('/credentials/:tokenId/history', controller.history);
module.exports = router;
