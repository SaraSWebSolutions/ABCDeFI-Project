const mongoose = require("mongoose");

const whitePaperSchema = new mongoose.Schema({
    file: {
        type: String
    }
}, { timestamps: true });

const WhitePaper = mongoose.model("WhitePaper", whitePaperSchema);
module.exports = WhitePaper;