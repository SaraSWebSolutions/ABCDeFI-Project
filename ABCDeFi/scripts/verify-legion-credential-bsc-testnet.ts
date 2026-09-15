import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { assertBscTestnetChainId, loadLegionBscTestnetConfig, readLegionBscManifest } from "./legion-bsc-testnet-config.js";

const ERC721_INTERFACE_ID = "0x80ac58cd";

function artifact() {
  const artifactPath = path.resolve("artifacts/contracts/nft/LegionCredentialV2.sol/LegionCredentialV2.json");
  if (!fs.existsSync(artifactPath)) throw new Error("LegionCredentialV2 artifact is missing; compile before verification.");
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { abi: any[]; deployedBytecode: string };
}

async function mustRevert(action: () => Promise<unknown>, label: string) {
  try { await action(); } catch { return; }
  throw new Error(`${label} unexpectedly succeeded; the deployed credential is not safely non-transferable.`);
}

async function main() {
  const config = loadLegionBscTestnetConfig();
  const manifest = readLegionBscManifest(config.manifestPath);
  if (!manifest || manifest.deploymentStatus !== "DEPLOYED" || !manifest.contracts.LegionCredentialV2 || !manifest.roles) {
    throw new Error("Canonical BSC LegionCredentialV2 is not deployed; verification cannot claim success.");
  }
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  assertBscTestnetChainId((await provider.getNetwork()).chainId);
  const deployed = manifest.contracts.LegionCredentialV2.address;
  const code = await provider.getCode(deployed);
  if (code === "0x") throw new Error("BSC Legion manifest address has no bytecode.");
  const compiled = artifact();
  if (ethers.keccak256(code) !== ethers.keccak256(compiled.deployedBytecode)) throw new Error("BSC Legion bytecode does not match the compiled canonical LegionCredentialV2 artifact.");
  const credential = new ethers.Contract(deployed, compiled.abi, provider);
  const [name, symbol, erc721, defaultAdminRole, legionAdminRole, minterRole, pauserRole, paused] = await Promise.all([
    credential.name(), credential.symbol(), credential.supportsInterface(ERC721_INTERFACE_ID), credential.DEFAULT_ADMIN_ROLE(), credential.LEGION_ADMIN_ROLE(), credential.LEGION_MINTER_ROLE(), credential.PAUSER_ROLE(), credential.paused(),
  ]);
  if (name !== "ABCDeFi Legion Credential V2" || symbol !== "ABCD-LEGION-V2" || !erc721) throw new Error("Manifest contract is not the canonical LegionCredentialV2 ERC-721.");
  const roleChecks = await Promise.all([
    credential.hasRole(defaultAdminRole, config.admin), credential.hasRole(legionAdminRole, config.admin), credential.hasRole(minterRole, config.minter), credential.hasRole(pauserRole, config.pauser),
  ]);
  if (roleChecks.some((granted: boolean) => !granted)) throw new Error("BSC Legion role assignment does not match the configured admin/minter/pauser addresses.");
  await mustRevert(() => credential.approve.staticCall(config.deployer, 1n), "ERC-721 approval");
  await mustRevert(() => credential.setApprovalForAll.staticCall(config.deployer, true), "ERC-721 operator approval");
  // The deployed runtime bytecode match above proves the activeCredentialOf guard;
  // the getter is additionally read here without manufacturing a credential.
  await credential.activeCredentialOf(config.deployer);
  console.log(JSON.stringify({ chainId: 97, address: deployed, bytecode: "present", name, symbol, erc721, roles: { admin: config.admin, minter: config.minter, pauser: config.pauser }, paused, nonTransferable: true, oneActivePerWalletGuard: "verified-by-canonical-bytecode", metadata: "IPFS URI validation is enforced by canonical bytecode" }, null, 2));
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "BSC Legion verification failed."); process.exitCode = 1; });
