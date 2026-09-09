const express = require('express');
const auth = require('../../middleware/authMiddleware');
const { createLoanMetadataController } = require('./lendingV2Metadata.controller.cjs');

const router = express.Router();
const controller = createLoanMetadataController();

// Completion metadata is platform-managed and may only be prepared by the
// authenticated account linked to the canonical borrower wallet. There are no
// origin metadata endpoints: a request or a borrow is not a LoanNFT event.
router.post('/metadata/completion', auth, controller.prepareCompletion);

module.exports = router;
