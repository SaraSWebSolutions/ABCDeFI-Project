import { CONTRACTS } from "./contracts";

const metaEnv: Record<string, string | undefined> = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const getEnv = (key: string, fallback = ''): string => metaEnv[key] ?? fallback;

export interface NetworkConfig {
  chainId: number;
  name: string;
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorerUrl: string;
  contracts: {
    ABCDToken: string;
    Treasury: string;
    TokenVesting: string;
    Presale: string;
    StakingPool: string;
  };
}

export const NETWORKS: Record<string, NetworkConfig> = {
  localhost: {
    chainId: 31337,
    name: "Hardhat Localhost",
    currency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: "http://127.0.0.1:8545",
    blockExplorerUrl: "http://localhost:8545",
    contracts: {
      ABCDToken: CONTRACTS.token,
      Treasury: CONTRACTS.treasury,
      TokenVesting: CONTRACTS.vesting,
      Presale: CONTRACTS.presale,
      StakingPool: CONTRACTS.staking,
    },
  },
  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia Testnet",
    currency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    contracts: {
      // Never reuse the active local deployment on a different chain.
      // These values remain unavailable until an explicit Sepolia manifest is supplied.
      ABCDToken: getEnv("VITE_SEPOLIA_ABCD_TOKEN"),
      Treasury: getEnv("VITE_SEPOLIA_TREASURY"),
      TokenVesting: getEnv("VITE_SEPOLIA_TOKEN_VESTING"),
      Presale: getEnv("VITE_SEPOLIA_PRESALE"),
      StakingPool: getEnv("VITE_SEPOLIA_STAKING"),
    },
  },
  bscTestnet: {
    chainId: 97,
    name: "BNB Smart Chain Testnet",
    currency: {
      name: "BNB",
      symbol: "tBNB",
      decimals: 18,
    },
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorerUrl: "https://testnet.bscscan.com",
    contracts: {
      ABCDToken: getEnv("VITE_BSC_TESTNET_ABCD_TOKEN", "0x0000000000000000000000000000000000000000"),
      Treasury: getEnv("VITE_BSC_TESTNET_TREASURY", "0x0000000000000000000000000000000000000000"),
      TokenVesting: getEnv("VITE_BSC_TESTNET_TOKEN_VESTING", "0x0000000000000000000000000000000000000000"),
      Presale: getEnv("VITE_BSC_TESTNET_PRESALE", "0x0000000000000000000000000000000000000000"),
      StakingPool: getEnv("VITE_BSC_TESTNET_STAKING", "0x0000000000000000000000000000000000000000"),
    },
  },
  mainnet: {
    chainId: 1,
    name: "Ethereum Mainnet",
    currency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorerUrl: "https://etherscan.io",
    contracts: {
      ABCDToken: getEnv("VITE_MAINNET_ABCD_TOKEN", "0x0000000000000000000000000000000000000000"),
      Treasury: getEnv("VITE_MAINNET_TREASURY", "0x0000000000000000000000000000000000000000"),
      TokenVesting: getEnv("VITE_MAINNET_TOKEN_VESTING", "0x0000000000000000000000000000000000000000"),
      Presale: getEnv("VITE_MAINNET_PRESALE", "0x0000000000000000000000000000000000000000"),
      StakingPool: getEnv("VITE_MAINNET_STAKING", "0x0000000000000000000000000000000000000000"),
    },
  },
};

export const DEFAULT_NETWORK = NETWORKS.localhost;
