const { addSplashScreen, splashScreen, updateSplashScreen } = require("./splashScreen.controller");
const upload = require("../../../middleware/fileUpload");
const express = require("express");

const router = express.Router();

router.post("/add", upload.fields([
    { name: "image", maxCount: 1 },
]), addSplashScreen);
router.get("/", splashScreen);
router.post("/update", upload.fields([
    { name: "image", maxCount: 1 },
]), updateSplashScreen);

module.exports = router;