const UserAccount = require("./userAccount.model");
const Wallet = require("./wallet.model");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../../../config/default");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sendMail = require("../../../utils/mailer");
const sendSms = require("../../../utils/sendSms");
const Notification = require("../notification/notification.model");
const sendPushNotification = require("../../../utils/sendPush");
const Referral = require("../referral/referral.model");
const { ethers } = require("ethers");
const logger = require("../../../logger");

// Helper to generate access and refresh tokens
const generateTokens = async (user) => {
    const accessToken = jwt.sign(
        { id: user._id, email: user.email, name: user.name, role: user.role },
        config.jwt,
        { expiresIn: config.jwt_expiry || "15m" }
    );
    const refreshToken = jwt.sign(
        { id: user._id, jti: crypto.randomBytes(16).toString("hex") },
        config.refresh_secret,
        { expiresIn: config.refresh_expiry || "7d" }
    );

    // Hash refresh token for secure database storage
    const hashedRefreshToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

    // Calculate expiry date
    const expiryDate = new Date();
    // Expiry matches 7d default, otherwise parse from refresh_expiry
    expiryDate.setDate(expiryDate.getDate() + 7);

    user.refreshToken = hashedRefreshToken;
    user.refreshTokenExpiry = expiryDate;
    await user.save();

    return { accessToken, refreshToken };
};

exports.registerUser = async (req, res, next) => {
    const { name, mobileNumber, email, password, gender, country, privacyData, refId } = req.body;

    try {
        const cleanEmail = email ? String(email).trim().toLowerCase() : "";
        const existUser = await UserAccount.findOne({
            $or: [{ email: cleanEmail }, { mobileNumber }]
        });

        if (existUser) {
            if (existUser.email === cleanEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Email Address is already registered. Please sign in instead."
                });
            }
            if (existUser.mobileNumber === Number(mobileNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Mobile Number is already registered"
                });
            }
        }

        if (!name || !email || !password || privacyData === undefined) {
            return res.status(400).json({
                success: false,
                message: "Full Name, Email, Password, and Privacy Policy acceptance are required"
            });
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special symbol (@$!%*?&)"
            });
        }

        if (refId) {
            const referral = await Referral.findOne({ refId: refId });
            if (!referral) {
                return res.status(404).json({
                    success: false,
                    message: "Referral code not found"
                });
            }
            if (referral.referred === true) {
                return res.status(400).json({
                    success: false,
                    message: "Referral code already used"
                });
            }
            referral.referred = true;
            await referral.save();
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();
        const hashedOtp = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        const userDataPayload = {
            name,
            email: cleanEmail,
            password: hashedPassword,
            gender: gender || "others",
            country: country || "United States",
            privacyData: Boolean(privacyData),
            otp: hashedOtp,
            otpExpires: new Date(Date.now() + 10 * 60 * 1000),
            otpLastSent: new Date(),
            refId: refId ? refId : null,
            status: false
        };
        if (mobileNumber) {
            userDataPayload.mobileNumber = Number(mobileNumber);
        }
        const userData = await UserAccount.create(userDataPayload);

        try {
            await Notification.create({
                message: "Account registered successfully",
                type: "Account Registration",
                userId: userData._id,
                time: new Date()
            });
        } catch (e) {
            // non-fatal
        }

        // Email Send
        const html = `
        <div style="font-family: Arial, sans-serif; background-color: #0f172a; padding: 25px; color: #fff;">
          <div style="max-width: 500px; margin: auto; background: #1e293b; border-radius: 10px; padding: 25px; text-align: center; border: 1px solid #334155;">
            <h2 style="color: #6366f1;">Verify Your Email Address</h2>
            <p style="color: #cbd5e1;">Hi <strong>${name}</strong>,</p>
            <p style="color: #cbd5e1;">Your email verification code is:</p>
            <div style="font-size: 34px; font-weight: bold; letter-spacing: 6px; margin: 20px 0; color: #38bdf8; background: #0f172a; padding: 12px; border-radius: 8px;">
              ${otp}
            </div>
            <p style="color: #94a3b8; font-size: 13px;">Valid for 10 minutes.</p>
          </div>
        </div>
        `;

        try {
            await sendMail({
                to: cleanEmail,
                subject: "🔐 Verify Your ABCDeFi Email",
                html
            });
        } catch (mailErr) {
            await UserAccount.deleteOne({ _id: userData._id });
            logger.error("Failed to send registration email: %s", mailErr.message);
            return res.status(503).json({
                success: false,
                message: "We could not send the verification email. Please try again later."
            });
        }

        // Send SMS OTP if mobile number provided
        if (mobileNumber) {
            try {
                await sendSms(String(mobileNumber), otp);
            } catch (smsErr) {
                logger.error("Failed to send registration SMS: %s", smsErr.message);
            }
        }

        res.status(201).json({
            success: true,
            message: "Account created successfully! Please verify your email via the OTP sent.",
            userId: userData._id,
            email: cleanEmail
        });

    } catch (err) {
        next(err);
    }
};

