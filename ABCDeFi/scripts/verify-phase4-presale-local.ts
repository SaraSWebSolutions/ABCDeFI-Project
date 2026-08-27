import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Contract, Interface, JsonRpcProvider, ethers } from "ethers";

type DeploymentRecord = { address: string };
type DeploymentManifest = {
  network: string;
  chainId: string;
  rpcUrl: string;
  deployer: string;
  contracts: Record<string, DeploymentRecord>;
};

const LOCAL_CHAIN_ID = 31337n;
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const EXPECTED = {
  rate: ethers.parseUnits("1000", 18),
  softCap: ethers.parseEther("10"),
  hardCap: ethers.parseEther("100"),
  minBuy: ethers.parseEther("0.1"),
  maxBuy: ethers.parseEther("10"),
};

function address(value: unknown, label: string): string {
  assert.equal(typeof value, "string", `${label} must be an address string`);
  assert.ok(ethers.isAddress(value), `${label} is not a valid Ethereum address`);
  assert.notEqual(value, ethers.ZeroAddress, `${label} must not be the zero address`);
  return ethers.getAddress(value);
}

function revertData(error: unknown): string | undefined {
  const details = error as {
    data?: unknown;
    info?: { error?: { data?: unknown } };
    error?: { data?: unknown };
  };
  const value = details.data ?? details.info?.error?.data ?? details.error?.data;
  return typeof value === "string" ? value : undefined;
}

async function expectStateRevert(
  provider: JsonRpcProvider,
  presaleAddress: string,
  from: string,
  contractInterface: Interface,
  functionName: string,
  expectedError: string,
): Promise<void> {
  const data = contractInterface.encodeFunctionData(functionName);
  try {
    await provider.call({ to: presaleAddress, from, data });
    assert.fail(`${functionName}() eth_call unexpectedly succeeded in the current state`);
  } catch (error) {
    const data = revertData(error);
    assert.ok(data && data !== "0x", `${functionName}() did not return contract revert data`);
    const decoded = contractInterface.parseError(data);
    assert.equal(decoded?.name, expectedError, `${functionName}() returned an unexpected contract error`);
  }
  console.log(`✓ ${functionName}() selector and current-state guard verified`);
}

