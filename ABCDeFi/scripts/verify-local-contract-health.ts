import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Contract, JsonRpcProvider } from "ethers";

type Deployment = {
  chainId: string;
  network: string;
  rpcUrl: string;
  contracts: Record<string, { address: string }>;
};

const REQUIRED_CONTRACTS = [
  "ABCDToken", "Treasury", "StakingPool", "LendingPool", "CollateralVault",
  "LoanManager", "LoanMarketplace", "EMIManager", "Liquidation", "NFTMarketplace",
  "ParticipantNFT", "ReputationNFT", "GuruNFT", "LoanNFT", "ReferralManager",
  "BonusEngine", "BonusManager",
] as const;

async function main() {
  const manifestPath = path.resolve("deployments.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Deployment;
  assert.equal(manifest.chainId, "31337", "This diagnostic is restricted to the canonical local deployment");

  const provider = new JsonRpcProvider(manifest.rpcUrl);
  const network = await provider.getNetwork();
  assert.equal(network.chainId, 31337n, "RPC chain does not match the canonical local deployment");

  const bytecode: Record<string, boolean> = {};
  for (const contractName of REQUIRED_CONTRACTS) {
    const address = manifest.contracts[contractName]?.address;
    assert.ok(address, `Manifest is missing ${contractName}`);
    bytecode[contractName] = (await provider.getCode(address)) !== "0x";
    assert.equal(bytecode[contractName], true, `${contractName} has no bytecode at its manifest address`);
  }

  const token = new Contract(manifest.contracts.ABCDToken.address, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ], provider);
  const tokenDetails = {
    name: await token.name(),
    symbol: await token.symbol(),
    decimals: (await token.decimals()).toString(),
  };
  assert.equal(tokenDetails.name, "ABCDeFi Core Token");
  assert.equal(tokenDetails.symbol, "ABCD");
  assert.equal(tokenDetails.decimals, "18");

  console.log(JSON.stringify({
    network: manifest.network,
    chainId: network.chainId.toString(),
    token: tokenDetails,
    bytecode,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
