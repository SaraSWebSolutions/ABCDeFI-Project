const { add, update, listAbout } = require("./about.controller");

const express = require("express");

const router = express.Router();

router.post("/add", add);
router.post("/update", update);
router.get("/", listAbout);

module.exports = router;