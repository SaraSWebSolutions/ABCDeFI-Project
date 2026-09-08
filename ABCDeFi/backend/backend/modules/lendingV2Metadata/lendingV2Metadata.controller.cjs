const { Contract, JsonRpcProvider, getAddress, isAddress, keccak256, parseEther, toUtf8Bytes, verifyMessage } = require('ethers');
const { loadLendingV2Manifest } = require('../../config/lendingV2Manifest.cjs');
const { loadLendingV2Artifacts } = require('../../config/lendingV2Artifacts.cjs');
const { storeNftAsset } = require('../../services/nftAssetStorage.cjs');

const MAX_INTENT_AGE_MS = 5 * 60 * 1000;
const SUPPORTED_TERMS = new Set([30 * 86_400, 90 * 86_400, 180 * 86_400]);
const UINT = /^\d+$/;
const NONCE = /^[A-Za-z0-9-]{16,128}$/;

function localDevelopmentEnabled() {
  return String(process.env.NODE_ENV).toLowerCase() === 'development'
    && String(process.env.AUTH_MODE).toLowerCase() === 'development';
}

function metadataIntentMessage(intent) {
  return [
    'ABCDeFi Lending V2 Direct Loan Metadata Intent',
    `chainId:${intent.chainId}`,
    `pool:${intent.pool.toLowerCase()}`,
    `depositId:${intent.depositId}`,
    `borrower:${intent.borrower.toLowerCase()}`,
    `principalWei:${intent.principalWei}`,
    `termSeconds:${intent.termSeconds}`,
    `issuedAt:${intent.issuedAt}`,
    `nonce:${intent.nonce}`,
  ].join('\n');
}

// A P2P request has no on-chain identifier until createRequest is mined.  The
// borrower therefore signs every immutable field that the request transaction
// will carry before we publish its certificate metadata.  This makes the
// published URI useful only for that exact request and avoids accepting a
// user-supplied URI/hash pair in the browser.
function p2pMetadataIntentMessage(intent) {
  return [
    'ABCDeFi Lending V2 P2P Request Metadata Intent',
    `chainId:${intent.chainId}`,
    `marketplace:${intent.marketplace.toLowerCase()}`,
    `borrower:${intent.borrower.toLowerCase()}`,
    `principalWei:${intent.principalWei}`,
    `collateralWei:${intent.collateralWei}`,
    `termSeconds:${intent.termSeconds}`,
    `issuedAt:${intent.issuedAt}`,
    `nonce:${intent.nonce}`,
  ].join('\n');
}