async function main() {
  const manifestPath = path.resolve("deployments.json");
  const artifactPath = path.resolve("artifacts/contracts/ico/Presale.sol/Presale.json");
  assert.ok(fs.existsSync(manifestPath), "root deployments.json is required");
  assert.ok(fs.existsSync(artifactPath), "compiled Presale artifact is required");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as DeploymentManifest;
  assert.equal(manifest.network, "localhost", "manifest network must be localhost");
  assert.equal(manifest.chainId, LOCAL_CHAIN_ID.toString(), "manifest chain ID must be 31337");
  assert.equal(manifest.rpcUrl, LOCAL_RPC_URL, "manifest RPC must be canonical localhost");

  const presaleAddress = address(manifest.contracts?.Presale?.address, "manifest Presale");
  const tokenAddress = address(manifest.contracts?.ABCDToken?.address, "manifest ABCDToken");
  const treasuryAddress = address(manifest.contracts?.Treasury?.address, "manifest Treasury");
  const verifierAddress = address(manifest.deployer, "manifest deployer");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { abi?: unknown[] };
  assert.ok(Array.isArray(artifact.abi), "compiled Presale artifact ABI is missing");

  const provider = new JsonRpcProvider(manifest.rpcUrl);
  assert.equal((await provider.getNetwork()).chainId, LOCAL_CHAIN_ID, "connected RPC chain ID does not match manifest");

  // This is a direct eth_getCode request; no signer or transaction is ever used.
  const code = await provider.getCode(presaleAddress);
  assert.notEqual(code, "0x", "manifest Presale has no deployed bytecode");
  console.log("✓ eth_getCode returned deployed Presale bytecode");

  const presaleInterface = new Interface(artifact.abi);
  for (const functionName of [
    "token", "treasury", "rate", "softCap", "hardCap", "minBuy", "maxBuy",
    "paused", "isFinalized", "isCancelled", "isRefunded", "claimRefund",
    "cancelFailedSale", "pause", "unpause", "getState", "getBuyerInfo",
  ]) {
    assert.ok(presaleInterface.getFunction(functionName), `compiled Presale ABI is missing ${functionName}()`);
  }

  // Contract reads below are eth_call requests because this provider has no signer.
  const presale = new Contract(presaleAddress, artifact.abi, provider);
  const [token, treasury, rate, softCap, hardCap, minBuy, maxBuy, paused, finalized, cancelled, refunded, state, buyer] = await Promise.all([
    presale.token(),
    presale.treasury(),
    presale.rate(),
    presale.softCap(),
    presale.hardCap(),
    presale.minBuy(),
    presale.maxBuy(),
    presale.paused(),
    presale.isFinalized(),
    presale.isCancelled(),
    presale.isRefunded(verifierAddress),
    presale.getState(),
    presale.getBuyerInfo(verifierAddress),
  ]);

  assert.equal(token.toLowerCase(), tokenAddress.toLowerCase(), "Presale token() does not match canonical ABCDToken");
  assert.equal(treasury.toLowerCase(), treasuryAddress.toLowerCase(), "Presale treasury() does not match canonical Treasury");
  assert.equal(rate, EXPECTED.rate, "Presale rate is incorrect");
  assert.equal(softCap, EXPECTED.softCap, "Presale softCap is incorrect");
  assert.equal(hardCap, EXPECTED.hardCap, "Presale hardCap is incorrect");
  assert.equal(minBuy, EXPECTED.minBuy, "Presale minBuy is incorrect");
  assert.equal(maxBuy, EXPECTED.maxBuy, "Presale maxBuy is incorrect");

  console.log(`✓ token() = ${token}`);
  console.log(`✓ treasury() = ${treasury}`);
  console.log(`✓ rate() = ${ethers.formatUnits(rate, 18)} ABCD / ETH`);
  console.log(`✓ softCap() = ${ethers.formatEther(softCap)} ETH`);
  console.log(`✓ hardCap() = ${ethers.formatEther(hardCap)} ETH`);
  console.log(`✓ minBuy() = ${ethers.formatEther(minBuy)} ETH`);
  console.log(`✓ maxBuy() = ${ethers.formatEther(maxBuy)} ETH`);
  console.log(`✓ paused() = ${paused}`);
  console.log(`✓ isFinalized() = ${finalized}`);
  console.log(`✓ isCancelled() = ${cancelled}`);
  console.log(`✓ isRefunded(${verifierAddress}) = ${refunded}`);
  console.log(`✓ getState() = ${state}`);
  console.log(`✓ getBuyerInfo(${verifierAddress}) read successfully: contribution ${ethers.formatEther(buyer.ethContributed)} ETH`);

  // These simulations are eth_call only. They do not create a transaction or persist state.
  await expectStateRevert(provider, presaleAddress, verifierAddress, presaleInterface, "claimRefund", "InvalidLifecycleState");
  await expectStateRevert(provider, presaleAddress, verifierAddress, presaleInterface, "cancelFailedSale", "InvalidLifecycleState");

  const pauseData = presaleInterface.encodeFunctionData("pause");
  await provider.call({ to: presaleAddress, from: verifierAddress, data: pauseData });
  assert.equal(await presale.paused(), paused, "eth_call pause() must not persist a state change");
  console.log("✓ pause() selector and non-persistent eth_call verified");

  await expectStateRevert(provider, presaleAddress, verifierAddress, presaleInterface, "unpause", "ExpectedPause");
  assert.equal(await presale.paused(), paused, "read-only verification changed the pause state");

  console.log("\nPHASE 4 PRESALE READ-ONLY VERIFICATION: PASS");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
