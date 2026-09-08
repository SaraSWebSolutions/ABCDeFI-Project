const { JsonRpcProvider, formatEther, isAddress } = require('ethers');
const { loadLendingManifest } = require('../../config/lendingManifest.cjs');
const { ChainEvent } = require('../lendingProjection/models');
const Wallet = require('../user/userAccount/wallet.model');

const PARTICIPANT_FIELDS = [
  'from', 'to', 'owner', 'buyer', 'seller', 'borrower', 'lender', 'payer',
  'recipient', 'beneficiary', 'user', 'account', 'referrer', 'referee',
];

function eventType(eventName) {
  switch (eventName) {
    case 'Transfer': return 'Token Transfer';
    case 'TokensPurchased':
    case 'Purchased': return 'Buy Token';
    case 'Staked': return 'Stake';
    case 'Unstaked': return 'Unstake';
    case 'RewardsClaimed':
    case 'RewardClaimed': return 'Claim Reward';
    case 'CollateralETHDeposited':
    case 'CollateralERC20Deposited': return 'Deposit Collateral';
    case 'CollateralETHReleased':
    case 'CollateralERC20Released': return 'Release Collateral';
    case 'LoanCreated': return 'Borrow';
    case 'LoanRepaid':
    case 'EMIPaid': return 'Repay';
    case 'TransferSingle':
    case 'TransferBatch':
    case 'ParticipantNFTMinted':
    case 'GuruNFTMinted':
    case 'ReputationNFTMinted':
    case 'LoanNFTMinted': return 'NFT Mint';
    case 'NFTPurchased': return 'NFT Purchase';
    case 'ReferralRewardPaid': return 'Referral Reward';
    default: return 'Protocol Event';
  }
}

function eventAmount(event) {
  const args = event.args || {};
  const rawAmount = args.value ?? args.amount ?? args.principal ?? args.emiAmount ?? null;
  if (rawAmount === null || !/^\d+$/.test(String(rawAmount))) return { amount: 'Unavailable', token: '—' };
  const asset = event.eventName.includes('CollateralETH') ? 'ETH' : 'ABCD';
  return { amount: `${formatEther(BigInt(rawAmount))} ${asset}`, token: asset };
}

function eventParticipant(args, requestedAddress) {
  for (const field of PARTICIPANT_FIELDS) {
    const value = args?.[field];
    if (typeof value === 'string' && value.toLowerCase() === requestedAddress) return value;
  }
  return requestedAddress;
}

function eventQuery(address) {
  return PARTICIPANT_FIELDS.map((field) => ({ [`args.${field}`]: address }));
}

exports.getCurrentWalletHistory = async (req, res, next) => {
  try {
    const requested = String(req.query.wallet || '').toLowerCase();
    if (!isAddress(requested)) {
      return res.status(400).json({ success: false, message: 'A valid connected wallet address is required.' });
    }

    const manifest = loadLendingManifest();
    const linkedWallet = await Wallet.findOne({
      userId: req.user.id,
      walletAddress: requested,
      verified: true,
      chainId: manifest.chainId,
    }).lean();
    if (!linkedWallet) {
      return res.status(403).json({ success: false, message: 'The connected wallet is not verified for this account on the canonical network.' });
    }

    const events = await ChainEvent.find({
      chainId: String(manifest.chainId),
      removed: false,
      $or: eventQuery(requested),
    }).sort({ blockNumber: -1, transactionIndex: -1, logIndex: -1 }).limit(100).lean();

    const provider = new JsonRpcProvider(manifest.rpcUrl);
    const blockTimestamps = new Map();
    await Promise.all(events.map(async (event) => {
      const key = String(event.blockNumber);
      if (!blockTimestamps.has(key)) {
        const block = await provider.getBlock(Number(event.blockNumber));
        blockTimestamps.set(key, block ? new Date(Number(block.timestamp) * 1000).toISOString() : null);
      }
    }));

    return res.json({
      success: true,
      source: { chainId: manifest.chainId, network: manifest.network, deploymentVersion: manifest.deploymentVersion },
      data: events.map((event) => {
        const amount = eventAmount(event);
        return {
          id: `${event.transactionHash}:${event.logIndex}`,
          txHash: event.transactionHash,
          userAddress: eventParticipant(event.args, requested),
          type: eventType(event.eventName),
          amount: amount.amount,
          token: amount.token,
          status: 'Completed',
          loanId: event.args?.loanId ? String(event.args.loanId) : undefined,
          nftId: event.args?.tokenId ? String(event.args.tokenId) : undefined,
          blockNumber: Number(event.blockNumber),
          timestamp: blockTimestamps.get(String(event.blockNumber)),
          network: manifest.network,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};
