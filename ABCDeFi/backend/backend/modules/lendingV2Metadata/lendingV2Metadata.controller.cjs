const fs = require('node:fs/promises');
const path = require('node:path');
const { Contract, JsonRpcProvider, getAddress, isAddress, keccak256, toUtf8Bytes } = require('ethers');
const { loadLendingV2Manifest } = require('../../config/lendingV2Manifest.cjs');
const { loadLendingV2Artifacts } = require('../../config/lendingV2Artifacts.cjs');
const Wallet = require('../user/userAccount/wallet.model');
const crypto = require('node:crypto');
const { storeNftAsset, storageProvider, readPublicIpfsJson } = require('../../services/nftAssetStorage.cjs');

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
  const isP2P = BigInt(requestId) !== 0n;
  // The whitepaper's 1% completion value is USD-denominated but does not
  // define a valuation timestamp or oracle methodology. It must not be
  // represented by a derived ABCD amount for either lending path.
  return {
    name: `ABCDeFi ${role} Loan Completion Certificate V2 — Loan #${loanId}`,
    description: `An ABCDeFi Lending V2${isP2P ? ' P2P' : ''} completion certificate. USD-denominated 1% valuation is intentionally not recorded until its whitepaper-undefined valuation policy is approved.`,
    external_url: process.env.FRONTEND_URL || 'http://localhost:5173',
    attributes: [
      { trait_type: 'Protocol', value: 'ABCDeFi Lending V2' },
      { trait_type: 'Certificate role', value: role },
      // This document is prepared before the terminal transaction, but it is
      // only referenced by an ERC-721 after that transaction succeeds. Do not
      // permanently label a completed certificate as pending.
      { trait_type: 'Certificate lifecycle', value: 'Minted only after successful on-chain settlement' },
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
      { trait_type: 'USD valuation status', value: 'Blocked: valuation timestamp/oracle policy requires approval' },
    ],
  };
}

const roles = Object.freeze(['Lender', 'Borrower', 'Platform']);
const attributesOf = (document) => Object.fromEntries((document?.attributes || []).map((item) => [item?.trait_type, item?.value]));
const metadataFingerprint = (document) => keccak256(toUtf8Bytes(JSON.stringify(document)));
const metadataCidFromUri = (uri) => {
  const match = typeof uri === 'string' && uri.match(/^ipfs:\/\/([A-Za-z0-9]+)$/);
  if (!match) throw badRequest('Completion metadata must use canonical public IPFS URIs.');
  return match[1];
};

function assertPreparedDocument(document, expected) {
  const attributes = attributesOf(document);
  if (String(attributes['Loan ID']) !== expected.loanId
    || String(attributes['Chain ID']) !== String(expected.chainId)
    || String(attributes.Borrower || '').toLowerCase() !== expected.borrower.toLowerCase()
    || String(attributes['Certificate role']) !== expected.role) {
    throw serviceUnavailable('Completion metadata preparation failed canonical loan validation.');
  }
}

function recordsMatchPlan(records, planned) {
  return Array.isArray(records) && planned.every((item) => records.some((record) => record.role === item.role && record.fingerprint === item.fingerprint && record.validationStatus === 'VALIDATED' && typeof record.metadataUri === 'string'));
}

function assertExactPreparedDocument(document, item, expected) {
  assertPreparedDocument(document, { ...expected, role: item.role });
  const { image, ...metadata } = document;
  if (typeof image !== 'string' || !/^ipfs:\/\/[A-Za-z0-9]+$/.test(image) || metadataFingerprint(metadata) !== item.fingerprint) {
    throw serviceUnavailable('Completion metadata preparation failed canonical document validation.');
  }
  return { imageCid: metadataCidFromUri(image), imageUri: image };
}

function plannedCompletion(loanId, loan, requestId, platform, chainId, borrower) {
  const expected = { loanId, chainId, borrower };
  const planned = roles.map((role) => {
    const document = completionCertificateMetadata(loanId, loan, requestId, platform, role, chainId);
    assertPreparedDocument(document, { ...expected, role });
    return { role, document, fingerprint: metadataFingerprint(document) };
  });
  return { expected, planned };
}

