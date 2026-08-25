// src/Services/contractProvider.ts
import { ethers } from 'ethers';
import { getSigner } from './wallet';
import { DEPLOYMENT_RPC_URL } from '../Config/contracts';

// The canonical web RPC follows deployments.json via the shared config module.
const RPC_URL = DEPLOYMENT_RPC_URL;
// Browser bundles must never contain a protocol/admin private key.
export const provider = new ethers.JsonRpcProvider(RPC_URL);

export async function getContract(address: string, abi: any) {
  return new ethers.Contract(address, abi, await getSigner());
}
