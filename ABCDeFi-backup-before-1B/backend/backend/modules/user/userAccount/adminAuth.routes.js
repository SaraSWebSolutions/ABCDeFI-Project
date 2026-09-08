const express = require("express");
const {
    adminLogin,
    verifyAdminLoginOtp,
    resendAdminLoginOtp,
} = require("./userAccount.controller");

const router = express.Router();

// Uses UserAccount rather than the isolated legacy Admin model. No token is
// issued until the existing hashed login OTP is verified.
router.post("/login", adminLogin);
router.post("/verify-login-otp", verifyAdminLoginOtp);
router.post("/resend-login-otp", resendAdminLoginOtp);

module.exports = router;
