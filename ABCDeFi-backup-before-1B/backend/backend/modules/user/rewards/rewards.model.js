const mongoose = require("mongoose");
const UserAccount = require("../userAccount/userAccount.model");

const rewardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: UserAccount
    },
    response: {
        type: String,
        enum: ["yes", "no"]
    },
    status: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Reward = mongoose.model("Reward", rewardSchema);
module.exports = Reward;