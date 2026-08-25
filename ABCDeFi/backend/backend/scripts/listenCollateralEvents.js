const { ethers } = require('ethers');
const Deposit = require('../modules/user/deposit/deposit.model');
const config = require('../config/default');
const logger = require('../logger');

// ABCDeFi CollateralVault simplified ABI for events
const COLLATERAL_VAULT_ABI = [
  "event CollateralLocked(address indexed user, address indexed token, uint256 amount)",
  "event DepositConfirmed(address indexed user, address indexed token, uint256 amount, uint256 depositId)",
  "event CollateralReleased(address indexed user, address indexed token, uint256 amount)"
];

async function startEventListener(rpcUrl) {
  if (!config.COLLATERAL_VAULT_ADDRESS) {
    logger.warn('COLLATERAL_VAULT_ADDRESS not set. Deposit event listener will not start.');
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(config.COLLATERAL_VAULT_ADDRESS, COLLATERAL_VAULT_ABI, provider);

  logger.info(`Starting CollateralVault event listener at ${config.COLLATERAL_VAULT_ADDRESS}`);

  // Listen for CollateralLocked
  contract.on('CollateralLocked', async (user, token, amount, event) => {
    try {
      const txHash = event.log.transactionHash;
      const blockNumber = event.log.blockNumber;
      
      logger.info(`CollateralLocked detected: tx ${txHash}`);
      
      // Update deposit in DB
      const deposit = await Deposit.findOne({ txHash });
      if (deposit) {
        if (deposit.status !== 'Locked' && deposit.status !== 'Released') {
          deposit.status = 'Locked';
          deposit.blockNumber = blockNumber;
          deposit.confirmedAt = new Date();
          await deposit.save();
          logger.info(`Updated Deposit ${deposit.depositId} status to Locked`);
        }
      } else {
        logger.warn(`CollateralLocked event received for unknown txHash: ${txHash}`);
      }
    } catch (error) {
      logger.error('Error handling CollateralLocked event:', error);
    }
  });

  // Additional events can be handled here...

  // --- LOAN MARKETPLACE LISTENER ---
  const LOAN_MARKETPLACE_ABI = [
    "event LoanCreated(string loanId, address indexed borrower, uint256 amount)",
    "event LoanFunded(string loanId, address indexed funder)",
    "event LoanRepaid(string loanId, address indexed borrower)"
  ];

  if (config.LOAN_MARKETPLACE_ADDRESS) {
    const loanContract = new ethers.Contract(config.LOAN_MARKETPLACE_ADDRESS, LOAN_MARKETPLACE_ABI, provider);
    logger.info(`Starting LoanMarketplace event listener at ${config.LOAN_MARKETPLACE_ADDRESS}`);

    loanContract.on('LoanCreated', async (loanId, borrower, amount, event) => {
      // Actually we just wait for LoanFunded usually, or update requested to active.
      // E.g., if LoanCreated is emitted, it might mean 'Requested' on-chain.
      logger.info(`LoanCreated detected: loanId ${loanId}`);
    });

    loanContract.on('LoanFunded', async (loanId, funder, event) => {
      try {
        const Loan = require('../modules/loan/loan.model');
        const loan = await Loan.findOne({ loanId });
        if (loan && loan.status === 'Requested') {
          loan.status = 'Funded';
          loan.fundedAt = new Date();
          await loan.save();
          logger.info(`Updated Loan ${loanId} status to Funded`);
        }
      } catch (err) {
        logger.error('Error handling LoanFunded event:', err);
      }
    });

    loanContract.on('LoanRepaid', async (loanId, borrower, event) => {
      try {
        const Loan = require('../modules/loan/loan.model');
        const loan = await Loan.findOne({ loanId });
        if (loan && (loan.status === 'Funded' || loan.status === 'Active')) {
          loan.status = 'Repaid';
          await loan.save();
          logger.info(`Updated Loan ${loanId} status to Repaid`);
          
          // Optionally release collateral lock
          const deposit = await Deposit.findOne({ depositId: loan.depositId });
          if (deposit) {
            deposit.status = 'Released'; // Assuming repay releases it
            await deposit.save();
          }
        }
      } catch (err) {
        logger.error('Error handling LoanRepaid event:', err);
      }
    });
  }
}

module.exports = { startEventListener };