exports.userFcmToken = async (req, res, next) => {
    const { userId, fcmToken } = req.body;
    try {
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        };

        const otp = crypto.randomInt(100000, 1000000).toString();
        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

        user.fcmToken = fcmToken;
        user.otp = hashedOtp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        if (fcmToken) {
            await sendPushNotification(fcmToken, "Your OTP Code", `Your OTP is: ${otp}`);
        }

        res.status(200).json({ success: true, message: "OTP sent" });
    } catch (err) {
        next(err)
    }
}

exports.verifyOtp = async (req, res, next) => {
    const { userId, otp } = req.body;

    try {
        if (!userId || !otp) {
            return res.status(400).json({
                success: false,
                message: "User ID and OTP are required"
            });
        }

        const hashedOtp = crypto
            .createHash("sha256")
            .update(String(otp))
            .digest("hex");

        const user = await UserAccount.findOne({
            _id: userId,
            otp: hashedOtp,
            otpExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        user.status = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        user.otpLastSent = undefined;
        await user.save();

        // Issue Access & Refresh token
        const tokens = await generateTokens(user);

        const safeUser = {
            id: user._id,
            name: user.name,
            email: user.email,
            status: user.status,
            role: user.role,
            isKYC: user.isKYC,
            kycStatus: user.kycStatus
        };

        res.status(200).json({
            success: true,
            message: "Account verified successfully",
            data: safeUser,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });

    } catch (err) {
        next(err);
    }
};

exports.resendOtp = async (req, res, next) => {
    const { userId, email } = req.body;

    try {
        let user;
        if (userId) {
            user = await UserAccount.findById(userId);
        } else if (email) {
            user = await UserAccount.findOne({ email: String(email).trim().toLowerCase() });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.otpLastSent && Date.now() - user.otpLastSent < 30000) {
            return res.status(429).json({
                success: false,
                message: "Please wait before requesting another OTP"
            });
        }

        const newOtp = crypto.randomInt(100000, 1000000).toString();

        const hashedOtp = crypto
            .createHash("sha256")
            .update(newOtp)
            .digest("hex");

        user.otp = hashedOtp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.otpLastSent = new Date();

        await user.save();

        if (user.fcmToken) {
            await sendPushNotification(
                user.fcmToken,
                "Your OTP Code",
                `Your OTP is: ${newOtp}`
            );
        }

        // Email backup for OTP resend
        const html = `
        <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
          <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; padding: 25px; text-align: center;">
            <h2>Verify Your Email</h2>
            <p>Your new OTP code is:</p>
            <div style="font-size: 30px; font-weight: bold; letter-spacing: 6px; margin: 20px 0; color: #4f46e5;">
              ${newOtp}
            </div>
            <p>This OTP is valid for 10 minutes.</p>
          </div>
        </div>
        `;
        try {
            await sendMail({
                to: user.email,
                subject: "🔐 Resent Email Verification OTP",
                html
            });
        } catch (mailErr) {
            logger.error("Failed to resend registration email: %s", mailErr.message);
        }

        res.status(200).json({
            success: true,
            message: "OTP resent successfully"
        });

    } catch (err) {
        next(err);
    }
};

exports.userLogin = async (req, res, next) => {
    const { email, mobileNumber, password } = req.body;
    try {
        if (!password || (!email && !mobileNumber)) {
            return res.status(400).json({ success: false, message: "Email or Phone number and Password required" });
        }
        let query = {};
        if (email) {
            query.email = String(email).trim().toLowerCase();
        } else if (mobileNumber) {
            query.mobileNumber = Number(mobileNumber);
        }

        const user = await UserAccount.findOne(query);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account does not exist"
            });
        }
        if (user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: "Account suspended by admin. Please contact support."
            });
        }
        if (!user.status) {
            const newOtp = crypto.randomInt(100000, 1000000).toString();
            const hashedOtp = crypto.createHash("sha256").update(newOtp).digest("hex");
            user.otp = hashedOtp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
            user.otpLastSent = new Date();
            await user.save();

            try {
                await sendMail({
                    to: user.email,
                    subject: "🔐 Verify Your ABCDeFi Email",
                    html: `<p>Your ABCDeFi verification code is <strong>${newOtp}</strong>. It expires in 10 minutes.</p>`
                });
            } catch (mailErr) {
                logger.error("Failed to send login verification email: %s", mailErr.message);
                return res.status(503).json({ success: false, message: "Unable to send verification email. Please try again later." });
            }

            return res.status(400).json({
                success: false,
                requireEmailVerify: true,
                userId: user._id,
                email: user.email,
                message: "Account not verified. A new verification OTP was sent to your email."
            });
        }
        if (!user.password) {
            return res.status(400).json({
                success: false,
                message: "Password not set for this account."
            });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        // If 2FA is enabled (default behavior for fintech security), generate Login OTP
        if (user.is2FAEnabled !== false) {
            const loginOtp = crypto.randomInt(100000, 1000000).toString(); // 6 digits
            const hashedOtp = crypto.createHash("sha256").update(loginOtp).digest("hex");

            user.loginOtp = hashedOtp;
            user.loginOtpExpires = Date.now() + 10 * 60 * 1000;
            await user.save();

            // Branded email send
            const html = `
            <div style="font-family: Arial, sans-serif; background-color: #0f172a; padding: 30px; color: #ffffff;">
              <div style="max-width: 500px; margin: auto; background: #1e293b; border-radius: 12px; padding: 30px; text-align: center; border: 1px solid #334155;">
                <h2 style="color: #6366f1; margin-bottom: 10px;">ABCDeFi Security Verification</h2>
                <p style="color: #cbd5e1; font-size: 15px;">Login OTP for <strong>${user.email}</strong></p>
                <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 25px 0; color: #38bdf8; background: #0f172a; padding: 15px; border-radius: 8px; border: 1px dashed #6366f1;">
                  ${loginOtp}
                </div>
                <p style="color: #94a3b8; font-size: 13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
              </div>
            </div>
            `;
            try {
                await sendMail({
                    to: user.email,
                    subject: "🔐 Your ABCDeFi 2FA Login Verification Code",
                    html
                });
            } catch (err) {
                user.loginOtp = undefined;
                user.loginOtpExpires = undefined;
                await user.save();
                logger.error("Failed to send 2FA email: %s", err.message);
                return res.status(503).json({ success: false, message: "Unable to send login verification code. Please try again later." });
            }

            return res.status(200).json({
                success: true,
                require2FA: true,
                userId: user._id,
                email: user.email,
                message: `Password Verified. OTP sent to ${user.email}`
            });
        }

        // Issue Access & Refresh token directly if 2FA disabled
        const tokens = await generateTokens(user);

        // Record session
        user.loginHistory.push({
            timestamp: new Date(),
            ip: req.ip || "127.0.0.1",
            device: req.headers["user-agent"] || "Web Browser",
            status: "Success"
        });
        await user.save();

        res.status(200).json({
            success: true,
            message: "Logged in Successfully",
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                country: user.country,
                isKYC: user.isKYC,
                role: user.role,
                is2FAEnabled: user.is2FAEnabled
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.verifyLoginOtp = async (req, res, next) => {
    const { userId, otp } = req.body;
    try {
        if (!userId || !otp) {
            return res.status(400).json({ success: false, message: "User ID and OTP are required" });
        }

        const hashedOtp = crypto.createHash("sha256").update(String(otp)).digest("hex");
        const user = await UserAccount.findOne({
            _id: userId,
            loginOtp: hashedOtp,
            loginOtpExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired Login OTP code" });
        }

        // Clear 2FA OTP
        user.loginOtp = undefined;
        user.loginOtpExpires = undefined;

        // Update login history & active sessions
        const sessionId = "sess_" + Date.now();
        user.loginHistory.push({
            timestamp: new Date(),
            ip: req.ip || "127.0.0.1",
            device: req.headers["user-agent"] || "Web Browser",
            status: "Success (2FA)"
        });
        user.activeSessions.push({
            sessionId,
            device: req.headers["user-agent"] || "Web Browser App",
            ip: req.ip || "127.0.0.1",
            lastActive: new Date()
        });

        // Generate JWT Access and Refresh Tokens
        const tokens = await generateTokens(user);

        res.status(200).json({
            success: true,
            message: "Login OTP verified successfully",
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                mobileNumber: user.mobileNumber,
                country: user.country,
                isKYC: user.isKYC,
                role: user.role,
                walletAddress: user.walletAddress,
                is2FAEnabled: user.is2FAEnabled
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.resendLoginOtp = async (req, res, next) => {
    const { userId } = req.body;
    try {
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.otpLastSent && Date.now() - user.otpLastSent.getTime() < 60000) {
            return res.status(429).json({ success: false, message: "Please wait before requesting another OTP." });
        }

        const newLoginOtp = crypto.randomInt(100000, 1000000).toString();
        const hashedOtp = crypto.createHash("sha256").update(newLoginOtp).digest("hex");
        user.loginOtp = hashedOtp;
        user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.otpLastSent = new Date();
        await user.save();

        try {
            await sendMail({
                to: user.email,
                subject: "🔐 Your ABCDeFi 2FA Login Verification Code",
                html: `<p>Your ABCDeFi login verification code is <strong>${newLoginOtp}</strong>. It expires in 10 minutes.</p>`
            });
        } catch (err) {
            user.loginOtp = undefined;
            user.loginOtpExpires = undefined;
            await user.save();
            logger.error("Failed to resend 2FA email: %s", err.message);
            return res.status(503).json({ success: false, message: "Unable to resend login verification code." });
        }

        res.status(200).json({
            success: true,
            message: `New Login OTP sent to ${user.email}`
        });
    } catch (err) {
        next(err);
    }
};

exports.userProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        const userData = await UserAccount.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const profile = userData.toObject();
        // Legacy accounts were created with `pending` as the schema default.
        // A pending state is authoritative only after a KYC submission exists.
        if (!profile.kycSubmittedAt && !profile.kycProviderReference && !profile.isKYC && profile.kycStatus === "pending") {
            profile.kycStatus = "unverified";
        }
        res.status(200).json({
            success: true,
            data: profile
        })
    } catch (err) {
        next(err)
    }
}

exports.updateProfile = async (req, res, next) => {
    const { ...updateFields } = req.body;
    try {
        const userId = req.user.id;
        const userData = await UserAccount.findById(userId);
        if (!userId) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }
        const image = req.files?.image?.[0];
        if (image) {
            updateFields.image = image.filename;
        }
        const uploadFolder = path.join(process.cwd(), "uploads");

        const oldFile = userData.image;
        if (oldFile) {
            const p = path.join(uploadFolder, oldFile);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        const updatedUser = await UserAccount.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { returnDocument: 'after' }
        );
        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (err) {
        next(err);
    }
};

exports.otpForPasswordReset = async (req, res, next) => {
    const { mobileNumber } = req.body;
    try {
        const user = await UserAccount.findOne({ mobileNumber });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            })
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

        user.otp = hashedOtp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        user.otpLastSent = Date.now();
        await user.save();

        if (user.fcmToken) {
            await sendPushNotification(
                user.fcmToken,
                "Password Reset OTP",
                `Your OTP is: ${otp}`
            );
        }

        res.status(200).json({ success: true, message: "OTP sent", otp: otp, userId: user._id });
    } catch (err) {
        next(err)
    }
}

exports.verifyOtpForPasswordReset = async (req, res, next) => {
    const { userId, otp } = req.body;
    try {
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.otp || !user.otpExpires || Date.now() > user.otpExpires) {
            return res.status(400).json({ success: false, message: "OTP expired or invalid" });
        }

        const hashedOtp = crypto.createHash("sha256").update(String(otp)).digest("hex");
        if (String(user.otp) !== String(hashedOtp)) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        user.otp = null;
        user.otpExpires = null;
        user.otpLastSent = null;
        await user.save();

        res.status(200).json({ success: true, message: "OTP Verified." });
    } catch (err) {
        next(err);
    }
}

exports.passwordResetWithOtp = async (req, res, next) => {
    const { userId, password } = req.body;
    try {
        const user = await UserAccount.findById(userId);
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long and include 1 uppercase letter, 1 number, and 1 special character"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();
        res.status(200).json({ success: true, message: "Password Changed successfully" });
    } catch (err) {
        next(err)
    }
}

exports.forgotPassword = async (req, res, next) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await UserAccount.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        if (!user.status) {
            return res.status(400).json({
                success: false,
                message: "Account not active"
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

        await user.save();

        const resetUrl = `${config.frontend_url}/reset-password/${resetToken}`;

        const html = `
        <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; padding: 25px; text-align: center; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
            
            <!-- Logo -->
            <img src="https://abcdefi.srv1252888.hstgr.cloud/logo.png" alt="Logo" style="width: 80px; margin-bottom: 15px;" />

            <h2 style="color: #333; margin-bottom: 10px;">Reset Your Password</h2>

            <p style="color: #555; font-size: 14px;">
            Hi <strong>${user.name}</strong>,
            </p>

            <p style="color: #555; font-size: 14px;">
            We received a request to reset your password. Click the button below to set a new one.
            </p>

            <!-- Button -->
            <a href="${resetUrl}" 
            style="display: inline-block; margin: 20px 0; padding: 12px 20px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Reset Password
            </a>

            <p style="color: #777; font-size: 13px;">
            This link will expire in <strong>15 minutes</strong>.
            </p>

            <p style="color: #777; font-size: 13px;">
            If you did not request this, you can safely ignore this email.
            </p>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />

            <!-- Fallback link -->
            <p style="color: #999; font-size: 12px;">
            If the button doesn’t work, copy and paste this link into your browser:
            </p>

            <p style="word-break: break-all; font-size: 12px; color: #4f46e5;">
            ${resetUrl}
            </p>

        </div>
        </div>
        `;

        await sendMail({
            to: user.email,
            subject: "Reset Your Password",
            html
        });

        res.status(200).json({
            success: true,
            message: "Reset link sent"
        });

    } catch (err) {
        next(err);
    }
};

exports.resetPassword = async (req, res, next) => {
    const { token, password } = req.body;

    try {
        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: "Token and password required"
            });
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await UserAccount.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired token"
            });
        }
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long and include 1 uppercase letter, 1 number, and 1 special character"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        user.password = hashedPassword;

        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({
            success: true,
            message: "Password reset successful"
        });

    } catch (err) {
        next(err);
    }
};

