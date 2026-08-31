import { BrowserProvider, Contract, formatEther, Signer } from 'ethers';
import ABCDTokenABI from '../abi/ABCDToken.json';
import { CONTRACTS, DEPLOYMENT_CHAIN_ID, DEPLOYMENT_RPC_URL } from '../Config/contracts';
import { assertCanonicalContractDeployment, assertCanonicalReadChain, provider as canonicalReadProvider } from './contractProvider';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const HARDHAT_CHAIN_ID = DEPLOYMENT_CHAIN_ID;
export const SEPOLIA_CHAIN_ID = 11155111n;
export const BSC_TESTNET_CHAIN_ID = 97n;
export const BSC_MAINNET_CHAIN_ID = 56n;

// Current frontend contract addresses are local deployment addresses.
// Switch this to BSC_TESTNET_CHAIN_ID only after a real BSC deployment.
export const EXPECTED_CHAIN_ID = DEPLOYMENT_CHAIN_ID;

let cachedProvider: BrowserProvider | null = null;
let cachedSigner: Signer | null = null;
let cachedAddress: string | null = null;

function injectedProvider() {
  if (typeof window === 'undefined') return null;
  if (!window.ethereum) return null;
  return window.ethereum.providers?.find?.((provider: any) => provider.isMetaMask)
    || window.ethereum;
}

export async function connectWallet(walletType: 'metamask' | 'walletconnect' | 'trust' | 'coinbase' = 'metamask') {
  if (walletType !== 'metamask') {
    throw new Error(`${walletType} wallet integration is not configured for this web build.`);
  }

  const ethereum = injectedProvider();
  if (!ethereum) throw new Error('MetaMask was not detected. Install MetaMask or use the configured wallet provider.');

  // An explicit connection may follow an account or chain change. Never let a
  // signer cached for the previous EIP-1193 account survive that boundary.
  cachedProvider = new BrowserProvider(ethereum);
  cachedSigner = null;
  cachedAddress = null;
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('No wallet account returned.');

  cachedAddress = accounts[0];
  // Do not obtain a signer or switch chains here. This function's only
  // permission boundary is the user's explicit eth_requestAccounts action.
  // A signer is needed only by an explicit transaction/SIWE action, and the
  // UI presents wrong-network state with a separate user-initiated switch.
  const network = await cachedProvider.getNetwork();

  return {
    provider: cachedProvider,
    address: cachedAddress,
    walletType,
    chainId: network.chainId,
  };
}

/**
 * Opens MetaMask's account-permission selector from an explicit user action.
 * This is not a second wallet connection: it refreshes the same EIP-1193
 * provider and returns through the canonical connectWallet flow.
 */
export async function requestWalletAccountSelection() {
  const ethereum = injectedProvider();
  if (!ethereum) throw new Error('MetaMask was not detected. Install MetaMask or use the configured wallet provider.');

  try {
    await ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
  } catch (error) {
    const details = error as { code?: number };
    // Some EIP-1193 providers do not expose the optional permissions method.
    // They can still present their normal account connect UI below.
    if (details.code !== -32601) throw error;
  }

  return connectWallet('metamask');
}

/**
 * Restore an account that the user has already authorized for this origin.
 * This deliberately uses eth_accounts rather than eth_requestAccounts so it
 * never opens MetaMask or creates a new permission request on page load.
 */
export async function restoreWalletConnection() {
  const ethereum = injectedProvider();
  if (!ethereum) return null;

  const provider = new BrowserProvider(ethereum);
  const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
  if (!accounts?.length) {
    cachedProvider = provider;
    cachedSigner = null;
    cachedAddress = null;
    return null;
  }

  cachedProvider = provider;
  cachedSigner = null;
  cachedAddress = accounts[0];
  const network = await provider.getNetwork();
  return { provider, address: accounts[0], chainId: network.chainId };
}

export async function getProvider(): Promise<BrowserProvider> {
  if (cachedProvider) return cachedProvider;
  const ethereum = injectedProvider();
  if (!ethereum) throw new Error('Web3 provider not detected.');
  cachedProvider = new BrowserProvider(ethereum);
  return cachedProvider;
}

export async function getSigner(): Promise<Signer> {
  const provider = await getProvider();
  const accounts = await provider.send('eth_accounts', []);
  if (!accounts?.length) throw new Error('Wallet is not connected.');
  const currentAddress = accounts[0];
  if (cachedSigner && cachedAddress?.toLowerCase() === currentAddress.toLowerCase()) {
    return cachedSigner;
  }

  // Recreate the signer whenever MetaMask reports a different selected
  // account. This is the final safeguard against a stale signer being used by
  // an admin transaction even if an EIP-1193 event was missed.
  cachedSigner = await provider.getSigner(currentAddress);
  cachedAddress = await cachedSigner.getAddress();
  return cachedSigner;
}

