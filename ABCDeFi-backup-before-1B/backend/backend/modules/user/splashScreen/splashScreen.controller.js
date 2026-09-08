const SplashScreen = require("./splashScreen.model");
const Ico = require("../../ico/ico.model");
const fs = require("fs");
const path = require("path");

exports.addSplashScreen = async (req, res, next) => {
    const { title, caption } = req.body;
    try {
        const image = req.files?.image?.[0];
        if (!image) {
            return res.status(400).json({
                message: "Upload an image",
            });
        }
        const saved = await SplashScreen.create({
            image: image ? image.filename : null,
            title,
            caption
        });
        res.status(201).json({
            message: "Uploaded successfully",
            data: saved,
        });
    } catch (err) {
        next(err)
    }
}

exports.splashScreen = async (req, res, next) => {
    try {
        const loadingData = await SplashScreen.find();

        const ico = await Ico.findOne().sort({ startDate: -1 });

        if (!loadingData.length) {
            return res.status(200).json({ data: null, icoStartDate: ico ? ico.startDate : null });
        }

        res.status(200).json({
            data: loadingData,
            icoStartDate: ico ? ico.startDate : null
        });
    } catch (err) {
        next(err);
    }
};

exports.updateSplashScreen = async (req, res, next) => {
    try {
        const { id, title, caption } = req.body;
        const image = req.files?.image?.[0];

        if (!id) return res.status(400).json({ message: "ID required" });

        const splashScreen = await SplashScreen.findById(id);
        if (!splashScreen) return res.status(404).json({ message: "Not found" });

        const uploadFolder = path.join(process.cwd(), "uploads");

        const oldFile = splashScreen.image;
        if (oldFile) {
            const p = path.join(uploadFolder, oldFile);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }

        if (image) splashScreen.image = image.filename;
        if (title) splashScreen.title = title;
        if (caption) splashScreen.caption = caption;

        await splashScreen.save();

        res.json({ message: "Updated", data: splashScreen });
    } catch (err) {
        next(err);
    }
};