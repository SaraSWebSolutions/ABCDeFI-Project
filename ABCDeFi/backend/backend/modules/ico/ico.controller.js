const Ico = require("./ico.model");

// In-Memory state for fast Presale / ICO tracking with default seed values
const icoState = {
  config: {
    referralBonusPct: 5,
    stages: [
      { id: 'private', name: 'Private Strategic Round', tokenPrice: 0.005, bonusPct: 15, status: 'Ended', capUSD: 500000, raisedUSD: 500000, tokensSold: 100000000 },
      { id: 'presale', name: 'Phase 1 Public Presale', tokenPrice: 0.010, bonusPct: 10, status: 'Live', capUSD: 2500000, raisedUSD: 1842500, tokensSold: 184250000 },
      { id: 'public', name: 'Phase 2 Public Launch', tokenPrice: 0.015, bonusPct: 0, status: 'Pending', capUSD: 5000000, raisedUSD: 0, tokensSold: 0 }
    ],
    allocations: [
      { label: 'Presale & Public Sale', pct: 40 },
      { label: 'Collateral Liquidity Vault', pct: 25 },
      { label: 'Ecosystem & Staking Rewards', pct: 15 },
      { label: 'Protocol Treasury & Reserves', pct: 10 },
      { label: 'Core Team & Advisors (2Y Vesting)', pct: 10 }
    ]
  },
  purchases: [],
  referrals: new Map(),
  vesting: new Map()
};

exports.setStartDate = async (req, res, next) => {
    try {
        const { title, startDate } = req.body;
        await Ico.create({
            title,
            startDate
        });
        res.status(200).json({
            success: true,
            message: "Ico date set"
        });
    } catch (err) {
        next(err);
    }
};

exports.showIcoStartDate = async (req, res, next) => {
    try {
        const latest = await Ico.findOne().sort({ startDate: -1 });
        res.status(200).json({
            success: true,
            data: latest ? latest.startDate : null
        });
    } catch (err) {
        next(err);
    }
};

exports.getIcoConfig = (req, res) => {
    return res.status(200).json({
        success: true,
        config: icoState.config
    });
};

exports.getIcoStats = (req, res) => {
    const totalRaisedUSD = icoState.config.stages.reduce((acc, s) => acc + (s.raisedUSD || 0), 0);
    const totalTokensSold = icoState.config.stages.reduce((acc, s) => acc + (s.tokensSold || 0), 0);
    const activeStage = icoState.config.stages.find(s => s.status === 'Live') || icoState.config.stages[1];

    return res.status(200).json({
        success: true,
        stats: {
            totalTokensForSale: 500000000,
            totalRaisedUSD,
            targetUSD: 5000000,
            tokensSold: totalTokensSold,
            currentPriceUSD: activeStage.tokenPrice,
            currentStage: activeStage.name,
            currentTier: `${activeStage.name} (${activeStage.bonusPct}% Bonus)`,
            stages: icoState.config.stages
        }
    });
};

exports.buyIcoTokens = (req, res) => {
    try {
        const { walletAddress, phase, amountUSD, referralCode } = req.body;
        if (!walletAddress || !amountUSD || Number(amountUSD) <= 0) {
            return res.status(400).json({ success: false, message: "Valid walletAddress and amountUSD required" });
        }

        const activeStage = icoState.config.stages.find(s => s.id === phase || s.status === 'Live') || icoState.config.stages[1];
        const numUsd = Number(amountUSD);
        const baseTokens = numUsd / activeStage.tokenPrice;
        const bonusTokens = baseTokens * (activeStage.bonusPct / 100);
        
        let referralBonusTokens = 0;
        if (referralCode) {
            referralBonusTokens = baseTokens * (icoState.config.referralBonusPct / 100);
        }

        const totalTokens = baseTokens + bonusTokens + referralBonusTokens;

        const purchase = {
            id: `ico-tx-${Date.now()}`,
            walletAddress: walletAddress.toLowerCase(),
            phase: activeStage.id,
            amountUSD: numUsd,
            tokensPurchased: baseTokens,
            bonusTokens,
            referralCode,
            referralBonusTokens,
            totalTokens,
            txHash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
            createdAt: new Date().toISOString(),
            status: 'Confirmed'
        };

        icoState.purchases.push(purchase);
        activeStage.raisedUSD = (activeStage.raisedUSD || 0) + numUsd;
        activeStage.tokensSold = (activeStage.tokensSold || 0) + totalTokens;

        return res.status(201).json({
            success: true,
            purchase,
            message: "Tokens purchased successfully"
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.getPurchasesByWallet = (req, res) => {
    const { walletAddress } = req.params;
    const normalized = (walletAddress || '').toLowerCase();
    const purchases = icoState.purchases.filter(p => p.walletAddress === normalized);
    return res.status(200).json({ success: true, purchases });
};

exports.createReferral = (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ success: false, message: "Wallet address required" });

    const normalized = walletAddress.toLowerCase();
    const existing = icoState.referrals.get(normalized);
    if (existing) return res.status(200).json({ success: true, referral: existing });

    const code = `REF-${walletAddress.slice(2, 8).toUpperCase()}`;
    const newRef = {
        referrerAddress: normalized,
        referralCode: code,
        createdAt: new Date().toISOString(),
        totalReferredUSD: 0,
        totalReferralBonusTokens: 0
    };
    icoState.referrals.set(normalized, newRef);
    return res.status(201).json({ success: true, referral: newRef });
};

exports.getReferralsByWallet = (req, res) => {
    const { walletAddress } = req.params;
    const normalized = (walletAddress || '').toLowerCase();
    const referral = icoState.referrals.get(normalized) || {
        referrerAddress: normalized,
        referralCode: `REF-${(walletAddress || 'USER01').slice(2, 8).toUpperCase()}`,
        totalReferredUSD: 0,
        totalReferralBonusTokens: 0
    };
    return res.status(200).json({ success: true, referrals: referral });
};

exports.getVestingByWallet = (req, res) => {
    const { walletAddress } = req.params;
    const normalized = (walletAddress || '').toLowerCase();
    const schedules = icoState.vesting.get(normalized) || [
        {
            walletAddress: normalized,
            totalTokens: 50000,
            cliffDays: 30,
            durationDays: 180,
            startDate: new Date().toISOString(),
            claimedTokens: 12500,
            createdAt: new Date().toISOString()
        }
    ];
    return res.status(200).json({ success: true, vestingSchedules: schedules });
};

exports.exportIcoData = (req, res) => {
    return res.status(200).json({
        success: true,
        exportedAt: new Date().toISOString(),
        config: icoState.config,
        purchases: icoState.purchases,
        referrals: Array.from(icoState.referrals.entries())
    });
};

exports.importIcoData = (req, res) => {
    try {
        const data = req.body;
        if (data.config) icoState.config = data.config;
        if (Array.isArray(data.purchases)) icoState.purchases = data.purchases;
        return res.status(200).json({ success: true, message: "ICO state imported successfully" });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
};