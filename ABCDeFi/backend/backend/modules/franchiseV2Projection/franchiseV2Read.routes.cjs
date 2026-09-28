const express = require('express');
const { JsonRpcProvider } = require('ethers');
const models = require('./models.cjs');
const { loadFranchiseV2Manifest } = require('../../config/franchiseV2Manifest.cjs');
const { loadFranchiseV2Artifacts } = require('../../config/franchiseV2Artifacts.cjs');
const { createFranchiseV2ReadController } = require('./franchiseV2Read.controller.cjs');

const router = express.Router();
const controller = createFranchiseV2ReadController({ models, manifestLoader: loadFranchiseV2Manifest, artifactsLoader: loadFranchiseV2Artifacts, providerFactory: (manifest) => new JsonRpcProvider(manifest.rpcUrl) });
router.get('/status', controller.status);
router.get('/wallet/:address', controller.wallet);
router.get('/applications/wallet/:address', controller.applications);
router.get('/applications', controller.allApplications);
router.get('/franchises', controller.franchises);
router.get('/transfer-requests', controller.transferRequests);
router.get('/franchises/:tokenId/history', controller.history);
router.get('/franchises/:tokenId', controller.franchise);
router.get('/transfer-requests/:requestId', controller.request);
module.exports = router;
