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

const router = express.Router();

// Existing start date routes
router.post("/add", setStartDate);
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
router.get("/admin/export", exportIcoData);
router.post("/admin/import", importIcoData);

module.exports = router;