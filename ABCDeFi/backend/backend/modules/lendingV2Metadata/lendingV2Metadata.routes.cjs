const express = require('express');
const auth = require('../../middleware/authMiddleware');
const { createLoanMetadataController } = require('./lendingV2Metadata.controller.cjs');
const { V2CompletionMetadataAudit } = require('../lendingV2Projection/models.cjs');

const router = express.Router();
const controller = createLoanMetadataController({ auditModel: V2CompletionMetadataAudit });

// Completion metadata is platform-managed and may only be prepared by the
// authenticated account linked to the canonical borrower wallet. There are no
// origin metadata endpoints: a request or a borrow is not a LoanNFT event.
router.post('/metadata/completion', auth, controller.prepareCompletion);
// Associates only pre-existing public IPFS documents after canonical read-back
// validation. This endpoint does not call the provider upload API.
router.post('/metadata/completion/associate', auth, controller.associateCompletion);

module.exports = router;
