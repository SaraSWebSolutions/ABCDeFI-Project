const { DEFAULT_SCOPE } = require('./indexer');
const { getAddress, isAddress } = require('ethers');

const UINT = /^\d+$/;

function lower(value) { return typeof value === 'string' ? value.toLowerCase() : value; }
function normalizeWalletAddress(value) {
  // isAddress accepts valid all-lowercase addresses and valid EIP-55 checksum
  // addresses, while rejecting malformed values and incorrect mixed-case checksums.
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value).toLowerCase();
}
function boundedLimit(value, fallback = 50) {
  const parsed = value === undefined ? fallback : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}
function queryLean(query) { return typeof query.lean === 'function' ? query.lean() : query; }
function sortedFind(model, filter, sort, limit) {
  let query = model.find(filter);
  if (typeof query.sort === 'function') query = query.sort(sort);
  if (typeof query.limit === 'function') query = query.limit(limit);
  return queryLean(query);
}
function source(manifest) {
  return {
    kind: 'canonical-indexed-on-chain',
    chainId: String(manifest.chainId),
    network: manifest.network,
    deploymentVersion: manifest.deploymentVersion,
    deploymentBlock: String(manifest.deploymentBlock),
    contracts: manifest.contracts,
  };
}
function invalid(res, message) { return res.status(400).json({ status: 'INVALID_REQUEST', message }); }

