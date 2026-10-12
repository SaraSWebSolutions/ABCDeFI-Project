import { network } from 'hardhat';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertB64ArtifactPath, resolveB64GenerationConfiguration } from './e2e-runtime/oneq-b64-deployment-manifest-generator.mjs';
const LOCAL_RPC_URL = process.env.ABCDEFI_LOCAL_RPC_URL || 'http://127.0.0.1:8545';

/** LOCAL TEST ONLY: production deployment requires all seven explicit env addresses. */
async function main() {
  const { ethers } = await network.connect(); const signers = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const b64 = process.env.ABCDEFI_RUNTIME_FAMILY === '1Q_LOCAL_B64_LIFECYCLE_TEST'
    ? resolveB64GenerationConfiguration(process.env) : null;
  if (b64 && chainId !== b64.chainId) throw new Error('B6.4 root deployment requires the approved disposable chain ID.');
  const names = ['ICO','FOUNDER','MARKETING','ADVISORS','FINANCE_RESOURCE','CONTINGENCY','RESERVE'] as const;
  const addresses = names.map((name, index) => process.env[`ABCD_1Q_${name}_WALLET`] || signers[index + 1]?.address);
  if (addresses.some((address) => !address || address === ethers.ZeroAddress)) throw new Error('All seven ABCD_1Q_*_WALLET values are required outside the local fixture.');
  const factory = await ethers.getContractFactory('ABCDTokenV2'); const token = await factory.deploy(...addresses as [string,string,string,string,string,string,string]); await token.waitForDeployment();
  const tx = token.deploymentTransaction(); const receipt = await tx?.wait(); if (!tx || !receipt) throw new Error('Deployment receipt unavailable.');
  const supply = await token.totalSupply(); const maxSupply = await token.maxSupply(); if (supply !== maxSupply) throw new Error('1Q supply invariant failed.');
  const allocationEntries = await Promise.all(names.map(async (name,index) => [name,{wallet:addresses[index],bps:[2000,5500,1000,200,900,200,200][index],amount:(await token.balanceOf(addresses[index]!)).toString()}] as const));
  const tokenAddress = await token.getAddress(); const tokenCode = await ethers.provider.getCode(tokenAddress);
  if (b64 && tokenCode === '0x') throw new Error('B6.4 ABCDTokenV2 bytecode evidence is unavailable.');
  const manifest = { schemaVersion: b64 ? 'b64-lifecycle-root-manifest-v1' : '1.0', model:'OWNER_APPROVED_1Q_SEVEN_ALLOCATION', localOnly:true, rpcUrl:LOCAL_RPC_URL, chainId, ...(b64 ? { runtimeFamily: b64.family, runId: b64.runId, runtimeDirectory: b64.runtimeDirectory, mongoNamespace: b64.mongoNamespace, checkpointNamespace: b64.checkpointNamespace } : {}), deploymentVersion:`abcd-1q-local-${receipt.hash}`, deploymentBlock:receipt.blockNumber, contracts:{ABCDTokenV2:{address:tokenAddress,deploymentTransactionHash:tx.hash,deploymentBlock:receipt.blockNumber,...(b64 ? { bytecodeHash: ethers.keccak256(tokenCode) } : {})}}, allocations:Object.fromEntries(allocationEntries) };
  const output = resolve(process.env.ABCD_1Q_MANIFEST_PATH || 'deployments.abcd-1q-local.json'); if (b64) assertB64ArtifactPath('root', output); writeFileSync(output,JSON.stringify(manifest,null,2)+'\n'); console.log(JSON.stringify({output,...manifest},null,2));
}
void main();