exports.passwordChange = async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const userId = req.user.id;

        const user = await UserAccount.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long and include 1 uppercase letter, 1 number, and 1 special character"
            });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err) {
        next(err);
    }
};

exports.notificationStatus = async (req, res, next) => {
    const { status } = req.body;
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(403).json({
                success: false,
                message: "User ID needed"
            })
        }
        await UserAccount.findByIdAndUpdate(userId, { notification: status }, { new: true })
        res.status(200).json({
            success: true,
            message: "Notification settings updated"
        })
    } catch (err) {
        next(err)
    }
}

exports.getAddress = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { signature, expectedAddress } = req.body;

        if (!signature || !expectedAddress) {
            return res.status(400).json({
                success: false,
                error: "Missing signature or address"
            });
        }

        if (!ethers.isAddress(expectedAddress)) {
            return res.status(400).json({
                success: false,
                error: "Invalid wallet address"
            });
        }

        const message = "Verify wallet ownership for ABCDeFI ICO. This wallet will be bound to your profile.";

        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (error) {
            console.error("Verification error:", error);
            return res.status(500).json({
                success: false,
                error: "Failed to verify signature"
            });
        }

        if (recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()) {

            await UserAccount.findByIdAndUpdate(
                userId,
                { walletAddress: expectedAddress },
                { new: true }
            );

            return res.status(200).json({
                success: true,
                message: "Wallet verified and bound successfully",
                verifiedAddress: recoveredAddress
            });

        } else {
            return res.status(401).json({
                success: false,
                error: "Signature verification failed. Wallet mismatch."
            });
        }

    } catch (err) {
        next(err);
    }
};

