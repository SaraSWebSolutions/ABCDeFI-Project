const WhitePaper = require("./whitePaper.model");
const fs = require("fs");
const path = require("path");

exports.addWhitePaper = async (req, res, next) => {
    try {
        const file = req.files?.file?.[0];
        if (!file) {
            return res.status(400).json({
                message: "Upload a file",
            });
        }
        const saved = await WhitePaper.create({
            file: file ? file.filename : null
        });
        res.status(201).json({
            message: "Uploaded successfully",
            data: saved,
        });
    } catch (err) {
        next(err)
    }
}

exports.updateWhitePaper = async (req, res, next) => {
    try {
        const { id } = req.body;
        const file = req.files?.file?.[0];

        if (!id) return res.status(400).json({ message: "ID required" });

        const whitePaper = await WhitePaper.findById(id);
        if (!whitePaper) return res.status(404).json({ message: "Not found" });

        const uploadFolder = path.join(process.cwd(), "uploads");

        const oldFile = whitePaper.file;
        if (oldFile) {
            const p = path.join(uploadFolder, oldFile);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }

        if (file) whitePaper.file = file.filename;

        await whitePaper.save();

        res.json({ message: "Updated", data: whitePaper });
    } catch (err) {
        next(err);
    }
}

exports.listWhitePaper = async (req, res, next) => {
    try {
        const whitePaperData = await WhitePaper.find();

        if (!whitePaperData.length) {
            return res.status(200).json({ data: null });
        }

        res.status(200).json({
            data: whitePaperData
        });
    } catch (err) {
        next(err);
    }
}