# ABCDeFi Protocol — Deployment & Verification Guide

This guide provides step-by-step instructions for installing dependencies, compiling smart contracts, executing unit tests, running coverage & linting, deploying to local and public testnets (Sepolia, Polygon Amoy, BNB Testnet), and verifying smart contracts on block explorers.

---

## 1. Prerequisites & Environment Setup

### Required Tools
- Node.js `v18+` or `v20+`
- npm `v9+` or yarn / pnpm / bun
- Git

### Installation
Clone the repository and install dependencies in the Hardhat project directory:

```bash
cd D:\dinesh\ABCDeFI-thirdweb\abcdefi-token
npm install
```

### Environment Configuration
Create a `.env` file in the root of `abcdefi-token/`:

```env
# Network RPC Endpoints
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY"
AMOY_RPC_URL="https://rpc-amoy.polygon.technology"
BNB_TESTNET_RPC_URL="https://data-seed-prebsc-1-s1.binance.org:8545"

# Private Key (Deployer Account)
PRIVATE_KEY="0xYOUR_PRIVATE_KEY_HERE"

# Block Explorer API Keys for Verification
ETHERSCAN_API_KEY="YOUR_ETHERSCAN_API_KEY"
POLYGONSCAN_API_KEY="YOUR_POLYGONSCAN_API_KEY"
BSCSCAN_API_KEY="YOUR_BSCSCAN_API_KEY"

# Ecosystem Wallet Addresses
FOUNDER_WALLET="0x..."
ICO_WALLET="0x..."
MARKETING_WALLET="0x..."
FINANCE_WALLET="0x..."
ADVISOR_WALLET="0x..."
RESERVE_WALLET="0x..."
CONTINGENCY_WALLET="0x..."
```

---

## 2. Compilation & Verification Commands

### Smart Contract Compilation
Compile Solidity smart contracts using Hardhat:

```bash
npx hardhat compile
```

### Execute Test Suite
Run all 168+ unit tests across the protocol test suite:

```bash
npx hardhat test
```

### Generate Code Coverage Report
Run test coverage analysis:

```bash
npx hardhat coverage
```

### Static Analysis & Solhint Linting
Execute Solhint linter across all `.sol` contracts:

```bash
npx solhint "contracts/**/*.sol"
```

---

## 3. Local Deployment (Hardhat Network)

1. Start a local Hardhat node in a separate terminal:
   ```bash
   npx hardhat node
   ```

2. Deploy the ecosystem to the local node:
   ```bash
   npx hardhat run scripts/deploy-ecosystem.ts --network localhost
   ```

---

## 4. Testnet Deployment (Sepolia, Amoy, BNB Testnet)

Ensure your deployer wallet has sufficient testnet gas tokens (Sepolia ETH, Amoy MATIC, tBNB).

### Deploy to Sepolia (Ethereum)
```bash
npx hardhat run scripts/deploy-ecosystem.ts --network sepolia
```

### Deploy to Polygon Amoy
```bash
npx hardhat run scripts/deploy-ecosystem.ts --network amoy
```

### Deploy to BNB Smart Chain Testnet
```bash
npx hardhat run scripts/deploy-ecosystem.ts --network bscTestnet
```

Deployment contract addresses and AccessControl parameters will be automatically saved to `deployments.json`.

---

## 5. Contract Verification on Block Explorers

Verify deployed contracts on Etherscan, Polygonscan, or BscScan:

### Verify ABCDToken
```bash
npx hardhat verify --network sepolia <TOKEN_ADDRESS> \
  "<FOUNDER_WALLET>" \
  "<ICO_WALLET>" \
  "<MARKETING_WALLET>" \
  "<FINANCE_WALLET>" \
  "<ADVISOR_WALLET>" \
  "<RESERVE_WALLET>" \
  "<CONTINGENCY_WALLET>"
```

### Verify Treasury
```bash
npx hardhat verify --network sepolia <TREASURY_ADDRESS> "<ADMIN_ADDRESS>"
```

### Verify Presale
```bash
npx hardhat verify --network sepolia <PRESALE_ADDRESS> \
  "<TOKEN_ADDRESS>" \
  "<TREASURY_ADDRESS>" \
  "1000000000000000000000" \
  "10000000000000000000" \
  "100000000000000000000" \
  "1000000000000000000" \
  "10000000000000000000" \
  "<ADMIN_ADDRESS>"
```
