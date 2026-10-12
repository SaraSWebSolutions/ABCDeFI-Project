const express = require("express");
const {
    adminLogin,
    verifyAdminLoginOtp,
    resendAdminLoginOtp,
    switchAdminSession,
} = require("./userAccount.controller");
const auth = require("../../../middleware/authMiddleware");
const { requireAdminRole } = require("../../../middleware/authMiddleware");

const router = express.Router();

// Uses UserAccount rather than the isolated legacy Admin model. No token is
// issued until the existing hashed login OTP is verified.
router.post("/login", adminLogin);
router.post("/verify-login-otp", verifyAdminLoginOtp);
router.post("/resend-login-otp", resendAdminLoginOtp);
// Only a live Super Admin session can enumerate or select server-authorized
// application-admin targets. Target credentials are never collected here.
router.get("/session/switch/targets", auth, requireAdminRole("super_admin"), switchAdminSession);
// POST performs the same persisted Super-Admin authorization in the controller
// so a denied persisted Admin attempt can be safely recorded in its existing
// security history. It never trusts any role supplied by the browser.
router.post("/session/switch", auth, switchAdminSession);
router.post("/session/switch/return", auth, switchAdminSession);

module.exports = router;
