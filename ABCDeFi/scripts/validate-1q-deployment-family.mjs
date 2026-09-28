import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider, Contract, isAddress, ZeroAddress } from "ethers";

const base = process.env.ABCD_1Q_FAMILY_DIR || process.cwd();
const input = (name) => path.resolve(base, process.env[name]);
const load = (name) => { const file = input(name); if (!fs.existsSync(file)) throw new Error(`Missing ${name}: ${file}`); return { file, value: JSON.parse(fs.readFileSync(file, "utf8")) }; };
const address = (value, label) => { if (typeof value !== "string" || !isAddress(value) || value === ZeroAddress) throw new Error(`Invalid ${label}`); return value; };
const code = async (provider, value, label) => { const result = await provider.getCode(address(value, label)); if (result === "0x") throw new Error(`Missing live bytecode for ${label}`); };

/** Read-only strict validator. It never selects historical fallbacks or mutates any manifest. */
async function main() {
  const root = load("ABCD_1Q_ROOT_MANIFEST_PATH"); const ico = load("ICO_V3_1Q_MANIFEST_PATH"); const lending = load("LENDING_V2_1Q_MANIFEST_PATH");
  if (root.value.model !== "OWNER_APPROVED_1Q_SEVEN_ALLOCATION") throw new Error("Root manifest is not owner-approved 1Q.");
  const provider = new JsonRpcProvider(process.env.ABCD_1Q_RPC_URL || "http://127.0.0.1:8545"); const live = Number((await provider.getNetwork()).chainId);
  for (const [label, manifest] of [["root",root.value],["ico",ico.value],["lending",lending.value]]) if (Number(manifest.chainId) !== 31337 || Number(manifest.chainId) !== live) throw new Error(`${label} chain mismatch.`);
  const token = address(root.value.contracts?.ABCDTokenV2?.address, "root ABCDTokenV2"); await code(provider, token, "ABCDTokenV2");
  const tokenAbi = ["function totalSupply() view returns (uint256)","function maxSupply() view returns (uint256)","function icoWallet() view returns (address)","function marketingWallet() view returns (address)","function financeResourceWallet() view returns (address)","function reserveWallet() view returns (address)"];
  const t = new Contract(token, tokenAbi, provider); if (await t.totalSupply() !== 1_000_000_000_000_000n * 10n ** 18n || await t.maxSupply() !== await t.totalSupply()) throw new Error("1Q token supply invariant failed.");
  for (const [key, getter] of [["ICO","icoWallet"],["MARKETING","marketingWallet"],["FINANCE_RESOURCE","financeResourceWallet"],["RESERVE","reserveWallet"]]) if ((await t[getter]()).toLowerCase() !== address(root.value.allocations?.[key]?.wallet, `root ${key}`).toLowerCase()) throw new Error(`${key} allocation binding mismatch.`);
  if (ico.value.rootDeploymentVersion !== root.value.deploymentVersion || lending.value.rootDeploymentVersion !== root.value.deploymentVersion) throw new Error("Child deployment family does not bind this 1Q root version.");
  if (address(ico.value.contracts?.ABCDTokenV2?.address, "ICO token") .toLowerCase() !== token.toLowerCase() || address(lending.value.contracts?.ABCDTokenV2?.address, "Lending token").toLowerCase() !== token.toLowerCase()) throw new Error("A child deployment binds another token.");
  for (const [label, value] of [["ICOManagerV3",ico.value.contracts?.ICOManagerV3?.address],["LendingPoolV2",lending.value.contracts?.LendingPoolV2?.address],["LendingReferralManagerV2",lending.value.contracts?.LendingReferralManagerV2?.address],["InsuranceReserveV2",lending.value.contracts?.InsuranceReserveV2?.address],["TreasuryV2",lending.value.contracts?.TreasuryV2?.address]]) await code(provider, value, label);
  const funding = lending.value.localTestFunding; for (const name of ["financeResourceLendingFunding","marketingReferralFunding","reserveFixtureFunding"]) if (!funding?.[name] || BigInt(funding[name]) <= 0n) throw new Error(`Missing bounded local funding: ${name}`);
  console.log(JSON.stringify({ status:"PASS", chainId:live, root:root.file, ico:ico.file, lending:lending.file, token, deploymentVersion:root.value.deploymentVersion }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
