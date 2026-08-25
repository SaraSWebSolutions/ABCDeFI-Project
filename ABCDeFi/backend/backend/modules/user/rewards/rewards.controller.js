const Reward = require("./rewards.model");
const UserAccount = require("../userAccount/userAccount.model");

exports.statusCheck = async (req, res, next) => {
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(403).json({
                success: true,
                message: "No headers"
            })
        }
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            })
        }
        const statusCheck = await Reward.findOne({ userId: userId });
        if (!statusCheck) {
            return res.status(200).json({
                message: true,
                data: false,
                points: 300
            })
        }
        if (statusCheck.status) {
            return res.status(200).json({
                message: true,
                data: true
            })
        }
        res.status(200).json({
            message: true,
            data: true
        })
    }
    catch (err) {
        next(err)
    }
}

exports.reward = async (req, res, next) => {
    const { response } = req.body
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(403).json({
                success: true,
                message: "No headers"
            })
        }
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            })
        }
        await Reward.create({
            userId: userId,
            response: response,
            status: true
        })
        res.status(200).json({
            success: true,
            message: "Submitted successfully"
        })
    } catch (err) {
        next(err)
    }
}