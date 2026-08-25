const { add, update, listPrivayPolicy } = require("./privacyPolicy.controller");
const express = require("express");

const router = express.Router();

router.post("/add", add);
router.post("/update", update);
router.get("/", listPrivayPolicy);

module.exports = router;