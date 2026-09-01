const express = require('express');
const multer = require('multer');
const auth = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/authMiddleware');
const controller = require('./nftStorage.controller');
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, done) => {
    if (file.mimetype !== 'image/png') {
      const error = new Error('Only PNG NFT assets are accepted.');
      error.status = 400;
      return done(error);
    }
    return done(null, true);
  },
});

function uploadAsset(req, res, next) {
  upload.single('asset')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      error.message = 'PNG NFT assets must be no larger than 5 MB.';
      error.status = 400;
    }
    return next(error);
  });
}

router.post('/metadata', auth, requireAdmin, uploadAsset, controller.createMetadata);
module.exports = router;
