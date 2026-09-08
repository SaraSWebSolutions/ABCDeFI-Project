const users = new Map();
const loans = new Map();
const nftRecords = [];

function generateId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeWallet(walletAddress) {
    return typeof walletAddress === 'string' ? walletAddress.toLowerCase() : '';
}

function ensureUser(profileData) {
    const walletAddress = normalizeWallet(profileData.walletAddress || profileData.wallet || profileData.email);
    if (!walletAddress && !profileData.email) {
        throw new Error('A wallet address or email is required');
    }

    const existing = users.get(walletAddress || profileData.email);
    if (existing) {
        return existing;
    }

    const user = {
        id: generateId('usr'),
        name: profileData.name || 'ABCDeFi User',
        email: profileData.email || '',
        walletAddress: walletAddress || '',
        country: profileData.country || 'Unknown',
        kycStatus: 'pending',
        creditScore: 650,
        reputation: 75,
        loanHistory: [],
        loans: [],
        createdAt: new Date().toISOString(),
    };

    users.set(walletAddress || profileData.email, user);
    return user;
}

function createUserProfile(profileData) {
    return ensureUser(profileData);
}

function getUserProfile(walletAddress) {
    return users.get(normalizeWallet(walletAddress)) || null;
}

function completeKyc(walletAddress, status = 'approved', metadata = {}) {
    const user = ensureUser({ walletAddress, country: metadata.country || 'India' });
    user.kycStatus = status;
    user.kycUpdatedAt = new Date().toISOString();
    user.country = metadata.country || user.country || 'India';
    if (metadata.documentType) user.documentType = metadata.documentType;
    if (metadata.provider) user.provider = metadata.provider;
    if (metadata.reviewMode) user.reviewMode = metadata.reviewMode;
    return user;
}

function getKycRequirements(country = 'India') {
    const normalized = String(country || 'India').trim().toLowerCase();
    const isIndia = normalized === 'india';
    const isSupportedRegion = ['united states', 'united kingdom', 'canada', 'australia', 'germany', 'singapore', 'uae'].includes(normalized);

    if (isIndia) {
        return {
            provider: 'Sumsub',
            requiredDocument: 'Aadhaar',
            reviewMode: 'automated',
            livenessRequired: true,
            country: country || 'India',
        };
    }

    if (isSupportedRegion) {
        return {
            provider: 'Sumsub',
            requiredDocument: 'Passport',
            reviewMode: 'manual',
            livenessRequired: true,
            country: country || 'India',
        };
    }

    return {
        provider: 'Manual Upload',
        requiredDocument: 'Passport',
        reviewMode: 'manual',
        livenessRequired: true,
        country: country || 'India',
    };
}

function submitKycVerification(payload) {
    const country = payload.country || 'India';
    const requirements = getKycRequirements(country);
    const user = ensureUser({
        walletAddress: payload.walletAddress,
        country,
        email: payload.email,
        name: payload.fullName || payload.name,
    });

    user.country = country;
    user.kycStatus = payload.reviewMode === 'manual' || requirements.reviewMode === 'manual' ? 'pending_review' : 'pending';
    user.provider = payload.provider || requirements.provider;
    user.documentType = payload.documentType || requirements.requiredDocument;
    user.documentNumber = payload.documentNumber || '';
    user.fullName = payload.fullName || user.name;
    user.reviewMode = payload.reviewMode || requirements.reviewMode;
    user.livenessRequired = payload.liveness !== undefined ? payload.liveness : requirements.livenessRequired;
    user.referenceId = payload.referenceId || `KYC_${String(user.walletAddress || 'wallet').slice(0, 8).toUpperCase()}`;
    user.kycUpdatedAt = new Date().toISOString();

    return {
        walletAddress: user.walletAddress,
        country,
        status: user.kycStatus,
        provider: user.provider,
        documentType: user.documentType,
        reviewMode: user.reviewMode,
        livenessRequired: user.livenessRequired,
        referenceId: user.referenceId,
        user,
        requirements,
    };
}

