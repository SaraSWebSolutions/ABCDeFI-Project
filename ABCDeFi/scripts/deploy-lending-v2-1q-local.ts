import { network } from "hardhat";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ethers as ethersLib } from "ethers";

const ROLE = (name: string) => ethersLib.keccak256(ethersLib.toUtf8Bytes(name));
const ETH_ASSET = "0x0000000000000000000000000000000000000001";
const units = (value: string) => ethersLib.parseUnits(value, 18);
const LOCAL_RPC_URL = process.env.ABCDEFI_LOCAL_RPC_URL || "http://127.0.0.1:8545";
type Entry = { address: string; deploymentTransactionHash: string; deploymentBlock: number };

/**
 * LOCAL TEST ONLY. This separate 1Q family never reads historical ABCDToken
 * allocation getters and never writes deployments.json or a historical manifest.
 */
async function main() {
  const rootPath = resolve(process.env.ABCD_1Q_ROOT_MANIFEST_PATH || "deployments.abcd-1q-local.json");
  if (!existsSync(rootPath)) throw new Error(`Missing 1Q root manifest: ${rootPath}`);
  const manifest = JSON.parse(readFileSync(rootPath, "utf8"));
  if (manifest.model !== "OWNER_APPROVED_1Q_SEVEN_ALLOCATION") throw new Error("Refusing a non-1Q root manifest.");
  const { ethers } = await network.connect(); const signers = await ethers.getSigners(); const admin = signers[0];
  const chainId = Number((await ethers.provider.getNetwork()).chainId); if (chainId !== 31337 || manifest.chainId !== chainId) throw new Error("1Q Lending deployment requires matching local chain 31337.");
  const tokenAddress = manifest.contracts?.ABCDTokenV2?.address; const allocation = manifest.allocations;
  if (!tokenAddress || !allocation?.FINANCE_RESOURCE?.wallet || !allocation?.MARKETING?.wallet || !allocation?.RESERVE?.wallet) throw new Error("1Q manifest lacks required token allocation bindings.");
  if (await ethers.provider.getCode(tokenAddress) === "0x") throw new Error("ABCDTokenV2 has no live bytecode.");
  const token = await ethers.getContractAt("ABCDTokenV2", tokenAddress);
  const finance = await token.financeResourceWallet(), marketing = await token.marketingWallet(), reserveWallet = await token.reserveWallet();
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!same(finance, allocation.FINANCE_RESOURCE.wallet) || !same(marketing, allocation.MARKETING.wallet) || !same(reserveWallet, allocation.RESERVE.wallet)) throw new Error("Live ABCDTokenV2 allocation binding does not match the 1Q manifest.");
  const signerFor = (address: string) => signers.find((s) => same(s.address, address)); const financeSigner = signerFor(finance), marketingSigner = signerFor(marketing), reserveSigner = signerFor(reserveWallet);
  if (!financeSigner || !marketingSigner || !reserveSigner) throw new Error("Required 1Q local allocation signer is unavailable.");
  const financeResourceLendingFunding = units(process.env.LENDING_V2_1Q_LOCAL_FINANCE_RESOURCE_FUNDING || "1000000");
  const marketingReferralFunding = units(process.env.LENDING_V2_1Q_LOCAL_MARKETING_REFERRAL_FUNDING || "10000");
  const reserveFixtureFunding = units(process.env.LENDING_V2_1Q_LOCAL_RESERVE_FIXTURE_FUNDING || "100000");
  const swapFixtureFunding = units(process.env.LENDING_V2_1Q_LOCAL_SWAP_FIXTURE_FUNDING || "1000000");
  if (!financeResourceLendingFunding || !marketingReferralFunding || !reserveFixtureFunding) throw new Error("1Q local fixture funding must be nonzero.");
  if (await token.balanceOf(finance) < financeResourceLendingFunding + swapFixtureFunding) throw new Error("Finance Resource allocation is insufficient for bounded local lending fixture.");
  if (await token.balanceOf(marketing) < marketingReferralFunding) throw new Error("Marketing allocation is insufficient for bounded local referral fixture.");
  if (await token.balanceOf(reserveWallet) < reserveFixtureFunding) throw new Error("Reserve allocation is insufficient for bounded local reserve fixture.");
  const deployed: Record<string, Entry> = {}; const deploy = async (name: string, args: unknown[]) => { const c = await (await ethers.getContractFactory(name)).deploy(...args); await c.waitForDeployment(); const tx = c.deploymentTransaction(); const r = await tx?.wait(); if (!tx || !r || r.status !== 1 || await ethers.provider.getCode(await c.getAddress()) === "0x") throw new Error(`${name} deployment failed`); deployed[name] = { address: await c.getAddress(), deploymentTransactionHash: tx.hash, deploymentBlock: r.blockNumber }; return c; };
  const treasury = await deploy("TreasuryV2", [tokenAddress, admin.address, signers[1].address, signers[2].address, signers[3].address, signers[4].address, signers[5].address, signers[6].address]);
  const ethFeed = await deploy("MockAggregatorV3V2", [8, 2_000n * 10n ** 8n]); const abcdFeed = await deploy("MockAggregatorV3V2", [8, 1n * 10n ** 8n]);
  const oracle = await deploy("OracleAdapterV2", [admin.address]); const vault = await deploy("CollateralVaultV2", [admin.address]); const manager = await deploy("LoanManagerV2", [admin.address]);
  const referral = await deploy("LendingReferralManagerV2", [admin.address, tokenAddress, await manager.getAddress(), marketing]); const loanNFT = await deploy("LoanNFTV2", [admin.address, await manager.getAddress(), await treasury.getAddress()]);
  const pool = await deploy("LendingPoolV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]); const reserve = await deploy("InsuranceReserveV2", [admin.address, tokenAddress, await manager.getAddress()]);
  const marketplace = await deploy("LoanMarketplaceV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]); const liquidation = await deploy("LiquidationV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await reserve.getAddress(), await loanNFT.getAddress(), await pool.getAddress(), await marketplace.getAddress()]); const emi = await deploy("EMIManagerV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]);
  const weth = await deploy("MockWETHV2", []); const router = await deploy("MockPancakeSwapRouterV2", [await weth.getAddress(), tokenAddress, 2_000, 1]); const validator = await deploy("ChainlinkLiquidationPriceValidatorV2", [await oracle.getAddress(), ETH_ASSET, tokenAddress, 300]); const adapter = await deploy("LiquidationSaleAdapterV2", [admin.address, tokenAddress]);
  const confirmed = async (tx: any, label: string) => { const r = await tx.wait(); if (!r || r.status !== 1) throw new Error(`${label} failed`); return r; };
  await confirmed(await oracle.configureFeedWithPolicy(ETH_ASSET, await ethFeed.getAddress(), 86400, 8, 10000, true), "ETH feed"); await confirmed(await oracle.configureFeedWithPolicy(tokenAddress, await abcdFeed.getAddress(), 86400, 8, 10000, true), "ABCD feed");
  for (const op of [pool, liquidation, marketplace, emi]) { await confirmed(await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await op.getAddress()), "manager role"); await confirmed(await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await op.getAddress()), "vault role"); await confirmed(await loanNFT.grantRole(ROLE("MINTER_ROLE"), await op.getAddress()), "nft role"); }
  await confirmed(await manager.grantRole(ROLE("RISK_SETTLEMENT_ROLE"), await liquidation.getAddress()), "risk role"); for (const s of [pool, liquidation, marketplace, loanNFT]) await confirmed(await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await s.getAddress()), "snapshot role");
  await confirmed(await loanNFT.grantRole(ROLE("DIRECT_COMPLETION_OPERATOR_ROLE"), await pool.getAddress()), "direct completion role"); await confirmed(await loanNFT.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()), "p2p completion role"); await confirmed(await loanNFT.setCompletionValuationOracle(await oracle.getAddress(), tokenAddress), "valuation oracle");
  await confirmed(await reserve.grantRole(ROLE("RESERVE_OPERATOR_ROLE"), await liquidation.getAddress()), "reserve role"); await confirmed(await reserve.setLiquidationEngine(await liquidation.getAddress()), "reserve engine"); await confirmed(await pool.grantRole(ROLE("LIQUIDATION_RECOVERY_ROLE"), await liquidation.getAddress()), "pool recovery role");
  await confirmed(await adapter.configure(await liquidation.getAddress(), await vault.getAddress(), await weth.getAddress(), await router.getAddress(), await validator.getAddress(), 300, [await weth.getAddress(), tokenAddress]), "sale adapter"); await confirmed(await liquidation.setSaleAdapter(await adapter.getAddress()), "liquidation adapter"); await confirmed(await liquidation.setEMIManager(await emi.getAddress()), "liquidation emi"); await confirmed(await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await marketplace.getAddress()), "p2p role"); await confirmed(await marketplace.setEMIManager(await emi.getAddress()), "marketplace emi"); await confirmed(await marketplace.setLiquidationEngine(await liquidation.getAddress()), "marketplace liquidation"); await confirmed(await emi.setMarketplace(await marketplace.getAddress()), "emi marketplace"); await confirmed(await pool.setEMIManager(await emi.getAddress()), "pool emi"); await confirmed(await emi.setLendingPool(await pool.getAddress()), "emi pool"); await confirmed(await emi.setOverdueSettlementEngine(await liquidation.getAddress()), "emi settlement"); for (const op of [pool, marketplace, emi]) await confirmed(await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await op.getAddress()), "referral role");
  await confirmed(await token.connect(financeSigner).transfer(admin.address, financeResourceLendingFunding), "Finance Resource lending funding"); await confirmed(await token.connect(financeSigner).transfer(await router.getAddress(), swapFixtureFunding), "Finance Resource router fixture funding"); await confirmed(await token.approve(await pool.getAddress(), financeResourceLendingFunding), "pool approval"); await confirmed(await pool.fundLiquidity(financeResourceLendingFunding), "pool funding");
  await confirmed(await token.connect(reserveSigner).transfer(admin.address, reserveFixtureFunding), "Reserve fixture transfer"); await confirmed(await token.approve(await reserve.getAddress(), reserveFixtureFunding), "reserve approval"); await confirmed(await reserve.fund(reserveFixtureFunding), "reserve funding"); await confirmed(await reserve.setReserveCoverCapABCD(reserveFixtureFunding), "local reserve cap"); await confirmed(await token.connect(marketingSigner).approve(await referral.getAddress(), marketingReferralFunding), "Marketing referral allowance");
  if (await pool.liquidity() !== financeResourceLendingFunding || await reserve.availableBalance() !== reserveFixtureFunding || await token.allowance(marketing, await referral.getAddress()) !== marketingReferralFunding) throw new Error("1Q bounded funding verification failed.");
  const output = resolve(process.env.LENDING_V2_1Q_MANIFEST_PATH || "deployments.lending-v2-1q-local.json"); const firstBlock = Math.min(...Object.values(deployed).map((v) => v.deploymentBlock)); const block = await ethers.provider.getBlock(firstBlock);
  const outputManifest = { schemaVersion: "1.0", model: "OWNER_APPROVED_1Q_LENDING_V2", localOnly: true, rpcUrl: LOCAL_RPC_URL, chainId, rootDeploymentVersion: manifest.deploymentVersion, deploymentVersion: `lending-v2-1q-local-${block?.hash}`, deploymentBlock: firstBlock, contracts: { ABCDTokenV2: { address: tokenAddress }, TreasuryV2: deployed.TreasuryV2, ...deployed }, allocations: { financeResource: finance, marketing, reserve: reserveWallet }, localTestFunding: { financeResourceLendingFunding: financeResourceLendingFunding.toString(), marketingReferralFunding: marketingReferralFunding.toString(), reserveFixtureFunding: reserveFixtureFunding.toString(), swapFixtureFunding: swapFixtureFunding.toString() } };
  writeFileSync(output, JSON.stringify(outputManifest, null, 2) + "\n"); console.log(JSON.stringify({ output, ...outputManifest }, null, 2));
}
void main();