function createLendingReadController({ models, manifest }) {
  if (!models || !manifest) throw new Error('models and canonical manifest are required');
  const chainId = String(manifest.chainId);
  const deploymentFilter = { chainId, deploymentVersion: manifest.deploymentVersion };

  async function availability() {
    const [deployment, checkpoint] = await Promise.all([
      queryLean(models.Deployment.findOne(deploymentFilter)),
      queryLean(models.BlockCheckpoint.findOne({ ...deploymentFilter, contractScope: DEFAULT_SCOPE })),
    ]);
    if (!deployment || !checkpoint?.lastProcessedBlock) {
      return {
        available: false,
        status: 'UNAVAILABLE',
        reason: 'The canonical lending indexer has not completed a confirmed sync for this deployment.',
        checkpoint: checkpoint?.lastProcessedBlock || null,
      };
    }
    return { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock };
  }
  async function requireAvailable(res, emptyData = []) {
    const state = await availability();
    if (!state.available) {
      res.json({ source: source(manifest), ...state, data: emptyData });
      return null;
    }
    return state;
  }
  async function readLoanProjection(loanId) {
    const loan = await queryLean(models.Loan.findOne({ chainId, loanManagerAddress: lower(manifest.contracts.loanManager), loanId }));
    if (!loan) return null;
    const [request, schedule, installments, repayments, defaultRecord, liquidation, certificates] = await Promise.all([
      queryLean(models.LoanRequest.findOne({ chainId, loanMarketplaceAddress: lower(manifest.contracts.loanMarketplace), loanId })),
      queryLean(models.EMISchedule.findOne({ chainId, emiManagerAddress: lower(manifest.contracts.emiManager), loanId })),
      sortedFind(models.EMIInstallment, { chainId, emiManagerAddress: lower(manifest.contracts.emiManager), loanId }, { installmentId: 1 }, 100),
      sortedFind(models.Repayment, { chainId, loanId }, { 'emiEvidence.blockNumber': 1, 'emiEvidence.logIndex': 1 }, 100),
      queryLean(models.LoanDefault.findOne({ chainId, loanId })),
      queryLean(models.Liquidation.findOne({ chainId, loanId })),
      sortedFind(models.LoanNFTCertificate, { chainId, loanId }, { tokenId: 1 }, 10),
    ]);
    return { loan, request, schedule, installments, repayments, default: defaultRecord, liquidation, loanNfts: certificates };
  }

  return {
    status: async (_req, res, next) => {
      try { res.json({ source: source(manifest), ...(await availability()) }); } catch (error) { next(error); }
    },
    openRequests: async (req, res, next) => {
      try {
        const state = await requireAvailable(res); if (!state) return;
        const data = await sortedFind(models.LoanRequest, { chainId, loanMarketplaceAddress: lower(manifest.contracts.loanMarketplace), status: 'OPEN' }, { 'createdEvidence.blockNumber': -1, 'createdEvidence.logIndex': -1 }, boundedLimit(req.query.limit));
        res.json({ source: source(manifest), ...state, data });
      } catch (error) { next(error); }
    },
    walletHistory: async (req, res, next) => {
      try {
        const wallet = normalizeWalletAddress(req.params.address);
        if (!wallet) return invalid(res, 'Wallet address must be a valid Ethereum address.');
        const state = await requireAvailable(res, { p2p: { requestsAsBorrower: [], requestsFunded: [], loans: [], installments: [], repayments: [], defaults: [], liquidations: [] }, directLending: { position: null, activities: [], liquidations: [] }, loanNfts: [] }); if (!state) return;
        const limit = boundedLimit(req.query.limit);
        const [requestsAsBorrower, requestsFunded, loans, position, certificates, directLiquidations, directActivities] = await Promise.all([
          sortedFind(models.LoanRequest, { chainId, borrower: wallet }, { 'createdEvidence.blockNumber': -1, 'createdEvidence.logIndex': -1 }, limit),
          sortedFind(models.LoanRequest, { chainId, lender: wallet }, { 'fundedEvidence.blockNumber': -1, 'fundedEvidence.logIndex': -1 }, limit),
          sortedFind(models.Loan, { chainId, $or: [{ borrower: wallet }, { lender: wallet }] }, { startTime: -1 }, limit),
          queryLean(models.DirectLendingPosition.findOne({ chainId, lendingPoolAddress: lower(manifest.contracts.lendingPool), borrower: wallet })),
          sortedFind(models.LoanNFTCertificate, { chainId, $or: [{ owner: wallet }, { borrower: wallet }, { lender: wallet }] }, { tokenId: -1 }, limit),
          sortedFind(models.DirectLiquidation, { chainId, $or: [{ borrower: wallet }, { liquidator: wallet }] }, { 'liquidationEvidence.blockNumber': -1, 'liquidationEvidence.logIndex': -1 }, limit),
          sortedFind(models.DirectLendingActivity, { chainId, lendingPoolAddress: lower(manifest.contracts.lendingPool), $or: [{ borrower: wallet }, { counterparty: wallet }] }, { 'evidence.blockNumber': -1, 'evidence.transactionIndex': -1, 'evidence.logIndex': -1 }, limit),
        ]);
        const loanIds = loans.map((loan) => loan.loanId);
        const scheduleFilter = loanIds.length ? { chainId, loanId: { $in: loanIds } } : { chainId, loanId: { $in: [] } };
        const [installments, repayments, defaults, p2pLiquidations] = await Promise.all([
          sortedFind(models.EMIInstallment, scheduleFilter, { dueDate: 1 }, limit * 12),
          sortedFind(models.Repayment, { chainId, $or: [{ borrower: wallet }, { lender: wallet }] }, { 'emiEvidence.blockNumber': -1, 'emiEvidence.logIndex': -1 }, limit),
          sortedFind(models.LoanDefault, { chainId, borrower: wallet }, { dueDate: -1 }, limit),
          sortedFind(models.Liquidation, { chainId, $or: [{ borrower: wallet }, { lender: wallet }] }, { 'marketplaceEvidence.blockNumber': -1, 'marketplaceEvidence.logIndex': -1 }, limit),
        ]);
        res.json({
          source: source(manifest), ...state, wallet,
          data: {
            p2p: { requestsAsBorrower, requestsFunded, loans, installments, repayments, defaults, liquidations: p2pLiquidations },
            directLending: { position: position || null, activities: directActivities, liquidations: directLiquidations },
            loanNfts: certificates,
          },
        });
      } catch (error) { next(error); }
    },
    loanDetail: async (req, res, next) => {
      try {
        const loanId = req.params.loanId;
        if (!UINT.test(loanId) || BigInt(loanId) === 0n) return invalid(res, 'Loan ID must be a positive uint256 decimal string.');
        const state = await requireAvailable(res); if (!state) return;
        const data = await readLoanProjection(loanId);
        if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null });
        res.json({ source: source(manifest), ...state, data });
      } catch (error) { next(error); }
    },
    loanHistory: async (req, res, next) => {
      try {
        const loanId = req.params.loanId;
        if (!UINT.test(loanId) || BigInt(loanId) === 0n) return invalid(res, 'Loan ID must be a positive uint256 decimal string.');
        const state = await requireAvailable(res, { installments: [], repayments: [], transitions: [], loanNfts: [] }); if (!state) return;
        const data = await readLoanProjection(loanId);
        if (!data) return res.status(404).json({ source: source(manifest), ...state, status: 'NOT_FOUND', data: null });
        const transitions = await sortedFind(models.LoanStateTransition, { chainId, loanManagerAddress: lower(manifest.contracts.loanManager), loanId }, { 'evidence.blockNumber': 1, 'evidence.logIndex': 1 }, 100);
        res.json({ source: source(manifest), ...state, data: { loan: data.loan, installments: data.installments, repayments: data.repayments, default: data.default, liquidation: data.liquidation, loanNfts: data.loanNfts, transitions } });
      } catch (error) { next(error); }
    },
  };
}

module.exports = { createLendingReadController, boundedLimit, normalizeWalletAddress, source };
