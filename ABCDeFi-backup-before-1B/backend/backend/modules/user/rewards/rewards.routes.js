const { statusCheck, reward } = require("./rewards.controller");
const auth = require("../../../middleware/authMiddleware");
const express = require("express");

const router = express.Router();

router.post("/status-check", auth, statusCheck);
router.post("/", auth, reward);

module.exports = router;