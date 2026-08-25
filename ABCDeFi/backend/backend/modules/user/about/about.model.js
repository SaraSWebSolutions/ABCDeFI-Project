const mongoose = require("mongoose");

const aboutSchema = new mongoose.Schema({
    content: {
        type: [String]
    }
}, { timestamps: true });

const About = mongoose.model("About", aboutSchema);
module.exports = About;