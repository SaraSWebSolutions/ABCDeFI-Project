import express from 'express';
import { calculateAICreditScore, detectFraudAnomalies, runAIFinancialAssistant } from '../services/aiService.js';

const router = express.Router();

router.post('/credit-score', (req, res) => {
  try {
    const { address, totalLoans, repaidLoans, defaultedLoans, walletAgeDays, averageCollateralEth } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, message: 'Wallet address required' });
    }

    const result = calculateAICreditScore({
      address,
      totalLoans: Number(totalLoans) || 0,
      repaidLoans: Number(repaidLoans) || 0,
      defaultedLoans: Number(defaultedLoans) || 0,
      walletAgeDays: Number(walletAgeDays) || 30,
      averageCollateralEth: Number(averageCollateralEth) || 1.0,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/fraud-check', (req, res) => {
  try {
    const { senderAddress, amountEth, txFrequencyPerMinute, isContractInteraction, rapidTransferChain } = req.body;
    if (!senderAddress) {
      return res.status(400).json({ success: false, message: 'Sender address required' });
    }

    const result = detectFraudAnomalies({
      senderAddress,
      amountEth: Number(amountEth) || 0,
      txFrequencyPerMinute: Number(txFrequencyPerMinute) || 1,
      isContractInteraction: Boolean(isContractInteraction),
      rapidTransferChain: Boolean(rapidTransferChain),
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/assistant', async (req, res) => {
  try {
    const { prompt, userPortfolio } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt message required' });
    }

    const result = await runAIFinancialAssistant(prompt, userPortfolio || {});
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