exports.refreshToken = async (req, res, next) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ success: false, message: "Refresh token required" });
    }

    try {
        const decoded = jwt.verify(refreshToken, config.refresh_secret);
        const hashedRefreshToken = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        const user = await UserAccount.findOne({
            _id: decoded.id,
            refreshToken: hashedRefreshToken,
            refreshTokenExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
        }

        const tokens = await generateTokens(user);

        res.status(200).json({
            success: true,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired refresh token", error: err.message });
    }
};

exports.logout = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await UserAccount.findById(userId);
        if (user) {
            user.refreshToken = null;
            user.refreshTokenExpiry = null;
            await user.save();
        }
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        next(err);
    }
};

exports.changeEmail = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { newEmail } = req.body;
        if (!newEmail) return res.status(400).json({ success: false, message: "New email is required" });

        const exist = await UserAccount.findOne({ email: newEmail.trim().toLowerCase() });
        if (exist && String(exist._id) !== String(userId)) {
            return res.status(400).json({ success: false, message: "Email is already in use by another account" });
        }

        const user = await UserAccount.findByIdAndUpdate(userId, { email: newEmail.trim().toLowerCase() }, { new: true });
        res.json({ success: true, message: "Email updated successfully", email: user.email });
    } catch (err) {
        next(err);
    }
};

