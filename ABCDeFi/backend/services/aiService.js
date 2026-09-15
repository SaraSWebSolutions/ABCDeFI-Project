/**
 * AI Service Engine for ABCDeFi Platform
 * Features: AI Credit Scoring, Real-Time Fraud Detection, and AI Financial Assistant Copilot.
 */

/**
 * Calculates AI Credit Score (300 - 850) based on wallet metrics.
 * @param {Object} walletData Wallet history details
 */
export function calculateAICreditScore(walletData) {
  const {
    address = '',
    totalLoans = 0,
    repaidLoans = 0,
    defaultedLoans = 0,
    walletAgeDays = 30,
    averageCollateralEth = 1.0,
  } = walletData;

  let baseScore = 600;

  // 1. Repayment History Impact (+150 max)
  if (totalLoans > 0) {
    const repaymentRatio = repaidLoans / totalLoans;
    baseScore += Math.floor(repaymentRatio * 150);
  } else {
    baseScore += 30; // Neutral baseline for new borrowers
  }

  // 2. Default Penalty (-150 per default)
  baseScore -= defaultedLoans * 150;

  // 3. Wallet Age bonus (+50 max)
  const ageBonus = Math.min(Math.floor(walletAgeDays / 30) * 10, 50);
  baseScore += ageBonus;

  // 4. Collateral backing bonus (+50 max)
  const collateralBonus = Math.min(Math.floor(averageCollateralEth * 10), 50);
  baseScore += collateralBonus;

  // Clamp score between 300 and 850
  const finalScore = Math.max(300, Math.min(850, baseScore));

  let riskTier = 'MEDIUM_RISK';
  if (finalScore >= 740) riskTier = 'LOW_RISK';
  else if (finalScore < 600) riskTier = 'HIGH_RISK';

  const maxBorrowLimitUsd = finalScore * 25; // Dynamic credit limit allocation

  return {
    address,
    creditScore: finalScore,
    riskTier,
    maxBorrowLimitUsd,
    metrics: {
      totalLoans,
      repaidLoans,
      defaultedLoans,
      walletAgeDays,
      repaymentRate: totalLoans > 0 ? `${((repaidLoans / totalLoans) * 100).toFixed(1)}%` : 'N/A',
    },
    recommendation:
      finalScore >= 740
        ? 'Eligible for discounted interest rate (4% APR) and higher LTV limit (80%).'
        : finalScore >= 600
        ? 'Standard tier eligible (5% APR, 75% LTV).'
        : 'High risk profile. Requires 90% collateral backing and restricted borrowing limits.',
  };
}

/**
 * Evaluates real-time transaction for fraud & anomaly detection.
 * @param {Object} txData Transaction details
 */
export function detectFraudAnomalies(txData) {
  const {
    senderAddress = '',
    amountEth = 0,
    txFrequencyPerMinute = 1,
    isContractInteraction = false,
    rapidTransferChain = false,
  } = txData;

  let riskScore = 10; // Low base risk
  const flags = [];

  // High frequency bot detection
  if (txFrequencyPerMinute > 10) {
    riskScore += 40;
    flags.push('HIGH_FREQUENCY_BOT_PATTERN');
  }

  // Rapid multi-contract transfer chain (Sybil / Drainer pattern)
  if (rapidTransferChain) {
    riskScore += 35;
    flags.push('SUSPICIOUS_RAPID_TRANSFER_CHAIN');
  }

  // Unusually large transaction amount
  if (amountEth > 50) {
    riskScore += 20;
    flags.push('LARGE_VALUE_ANOMALY');
  }

  const finalRiskScore = Math.min(100, riskScore);
  const isSuspicious = finalRiskScore >= 50;

  return {
    senderAddress,
    riskScore: finalRiskScore,
    isSuspicious,
    status: isSuspicious ? 'FLAGGED_FOR_REVIEW' : 'PASSED',
    detectedFlags: flags,
    timestamp: new Date().toISOString(),
  };
}

/**
 * AI Financial Assistant Prompt Handler (Gemini Copilot Helper).
 * @param {string} prompt User natural language question
 * @param {Object} userPortfolio User's token and lending portfolio state
 */
export async function runAIFinancialAssistant(prompt, userPortfolio = {}) {
  const query = prompt.toLowerCase();

  let responseText = '';

  if (query.includes('borrow') || query.includes('loan') || query.includes('collateral')) {
    responseText =
      '🏦 **Lending & Borrowing Advice**:\n\n' +
      '• You can deposit ETH as collateral into `LendingPool.sol` and borrow up to **75% LTV** in ABCD tokens.\n' +
      '• Maintain your **Health Factor above 1.25** to avoid the 85% Liquidation Threshold.\n' +
      '• Borrowing ABCD tokens allows you to access liquidity without selling your underlying ETH assets!';
  } else if (query.includes('presale') || query.includes('ico') || query.includes('buy')) {
    responseText =
      '🚀 **ICO Presale Allocation Guide**:\n\n' +
      '• Presale rate is discounted with tiered volume bonuses:\n' +
      '  - Buy 10M ABCD $\\rightarrow$ **300K ABCD Bonus** (3%)\n' +
      '  - Buy 50M ABCD $\\rightarrow$ **1.5M ABCD Bonus** (3%)\n' +
      '• Verified KYC users automatically receive whitelist priority.';
  } else {
    responseText =
      `🤖 **ABCDeFi AI Copilot**: I analyzed your request: "${prompt}".\n\n` +
      'I can assist you with:\n' +
      '1. **Credit Score & Borrowing Limits**: Check your AI credit rating.\n' +
      '2. **Presale & Bonus Rules**: Learn how to maximize ICO allocations.';
  }

  return {
    query: prompt,
    response: responseText,
    timestamp: new Date().toISOString(),
    aiModel: 'Gemini-DeFi-Copilot-v1',
  };
}
