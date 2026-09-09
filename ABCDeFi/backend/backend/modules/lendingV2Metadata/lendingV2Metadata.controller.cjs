const fs = require('node:fs/promises');
const path = require('node:path');
const { Contract, JsonRpcProvider, getAddress, isAddress, keccak256, toUtf8Bytes } = require('ethers');
const { loadLendingV2Manifest } = require('../../config/lendingV2Manifest.cjs');
const { loadLendingV2Artifacts } = require('../../config/lendingV2Artifacts.cjs');
const Wallet = require('../user/userAccount/wallet.model');
const { storeNftAsset, storageProvider } = require('../../services/nftAssetStorage.cjs');

const UINT = /^\d+$/;
const DEFAULT_COMPLETION_ARTWORK = path.resolve(__dirname, '../../public/logo.png');

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function serviceUnavailable(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

function parseLoanId(body) {
  const loanId = typeof body?.loanId === 'string' && UINT.test(body.loanId) && BigInt(body.loanId) > 0n ? body.loanId : null;
  if (!loanId) throw badRequest('Loan ID must be a positive integer.');
  return loanId;
}

function completionCertificateMetadata(loanId, loan, requestId, platform, role, chainId = 31337) {
  const principal = BigInt(loan.principal);
  const agreedInterest = principal * BigInt(loan.aprBps) * (BigInt(loan.maturity) - BigInt(loan.start)) / (10_000n * 365n * 86_400n);
  const totalScheduled = principal + agreedInterest;
  const certificateValue = totalScheduled / 100n;
  return {
    name: `ABCDeFi ${role} Loan Completion Certificate V2 — Loan #${loanId}`,
    description: 'A soulbound ABCDeFi Lending V2 completion certificate. Its recorded 1% valuation is non-redeemable provenance/accounting metadata, not a claim on loan proceeds.',
    external_url: process.env.FRONTEND_URL || 'http://localhost:5173',
    attributes: [
      { trait_type: 'Protocol', value: 'ABCDeFi Lending V2' },
      { trait_type: 'Certificate role', value: role },
      { trait_type: 'Certificate state', value: 'Pending on-chain completion settlement' },
      { trait_type: 'Chain ID', value: String(chainId) },
      { trait_type: 'Loan ID', value: loanId },
      { trait_type: 'Request ID', value: requestId ? String(requestId) : 'Direct lending' },
      { trait_type: 'Borrower', value: loan.borrower },
      { trait_type: 'Lender', value: loan.lender },
      { trait_type: 'Platform', value: platform },
      { trait_type: 'Principal wei', value: principal.toString() },
      { trait_type: 'Agreed interest wei', value: agreedInterest.toString() },
      { trait_type: 'Total scheduled repayment wei', value: totalScheduled.toString() },
      { trait_type: 'Loan term seconds', value: (BigInt(loan.maturity) - BigInt(loan.start)).toString() },
      { trait_type: 'Original collateral wei', value: String(loan.collateralETH) },
      { trait_type: 'Certificate valuation BPS', value: '100' },
      { trait_type: 'Certificate valuation ABCD wei', value: certificateValue.toString() },
      { trait_type: 'Valuation basis', value: '1% of principal plus agreed interest; non-redeemable accounting metadata' },
    ],
  };
}

function assertPublicIpfsMetadata(stored) {
  if (stored.provider !== 'pinata' || typeof stored.metadataUri !== 'string' || !/^ipfs:\/\/[A-Za-z0-9]+$/.test(stored.metadataUri)) {
    throw serviceUnavailable('LoanNFTV2 completion certificates require public IPFS metadata from the configured Pinata provider.');
  }
}

async function loadPlatformArtwork(artworkPath = process.env.LOAN_NFT_COMPLETION_ARTWORK_PATH || DEFAULT_COMPLETION_ARTWORK) {
  if (typeof artworkPath !== 'string' || !artworkPath.trim()) throw serviceUnavailable('Platform completion certificate artwork is not configured.');
  let buffer;
  try { buffer = await fs.readFile(path.resolve(artworkPath)); }
  catch { throw serviceUnavailable('Platform completion certificate artwork is unavailable.'); }
  return { buffer, mimetype: 'image/png', originalname: 'abcdefi-loan-completion-certificate.png' };
}

async function linkedWalletForUser(walletModel, userId) {
  if (!userId) throw badRequest('Authenticated user is required to prepare completion certificates.');
  const query = walletModel.findOne({ userId, verified: true });
  const wallet = typeof query?.lean === 'function' ? await query.lean() : await query;
  if (!wallet?.walletAddress || !isAddress(wallet.walletAddress)) throw badRequest('Link and verify the borrower wallet before completing this loan.');
  return getAddress(wallet.walletAddress);
}

function createLoanMetadataController({
  manifest = loadLendingV2Manifest(),
  artifacts = loadLendingV2Artifacts(),
  provider = new JsonRpcProvider(manifest.rpcUrl),
  loanManager: loanManagerOverride,
  marketplace: marketplaceOverride,
  loanNFT: loanNFTOverride,
  walletModel = Wallet,
  store = storeNftAsset,
  platformArtwork,
} = {}) {
  return {
    prepareCompletion: async (req, res, next) => {
      try {
        if (storageProvider() !== 'pinata') throw serviceUnavailable('LoanNFTV2 completion certificates require configured Pinata/IPFS storage.');
        const loanId = parseLoanId(req.body);
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== Number(manifest.chainId)) throw badRequest('Canonical Lending V2 RPC is not on the configured chain.');
        const loanManager = loanManagerOverride || new Contract(manifest.contracts.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
        const marketplace = marketplaceOverride || new Contract(manifest.contracts.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, provider);
        const loanNFT = loanNFTOverride || new Contract(manifest.contracts.LoanNFTV2.address, artifacts.LoanNFTV2.abi, provider);
        const loan = await loanManager.getLoan(loanId);
        if (!loan.borrower || loan.borrower === '0x0000000000000000000000000000000000000000') throw badRequest('The selected canonical loan does not exist.');
        const linkedWallet = await linkedWalletForUser(walletModel, req.user?.id);
        if (linkedWallet.toLowerCase() !== getAddress(loan.borrower).toLowerCase()) throw badRequest('The authenticated account is not linked to this loan borrower wallet.');
        if (![0, 2, 6].includes(Number(loan.state)) || BigInt(loan.principalOutstanding) === 0n) throw badRequest('Completion certificates can be prepared only for an unsettled repayable loan.');
        const [requestId, platform, artwork] = await Promise.all([
          marketplace.requestByLoanId(loanId),
          loanNFT.platformRecipient(),
          platformArtwork ? platformArtwork() : loadPlatformArtwork(),
        ]);
        const completion = {};
        for (const role of ['Lender', 'Borrower', 'Platform']) {
          const stored = await store(artwork, completionCertificateMetadata(loanId, loan, requestId, platform, role, manifest.chainId));
          assertPublicIpfsMetadata(stored);
          completion[role.toLowerCase()] = { ...stored, metadataHash: keccak256(toUtf8Bytes(stored.metadataUri)) };
        }
        return res.status(201).json({ success: true, data: { completion, loan: { loanId, borrower: getAddress(loan.borrower), requestId: String(requestId) } } });
      } catch (error) { return next(error); }
    },
  };
}

module.exports = { completionCertificateMetadata, createLoanMetadataController, loadPlatformArtwork, parseLoanId };