function completionMetadataIntentMessage(intent) {
  return [
    'ABCDeFi Lending V2 Completion Certificate Metadata Intent',
    `chainId:${intent.chainId}`,
    `loanId:${intent.loanId}`,
    `borrower:${intent.borrower.toLowerCase()}`,
    `issuedAt:${intent.issuedAt}`,
    `nonce:${intent.nonce}`,
  ].join('\n');
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseIntent(body, now) {
  const intent = {
    chainId: Number(body.chainId),
    pool: typeof body.pool === 'string' && isAddress(body.pool) ? getAddress(body.pool) : null,
    depositId: typeof body.depositId === 'string' && UINT.test(body.depositId) && BigInt(body.depositId) > 0n ? body.depositId : null,
    borrower: typeof body.borrower === 'string' && isAddress(body.borrower) ? getAddress(body.borrower) : null,
    principalWei: typeof body.principalWei === 'string' && UINT.test(body.principalWei) && BigInt(body.principalWei) > 0n ? body.principalWei : null,
    termSeconds: Number(body.termSeconds),
    issuedAt: Number(body.issuedAt),
    nonce: typeof body.nonce === 'string' ? body.nonce : '',
  };
  if (intent.chainId !== 31337 || !intent.pool || !intent.depositId || !intent.borrower || !intent.principalWei || !SUPPORTED_TERMS.has(intent.termSeconds) || !Number.isSafeInteger(intent.issuedAt) || !NONCE.test(intent.nonce)) {
    throw badRequest('Loan metadata intent is invalid.');
  }
  if (intent.issuedAt > now + 30_000 || now - intent.issuedAt > MAX_INTENT_AGE_MS) {
    throw badRequest('Loan metadata intent has expired. Create a new signed intent.');
  }
  return intent;
}

function parseP2PIntent(body, now) {
  const intent = {
    chainId: Number(body.chainId),
    marketplace: typeof body.marketplace === 'string' && isAddress(body.marketplace) ? getAddress(body.marketplace) : null,
    borrower: typeof body.borrower === 'string' && isAddress(body.borrower) ? getAddress(body.borrower) : null,
    principalWei: typeof body.principalWei === 'string' && UINT.test(body.principalWei) && BigInt(body.principalWei) > 0n ? body.principalWei : null,
    collateralWei: typeof body.collateralWei === 'string' && UINT.test(body.collateralWei) && BigInt(body.collateralWei) > 0n ? body.collateralWei : null,
    termSeconds: Number(body.termSeconds),
    issuedAt: Number(body.issuedAt),
    nonce: typeof body.nonce === 'string' ? body.nonce : '',
  };
  if (intent.chainId !== 31337 || !intent.marketplace || !intent.borrower || !intent.principalWei || !intent.collateralWei || !SUPPORTED_TERMS.has(intent.termSeconds) || !Number.isSafeInteger(intent.issuedAt) || !NONCE.test(intent.nonce)) {
    throw badRequest('P2P request metadata intent is invalid.');
  }
  if (intent.issuedAt > now + 30_000 || now - intent.issuedAt > MAX_INTENT_AGE_MS) {
    throw badRequest('P2P request metadata intent has expired. Create a new signed intent.');
  }
  return intent;
}

function parseCompletionIntent(body, now) {
  const intent = {
    chainId: Number(body.chainId),
    loanId: typeof body.loanId === 'string' && UINT.test(body.loanId) && BigInt(body.loanId) > 0n ? body.loanId : null,
    borrower: typeof body.borrower === 'string' && isAddress(body.borrower) ? getAddress(body.borrower) : null,
    issuedAt: Number(body.issuedAt),
    nonce: typeof body.nonce === 'string' ? body.nonce : '',
  };
  if (intent.chainId !== 31337 || !intent.loanId || !intent.borrower || !Number.isSafeInteger(intent.issuedAt) || !NONCE.test(intent.nonce)) throw badRequest('Completion certificate metadata intent is invalid.');
  if (intent.issuedAt > now + 30_000 || now - intent.issuedAt > MAX_INTENT_AGE_MS) throw badRequest('Completion certificate metadata intent has expired. Create a new signed intent.');
  return intent;
}

function certificateMetadata(intent, collateralWei, maxBorrowableWei) {
  return {
    name: `ABCDeFi Direct Loan Certificate V2 — Pending Deposit #${intent.depositId}`,
    description: 'Pre-origination metadata for an ABCDeFi Lending V2 direct loan. The on-chain LoanNFTV2 certificate is minted only if the signed borrower opens this loan successfully.',
    external_url: process.env.FRONTEND_URL || 'http://localhost:5173',
    attributes: [
      { trait_type: 'Protocol', value: 'ABCDeFi Lending V2' },
      { trait_type: 'Certificate state', value: 'Pre-origination' },
      { trait_type: 'Chain ID', value: String(intent.chainId) },
      { trait_type: 'Lending pool', value: intent.pool },
      { trait_type: 'Pending deposit ID', value: intent.depositId },
      { trait_type: 'Borrower', value: intent.borrower },
      { trait_type: 'Principal wei', value: intent.principalWei },
      { trait_type: 'Term seconds', value: String(intent.termSeconds) },
      { trait_type: 'Collateral wei', value: collateralWei.toString() },
      { trait_type: 'Maximum borrowable wei', value: maxBorrowableWei.toString() },
    ],
  };
}

function p2pCertificateMetadata(intent) {
  return {
    name: 'ABCDeFi P2P Loan Request Certificate V2',
    description: 'Pre-funding metadata for an ABCDeFi Lending V2 P2P request. The on-chain LoanNFTV2 certificate is minted only if a lender funds this exact signed request.',
    external_url: process.env.FRONTEND_URL || 'http://localhost:5173',
    attributes: [
      { trait_type: 'Protocol', value: 'ABCDeFi Lending V2' },
      { trait_type: 'Certificate state', value: 'Pre-funding P2P request' },
      { trait_type: 'Chain ID', value: String(intent.chainId) },
      { trait_type: 'Marketplace', value: intent.marketplace },
      { trait_type: 'Borrower', value: intent.borrower },
      { trait_type: 'Principal wei', value: intent.principalWei },
      { trait_type: 'Collateral wei', value: intent.collateralWei },
      { trait_type: 'Term seconds', value: String(intent.termSeconds) },
    ],
  };
}

function completionCertificateMetadata(intent, loan, requestId, platform, role) {
  const principal = BigInt(loan.principal);
  const agreedInterest = principal * BigInt(loan.aprBps) * (BigInt(loan.maturity) - BigInt(loan.start)) / (10_000n * 365n * 86_400n);
  const totalScheduled = principal + agreedInterest;
  const certificateValue = totalScheduled / 100n;
  return {
    name: `ABCDeFi ${role} Loan Completion Certificate V2 — Loan #${intent.loanId}`,
    description: 'A soulbound ABCDeFi Lending V2 completion certificate. Its recorded 1% valuation is non-redeemable provenance/accounting metadata, not a claim on loan proceeds.',
    external_url: process.env.FRONTEND_URL || 'http://localhost:5173',
    attributes: [
      { trait_type: 'Protocol', value: 'ABCDeFi Lending V2' },
      { trait_type: 'Certificate role', value: role },
      { trait_type: 'Certificate state', value: 'Pending on-chain completion settlement' },
      { trait_type: 'Chain ID', value: String(intent.chainId) },
      { trait_type: 'Loan ID', value: intent.loanId },
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
    const error = new Error('LoanNFTV2 requires public IPFS metadata. Configure the Pinata provider; local HTTP staging cannot be minted.');
    error.status = 503;
    throw error;
  }
}

function createLoanMetadataController({
  manifest = loadLendingV2Manifest(),
  artifacts = loadLendingV2Artifacts(),
  provider = new JsonRpcProvider(manifest.rpcUrl),
  pool,
  loanManager: loanManagerOverride,
  marketplace: marketplaceOverride,
  loanNFT: loanNFTOverride,
  store = storeNftAsset,
  now = () => Date.now(),
  recoverSigner = verifyMessage,
} = {}) {
  const lendingPool = pool || new Contract(manifest.contracts.LendingPoolV2.address, artifacts.LendingPoolV2.abi, provider);
  const consumedSignatures = new Map();
  const consumeSignature = (signature, expiresAt) => {
    for (const [key, expiry] of consumedSignatures) if (expiry <= now()) consumedSignatures.delete(key);
    if (consumedSignatures.has(signature)) throw badRequest('This signed loan metadata intent was already used.');
    consumedSignatures.set(signature, expiresAt);
  };

  return {
    createDirect: async (req, res, next) => {
      try {
        if (!localDevelopmentEnabled()) return res.status(404).json({ success: false, message: 'Local Lending V2 metadata publishing is unavailable.' });
        const intent = parseIntent(req.body || {}, now());
        if (intent.pool.toLowerCase() !== manifest.contracts.LendingPoolV2.address.toLowerCase()) throw badRequest('Loan metadata intent uses a non-canonical LendingPoolV2 address.');
        const signature = typeof req.body.signature === 'string' ? req.body.signature : '';
        if (!signature) throw badRequest('A borrower signature is required to publish loan metadata.');
        const recovered = getAddress(recoverSigner(metadataIntentMessage(intent), signature));
        if (recovered.toLowerCase() !== intent.borrower.toLowerCase()) throw badRequest('Loan metadata signature does not belong to the selected borrower.');
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== Number(manifest.chainId)) throw badRequest('Canonical Lending V2 RPC is not on chain 31337.');
        const deposit = await lendingPool.pendingCollateral(intent.depositId);
        // `pendingCollateral` is authoritative for both ownership and the exact
        // ETH amount that will be bound to the subsequent borrow transaction.
        if (!deposit.active || getAddress(deposit.borrower).toLowerCase() !== intent.borrower.toLowerCase()) throw badRequest('The selected pending deposit is not active for this borrower.');
        const collateral = BigInt(deposit.amount);
        const authoritativeMaximum = await lendingPool.maxBorrowable(collateral);
        if (BigInt(intent.principalWei) > authoritativeMaximum) throw badRequest('Requested principal exceeds the current on-chain borrowing capacity.');
        const stored = await store(req.file, certificateMetadata(intent, collateral, authoritativeMaximum));
        assertPublicIpfsMetadata(stored);
        consumeSignature(signature, intent.issuedAt + MAX_INTENT_AGE_MS);
        const metadataHash = keccak256(toUtf8Bytes(stored.metadataUri));
        return res.status(201).json({
          success: true,
          data: { ...stored, metadataHash, intent: { depositId: intent.depositId, borrower: intent.borrower, principalWei: intent.principalWei, termSeconds: String(intent.termSeconds) } },
        });
      } catch (error) { return next(error); }
    },
    createP2P: async (req, res, next) => {
      try {
        if (!localDevelopmentEnabled()) return res.status(404).json({ success: false, message: 'Local Lending V2 metadata publishing is unavailable.' });
        const intent = parseP2PIntent(req.body || {}, now());
        if (intent.marketplace.toLowerCase() !== manifest.contracts.LoanMarketplaceV2.address.toLowerCase()) throw badRequest('P2P metadata intent uses a non-canonical LoanMarketplaceV2 address.');
        const signature = typeof req.body.signature === 'string' ? req.body.signature : '';
        if (!signature) throw badRequest('A borrower signature is required to publish P2P request metadata.');
        const recovered = getAddress(recoverSigner(p2pMetadataIntentMessage(intent), signature));
        if (recovered.toLowerCase() !== intent.borrower.toLowerCase()) throw badRequest('P2P metadata signature does not belong to the selected borrower.');
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== Number(manifest.chainId)) throw badRequest('Canonical Lending V2 RPC is not on chain 31337.');
        const code = await provider.getCode(manifest.contracts.LoanMarketplaceV2.address);
        if (!code || code === '0x') throw badRequest('Canonical LoanMarketplaceV2 has no deployed bytecode.');
        const stored = await store(req.file, p2pCertificateMetadata(intent));
        assertPublicIpfsMetadata(stored);
        consumeSignature(signature, intent.issuedAt + MAX_INTENT_AGE_MS);
        const metadataHash = keccak256(toUtf8Bytes(stored.metadataUri));
        return res.status(201).json({
          success: true,
          data: { ...stored, metadataHash, intent: { borrower: intent.borrower, principalWei: intent.principalWei, collateralWei: intent.collateralWei, termSeconds: String(intent.termSeconds) } },
        });
      } catch (error) { return next(error); }
    },
    createCompletion: async (req, res, next) => {
      try {
        if (!localDevelopmentEnabled()) return res.status(404).json({ success: false, message: 'Local Lending V2 completion metadata publishing is unavailable.' });
        const intent = parseCompletionIntent(req.body || {}, now());
        const signature = typeof req.body.signature === 'string' ? req.body.signature : '';
        if (!signature) throw badRequest('A borrower signature is required to publish completion certificate metadata.');
        const recovered = getAddress(recoverSigner(completionMetadataIntentMessage(intent), signature));
        if (recovered.toLowerCase() !== intent.borrower.toLowerCase()) throw badRequest('Completion certificate signature does not belong to the loan borrower.');
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== Number(manifest.chainId)) throw badRequest('Canonical Lending V2 RPC is not on chain 31337.');
        const loanManager = loanManagerOverride || new Contract(manifest.contracts.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
        const marketplace = marketplaceOverride || new Contract(manifest.contracts.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, provider);
        const loanNFT = loanNFTOverride || new Contract(manifest.contracts.LoanNFTV2.address, artifacts.LoanNFTV2.abi, provider);
        const loan = await loanManager.getLoan(intent.loanId);
        if (!loan.borrower || loan.borrower === '0x0000000000000000000000000000000000000000' || getAddress(loan.borrower).toLowerCase() !== intent.borrower.toLowerCase()) throw badRequest('The selected canonical loan does not belong to this borrower.');
        if (![0, 2, 6].includes(Number(loan.state)) || BigInt(loan.principalOutstanding) === 0n) throw badRequest('Completion metadata can be published only for an unsettled repayable loan.');
        const requestId = await marketplace.requestByLoanId(intent.loanId);
        const platform = await loanNFT.platformRecipient();
        const completion = {};
        for (const role of ['Lender', 'Borrower', 'Platform']) {
          const stored = await store(req.file, completionCertificateMetadata(intent, loan, requestId, platform, role));
          assertPublicIpfsMetadata(stored);
          completion[role.toLowerCase()] = { ...stored, metadataHash: keccak256(toUtf8Bytes(stored.metadataUri)) };
        }
        consumeSignature(signature, intent.issuedAt + MAX_INTENT_AGE_MS);
        return res.status(201).json({ success: true, data: { completion, intent: { loanId: intent.loanId, borrower: intent.borrower, requestId: String(requestId) } } });
      } catch (error) { return next(error); }
    },
  };
}

module.exports = { MAX_INTENT_AGE_MS, certificateMetadata, completionCertificateMetadata, completionMetadataIntentMessage, createLoanMetadataController, metadataIntentMessage, p2pCertificateMetadata, p2pMetadataIntentMessage, parseCompletionIntent, parseIntent, parseP2PIntent };
