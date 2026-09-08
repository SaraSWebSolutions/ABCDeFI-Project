const Referral = require("./referral.model");
const UserAccount = require("../userAccount/userAccount.model");

exports.createReferr = async (req, res, next) => {
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(404).json({
                success: false,
                message: "User Id requires"
            })
        }
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        const referral = await Referral.create({
            userId: userId,
        })
        res.status(200).json({
            success: true,
            message: "Referral created",
            data: referral,
            title: "ABCDeFI",
            link:"",
            caption: "Share this referral to the other users"
        })
    } catch (err) {
        next(err)
    }
}