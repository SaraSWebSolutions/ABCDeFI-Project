const mongoose = require("mongoose");
const UserAccount = require("../userAccount/userAccount.model");

const referralSchema = new mongoose.Schema({
    refId: {
        type: String,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: UserAccount
    },
    referred: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

referralSchema.pre('save', async function () {
    if (!this.refId) {
        const randomStr = Math.random().toString(36).substring(2, 9).toUpperCase();
        this.refId = `REF-${randomStr}`;
    }
});

const Referral = mongoose.model("Referral", referralSchema);
module.exports = Referral;