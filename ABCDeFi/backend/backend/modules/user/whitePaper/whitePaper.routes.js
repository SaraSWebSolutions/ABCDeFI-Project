const { addWhitePaper, updateWhitePaper, listWhitePaper } = require("./whitePaper.controller");
const upload = require("../../../middleware/fileUpload");
const express = require("express");

const router = express.Router();

router.post("/add", upload.fields([
    { name: "file", maxCount: 1 }
]), addWhitePaper);
router.post("/update", upload.fields([
    { name: "file", maxCount: 1 }
]), updateWhitePaper);
router.get("/", listWhitePaper);

module.exports = router;