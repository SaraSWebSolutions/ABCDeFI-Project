# ABCDeFi Protocol — Comprehensive System Architecture

The **ABCDeFi Protocol** is an enterprise-grade decentralized finance (DeFi) ecosystem integrating an ERC-20 utility token (`ABCDToken`), ICO Presale engine, multi-tier Staking pools, Collateralized Lending & Liquidation, Token Vesting schedules, Chainlink Oracles, and a peer-to-peer NFT Marketplace.

---

## 1. System High-Level Topology

```mermaid
graph TD
    User["👤 User / Borrower / Staker / Buyer"] --> |Web3 Signer| Wallet["🦊 Wallet (MetaMask / Web3)"]
    Wallet --> |Transactions & Calls| Frontend["💻 React / Next.js DApp"]
    
    Frontend --> |Ethers.js / Thirdweb| Router["Core Smart Contracts"]
    
    subgraph Token & Treasury
        ABCD["🪙 ABCDToken (ERC-20)"]
        Treasury["🏦 Treasury (ITreasury)"]
        Vesting["⏳ TokenVesting"]
        Presale["🛒 Presale (ICO)"]
    end
    
    subgraph Lending & Oracle Engine
        LendingPool["🏦 LendingPool"]
        CollateralVault["🔒 CollateralVault"]
        LoanManager["📋 LoanManager"]
        Liquidation["⚡ Liquidation Engine"]
        Oracle["🔮 ChainlinkOracle (IPriceOracle)"]
    end
    
    subgraph Yield & Staking
        Staking["🥩 Staking & StakingPool"]
        Bonus["🎁 BonusManager"]
    end
    
    subgraph NFT Suite & Marketplace
        NFTMarket["🏪 NFTMarketplace"]
        LoanNFT["📜 LoanNFT"]
        GuruNFT["🏅 GuruNFT"]
        ParticipantNFT["🎖️ ParticipantNFT"]
        ReputationNFT["🛡️ ReputationNFT (Soulbound)"]
        BarterNFT["🔄 BarterNFT"]
    end
    
    subgraph Shared Utility Libraries
        Val["Validation.sol"]
        Math["PercentageMath.sol"]
        Calc["InterestCalculator.sol"]
        Err["Errors.sol"]
    end

    Router --> ABCD
    Presale --> |Forward ETH| Treasury
    LendingPool --> Oracle
    Liquidation --> Oracle
    Liquidation --> |Surplus ETH| Treasury
    NFTMarket --> |Fees| Treasury
```

---

## 2. Smart Contract Relationships & Access Control

```mermaid
classDiagram
    class ABCDToken {
        +MINTER_ROLE
        +BURNER_ROLE
        +PAUSER_ROLE
        +TREASURY_ROLE
        +mint()
        +burn()
        +pause()
    }

    class Treasury {
        +TREASURY_ADMIN_ROLE
        +WITHDRAWER_ROLE
        +depositETH()
        +depositERC20()
        +withdrawETH()
    }

    class Presale {
        +PRESALE_ADMIN_ROLE
        +buyWithETH()
        +finalizePresale()
        +claimTokens()
    }

    class LendingPool {
        +depositCollateral()
        +borrowTokens()
        +repayLoan()
        +withdrawCollateral()
    }

    class Liquidation {
        +liquidatePosition()
        +calculateHealthFactor()
        +checkLiquidationEligibility()
    }

    class ChainlinkOracle {
        +getAssetPrice()
        +getValueInUSD()
        +setPriceFeed()
    }

    Presale --> ITreasury : depositETH()
    LendingPool --> ChainlinkOracle : USD Valuation
    Liquidation --> LendingPool : Position Status
    Liquidation --> ChainlinkOracle : Price Query
    Liquidation --> Treasury : Surplus Routing
```

---

## 3. Token Flow & Distribution Model

```mermaid
sequenceDiagram
    autonumber
    actor Investor
    participant Presale
    participant Treasury
    participant ABCDToken
    participant Vesting

    Investor->>Presale: buyWithETH{value: 1 ETH}()
    Presale->>Presale: Record ETH & calculate ABCD tokens sold
    Note over Presale: Presale Reaches Finalization
    Presale->>Treasury: depositETH() [Forwards raised ETH]
    Investor->>Presale: claimTokens()
    Presale->>ABCDToken: transfer(Investor, tokensPurchased)

    Admin->>Vesting: createVestingSchedule(beneficiary, amount, cliff, duration)
    Vesting->>ABCDToken: Transfer tokens to Vesting Contract
    Note over Vesting: Cliff Expired & Time Elapsed
    Investor->>Vesting: release()
    Vesting->>ABCDToken: safeTransfer(beneficiary, vestedAmount)
```

