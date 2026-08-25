const { listUsers } = require("./userManagement.controller");
const auth = require("../../../middleware/authMiddleware");
const { requireAdmin } = require("../../../middleware/authMiddleware");

const express = require("express");

const router = express.Router();

router.get("/", auth, requireAdmin, listUsers);

module.exports = router;
