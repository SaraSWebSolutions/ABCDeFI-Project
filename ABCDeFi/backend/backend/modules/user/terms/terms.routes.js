const { add, update, listTerms } = require("./terms.controller");
const express = require("express");

const router = express.Router();

router.post("/add", add);
router.post("/update", update);
router.get("/", listTerms);

module.exports = router;