export async function getWalletAddress(): Promise<string> {
  return (await getSigner()).getAddress();
}

export async function signAuthChallenge(_userAddress: string, message: string): Promise<string> {
  const signer = await getSigner();
  return signer.signMessage(message);
}

export async function getEthBalance(_walletProvider?: BrowserProvider, address?: string): Promise<string | null> {
  try {
    const addr = address || await getWalletAddress();
    await assertCanonicalReadChain();
    return formatEther(await canonicalReadProvider.getBalance(addr));
  } catch (error) {
    console.warn('[getEthBalance] Failed to fetch native balance:', error);
    return null;
  }
}

export async function getTokenBalance(_walletProviderOrSigner?: BrowserProvider | Signer, userAddress?: string, tokenAddress?: string): Promise<string | null> {
  try {
    const addr = userAddress || await getWalletAddress();
    const targetAddress = tokenAddress || CONTRACTS.token;
    if (!targetAddress || targetAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('[getTokenBalance] ABCD token address is not configured');
      return null;
    }

    await assertCanonicalContractDeployment('ABCDToken', targetAddress);
    const token = new Contract(targetAddress, ABCDTokenABI, canonicalReadProvider);
    return formatEther(await token.balanceOf(addr));
  } catch (error) {
    console.error('Token balance loading failed:', error);
    return null;
  }
}

export function getNetworkName(chainId: bigint): string {
  if (chainId === HARDHAT_CHAIN_ID) return 'Hardhat Local';
  if (chainId === SEPOLIA_CHAIN_ID) return 'Ethereum Sepolia';
  if (chainId === BSC_TESTNET_CHAIN_ID) return 'BNB Smart Chain Testnet';
  if (chainId === BSC_MAINNET_CHAIN_ID) return 'BNB Smart Chain Mainnet';
  return `Unknown Network (${chainId})`;
}

export async function checkNetwork(provider?: BrowserProvider) {
  const p = provider || await getProvider();
  const network = await p.getNetwork();
  return {
    chainId: network.chainId,
    networkName: getNetworkName(network.chainId),
    isCorrect: network.chainId === EXPECTED_CHAIN_ID,
  };
}

export async function switchNetwork(target: bigint | string = EXPECTED_CHAIN_ID) {
  const ethereum = injectedProvider();
  if (!ethereum) throw new Error('MetaMask was not detected.');

  const chainIdHex = typeof target === 'string'
    ? target
    : target === HARDHAT_CHAIN_ID ? '0x7a69'
      : target === SEPOLIA_CHAIN_ID ? '0xaa36a7'
        : target === BSC_TESTNET_CHAIN_ID ? '0x61'
          : target === BSC_MAINNET_CHAIN_ID ? '0x38' : null;

  if (!chainIdHex) throw new Error(`Unsupported network: ${String(target)}`);

  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
  } catch (error: any) {
    if (error.code !== 4902) throw error;

    if (chainIdHex === '0x7a69') {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x7a69',
          chainName: 'Hardhat Local',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [DEPLOYMENT_RPC_URL],
        }],
      });
    } else if (chainIdHex === '0x61') {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x61',
          chainName: 'BNB Smart Chain Testnet',
          nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
          rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
          blockExplorerUrls: ['https://testnet.bscscan.com'],
        }],
      });
    } else {
      throw error;
    }
  }

  clearWalletCache();
}

export function getTokenContract(signerOrProvider?: Signer | BrowserProvider, tokenAddress?: string) {
  return new Contract(tokenAddress || CONTRACTS.token, ABCDTokenABI, signerOrProvider || cachedSigner || cachedProvider);
}

export function setupEthereumListeners(
  onAccountChanged?: (accounts: string[]) => void,
  onChainChanged?: (chainId: string) => void,
) {
  const ethereum = injectedProvider();
  if (!ethereum?.on) return () => {};

  const accountsChanged = (accounts: string[]) => {
    cachedSigner = null;
    cachedAddress = accounts[0] || null;
    if (!accounts.length) cachedProvider = null;
    onAccountChanged?.(accounts);
  };

  const chainChanged = (chainId: string) => {
    cachedProvider = null;
    cachedSigner = null;
    cachedAddress = null;
    onChainChanged?.(chainId);
  };

  ethereum.on('accountsChanged', accountsChanged);
  ethereum.on('chainChanged', chainChanged);

  return () => {
    ethereum.removeListener?.('accountsChanged', accountsChanged);
    ethereum.removeListener?.('chainChanged', chainChanged);
  };
}

export function clearWalletCache() {
  cachedProvider = null;
  cachedSigner = null;
  cachedAddress = null;
}

export function disconnectWallet() {
  clearWalletCache();
}
