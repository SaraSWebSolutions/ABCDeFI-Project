const mongoose = require("mongoose");

const IcoSchema = new mongoose.Schema({
    title: {
        type: String
    },
    startDate: {
        type: Date
    }
}, { timestamps: true });

const Ico = mongoose.model("Ico", IcoSchema);
module.exports = Ico;