const mongoose = require("mongoose");

const UserAccountSchema = new mongoose.Schema({
    fcmToken: {
        type: String,
        default: null
    },
    notification: {
        type: Boolean,
        default: true
    },
    name: {
        type: String
    },
    // Unique sparse: allows multiple null values, but enforces uniqueness for real values
    mobileNumber: {
        type: Number,
        unique: true,
        sparse: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String
    },
    gender: {
        type: String,
        enum: ["male", "female", "others"]
    },
    country: {
        type: String
    },
    privacyData: {
        type: Boolean,
        default: false
    },
    // status: true = account is verified and active
    status: {
        type: Boolean,
        default: false
    },
    otp: String,
    otpExpires: Date,
    otpLastSent: Date,
    image: {
        type: String,
        default: null
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    googleId: { type: String, default: null },
    facebookId: { type: String, default: null },
    appleId: { type: String, default: null },
    refId: {
        type: String,
        default: null
    },
    walletLoginNonce: { type: String, default: null },
    walletLoginNonceExpires: { type: Date, default: null },
    walletLoginMessage: { type: String, default: null },
    walletAddress: {
        type: String
    },
    isKYC: {
        type: Boolean,
        default: false,
    },
    kycStatus: {
        type: String,
        enum: ["unverified", "pending", "approved", "rejected"],
        default: "unverified"
    },
    kycSubmittedAt: { type: Date, default: null },
    kycProviderReference: { type: String, default: null },
    is2FAEnabled: {
        type: Boolean,
        default: true
    },
    loginOtp: String,
    loginOtpExpires: Date,
    // Binds the shared hashed login OTP to the entry point that created it.
    // This prevents a user-login OTP from being presented to the admin OTP
    // endpoint (and vice versa) without duplicating the OTP subsystem.
    loginOtpPurpose: {
        type: String,
        enum: ["user", "admin"],
        default: null
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ip: { type: String, default: "127.0.0.1" },
        device: { type: String, default: "Web Browser" },
        location: { type: String, default: "United States" },
        status: { type: String, default: "Success" }
    }],
    activeSessions: [{
        sessionId: { type: String },
        device: { type: String, default: "Web Browser" },
        ip: { type: String, default: "127.0.0.1" },
        lastActive: { type: Date, default: Date.now }
    }],
    lastLoginAt: { type: Date, default: null },
    // Refresh token support — stores hashed refresh token and its expiry
    refreshToken: {
        type: String,
        default: null
    },
    refreshTokenExpiry: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const UserAccount = mongoose.model("UserAccount", UserAccountSchema);
module.exports = UserAccount;
