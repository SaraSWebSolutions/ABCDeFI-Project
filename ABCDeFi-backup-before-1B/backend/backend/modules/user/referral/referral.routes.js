const { createReferr } = require("./referral.controller");
const auth = require("../../../middleware/authMiddleware");

const express = require("express");
const router = express.Router();

router.post("/create", auth, createReferr);

module.exports = router;