---

## 4. Lending, Dynamic Interest & Liquidation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Borrower
    actor Liquidator
    participant LendingPool
    participant Oracle as ChainlinkOracle
    participant Liquidation
    participant Treasury

    Borrower->>LendingPool: depositCollateral{value: 2 ETH}()
    Borrower->>LendingPool: borrowTokens(1,000 ABCD)
    LendingPool->>Oracle: getValueInUSD(ETH, 2 ETH)
    Oracle-->>LendingPool: $6,000 USD
    LendingPool->>LendingPool: Verify LTV <= 75%
    LendingPool->>Borrower: Transfer 1,000 ABCD

    Note over Liquidation: Price Drops or Debt Ratio Exceeds Threshold (Health Factor < 1.0)
    Liquidator->>Liquidation: calculateHealthFactor(Borrower)
    Liquidation->>Oracle: getAssetPrice(ETH)
    Oracle-->>Liquidation: $1,200 USD (Health Factor = 0.8e18)

    Liquidator->>Liquidation: liquidatePosition(Borrower, debtToCover)
    Liquidation->>ABCDToken: transferFrom(Liquidator, debtToCover)
    Liquidation->>Liquidator: Transfer Seized ETH + 5% Liquidator Bonus
    Liquidation->>Treasury: Transfer Surplus ETH Proceeds
```

---

## 5. Staking & Emergency Withdraw Flow

```mermaid
stateDiagram-v2
    [*] --> ActiveState: Deposit ABCD Tokens

    state ActiveState {
        [*] --> LockDuration30Days: 5% APY
        [*] --> LockDuration90Days: 12% APY
        [*] --> LockDuration180Days: 25% APY
        [*] --> LockDuration365Days: 40% APY

        LockDuration30Days --> YieldAccrual
        YieldAccrual --> ClaimRewards: Intermediary Yield Claim
        YieldAccrual --> Unstake: Lock Duration Expired (Principal + APY Yield)
    }

    ActiveState --> PausedState: Protocol Emergency Pause (whenPaused)
    
    state PausedState {
        [*] --> EmergencyWithdraw: 100% Principal Immediate Recovery (Unearned Yield Forfeited)
    }

    Unstake --> [*]
    EmergencyWithdraw --> [*]
```

---

## 6. NFT Suite & Peer-to-Peer Marketplace Flow

```mermaid
sequenceDiagram
    autonumber
    actor Seller
    actor Buyer
    participant NFTMarketplace
    participant BarterNFT
    participant Treasury

    Seller->>NFTMarketplace: listNFT(nftContract, tokenId, price)
    NFTMarketplace->>NFTMarketplace: Transfer NFT to Escrow
    Buyer->>NFTMarketplace: buyNFT{value: price}(listingId)
    NFTMarketplace->>Treasury: Transfer Protocol Platform Fee (ETH)
    NFTMarketplace->>Seller: Transfer Net Sale Proceeds (ETH)
    NFTMarketplace->>Buyer: Transfer Escrowed NFT

    Note over BarterNFT: Peer-to-Peer Voucher Trading
    Seller->>BarterNFT: createBarterVoucher(offeredToken, requestedToken)
    Buyer->>BarterNFT: executeBarterTrade(voucherId)
    BarterNFT->>Seller: Deliver Requested NFT/Tokens
    BarterNFT->>Buyer: Deliver Offered NFT/Tokens
```

---

## 7. Shared Libraries & Utility Layer

| Library Name | Primary Responsibility | Key Functions |
| :--- | :--- | :--- |
| **`Validation.sol`** | Centralized input & boundary checks | `validateAddress()`, `validateAmount()`, `validatePercentage()`, `validateDeadline()` |
| **`PercentageMath.sol`** | Precision 4-decimal basis points math ($10000 = 100\%$) | `percentMul()`, `percentDiv()` with half-up rounding |
| **`InterestCalculator.sol`** | Accrued interest & pool utilization rates | `calculateSimpleInterest()`, `calculateUtilizationRate()`, `calculateVariableBorrowRate()` |
| **`Errors.sol`** | Custom gas-efficient Solidity errors | `ZeroAddress()`, `InvalidAmount()`, `InvalidPercentage()`, `InvalidDeadline()` |
