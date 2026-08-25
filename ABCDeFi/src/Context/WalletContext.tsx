import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Contract, parseEther, parseUnits, formatUnits } from 'ethers';
import {
  connectWallet as connectWalletService,
  disconnectWallet as disconnectWalletService,
  getEthBalance,
  getTokenBalance,
  setupEthereumListeners,
  checkNetwork,
  switchNetwork,
  getSigner,
  EXPECTED_CHAIN_ID,
  getNetworkName,
  HARDHAT_CHAIN_ID,
  BSC_TESTNET_CHAIN_ID,
} from '../Services/wallet';
import { AuthService } from '../Services/authService';
import { CONTRACTS } from '../Config/contracts';
import CollateralVaultABI from '../abi/CollateralVault.json';

interface WalletContextType {
  address: string | null;
  shortAddress: string;
  isConnected: boolean;
  isConnecting: boolean;
  walletVerified: boolean;
  balanceBNB: string | null;
  balanceABCD: string | null;
  networkName: string;
  chain: string;
  chainId: bigint | null;
  isCorrectNetwork: boolean;
  balances: { ABCD: number | null; BNB: number | null; ETH: number | null; USDT: number | null; USDC: number | null };
  profile: { kycStatus: string } | null;
  isKycApproved: boolean;
  jwtToken: string | null;
  connectWallet: (type?: 'metamask' | 'walletconnect' | 'trust' | 'coinbase') => Promise<string | undefined>;
  disconnectWallet: () => void;
  loginWithSignature: () => Promise<string | null>;
  setKycStatus: (approved: boolean) => void;
  refreshBalances: () => Promise<void>;
  switchBscNetwork: () => Promise<void>;
  switchChain: (chainName?: string) => Promise<void>;
  depositCollateral: (token: string, amount: string) => Promise<any>;
  createLoan: (depositId: string, loanAmount: string, duration: number) => Promise<any>;
  fundLoan: (loanId: string) => Promise<any>;
  repayLoan: (loanId: string) => Promise<any>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  // Provider events alone must never create an application connection. This
  // flag is set only by an explicit Connect Wallet/SIWE action.
  const explicitConnectionRef = useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletVerified, setWalletVerified] = useState(false);
  const [balanceBNB, setBalanceBNB] = useState<string | null>(null);
  const [balanceABCD, setBalanceABCD] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState('Not Connected');
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [isKycApproved, setIsKycApproved] = useState(false);
  const [jwtToken, setJwtToken] = useState<string | null>(() => localStorage.getItem('abcdefi_jwt'));

  const refreshNetwork = useCallback(async () => {
    const result = await checkNetwork();
    setChainId(result.chainId);
    setNetworkName(result.networkName);
    setIsCorrectNetwork(result.isCorrect);
  }, []);

  const loadBalancesForAddress = useCallback(async (provider: Parameters<typeof getEthBalance>[0], walletAddress: string) => {
    try {
      const [native, abcd] = await Promise.all([
        getEthBalance(provider, walletAddress).catch((err) => {
          console.error("Native balance loading failed:", err);
          return null;
        }),
        getTokenBalance(provider, walletAddress),
      ]);

      setBalanceBNB(native === null ? null : Number(native).toFixed(6));
      setBalanceABCD(abcd === null ? null : Number(abcd).toLocaleString(undefined, { maximumFractionDigits: 6 }));
    } catch (error) {
      console.error("Token balance loading failed:", error);
      setBalanceBNB(null);
      setBalanceABCD(null);
    }
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!address) return;
    await loadBalancesForAddress(undefined, address);
  }, [address, loadBalancesForAddress]);

  const connectWallet = async (type: 'metamask' | 'walletconnect' | 'trust' | 'coinbase' = 'metamask') => {
    // This function is called only from explicit Connect Wallet/SIWE actions.
    // Mark intent before MetaMask can emit accountsChanged during approval.
    explicitConnectionRef.current = true;
    setIsConnecting(true);
    try {
      const result = await connectWalletService(type);
      if (!result.address) throw new Error('No address returned from wallet provider');
      setAddress(result.address);
      // A connected address is not a verified SIWE session.
      setWalletVerified(false);
      setChainId(result.chainId);
      setNetworkName(getNetworkName(result.chainId));
      setIsCorrectNetwork(result.chainId === EXPECTED_CHAIN_ID);
      // The connection is established once MetaMask has returned an account.
      // Balance RPC reads must never keep the Connect button in a pending state.
      void loadBalancesForAddress(result.provider, result.address);
      return result.address;
    } catch (error) {
      explicitConnectionRef.current = false;
      setAddress(null);
      setChainId(null);
      setNetworkName('Not Connected');
      setIsCorrectNetwork(false);
      setWalletVerified(false);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    disconnectWalletService();
    explicitConnectionRef.current = false;
    setAddress(null);
    setBalanceBNB(null);
    setBalanceABCD(null);
    setNetworkName('Not Connected');
    setChainId(null);
    setIsCorrectNetwork(false);
    setWalletVerified(false);
    setJwtToken(null);
    localStorage.removeItem('abcdefi_connected_wallet');
  };

  const loginWithSignature = async () => {
    const currentAddress = address || await connectWallet('metamask');

    if (!currentAddress) {
      throw new Error('Wallet not connected');
    }

    const challenge = await AuthService.walletLoginChallenge(currentAddress);

    if (!challenge?.nonce || !challenge?.message) {
      throw new Error('Invalid wallet authentication challenge');
    }

    const signer = await getSigner();
    const signature = await signer.signMessage(challenge.message);

    const result = await AuthService.walletLogin(
      currentAddress,
      signature,
      challenge.nonce
    );

    console.log("[WalletContext] FULL LOGIN RESULT:", result);
    console.log("[WalletContext] LOGIN KYC:", result?.user?.kycStatus);

    if (!result?.token) {
      throw new Error('Backend did not issue an access token');
    }

    // Save JWT
    setJwtToken(result.token);
    localStorage.setItem('abcdefi_jwt', result.token);
    setWalletVerified(true);

    // Sync KYC status from backend
    if (result?.user?.kycStatus) {
      const approved = result.user.kycStatus === "approved";
      setIsKycApproved(approved);

      console.log(
        "[WalletContext] Backend KYC status:",
        result.user.kycStatus
      );
    }

    return result.token;
  };

  const setKycStatus = (approved: boolean) => setIsKycApproved(approved);

  const switchBscNetwork = async () => {
    await switchNetwork(BSC_TESTNET_CHAIN_ID);
    await refreshNetwork();
  };

  const switchChain = async (chainName?: string) => {
    const target = chainName || 'Hardhat Local';
    if (target === 'Hardhat Local') await switchNetwork(HARDHAT_CHAIN_ID);
    else if (target === 'BNB Smart Chain Testnet' || target === 'BSC Testnet') await switchNetwork(BSC_TESTNET_CHAIN_ID);
    else throw new Error(`Unsupported network: ${target}`);
    await refreshNetwork();
    await refreshBalances();
  };

  const depositCollateral = async (tokenAddress: string, amount: string) => {
    if (!address) throw new Error('Wallet not connected');
    if (!isCorrectNetwork) throw new Error(`Please switch to the configured network (${networkName})`);
    if (!isKycApproved) throw new Error('KYC approval is required before depositing collateral');

    const signer = await getSigner();
    const vault = new Contract(CONTRACTS.collateralVault, CollateralVaultABI, signer);
    let tx;

    const native = tokenAddress.toLowerCase() === 'eth' || tokenAddress === '0x0000000000000000000000000000000000000000';
    if (native) {
      tx = await vault.depositETH(address, { value: parseEther(amount) });
    } else {
      const erc20 = new Contract(tokenAddress, [
        'function decimals() view returns (uint8)',
        'function allowance(address,address) view returns (uint256)',
        'function approve(address,uint256) returns (bool)',
      ], signer);
      const decimals = Number(await erc20.decimals());
      const parsed = parseUnits(amount, decimals);
      const allowance = await erc20.allowance(address, CONTRACTS.collateralVault);
      if (allowance < parsed) {
        const approval = await erc20.approve(CONTRACTS.collateralVault, parsed);
        await approval.wait();
      }
      tx = await vault.depositERC20(tokenAddress, address, parsed);
    }

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('Collateral deposit was reverted or not confirmed on-chain.');
    }

    const token = localStorage.getItem('abcdefi_jwt');
    if (token) {
      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          token: tokenAddress,
          amount,
          walletAddress: address,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          chainId: chainId ? Number(chainId) : undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Blockchain deposit succeeded but backend recording failed');
      }
    }

    await refreshBalances();
    return receipt;
  };

  const createLoan = async () => {
    throw new Error('Use the LoanMarketplace flow to create a collateralized loan request.');
  };
  const fundLoan = async () => {
    throw new Error('Use the LoanMarketplace lender funding flow.');
  };
  const repayLoan = async () => {
    throw new Error('Use the EMIManager / LendingPool repayment flow.');
  };

  useEffect(() => {
    const handleAuthLogout = () => {
      disconnectWalletService();
      setAddress(null);
      setBalanceBNB(null);
      setBalanceABCD(null);
      setNetworkName('Not Connected');
      setChainId(null);
      setIsCorrectNetwork(false);
      setIsKycApproved(false);
      setWalletVerified(false);
      setJwtToken(null);
      explicitConnectionRef.current = false;
      localStorage.removeItem('abcdefi_connected_wallet');
    };

    window.addEventListener('abcdefi-auth-logout', handleAuthLogout);
    return () => window.removeEventListener('abcdefi-auth-logout', handleAuthLogout);
  }, []);

  useEffect(() => {
    const cleanup = setupEthereumListeners(
      async (accounts: string[]) => {
        if (!explicitConnectionRef.current) return;
        if (!accounts.length) {
          disconnectWallet();
          return;
        }
        setAddress(accounts[0]);
        setWalletVerified(false);
        await refreshNetwork();
        await refreshBalances();
      },
      async (_chainId: string) => {
        if (!explicitConnectionRef.current) return;
        setChainId(null);
        setWalletVerified(false);
        await refreshNetwork();
        await refreshBalances();
      },
    );
    return cleanup;
  }, [refreshBalances, refreshNetwork]);

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const numericAbcd = balanceABCD === null ? null : Number(balanceABCD.replace(/,/g, ''));
  const numericBnb = balanceBNB === null ? null : Number(balanceBNB);

  return (
    <WalletContext.Provider value={{
      address,
      shortAddress,
      isConnected: Boolean(address),
      isConnecting,
      walletVerified,
      balanceBNB,
      balanceABCD,
      networkName,
      chain: networkName,
      chainId,
      isCorrectNetwork,
      balances: { ABCD: numericAbcd, BNB: numericBnb, ETH: numericBnb, USDT: null, USDC: null },
      profile: null,
      isKycApproved,
      jwtToken,
      connectWallet,
      disconnectWallet,
      loginWithSignature,
      setKycStatus,
      refreshBalances,
      switchBscNetwork,
      switchChain,
      depositCollateral,
      createLoan,
      fundLoan,
      repayLoan,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside WalletProvider');
  return context;
};
