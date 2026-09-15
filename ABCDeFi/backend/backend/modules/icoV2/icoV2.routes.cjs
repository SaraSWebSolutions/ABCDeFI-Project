const express = require('express');
const { createIcoV2Controller } = require('./icoV2.controller.cjs');

const router = express.Router();
const controller = createIcoV2Controller();
router.get('/status', controller.status);
router.get('/buyers/:address', controller.buyer);
module.exports = router;