exports.changeMobile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { newMobile } = req.body;
        if (!newMobile) return res.status(400).json({ success: false, message: "New mobile number is required" });

        const user = await UserAccount.findByIdAndUpdate(userId, { mobileNumber: Number(newMobile) }, { new: true });
        res.json({ success: true, message: "Mobile number updated successfully", mobileNumber: user.mobileNumber });
    } catch (err) {
        next(err);
    }
};

exports.toggle2FA = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await UserAccount.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.is2FAEnabled = !user.is2FAEnabled;
        await user.save();

        res.json({
            success: true,
            message: `2FA ${user.is2FAEnabled ? 'enabled' : 'disabled'} successfully`,
            is2FAEnabled: user.is2FAEnabled
        });
    } catch (err) {
        next(err);
    }
};

exports.getSessions = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await UserAccount.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        res.json({
            success: true,
            activeSessions: user.activeSessions || [],
            loginHistory: user.loginHistory || []
        });
    } catch (err) {
        next(err);
    }
};

// Admin Endpoints
exports.adminGetUsers = async (req, res, next) => {
    try {
        const users = await UserAccount.find().select("-password -otp -loginOtp -refreshToken").sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (err) {
        next(err);
    }
};


exports.submitKyc = async (req, res, next) => {
    try {
        const { fullName, country, docType } = req.body;
        if (!fullName || !country || !docType) {
            return res.status(400).json({ success: false, message: "Full name, country and document type are required" });
        }

        // Do not create a local "pending" record or fabricated provider reference.
        // KYC may enter pending only after the configured provider accepts an application.
        return res.status(503).json({
            success: false,
            message: "KYC submission is unavailable because no server-side provider integration is configured."
        });
    } catch (err) {
        next(err);
    }
};

exports.adminUpdateUserStatus = async (req, res, next) => {
    try {
        const { targetUserId, isSuspended } = req.body;
        const user = await UserAccount.findByIdAndUpdate(targetUserId, { isSuspended }, { new: true });
        res.json({ success: true, message: `Account ${isSuspended ? 'suspended' : 'activated'}`, user });
    } catch (err) {
        next(err);
    }
};

exports.adminUpdateUserKyc = async (req, res, next) => {
    try {
        const { targetUserId, isKYC } = req.body;
        const user = await UserAccount.findByIdAndUpdate(targetUserId, { isKYC, kycStatus: isKYC ? "approved" : "rejected" }, { new: true });
        res.json({ success: true, message: `User KYC ${isKYC ? 'approved' : 'pending/rejected'}`, user });
    } catch (err) {
        next(err);
    }
};

exports.adminResetUserPassword = async (req, res, next) => {
    try {
        const { targetUserId, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await UserAccount.findByIdAndUpdate(targetUserId, { password: hashedPassword });
        res.json({ success: true, message: "User password reset successfully by admin" });
    } catch (err) {
        next(err);
    }
};

// -----------------------------------------------------------------------------
// Wallet login (SIWE-style challenge/response)
// -----------------------------------------------------------------------------
exports.walletLoginNonce = async (req, res, next) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress || !ethers.isAddress(walletAddress)) {
            return res.status(400).json({ success: false, message: "Valid wallet address is required" });
        }

        const normalized = walletAddress.toLowerCase();

        // UserAccount is the primary account-to-wallet relationship.
        const user = await UserAccount.findOne({ walletAddress: normalized });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No ABCDeFi account is linked to this wallet"
            });
        }
        if (user.isSuspended) {
            return res.status(403).json({ success: false, message: "Account is suspended" });
        }

        // Require the wallet-link record to be verified.
        const linkedWallet = await Wallet.findOne({
            userId: user._id,
            walletAddress: normalized,
            verified: true
        });

        if (!linkedWallet) {
            return res.status(403).json({
                success: false,
                message: "Wallet is not verified. Please verify and link your wallet first."
            });
        }

        const nonce = crypto.randomBytes(32).toString("hex");
        const issuedAt = new Date();
        const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
        const chainId = Number(linkedWallet.chainId);
        if (!Number.isInteger(chainId)) {
            return res.status(500).json({
                success: false,
                message: "Wallet network information is invalid"
            });
        }
        const uri = config.frontend_url;
        const domain = new URL(uri).host;
        const message = `${domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nSign in to ABCDeFi\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`;

        user.walletLoginNonce = nonce;
        user.walletLoginNonceExpires = expiresAt;
        user.walletLoginMessage = message;
        await user.save();

        return res.json({ success: true, nonce, message, expiresAt });
    } catch (err) {
        next(err);
    }
};

