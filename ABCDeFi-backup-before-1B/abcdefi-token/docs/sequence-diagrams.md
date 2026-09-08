# ABCDeFi Protocol — Comprehensive Sequence Diagrams

This document contains detailed end-to-end execution sequence diagrams for all core user flows in the **ABCDeFi Protocol**.

---

## 1. Buy Tokens Sequence (ICO Presale)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Wallet as 🦊 Wallet (MetaMask)
    participant Presale as 🛒 Presale.sol
    participant Treasury as 🏦 Treasury.sol
    participant Token as 🪙 ABCDToken.sol

    User->>Wallet: Initiate Buy Action (Input ETH Amount)
    Wallet->>Presale: buyWithETH{value: ethAmount}()
    
    activate Presale
    Presale->>Presale: Validate state (Active), whitelist & buy limits
    Presale->>Presale: Calculate tokenAmount = (ethAmount * rate) / 1e18
    Presale->>Presale: Record buyer contribution & tokens purchased
    Presale-->>Wallet: Emit TokensPurchased(buyer, ethAmount, tokenAmount)
    deactivate Presale

    Note over Presale, Treasury: Presale SoftCap Met & Admin Finalizes ICO
    Presale->>Treasury: ITreasury.depositETH{value: totalEthRaised}()
    Treasury-->>Presale: Emit DepositedETH(Presale, totalEthRaised)

    User->>Wallet: Claim Tokens
    Wallet->>Presale: claimTokens()
    activate Presale
    Presale->>Presale: Verify isFinalized & unclaimed balance
    Presale->>Token: safeTransfer(User, tokenAmount)
    Token-->>User: Transfer ABCD Tokens to User Wallet
    deactivate Presale
```

---

## 2. Borrow Loan Sequence (Collateralized Lending)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Wallet as 🦊 Wallet (MetaMask)
    participant Vault as 🔒 CollateralVault.sol
    participant Pool as 🏦 LendingPool.sol
    participant Oracle as 🔮 ChainlinkOracle.sol
    participant Manager as 📋 LoanManager.sol
    participant Token as 🪙 ABCDToken.sol

    User->>Wallet: Deposit Collateral (e.g. 2 ETH)
    Wallet->>Vault: depositETH{value: 2 ETH}()
    Vault-->>Wallet: Emit CollateralDeposited(User, 2 ETH)

    User->>Wallet: Request Borrow (e.g. 1,000 ABCD)
    Wallet->>Pool: borrowTokens(1,000 ABCD)
    
    activate Pool
    Pool->>Oracle: getValueInUSD(ETH, 2 ETH)
    Oracle-->>Pool: Return $6,000 USD Collateral Value
    Pool->>Pool: Verify Borrow <= LTV (75%)
    Pool->>Manager: createLoan(User, 1,000 ABCD, 2 ETH, interestRateBps)
    Manager-->>Pool: Return loanId #1
    Pool->>Token: safeTransfer(User, 1,000 ABCD)
    Token-->>User: User receives 1,000 ABCD Loan
    deactivate Pool
```

---

## 3. Repay Loan & Partial Repayment Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Borrower
    participant Wallet as 🦊 Wallet
    participant Pool as 🏦 LendingPool.sol
    participant Manager as 📋 LoanManager.sol
    participant Token as 🪙 ABCDToken.sol
    participant Vault as 🔒 CollateralVault.sol

    Borrower->>Token: approve(LendingPool, repayAmount)
    
    Note over Borrower, Pool: Stage 1: Partial Repayment (25% / 250 ABCD)
    Borrower->>Pool: repayLoan(250 ABCD)
    activate Pool
    Pool->>Token: safeTransferFrom(Borrower, LendingPool, 250 ABCD)
    Pool->>Manager: recordRepayment(loanId, 250 ABCD)
    Manager->>Manager: Accrue interest & reduce principal (750 ABCD remaining)
    deactivate Pool

    Note over Borrower, Pool: Stage 2: Final Partial Repayment (Remaining Balance)
    Borrower->>Pool: repayLoan(750 ABCD)
    activate Pool
    Pool->>Token: safeTransferFrom(Borrower, LendingPool, 750 ABCD)
    Pool->>Manager: recordRepayment(loanId, 750 ABCD)
    Manager->>Manager: Mark loan as REPAID
    deactivate Pool

    Borrower->>Vault: releaseCollateral(loanId)
    Vault-->>Borrower: Return 2 ETH Collateral to User Wallet
```

---

## 4. Staking & Emergency Withdraw Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Staker
    participant Pool as 🥩 StakingPool.sol
    participant Token as 🪙 ABCDToken.sol

    Staker->>Token: approve(StakingPool, 1,000 ABCD)
    Staker->>Pool: stake(1,000 ABCD, 30 days)
    Pool->>Token: safeTransferFrom(Staker, StakingPool, 1,000 ABCD)

    alt Standard Lock Period Completed
        Note over Staker, Pool: 30 Days Expire
        Staker->>Pool: unstake(stakeIndex)
        Pool->>Token: safeTransfer(Staker, 1,000 ABCD Principal + APY Yield)
        Token-->>Staker: Receive Principal + Yield Rewards
    else Emergency Protocol Pause (whenPaused)
        Note over Pool: Admin Triggers Emergency Pause
        Staker->>Pool: emergencyWithdraw(stakeIndex)
        Pool->>Token: safeTransfer(Staker, 1,000 ABCD Principal)
        Token-->>Staker: Instant 100% Principal Recovery (Yield Forfeited)
    end
```

---

## 5. Token Vesting Claim Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Beneficiary
    participant Vesting as ⏳ TokenVesting.sol
    participant Token as 🪙 ABCDToken.sol

    Admin->>Vesting: createVestingSchedule(Beneficiary, totalAmount, cliffDuration, totalDuration)
    Vesting->>Token: safeTransferFrom(Admin, Vesting, totalAmount)

    Note over Beneficiary, Vesting: Time Elapsed > Cliff Duration
    Beneficiary->>Vesting: release(scheduleId)
    activate Vesting
    Vesting->>Vesting: Calculate linear vested amount = (totalAmount * elapsedTime) / totalDuration
    Vesting->>Token: safeTransfer(Beneficiary, releasableAmount)
    Token-->>Beneficiary: Receive Vested ABCD Tokens
    deactivate Vesting
```

---

## 6. NFT Minting & Marketplace Listing Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Seller
    actor Buyer
    participant Market as 🏪 NFTMarketplace.sol
    participant NFT as 🎨 GuruNFT / LoanNFT.sol
    participant Treasury as 🏦 Treasury.sol

    Seller->>NFT: mintBadge(Seller, tier)
    Seller->>NFT: setApprovalForAll(NFTMarketplace, true)

    Seller->>Market: listNFT(NFTContractAddress, tokenId, price)
    Market->>NFT: safeTransferFrom(Seller, NFTMarketplace, tokenId)
    Note over Market: NFT Escrowed in Marketplace Contract

    Buyer->>Market: buyNFT{value: price}(listingId)
    activate Market
    Market->>Market: Calculate protocol fee (e.g. 2.5%)
    Market->>Treasury: Forward Protocol Platform Fee (ETH)
    Market->>Seller: Forward Net Sale Proceeds (ETH)
    Market->>NFT: safeTransferFrom(NFTMarketplace, Buyer, tokenId)
    NFT-->>Buyer: Transfer NFT Ownership to Buyer
    deactivate Market
```
