const UserAccount = require("../../user/userAccount/userAccount.model");

exports.listUsers = async (req, res, next) => {
    try {
        const userData = await UserAccount.find();
        res.status(200).json({
            success: true,
            data: userData
        })
    } catch (err) {
        next(err)
    }
}