const { Contract, JsonRpcProvider, getAddress, isAddress } = require('ethers');
const { SCOPE } = require('./indexer.cjs');
const UINT = /^\d+$/;
const lower = (value) => value.toLowerCase();
const normalizeWallet = (value) => typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null;
const toJson = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(toJson) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)])) : value;
const boundedLimit = (value, fallback = 50) => Math.min(100, Math.max(1, Number.isInteger(Number(value)) ? Number(value) : fallback));

function createLendingV2ReadController({ manifest, artifacts, models, provider = new JsonRpcProvider(manifest.rpcUrl) }) {
  const manager = new Contract(manifest.contracts.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
  const marketplace = new Contract(manifest.contracts.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, provider);
  const liquidation = new Contract(manifest.contracts.LiquidationV2.address, artifacts.LiquidationV2.abi, provider);
  const emi = new Contract(manifest.contracts.EMIManagerV2.address, artifacts.EMIManagerV2.abi, provider);
  const nft = new Contract(manifest.contracts.LoanNFTV2.address, artifacts.LoanNFTV2.abi, provider);
  const source = () => ({ kind: 'canonical-v2-indexed-on-chain', chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, contracts: Object.fromEntries(Object.entries(manifest.contracts).map(([name, record]) => [name, record.address])) });
  const availability = async () => {
    const checkpoint = await models.V2BlockCheckpoint.findOne({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, scope: SCOPE }).lean();
    return checkpoint?.lastProcessedBlock ? { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock } : { available: false, status: 'UNAVAILABLE', reason: 'The canonical Lending V2 indexer has not completed a confirmed sync for this deployment.', checkpoint: null };
  };
  const requireAvailable = async (res, data = []) => { const state = await availability(); if (!state.available) { res.json({ source: source(), ...state, data }); return null; } return state; };
  const readLoan = async (loanId) => {
    const record = await manager.getLoan(loanId);
    if (lower(record.borrower) === '0x0000000000000000000000000000000000000000') return null;
    const [accruedInterest, outstanding, lateFee, totalRepayment, state, currentLtvBps, healthFactor, liquidatable, quote, schedule, certificate] = await Promise.all([
      manager.previewAccruedInterest(loanId), manager.previewOutstanding(loanId), manager.previewLateFee(loanId), manager.previewTotalRepayment(loanId), manager.previewLoanStatus(loanId),
      liquidation.currentLtvBps(loanId), liquidation.healthFactor(loanId), liquidation.isLiquidatable(loanId), liquidation.previewLiquidation(loanId), emi.getSchedule(loanId), nft.loanCertificate(loanId),
    ]);
    const certificateInfo = certificate[0] === 0n ? null : { tokenId: certificate[0], owner: await nft.ownerOf(certificate[0]), tokenURI: await nft.tokenURI(certificate[0]), certificate: await nft.certificates(certificate[0]) };
    return toJson({ loan: record, previews: { accruedInterest, outstanding, lateFee, totalRepayment, state, currentLtvBps, healthFactor, liquidatable, liquidation: quote }, schedule, certificate: certificateInfo });
  };
  const eventList = (filter, count) => models.V2ChainEvent.find({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, ...filter }).sort({ blockNumber: 1, logIndex: 1 }).limit(count).lean();
  return {
    status: async (_req, res, next) => { try { res.json({ source: source(), ...(await availability()) }); } catch (error) { next(error); } },
    openRequests: async (req, res, next) => { try {
      const state = await requireAvailable(res); if (!state) return;
      const created = await eventList({ contractName: 'LoanMarketplaceV2', eventName: 'RequestCreated' }, boundedLimit(req.query.limit)); const data = [];
      for (const event of created) { const request = await marketplace.requests(event.args.requestId); if (Number(request.state) === 0) data.push({ requestId: event.args.requestId, request: toJson(request), createdEvidence: event }); }
      res.json({ source: source(), ...state, data });
    } catch (error) { next(error); } },
    wallet: async (req, res, next) => { try {
      const wallet = normalizeWallet(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be a valid Ethereum address.' });
      const state = await requireAvailable(res, { events: [], loanIds: [] }); if (!state) return;
      const all = await eventList({}, 500); const events = all.filter((event) => JSON.stringify(event.args).toLowerCase().includes(wallet)).slice(-boundedLimit(req.query.limit));
      const loanIds = [...new Set(events.map((event) => event.args.loanId).filter((id) => typeof id === 'string' && UINT.test(id)))];
      res.json({ source: source(), ...state, wallet, data: { events, loanIds } });
    } catch (error) { next(error); } },
    loan: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res); if (state) { const data = await readLoan(id); if (!data) return res.status(404).json({ source: source(), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(), ...state, data }); } } catch (error) { next(error); } },
    history: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, []); if (state) { const all = await eventList({}, 500); res.json({ source: source(), ...state, data: all.filter((event) => String(event.args.loanId || '') === id).slice(-100) }); } } catch (error) { next(error); } },
    preview: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res); if (state) { const data = await readLoan(id); if (!data) return res.status(404).json({ source: source(), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(), ...state, data: data.previews }); } } catch (error) { next(error); } },
  };
}
module.exports = { createLendingV2ReadController, normalizeWallet };
