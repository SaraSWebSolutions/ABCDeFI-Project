const mongoose = require("mongoose");

const SplashScreenSchema = new mongoose.Schema({
    image: {
        type: String
    },
    title: {
        type: String
    },
    caption: {
        type: String
    }
}, { timestamps: true });

const SplashScreen = mongoose.model("SplashScreen", SplashScreenSchema);
module.exports = SplashScreen;