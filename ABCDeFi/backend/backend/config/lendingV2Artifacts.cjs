const fs = require('node:fs');
const path = require('node:path');

const PATHS = Object.freeze({
  LendingPoolV2: 'artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json',
  CollateralVaultV2: 'artifacts/contracts/lending/v2/CollateralVaultV2.sol/CollateralVaultV2.json',
  LoanManagerV2: 'artifacts/contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json',
  LiquidationV2: 'artifacts/contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json',
  LoanMarketplaceV2: 'artifacts/contracts/lending/v2/LoanMarketplaceV2.sol/LoanMarketplaceV2.json',
  EMIManagerV2: 'artifacts/contracts/lending/v2/EMIManagerV2.sol/EMIManagerV2.json',
  LoanNFTV2: 'artifacts/contracts/nft/LoanNFTV2.sol/LoanNFTV2.json',
});

function loadLendingV2Artifacts() {
  const root = path.resolve(__dirname, '../../..');
  return Object.freeze(Object.fromEntries(Object.entries(PATHS).map(([name, relative]) => {
    const source = path.resolve(root, relative);
    if (!fs.existsSync(source)) throw new Error(`Lending V2 ABI is missing: ${source}`);
    const artifact = JSON.parse(fs.readFileSync(source, 'utf8'));
    if (!Array.isArray(artifact.abi)) throw new Error(`Lending V2 ABI is invalid: ${source}`);
    return [name, Object.freeze({ abi: artifact.abi, source: artifact.sourceName })];
  })));
}

module.exports = { PATHS, loadLendingV2Artifacts };
