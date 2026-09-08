/**
 * AI Service Engine for ABCDeFi Platform
 * Features: AI Credit Scoring, Real-Time Fraud Detection, and AI Financial Assistant Copilot.
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

  if (totalLoans > 0) {
    const repaymentRatio = repaidLoans / totalLoans;
    baseScore += Math.floor(repaymentRatio * 150);
  } else {
    baseScore += 30;
  }

  baseScore -= defaultedLoans * 150;

  const ageBonus = Math.min(Math.floor(walletAgeDays / 30) * 10, 50);
  baseScore += ageBonus;

  const collateralBonus = Math.min(Math.floor(averageCollateralEth * 10), 50);
  baseScore += collateralBonus;

  const finalScore = Math.max(300, Math.min(850, baseScore));

  let riskTier = 'MEDIUM_RISK';
  if (finalScore >= 740) riskTier = 'LOW_RISK';
  else if (finalScore < 600) riskTier = 'HIGH_RISK';

  const maxBorrowLimitUsd = finalScore * 25;

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

export function detectFraudAnomalies(txData) {
  const {
    senderAddress = '',
    amountEth = 0,
    txFrequencyPerMinute = 1,
    isContractInteraction = false,
    rapidTransferChain = false,
  } = txData;

  let riskScore = 10;
  const flags = [];

  if (txFrequencyPerMinute > 10) {
    riskScore += 40;
    flags.push('HIGH_FREQUENCY_BOT_PATTERN');
  }

  if (rapidTransferChain) {
    riskScore += 35;
    flags.push('SUSPICIOUS_RAPID_TRANSFER_CHAIN');
  }

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

export async function runAIFinancialAssistant(prompt, userPortfolio = {}) {
  const query = prompt.toLowerCase();

  let responseText = '';

  if (query.includes('yield') || query.includes('stake') || query.includes('apy')) {
    responseText =
      '💡 **ABCDeFi Staking Strategy Recommendation**:\n\n' +
      '• **30-Day Lock**: 5% APY — Best for short-term liquidity maintenance.\n' +
      '• **90-Day Lock**: 12% APY — Ideal balance between flexibility and yield.\n' +
      '• **180-Day Lock**: 25% APY — Recommended for strong token holders.\n' +
      '• **365-Day Lock**: 40% APY — Maximum yield tier for long-term compound gains.\n\n' +
      '👉 *Pro Tip*: Stake 60% of your ABCD holdings in the 180-day tier and keep 40% in the 30-day pool for dynamic liquidity.';
  } else if (query.includes('borrow') || query.includes('loan') || query.includes('collateral')) {
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
      '2. **Staking & APY Yield Optimization**: Find the highest yield tiers.\n' +
      '3. **Presale & Bonus Rules**: Learn how to maximize ICO allocations.';
  }

  return {
    query: prompt,
    response: responseText,
    timestamp: new Date().toISOString(),
    aiModel: 'Gemini-DeFi-Copilot-v1',
  };
}