function calculateMonthlyEmi(principalUSD, annualRatePct, durationMonths) {
    if (principalUSD <= 0 || durationMonths <= 0) {
        return { monthlyEMI: 0, totalInterest: 0, totalRepayment: 0 };
    }

    const r = annualRatePct / 12 / 100;
    const n = durationMonths;
    let monthlyEMI = principalUSD / n;

    if (r > 0) {
        const factor = Math.pow(1 + r, n);
        monthlyEMI = (principalUSD * r * factor) / (factor - 1);
    }

    const totalRepayment = monthlyEMI * n;
    const totalInterest = totalRepayment - principalUSD;

    return {
        monthlyEMI: Math.round(monthlyEMI * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalRepayment: Math.round(totalRepayment * 100) / 100,
    };
}

function generateSchedule(principalUSD, annualRatePct, durationMonths, loanId) {
    const { monthlyEMI } = calculateMonthlyEmi(principalUSD, annualRatePct, durationMonths);
    const r = annualRatePct / 12 / 100;
    let remainingBalance = principalUSD;
    const schedule = [];

    for (let month = 1; month <= durationMonths; month += 1) {
        const interestComponent = r > 0 ? remainingBalance * r : 0;
        const principalComponent = monthlyEMI - interestComponent;
        remainingBalance = Math.max(0, remainingBalance - principalComponent);

        schedule.push({
            monthNumber: month,
            dueDate: new Date(Date.now() + month * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            emiAmountUSD: Math.round(monthlyEMI * 100) / 100,
            principalComponentUSD: Math.round(principalComponent * 100) / 100,
            interestComponentUSD: Math.round(interestComponent * 100) / 100,
            remainingBalanceUSD: Math.round(remainingBalance * 100) / 100,
            status: month === 1 ? 'Due' : 'Upcoming',
        });
    }

    return { loanId, monthlyEMI, schedule, totalRepayment: Math.round(monthlyEMI * durationMonths * 100) / 100 };
}

function createLoanRequest(payload) {
    const borrower = ensureUser({
        walletAddress: payload.borrowerWallet,
        email: payload.email,
        name: payload.name,
        country: payload.country,
    });

    if (borrower.kycStatus !== 'approved') {
        throw new Error('Borrower must complete KYC before creating a loan request');
    }

    const loanId = `LOAN-${1000 + loans.size + 1}`;
    const amount = Number(payload.amount || 0);
    const interestRate = Number(payload.interestRate || 11);
    const durationMonths = Number(payload.durationMonths || 6);
    const ltv = Number(payload.ltv || 0);
    const principalUSD = amount;
    const loan = {
        loanId,
        borrowerWallet: borrower.walletAddress,
        borrowerName: borrower.name,
        amount: principalUSD,
        currency: payload.currency || 'ABCD',
        purpose: payload.purpose || 'General use',
        durationMonths,
        interestRate,
        collateral: payload.collateral || '2 ETH',
        collateralValueUSD: Number(payload.collateralValueUSD || 0),
        ltv,
        income: Number(payload.income || 0),
        employment: payload.employment || 'Unknown',
        address: payload.address || 'Unknown',
        kycStatus: borrower.kycStatus,
        status: 'Pending Marketplace',
        createdAt: new Date().toISOString(),
        emiSchedule: [],
        paymentsMade: 0,
        outstandingBalance: principalUSD,
        lenderWallet: null,
    };

    loans.set(loanId, loan);
    borrower.loans.push(loanId);
    borrower.loanHistory.push({
        loanId,
        type: 'Created',
        status: 'Pending Marketplace',
        amount: principalUSD,
        createdAt: loan.createdAt,
    });

    return loan;
}

function getMarketplaceLoans() {
    return Array.from(loans.values()).filter((loan) => loan.status === 'Pending Marketplace' || loan.status === 'Active');
}

function fundLoan(loanId, lenderWallet) {
    const loan = loans.get(loanId);
    if (!loan) {
        throw new Error(`Loan ${loanId} not found`);
    }

    loan.status = 'Active';
    loan.lenderWallet = lenderWallet;
    loan.fundedAt = new Date().toISOString();
    loan.emiPlan = generateSchedule(loan.amount, loan.interestRate, loan.durationMonths, loan.loanId);
    loan.emiSchedule = loan.emiPlan.schedule;
    loan.outstandingBalance = loan.amount;
    loan.nextDueDate = loan.emiSchedule[0]?.dueDate || null;
    return loan;
}

function payEmi(loanId, amountPaid = 0) {
    const loan = loans.get(loanId);
    if (!loan) {
        throw new Error(`Loan ${loanId} not found`);
    }

    if (loan.status !== 'Active') {
        throw new Error(`Loan ${loanId} is not active`);
    }

    const scheduleEntry = loan.emiSchedule[0] || null;
    if (scheduleEntry) {
        scheduleEntry.status = 'Paid';
        loan.emiSchedule.push({ ...scheduleEntry, monthNumber: scheduleEntry.monthNumber + 1000, status: 'Upcoming' });
        loan.emiSchedule.shift();
    }

    loan.paymentsMade += 1;
    loan.outstandingBalance = Math.max(0, loan.outstandingBalance - Number(amountPaid || loan.emiPlan?.monthlyEMI || 0));
    loan.lastPaymentAt = new Date().toISOString();
    loan.status = loan.outstandingBalance <= 0 ? 'Completed' : 'Active';

    const borrower = getUserProfile(loan.borrowerWallet);
    if (borrower) {
        borrower.loanHistory.push({
            loanId,
            type: 'EMI Paid',
            status: loan.status,
            amount: amountPaid || loan.emiPlan?.monthlyEMI || 0,
            createdAt: loan.lastPaymentAt,
        });
    }

    return {
        loanId,
        status: 'Paid',
        scheduleEntry: scheduleEntry || { monthNumber: 1 },
        loan,
    };
}

function getLoanHistory(walletAddress) {
    const borrower = getUserProfile(walletAddress);
    if (!borrower) {
        return [];
    }

    return borrower.loanHistory.map((entry) => ({
        ...entry,
        loan: loans.get(entry.loanId) || null,
    }));
}

function getPortfolioSummary(walletAddress) {
    const borrower = getUserProfile(walletAddress);
    if (!borrower) {
        return {
            totalPortfolioUSD: 0,
            healthScorePct: 0,
            netWorthGrowth24h: 0,
            breakdown: {
                tokensUSD: 0,
                activeLoansUSD: 0,
                rewardsUSD: 0,
            },
        };
    }

    const activeLoans = Array.from(loans.values()).filter((loan) => loan.borrowerWallet === borrower.walletAddress && loan.status === 'Active');
    const activeLoansUSD = activeLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);

    return {
        totalPortfolioUSD: 15000 + activeLoansUSD,
        healthScorePct: borrower.kycStatus === 'approved' ? 92 : 68,
        netWorthGrowth24h: 8.25,
        breakdown: {
            tokensUSD: 12000,
            activeLoansUSD,
            rewardsUSD: 3000,
        },
    };
}

function getLoanNfts(walletAddress) {
    const borrower = getUserProfile(walletAddress);
    if (!borrower) {
        return Array.from(loans.values()).map((loan, index) => ({
            id: `${loan.loanId}-nft-${index + 1}`,
            loanId: loan.loanId,
            type: 'Loan NFT',
            contractAddress: '0x3235F883109a96eE52882A3c03531Ff9c878f8ED',
            ownerAddress: loan.borrowerWallet,
            metadataURI: `ipfs://bafkrei${loan.loanId.toLowerCase()}`,
            transactionHash: '',
            title: `Lender Rights ${loan.loanId}`,
            status: loan.status,
            attributes: {
                loanId: loan.loanId,
                amount: loan.amount,
                interestRate: loan.interestRate,
                durationMonths: loan.durationMonths,
            },
            metadata: {
                loanId: loan.loanId,
                amount: loan.amount,
                interestRate: loan.interestRate,
                durationMonths: loan.durationMonths,
            },
        }));
    }

    return Array.from(loans.values())
        .filter((loan) => loan.borrowerWallet === borrower.walletAddress)
        .map((loan, index) => ({
            id: `${loan.loanId}-nft-${index + 1}`,
            loanId: loan.loanId,
            type: 'Loan NFT',
            contractAddress: '0x3235F883109a96eE52882A3c03531Ff9c878f8ED',
            ownerAddress: borrower.walletAddress,
            metadataURI: `ipfs://bafkrei${loan.loanId.toLowerCase()}`,
            transactionHash: '',
            title: `Lender Rights ${loan.loanId}`,
            status: loan.status,
            attributes: {
                loanId: loan.loanId,
                amount: loan.amount,
                interestRate: loan.interestRate,
                durationMonths: loan.durationMonths,
            },
            metadata: {
                loanId: loan.loanId,
                amount: loan.amount,
                interestRate: loan.interestRate,
                durationMonths: loan.durationMonths,
            },
        }));
}

function createNftRecord(nftData) {
    const record = {
        tokenId: String(nftData.tokenId || Date.now()),
        contractAddress: nftData.contractAddress || '0x3235F883109a96eE52882A3c03531Ff9c878f8ED',
        ownerAddress: normalizeWallet(nftData.ownerAddress || nftData.walletAddress),
        metadataURI: nftData.metadataURI || '',
        transactionHash: nftData.transactionHash || '',
        type: nftData.type || 'Loan NFT',
        attributes: nftData.attributes || nftData.metadata || {},
        mintedAt: nftData.mintedAt || new Date(),
    };

    nftRecords.push(record);
    return record;
}

function getReports() {
    const allLoans = Array.from(loans.values());
    const totalBorrowedUSD = allLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);

    return {
        totalLoans: allLoans.length,
        activeLoans: allLoans.filter((loan) => loan.status === 'Active').length,
        completedLoans: allLoans.filter((loan) => loan.status === 'Completed').length,
        totalBorrowedUSD,
        auditTrail: allLoans.map((loan) => ({
            loanId: loan.loanId,
            status: loan.status,
            borrowerWallet: loan.borrowerWallet,
            lenderWallet: loan.lenderWallet,
            createdAt: loan.createdAt,
        })),
    };
}

module.exports = {
    createUserProfile,
    getUserProfile,
    completeKyc,
    getKycRequirements,
    submitKycVerification,
    createLoanRequest,
    getMarketplaceLoans,
    fundLoan,
    payEmi,
    getLoanHistory,
    getPortfolioSummary,
    getLoanNfts,
    createNftRecord,
    getReports,
    calculateMonthlyEmi,
    generateSchedule,
    __internal: {
        users,
        loans,
        nftRecords,
    },
};