function completionFromAudit(records) {
  return Object.fromEntries(records.map((record) => [record.role.toLowerCase(), {
    provider: 'pinata', cid: record.cid, metadataCid: record.cid, imageCid: record.imageCid,
    imageUri: record.imageUri, metadataUri: record.metadataUri, uri: record.metadataUri, metadataHash: record.metadataHash,
  }]));
}

async function saveAudit(audit, patch) {
  if (!audit) return;
  Object.assign(audit, patch);
  if (typeof audit.save === 'function') await audit.save();
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
  readMetadata = readPublicIpfsJson,
  auditModel,
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
        const { expected, planned } = plannedCompletion(loanId, loan, requestId, platform, manifest.chainId, getAddress(loan.borrower));
        const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, loanId, borrower: expected.borrower.toLowerCase() };
        let prior = null;
        if (auditModel?.findOne) {
          const query = auditModel.findOne({ ...identity, status: 'VALIDATED' }).sort?.({ requestedAt: -1 }) || auditModel.findOne({ ...identity, status: 'VALIDATED' });
          prior = typeof query?.lean === 'function' ? await query.lean() : await query;
          if (prior && recordsMatchPlan(prior.records, planned)) {
            const completion = completionFromAudit(prior.records);
            for (const item of planned) assertExactPreparedDocument(await readMetadata(completion[item.role.toLowerCase()].cid), item, expected);
            return res.status(200).json({ success: true, data: { completion, loan: { loanId, borrower: expected.borrower, requestId: String(requestId) }, correlationId: prior.correlationId, reused: true } });
          }
          const uncertainQuery = auditModel.findOne({ ...identity, status: { $in: ['PENDING_UPLOAD', 'OUTCOME_UNKNOWN', 'POST_UPLOAD_VALIDATION_FAILED'] } }).sort?.({ requestedAt: -1 }) || auditModel.findOne({ ...identity, status: { $in: ['PENDING_UPLOAD', 'OUTCOME_UNKNOWN', 'POST_UPLOAD_VALIDATION_FAILED'] } });
          const uncertain = typeof uncertainQuery?.lean === 'function' ? await uncertainQuery.lean() : await uncertainQuery;
          if (uncertain) throw serviceUnavailable('A prior completion-metadata upload outcome is unresolved; do not retry automatically.');
        }
        let audit = auditModel?.create ? await auditModel.create({ correlationId: crypto.randomUUID(), ...identity, requestedAt: new Date(), status: 'PENDING_UPLOAD', records: planned.map((item) => ({ role: item.role, fingerprint: item.fingerprint, metadataHash: '0x' + '0'.repeat(64), validationStatus: 'PLANNED' })) }) : null;
        const completion = {};
        try {
          for (const item of planned) {
            const stored = await store(artwork, item.document);
            assertPublicIpfsMetadata(stored);
            const returned = await readMetadata(stored.metadataCid);
            assertPreparedDocument(returned, { ...expected, role: item.role });
            const metadataHash = keccak256(toUtf8Bytes(stored.metadataUri));
            completion[item.role.toLowerCase()] = { ...stored, metadataHash };
            if (audit) {
              audit.records = audit.records.map((record) => {
                if (record.role !== item.role) return record;
                const plain = typeof record.toObject === 'function' ? record.toObject() : record;
                return { ...plain, metadataHash, cid: stored.metadataCid, metadataUri: stored.metadataUri, imageCid: stored.imageCid, imageUri: stored.imageUri, validationStatus: 'VALIDATED' };
              });
              await saveAudit(audit, {});
            }
          }
        } catch (error) {
          const status = /canonical loan validation/i.test(String(error?.message || '')) ? 'POST_UPLOAD_VALIDATION_FAILED' : 'OUTCOME_UNKNOWN';
          await saveAudit(audit, { status, failureReason: 'provider upload or public read-back could not be verified' });
          throw error;
        }
        await saveAudit(audit, { status: 'VALIDATED', failureReason: null });
        return res.status(201).json({ success: true, data: { completion, loan: { loanId, borrower: expected.borrower, requestId: String(requestId) }, correlationId: audit?.correlationId || null, reused: false } });
      } catch (error) { return next(error); }
    },
    associateCompletion: async (req, res, next) => {
      try {
        const loanId = parseLoanId(req.body);
        const supplied = req.body?.completion;
        if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.keys(supplied).sort().join(',') !== 'borrower,lender,platform') {
          throw badRequest('Exactly lender, borrower, and platform completion metadata records are required.');
        }
        if (!auditModel?.findOne || !auditModel?.create) throw serviceUnavailable('Completion metadata audit storage is unavailable.');
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== Number(manifest.chainId)) throw badRequest('Canonical Lending V2 RPC is not on the configured chain.');
        const loanManager = loanManagerOverride || new Contract(manifest.contracts.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
        const marketplace = marketplaceOverride || new Contract(manifest.contracts.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, provider);
        const loanNFT = loanNFTOverride || new Contract(manifest.contracts.LoanNFTV2.address, artifacts.LoanNFTV2.abi, provider);
        const loan = await loanManager.getLoan(loanId);
        if (!loan.borrower || loan.borrower === '0x0000000000000000000000000000000000000000') throw badRequest('The selected canonical loan does not exist.');
        const linkedWallet = await linkedWalletForUser(walletModel, req.user?.id);
        if (linkedWallet.toLowerCase() !== getAddress(loan.borrower).toLowerCase()) throw badRequest('The authenticated account is not linked to this loan borrower wallet.');
        if (![0, 2, 6].includes(Number(loan.state)) || BigInt(loan.principalOutstanding) === 0n) throw badRequest('Completion certificates can be associated only for an unsettled repayable loan.');
        const [requestId, platform] = await Promise.all([marketplace.requestByLoanId(loanId), loanNFT.platformRecipient()]);
        const { expected, planned } = plannedCompletion(loanId, loan, requestId, platform, manifest.chainId, getAddress(loan.borrower));
        const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, loanId, borrower: expected.borrower.toLowerCase() };
        const priorQuery = auditModel.findOne({ ...identity, status: 'VALIDATED' }).sort?.({ requestedAt: -1 }) || auditModel.findOne({ ...identity, status: 'VALIDATED' });
        const prior = typeof priorQuery?.lean === 'function' ? await priorQuery.lean() : await priorQuery;
        if (prior && recordsMatchPlan(prior.records, planned)) {
          const completion = completionFromAudit(prior.records);
          for (const item of planned) assertExactPreparedDocument(await readMetadata(completion[item.role.toLowerCase()].cid), item, expected);
          return res.status(200).json({ success: true, data: { completion, loan: { loanId, borrower: expected.borrower, requestId: String(requestId) }, correlationId: prior.correlationId, reused: true } });
        }
        const records = [];
        for (const item of planned) {
          const suppliedRecord = supplied[item.role.toLowerCase()];
          const metadataUri = typeof suppliedRecord === 'string' ? suppliedRecord : suppliedRecord?.metadataUri;
          const cid = metadataCidFromUri(metadataUri);
          const returned = await readMetadata(cid);
          const image = assertExactPreparedDocument(returned, item, expected);
          records.push({ role: item.role, fingerprint: item.fingerprint, metadataHash: keccak256(toUtf8Bytes(metadataUri)), cid, metadataUri, ...image, validationStatus: 'VALIDATED' });
        }
        const audit = await auditModel.create({ correlationId: crypto.randomUUID(), ...identity, requestedAt: new Date(), status: 'VALIDATED', records, failureReason: null });
        const completion = completionFromAudit(records);
        return res.status(201).json({ success: true, data: { completion, loan: { loanId, borrower: expected.borrower, requestId: String(requestId) }, correlationId: audit.correlationId, reused: false } });
      } catch (error) { return next(error); }
    },
  };
}

module.exports = { completionCertificateMetadata, createLoanMetadataController, loadPlatformArtwork, parseLoanId };
