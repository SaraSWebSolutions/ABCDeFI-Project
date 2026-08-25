const test = require('node:test');
const assert = require('node:assert/strict');
const { createUserProfile, completeKyc, createLoanRequest, fundLoan, payEmi, getLoanHistory, getKycRequirements, submitKycVerification } = require('../services/lendingWorkflow.cjs');

test('creates a loan request only after KYC approval and funds it into an active loan', () => {
    const user = createUserProfile({
        email: 'borrower@example.com',
        walletAddress: '0xabc123',
        name: 'Borrower User',
        country: 'India',
    });

    const kyc = completeKyc(user.walletAddress, 'approved');
    assert.equal(kyc.kycStatus, 'approved');

    const loan = createLoanRequest({
        borrowerWallet: user.walletAddress,
        amount: 1000,
        currency: 'ABCD',
        purpose: 'Business expansion',
        durationMonths: 6,
        interestRate: 11,
        collateral: '2 ETH',
        collateralValueUSD: 6000,
        ltv: 60,
        income: 4000,
        employment: 'Salaried',
        address: 'Hyderabad',
    });

    assert.equal(loan.status, 'Pending Marketplace');
    assert.equal(loan.kycStatus, 'approved');

    const funded = fundLoan(loan.loanId, '0xdef456');
    assert.equal(funded.status, 'Active');
    assert.equal(funded.lenderWallet, '0xdef456');

    const paid = payEmi(loan.loanId, 100);
    assert.equal(paid.status, 'Paid');
    assert.ok(paid.scheduleEntry.monthNumber >= 1);

    const history = getLoanHistory(user.walletAddress);
    assert.ok(history.some((item) => item.loanId === loan.loanId));
});

test('applies country-based KYC requirements and manual review for non-India users', () => {
    const requirements = getKycRequirements('United States');
    assert.equal(requirements.requiredDocument, 'Passport');
    assert.equal(requirements.reviewMode, 'manual');

    const submitted = submitKycVerification({
        walletAddress: '0xcountryuser',
        country: 'United States',
        documentType: 'Passport',
        documentNumber: 'P1234567',
        fullName: 'Ada Brooks',
        provider: 'Manual Upload',
        reviewMode: 'manual',
        liveness: true,
    });

    assert.equal(submitted.status, 'pending_review');
    assert.equal(submitted.country, 'United States');
    assert.equal(submitted.provider, 'Manual Upload');
});
