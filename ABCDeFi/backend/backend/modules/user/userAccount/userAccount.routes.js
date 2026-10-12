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
  developmentDashboardSession,
  r3TestDashboardSession,
  developmentLoginOtpForAutomation,
    walletLoginNonce,
  walletLogin,
  adminAuthDebug
} = require("./userAccount.controller");

const upload = require("../../../middleware/fileUpload");
const auth = require("../../../middleware/authMiddleware");
const { requireAdmin, requireAdminPermission } = require("../../../middleware/authMiddleware");
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
// Local-only convenience route. The controller fails closed unless both
// NODE_ENV/AUTH_MODE development and a localhost MongoDB database are active.
router.post("/development-dashboard-session", developmentDashboardSession);
// Sealed test-only browser fixture. The controller validates the exact R3
// runtime, descriptor, Mongo namespace, and explicit server-side enable flag.
router.post("/r3-test-dashboard-session", r3TestDashboardSession);
// Local loopback development automation only; the controller fails closed in
// production, non-local-database, and non-loopback contexts.
router.get("/development-login-otp/:userId", developmentLoginOtpForAutomation);
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
router.get("/admin/users", auth, requireAdminPermission("users.read"), adminGetUsers);
router.post("/admin/users/status", auth, requireAdminPermission("users.support"), adminUpdateUserStatus);
router.post("/admin/users/kyc", auth, requireAdminPermission("compliance.review"), adminUpdateUserKyc);
router.post("/admin/users/reset-password", auth, requireAdminPermission("users.support"), adminResetUserPassword);
// Never available in production; controller also enforces development mode.
// The local OTP inspector can reveal short-lived authentication material, so
// only security administrators (and super_admin through the canonical
// permission registry) may call it. The controller still fails closed outside
// explicitly enabled local development.
router.get("/admin/auth-debug/:userId", auth, requireAdminPermission("security.read"), adminAuthDebug);

module.exports = router;
