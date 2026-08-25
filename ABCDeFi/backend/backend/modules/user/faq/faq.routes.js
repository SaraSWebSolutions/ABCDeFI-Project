const express = require("express");
const router = express.Router();
const faqController = require("./faq.controller");

router.post("/", faqController.createFAQ);
router.get("/", faqController.getFAQs);
router.get("/:id", faqController.getFAQById);
router.post("/update", faqController.updateFAQ);
router.post("/delete", faqController.deleteFAQ);

module.exports = router;