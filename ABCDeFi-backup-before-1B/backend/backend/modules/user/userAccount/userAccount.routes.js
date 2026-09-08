const { 
    registerUser, 
    verifyOtp, 
    userLogin,
    verifyLoginOtp,
    resendLoginOtp, 
    resendOtp, 
    userProfile, 
    updateProfile, 
    otpForPasswordReset, 
    verifyOtpForPasswordReset, 
    passwordResetWithOtp, 
    forgotPassword, 
    resetPassword, 
    passwordChange, 
    changeEmail,
    changeMobile,
    toggle2FA,
    getSessions,
    adminGetUsers,
    adminUpdateUserStatus,
    adminUpdateUserKyc,
    adminResetUserPassword,
    notificationStatus, 
    userFcmToken, 
    getAddress,
    submitKyc,
    refreshToken,
    logout,
    walletLoginNonce,
  walletLogin,
  adminAuthDebug
} = require("./userAccount.controller");

const upload = require("../../../middleware/fileUpload");
const auth = require("../../../middleware/authMiddleware");
const { requireAdmin } = require("../../../middleware/authMiddleware");
const express = require("express");
const walletRouter = require("./wallet.routes");

const router = express.Router();

// Wallet ownership verification
router.use("/wallet", auth, walletRouter);

// Registration and Activation
router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Wallet login challenge/verification (no fake client JWTs)
router.post("/wallet-login/nonce", walletLoginNonce);
router.post("/wallet-login", walletLogin);

// Sessions & Auth
router.post("/login", userLogin);
router.post("/verify-login-otp", verifyLoginOtp);
router.post("/resend-login-otp", resendLoginOtp);
router.post("/refresh-token", refreshToken);
router.post("/logout", auth, logout);

// KYC
router.post("/kyc/submit", auth, submitKyc);

// Profile & Security Settings
router.post("/profile", auth, userProfile);
router.get("/profile", auth, userProfile);
router.post("/profile-update", upload.fields([
    { name: "image", maxCount: 1 }
]), auth, updateProfile);
router.post("/change-password", auth, passwordChange);
router.post("/change-email", auth, changeEmail);
router.post("/change-mobile", auth, changeMobile);
router.post("/toggle-2fa", auth, toggle2FA);
router.get("/sessions", auth, getSessions);

// Password Reset Flows
router.post("/otp-password-change", otpForPasswordReset);
router.post("/password-otp", verifyOtpForPasswordReset);
router.post("/verify-password-otp", verifyOtpForPasswordReset);
router.post("/password-reset", passwordResetWithOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Settings and Integrations
router.post("/notification-settings", auth, notificationStatus);
router.post("/get-fcm", userFcmToken);
router.post("/get-address", auth, getAddress);

// Admin Management
router.get("/admin/users", auth, requireAdmin, adminGetUsers);
router.post("/admin/users/status", auth, requireAdmin, adminUpdateUserStatus);
router.post("/admin/users/kyc", auth, requireAdmin, adminUpdateUserKyc);
router.post("/admin/users/reset-password", auth, requireAdmin, adminResetUserPassword);
// Never available in production; controller also enforces development mode.
router.get("/admin/auth-debug/:userId", auth, requireAdmin, adminAuthDebug);

module.exports = router;