exports.walletLogin = async (req, res, next) => {
    try {
        const { walletAddress, signature, nonce } = req.body;
        if (!walletAddress || !signature || !nonce || !ethers.isAddress(walletAddress)) {
            return res.status(400).json({ success: false, message: "walletAddress, signature and nonce are required" });
        }

        const normalized = walletAddress.toLowerCase();
        // UserAccount is the primary account-to-wallet relationship.
        const user = await UserAccount.findOne({ walletAddress: normalized });
        if (!user) {
            return res.status(404).json({ success: false, message: "No ABCDeFi account is linked to this wallet" });
        }
        if (user.isSuspended) {
            return res.status(403).json({ success: false, message: "Account is suspended" });
        }
        if (!user.walletLoginNonce || user.walletLoginNonce !== nonce || !user.walletLoginMessage) {
            return res.status(401).json({ success: false, message: "Invalid wallet challenge" });
        }
        if (user.walletLoginNonceExpires && user.walletLoginNonceExpires < new Date()) {
            return res.status(401).json({ success: false, message: "Wallet challenge expired" });
        }

        // Confirm the wallet is still verified when consuming the challenge.
        const linkedWallet = await Wallet.findOne({
            userId: user._id,
            walletAddress: normalized,
            verified: true
        });
        if (!linkedWallet) {
            return res.status(403).json({ success: false, message: "Wallet is not verified" });
        }

        const recovered = ethers.verifyMessage(user.walletLoginMessage, signature);
        if (recovered.toLowerCase() !== normalized) {
            return res.status(401).json({ success: false, message: "Wallet signature verification failed" });
        }

        user.walletLoginNonce = null;
        user.walletLoginNonceExpires = null;
        user.walletLoginMessage = null;
        user.lastLoginAt = new Date();
        await user.save();

        const { accessToken, refreshToken } = await generateTokens(user);
        return res.json({
            success: true,
            token: accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                walletAddress: user.walletAddress,
                country: user.country,
                kycStatus: user.kycStatus
            }
        });
    } catch (err) {
        next(err);
    }
};
