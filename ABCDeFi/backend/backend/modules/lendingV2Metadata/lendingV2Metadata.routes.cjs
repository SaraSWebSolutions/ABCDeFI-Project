const express = require('express');
const multer = require('multer');
const auth = require('../../middleware/authMiddleware');
const { createLoanMetadataController } = require('./lendingV2Metadata.controller.cjs');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, done) => {
    if (file.mimetype !== 'image/png') return done(Object.assign(new Error('Only PNG loan-certificate artwork is accepted.'), { status: 400 }));
    return done(null, true);
  },
});
const router = express.Router();
const controller = createLoanMetadataController();

router.post('/metadata/direct', auth, (req, res, next) => upload.single('asset')(req, res, error => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') error.message = 'Loan-certificate PNG artwork must be no larger than 5 MB.';
  error.status ||= 400;
  return next(error);
}), controller.createDirect);

router.post('/metadata/p2p', auth, (req, res, next) => upload.single('asset')(req, res, error => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') error.message = 'Loan-certificate PNG artwork must be no larger than 5 MB.';
  error.status ||= 400;
  return next(error);
}), controller.createP2P);

router.post('/metadata/completion', auth, (req, res, next) => upload.single('asset')(req, res, error => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') error.message = 'Loan-certificate PNG artwork must be no larger than 5 MB.';
  error.status ||= 400;
  return next(error);
}), controller.createCompletion);

module.exports = router;
