const config = require('../../config/default');

/**
 * Calculates Loan to Value ratio
 * @param {Number} loanAmount - Requested loan amount in USD
 * @param {Number} collateralValue - Collateral value in USD
 * @returns {Number} LTV percentage
 */
exports.calculateLTV = (loanAmount, collateralValue) => {
  if (collateralValue <= 0) return 100;
  return (loanAmount / collateralValue) * 100;
};

/**
 * Validates if the given LTV is within the allowed limits
 * @param {Number} ltv - Calculated LTV
 * @returns {Object} { isValid: boolean, message: string }
 */
exports.validateLTV = (ltv) => {
  const maxLTV = config.MAX_LTV || 50;
  if (ltv > maxLTV) {
    return {
      isValid: false,
      message: `Requested LTV (${ltv.toFixed(2)}%) exceeds the maximum allowed limit of ${maxLTV}%`
    };
  }
  return { isValid: true, message: 'LTV is valid' };
};

/**
 * Calculates Interest and EMI
 * @param {Number} principal - Requested loan amount
 * @param {Number} durationInDays - Loan duration in days
 * @returns {Object} Loan calculations
 */
exports.calculateInterest = (principal, durationInDays) => {
  const apy = config.DEFAULT_INTEREST_RATE || 10.8;
  
  // Total Interest = (Principal * APY * Duration) / (365 * 100)
  const totalInterest = (principal * apy * durationInDays) / (365 * 100);
  const totalRepayment = principal + totalInterest;

  // Approximate monthly EMI if duration > 30 days
  const months = Math.max(1, durationInDays / 30);
  const emi = totalRepayment / months;

  return {
    principal,
    apy,
    durationInDays,
    totalInterest,
    totalRepayment,
    estimatedMonthlyEMI: emi
  };
};
