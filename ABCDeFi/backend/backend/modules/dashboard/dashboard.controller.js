const { loadLendingManifest } = require('../../config/lendingManifest.cjs');
const UserAccount = require('../user/userAccount/userAccount.model');
const { Loan, Repayment } = require('../lendingProjection/models');

function sumUintStrings(records, field) {
  return records.reduce((total, record) => total + BigInt(record[field] || '0'), 0n).toString();
}

exports.getDashboardSummary = async (req, res, next) => {
  try {
    const manifest = loadLendingManifest();
    const chainId = String(manifest.chainId);
    const user = await UserAccount.findById(req.user.id).select('walletAddress').lean();
    const walletAddress = user?.walletAddress?.toLowerCase() || null;

    const activeLoans = await Loan.find({ chainId, status: 'ACTIVE' })
      .select('borrower lender principal')
      .lean();
    const [userLoans, userRepayments] = walletAddress
      ? await Promise.all([
        Loan.find({ chainId, $or: [{ borrower: walletAddress }, { lender: walletAddress }] })
          .select('borrower lender principal status')
          .lean(),
        Repayment.find({ chainId, lender: walletAddress }).select('amount').lean(),
      ])
      : [[], []];

    const activeBorrowed = userLoans.filter((loan) => loan.status === 'ACTIVE' && loan.borrower === walletAddress);
    const activeLent = userLoans.filter((loan) => loan.status === 'ACTIVE' && loan.lender === walletAddress);

    return res.json({
      success: true,
      source: {
        chainId,
        network: manifest.network,
        deploymentVersion: manifest.deploymentVersion,
        values: 'ABCD base-unit decimal strings unless marked unavailable',
      },
      portfolio: {
        // No price oracle is part of the canonical Phase 1 deployment, so USD value must not be fabricated.
        totalValue: '0',
        borrowed: sumUintStrings(activeBorrowed, 'principal'),
        lent: sumUintStrings(activeLent, 'principal'),
        interestEarned: sumUintStrings(userRepayments, 'amount'),
      },
      protocol: {
        // Staking and presence telemetry are outside the indexed Phase 1 lending contracts.
        totalStaked: '0',
        activeDebtVolume: sumUintStrings(activeLoans, 'principal'),
        onlineUsers: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
