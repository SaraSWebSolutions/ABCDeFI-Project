const express = require('express');
const multer = require('multer');
const auth = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/authMiddleware');
const controller = require('./nftStorage.controller');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, done) => done(null, file.mimetype === 'image/png') });
router.post('/metadata', auth, requireAdmin, upload.single('asset'), controller.createMetadata);
module.exports = router;
