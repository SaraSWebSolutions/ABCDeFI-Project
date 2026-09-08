const mongoose = require("mongoose");

const privacyPolicySchema = new mongoose.Schema({
    content: {
        type: [String]
    }
}, { timestamps: true });

const PrivacyPolicy = mongoose.model("PrivacyPolicy", privacyPolicySchema);
module.exports = PrivacyPolicy;