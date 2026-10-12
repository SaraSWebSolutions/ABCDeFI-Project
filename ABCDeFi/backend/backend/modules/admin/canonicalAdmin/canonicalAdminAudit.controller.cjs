const ALLOWED_MODULES = new Set(['ABCDTokenV2', 'ICO V3', 'Lending V2', 'P2P', 'EMIManagerV2', 'Referral', 'Reserve', 'Treasury', 'Legion', 'Marketplace', 'Legion Marketplace']);
const EMERGENCY_ACTIONS = new Set(['pause', 'unpause']);
const ICO_ACTIONS = new Set(['setEligibility', 'setOracle', 'setProceedsRecipient', 'configureTge', 'finalize', 'cancel', 'withdrawProceeds']);
// Legion administration is deliberately allowlisted.  This is not a generic
// NFT write channel: minting, transfers, marketplace settlement, and owner
// controls remain outside the Admin control plane.
const LEGION_ACTIONS = new Set(['updateMetadata', 'approveTransfer', 'invalidateTransfer']);
const ALLOWED_ACTIONS = new Set([...EMERGENCY_ACTIONS, ...ICO_ACTIONS]);
const ALLOWED_STATES = new Set(['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REVERTED', 'STALE', 'UNAVAILABLE']);
// Audit records are an operation lifecycle, not a mutable activity feed.
// In particular, a terminal result must never be reopened as PENDING, which
// would falsely imply that a blockchain operation is awaiting confirmation.
const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: new Set(['SUBMITTED', 'FAILED', 'UNAVAILABLE']),
  SUBMITTED: new Set(['CONFIRMED', 'FAILED', 'REVERTED', 'STALE', 'UNAVAILABLE']),
  CONFIRMED: new Set(),
  FAILED: new Set(),
  REVERTED: new Set(),
  STALE: new Set(),
  UNAVAILABLE: new Set(),
});

const positiveInteger = (value) => /^\d+$/.test(String(value || ''));
const transactionHash = (value) => /^0x[a-fA-F0-9]{64}$/.test(String(value || ''));

function validateTarget(module, action) {
  const allowed = module === 'ICO V3'
    ? ALLOWED_ACTIONS.has(action)
    : module === 'Legion'
      ? EMERGENCY_ACTIONS.has(action) || LEGION_ACTIONS.has(action)
      : EMERGENCY_ACTIONS.has(action);
  if (!ALLOWED_MODULES.has(module) || !allowed) {
    const error = new Error('Unsupported canonical emergency action.');
    error.status = 400;
    throw error;
  }
}

function runtimeContext(runtime) {
  return {
    runtimeFamily: runtime.family,
    chainId: String(runtime.chainId),
    rpcUrl: runtime.rpcUrl,
    deploymentIdentity: runtime.deploymentIdentity,
  };
}

