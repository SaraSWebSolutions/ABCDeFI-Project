# ABCDeFi Protocol — DApp API & Endpoint Documentation

This document specifies the REST & Web3 API endpoint contracts used by the ABCDeFi frontend and backend indexer services.

---

## 1. Presale & Token Purchase Endpoints

### `POST /api/v1/buyTokens`
Calculates token estimation and prepares transaction parameters for buying ABCD tokens.

- **Request Body**:
  ```json
  {
    "buyerAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "ethAmount": "1.5"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "estimatedTokens": "1500.0",
    "ratePerETH": "1000",
    "tx": {
      "to": "0xPresaleContractAddress",
      "data": "0xd0febe4c",
      "value": "1500000000000000000"
    }
  }
  ```

---

## 2. Staking & Yield Endpoints

### `POST /api/v1/stake`
Constructs transaction data for locking ABCD tokens into staking pools.

- **Request Body**:
  ```json
  {
    "userAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "amount": "1000.0",
    "lockDurationDays": 30
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "expectedApyBps": 500,
    "lockDurationSeconds": 2592000,
    "tx": {
      "to": "0xStakingPoolContractAddress",
      "data": "0xa694fc3a..."
    }
  }
  ```

### `POST /api/v1/claim`
Prepares reward claim transactions for active staking or vesting schedules.

---

## 3. Portfolio & User Account Analytics

### `GET /api/v1/portfolio/:address`
Returns complete portfolio balances, active stakes, collateral deposits, and loan positions for a wallet.

- **URL Params**: `:address` (Wallet Address)
- **Response**:
  ```json
  {
    "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "tokenBalance": "25000.0",
    "stakedBalance": "5000.0",
    "activeStakes": [
      {
        "stakeIndex": 0,
        "amount": "5000.0",
        "lockDurationDays": 90,
        "unclaimedRewards": "150.0"
      }
    ],
    "lendingPosition": {
      "collateralETH": "2.0",
      "borrowedABCD": "1000.0",
      "healthFactor": "1.70"
    }
  }
  ```

---

## 4. Lending & Loan Management Endpoints

### `GET /api/v1/loan/:id`
Queries metadata, interest accrual, and status for a specific loan ID.

- **Response**:
  ```json
  {
    "loanId": 1,
    "borrower": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "principal": "1000.0",
    "collateralETH": "2.0",
    "interestRateBps": 1000,
    "accruedInterest": "50.0",
    "status": "ACTIVE"
  }
  ```

### `GET /api/v1/healthFactor/:address`
Queries current Health Factor solvency metric for a borrower.

- **Response**:
  ```json
  {
    "borrower": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "healthFactor": "1.70",
    "healthFactorRaw": "1700000000000000000",
    "isLiquidationEligible": false
  }
  ```

---

## 5. Oracle & Asset Price Feeds

### `GET /api/v1/oracle/price/:asset`
Returns normalized USD prices for registered tokens from Chainlink feeds.

- **Response**:
  ```json
  {
    "asset": "ETH",
    "priceUSD": "3000.00",
    "decimals": 18,
    "isFeedActive": true,
    "timestamp": "2026-07-28T18:16:00Z"
  }
  ```
