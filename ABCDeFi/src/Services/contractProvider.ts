// src/Services/contractProvider.ts
import { ethers } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, DEPLOYMENT_RPC_URL } from '../Config/contracts';

// The canonical web RPC follows deployments.json via the shared config module.
const RPC_URL = DEPLOYMENT_RPC_URL;
// Browser bundles must never contain a protocol/admin private key.
export const provider = new ethers.JsonRpcProvider(RPC_URL);

export async function assertCanonicalReadChain(): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== DEPLOYMENT_CHAIN_ID) {
    throw new Error(`Canonical RPC is on chain ${network.chainId}, expected ${DEPLOYMENT_CHAIN_ID}. Switch or restart the configured local RPC.`);
  }
}

/**
 * Canonical read-side deployment guard. Reads always use deployments.json's
 * RPC, never the selected MetaMask network. This avoids misleading ABI decode
 * errors when a local Hardhat node has been reset after the manifest was made.
 */
export async function assertCanonicalContractDeployment(name: string, address: string): Promise<void> {
  await assertCanonicalReadChain();
  const code = await provider.getCode(address);
  if (!code || code === '0x' || code === '0x0') {
    throw new Error(`No deployed bytecode for ${name} at ${address} on chain ${DEPLOYMENT_CHAIN_ID}. The local Hardhat chain does not match deployments.json.`);
  }
}

export async function getCanonicalReadContract(name: string, address: string, abi: ethers.InterfaceAbi) {
  await assertCanonicalContractDeployment(name, address);
  return new ethers.Contract(address, abi, provider);
}

export async function getContract(address: string, abi: any) {
  return getCanonicalReadContract('Configured contract', address, abi);
}