function createCanonicalAdminAuditController({ auditModel, runtimeLoader, reconcileStaleAudit = null }) {
  const create = async (req, res, next) => {
    try {
      const { module, action, detail, transactionHash: hash } = req.body || {};
      validateTarget(module, action);
      if (!transactionHash(hash)) {
        const error = new Error('A canonical audit record requires a submitted transaction hash.'); error.status = 400; throw error;
      }
      const audit = await auditModel.create({
        administratorId: req.user.id,
        module,
        action,
        // PENDING is an in-memory wallet-confirmation state. Persisted audit
        // evidence starts only once the wallet returned a broadcast hash.
        state: 'SUBMITTED',
        transactionHash: hash,
        ...runtimeContext(runtimeLoader()),
        ...(typeof detail === 'string' && detail.trim() ? { detail: detail.trim() } : {}),
      });
      res.status(201).json({ success: true, audit });
    } catch (error) { next(error); }
  };

  const update = async (req, res, next) => {
    try {
      const { state, transactionHash: hash, blockNumber, expectedEventObserved, indexerObserved, detail } = req.body || {};
      if (!ALLOWED_STATES.has(state)) {
        const error = new Error('Unsupported canonical audit state.'); error.status = 400; throw error;
      }
      const audit = await auditModel.findOne({ _id: req.params.auditId, administratorId: req.user.id });
      if (!audit) { const error = new Error('Canonical audit record was not found.'); error.status = 404; throw error; }
      const runtime = runtimeContext(runtimeLoader());
      if (audit.runtimeFamily !== runtime.runtimeFamily || audit.chainId !== runtime.chainId || audit.deploymentIdentity !== runtime.deploymentIdentity) {
        const error = new Error('Canonical runtime identity changed; the audit record is stale.'); error.status = 409; throw error;
      }
      if (!ALLOWED_TRANSITIONS[audit.state]?.has(state)) {
        const error = new Error('Canonical audit lifecycle does not allow this state transition.'); error.status = 409; throw error;
      }
      if (state === 'SUBMITTED' && !transactionHash(hash)) { const error = new Error('Submitted state requires a transaction hash.'); error.status = 400; throw error; }
      if (state === 'CONFIRMED' && (!transactionHash(hash) || !positiveInteger(blockNumber) || expectedEventObserved !== true || indexerObserved !== true)) {
        const error = new Error('Confirmed state requires receipt block, expected event, and canonical indexer confirmation.'); error.status = 400; throw error;
      }
      audit.state = state;
      if (transactionHash(hash)) audit.transactionHash = hash;
      if (positiveInteger(blockNumber)) audit.blockNumber = String(blockNumber);
      if (typeof expectedEventObserved === 'boolean') audit.expectedEventObserved = expectedEventObserved;
      if (typeof indexerObserved === 'boolean') audit.indexerObserved = indexerObserved;
      if (typeof detail === 'string') audit.detail = detail.slice(0, 500) || null;
      audit.updatedAt = new Date();
      await audit.save();
      res.json({ success: true, audit });
    } catch (error) { next(error); }
  };

  const list = async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
      const audits = await auditModel.find({ administratorId: req.user.id }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
      res.json({ success: true, data: audits });
    } catch (error) { next(error); }
  };
  const reconcile = async (req, res, next) => {
    try {
      if (!reconcileStaleAudit) { const error = new Error('Canonical stale-audit reconciliation is unavailable.'); error.status = 503; throw error; }
      const audit = await auditModel.findOne({ _id: req.params.auditId, administratorId: req.user.id });
      if (!audit) { const error = new Error('Canonical audit record was not found.'); error.status = 404; throw error; }
      if (audit.state === 'CONFIRMED' && audit.reconciliation) return res.json({ success: true, idempotent: true, audit });
      const verified = await reconcileStaleAudit(audit);
      const filter = { _id: audit._id, administratorId: req.user.id, state: 'STALE', transactionHash: audit.transactionHash, runtimeFamily: audit.runtimeFamily, chainId: audit.chainId, rpcUrl: audit.rpcUrl, deploymentIdentity: audit.deploymentIdentity };
      const update = { $set: { state: 'CONFIRMED', blockNumber: verified.blockNumber, expectedEventObserved: true, indexerObserved: true, detail: 'Canonical receipt, event, role, indexer, and API evidence reconciled after bounded-wait staleness.', reconciliation: verified.evidence, updatedAt: new Date() } };
      const reconciled = await auditModel.findOneAndUpdate(filter, update, { new: true });
      if (reconciled) return res.json({ success: true, idempotent: false, audit: reconciled });
      const current = await auditModel.findOne({ _id: audit._id, administratorId: req.user.id });
      if (current?.state === 'CONFIRMED' && current.reconciliation) return res.json({ success: true, idempotent: true, audit: current });
      const error = new Error('The canonical audit record changed before reconciliation could be committed.'); error.status = 409; throw error;
    } catch (error) { next(error); }
  };
  return { create, update, list, reconcile };
}

module.exports = { createCanonicalAdminAuditController, ALLOWED_MODULES, ALLOWED_ACTIONS, LEGION_ACTIONS, ALLOWED_STATES, ALLOWED_TRANSITIONS };
