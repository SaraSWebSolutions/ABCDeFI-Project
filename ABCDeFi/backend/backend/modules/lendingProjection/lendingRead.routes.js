const express = require('express');
const models = require('./models');
const { loadLendingManifest } = require('../../config/lendingManifest.cjs');
const { createLendingReadController } = require('./lendingRead.controller');

const router = express.Router();
const controller = createLendingReadController({ models, manifest: loadLendingManifest() });

router.get('/status', controller.status);
router.get('/requests/open', controller.openRequests);
router.get('/wallet/:address', controller.walletHistory);
// Singular aliases are the documented canonical resource paths. Keep the
// earlier plural route below for existing consumers during this migration.
router.get('/loan/:loanId/history', controller.loanHistory);
router.get('/loan/:loanId', controller.loanDetail);
router.get('/loans/:loanId', controller.loanDetail);

module.exports = router;
