const { 
  setStartDate, 
  showIcoStartDate,
  getIcoConfig,
  getIcoStats,
  buyIcoTokens,
  getPurchasesByWallet,
  createReferral,
  getReferralsByWallet,
  getVestingByWallet,
  exportIcoData,
  importIcoData
} = require("./ico.controller");
const express = require("express");
const auth = require("../../middleware/authMiddleware");
const { requireAdmin } = require("../../middleware/authMiddleware");

const router = express.Router();

// Existing start date routes
router.post("/add", auth, requireAdmin, setStartDate);
router.get("/", showIcoStartDate);

// Standard ICO / Presale routes
router.get("/config", getIcoConfig);
router.get("/stats", getIcoStats);
router.post("/purchase", buyIcoTokens);
router.get("/purchases/:walletAddress", getPurchasesByWallet);
router.post("/referral", createReferral);
router.get("/referrals/:walletAddress", getReferralsByWallet);
router.get("/vesting/:walletAddress", getVestingByWallet);

// Admin Import/Export routes
router.get("/admin/export", auth, requireAdmin, exportIcoData);
router.post("/admin/import", auth, requireAdmin, importIcoData);

module.exports = router;
