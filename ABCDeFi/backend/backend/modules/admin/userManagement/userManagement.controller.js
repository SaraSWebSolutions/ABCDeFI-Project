const UserAccount = require("../../user/userAccount/userAccount.model");

exports.listUsers = async (req, res, next) => {
    try {
        const userData = await UserAccount.find().select(
            "-password -otp -otpExpires -otpLastSent -loginOtp -loginOtpExpires -loginOtpPurpose "
            + "-refreshToken -refreshTokenExpiry -resetPasswordToken -resetPasswordExpires "
            + "-walletLoginNonce -walletLoginNonceExpires -walletLoginMessage"
        );
        res.status(200).json({
            success: true,
            data: userData
        })
    } catch (err) {
        next(err)
    }
}
