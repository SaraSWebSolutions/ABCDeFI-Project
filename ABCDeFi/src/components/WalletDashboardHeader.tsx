import React, { useState } from 'react';
import {
  connectWallet,
  getEthBalance,
  getTokenBalance,
  checkNetwork,
  switchNetwork,
  getSigner,
  getTokenContract,
  EXPECTED_CHAIN_ID,
} from '../Services/wallet';
import { BrowserProvider, Signer } from 'ethers';
import {
  Wallet,
  Network,
  Coins,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';

export type TxStatus = 'idle' | 'pending' | 'waiting' | 'success' | 'error';

export const WalletDashboardHeader: React.FC = () => {
  // Wallet State
  const [wallet, setWallet] = useState<{
    provider: BrowserProvider;
    signer: Signer;
    address: string;
  } | null>(null);

  // Dashboard Data States (Steps 6 - 10)
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [abcdBalance, setAbcdBalance] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string>('Unknown');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  // Step 13: Transaction Status State
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Helper to load balances and network details
  const loadWalletDetails = async (currentWallet: {
    provider: BrowserProvider;
    signer: Signer;
    address: string;
  }) => {
    // Step 6: ETH Balance
    const eth = await getEthBalance(currentWallet.provider, currentWallet.address);
    setEthBalance(eth);

    // Step 7: ABCD Token Balance
    const abcd = await getTokenBalance(currentWallet.provider, currentWallet.address);
    setAbcdBalance(abcd);

    // Step 10 & 11: Network Check
    const net = await checkNetwork(currentWallet.provider);
    setNetworkName(net.networkName);
    setIsCorrectNetwork(net.isCorrect);
  };

  // Connect Handler
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connectedWallet = await connectWallet();
      if (connectedWallet?.address) {
        console.log('Connected Wallet Address:', connectedWallet.address);
        // A signer is requested only after this explicit Connect Wallet click.
        const connected = { provider: connectedWallet.provider, signer: await getSigner(), address: connectedWallet.address };
        setWallet(connected);
        setIsSimulated(false);
        await loadWalletDetails(connected);
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Step 15: Disconnect Handler (Clears React state)
  const handleDisconnect = () => {
    setWallet(null);
    setIsSimulated(false);
    setEthBalance(null);
    setAbcdBalance('0');
    setNetworkName('Unknown');
    setIsCorrectNetwork(true);
    setTxStatus('idle');
    setTxHash(null);
  };

  // Helper for formatting wallet address
  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Step 12 & 13: Example contract transaction execution with status steps
  const executeSampleTransaction = async (actionName: string) => {
    if (!wallet) return;

    try {
      // Step 13: Transaction Pending...
      setTxStatus('pending');
      console.log(`Executing ${actionName}...`);

      const tokenContract = getTokenContract(wallet.signer);

      // Simulate or call transaction
      setTimeout(() => {
        // Step 13: Waiting Confirmation...
        setTxStatus('waiting');
        setTxHash('0x9a8f...3e21');
      }, 1500);

      setTimeout(() => {
        // Step 13: Transaction Successful
        setTxStatus('success');
        // Refresh balances after transaction
        loadWalletDetails(wallet);
      }, 3500);
    } catch (error) {
      console.error(`Transaction ${actionName} failed:`, error);
      setTxStatus('error');
    }
  };

  return (
    <div className="w-full bg-slate-900/95 border-b border-slate-800 text-slate-100 shadow-xl backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Step 11: Network Warning Banner */}
        {wallet && !isCorrectNetwork && (
          <div className="mb-3 bg-amber-500/15 border border-amber-500/40 rounded-xl px-4 py-2 flex items-center justify-between text-xs sm:text-sm text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Please switch to Ethereum Sepolia Testnet (Chain ID: 11155111)</span>
            </div>
            <button
              onClick={() => switchNetwork("0xaa36a7")}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition cursor-pointer"
            >
              Switch to Sepolia
            </button>
          </div>
        )}

        {/* Top Web3 Dashboard Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">

          {/* Left Brand / Connection Status */}
          <div className="flex items-center gap-3">
            {wallet ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{isSimulated ? '🟡 Demo Connected' : '🟢 Connected'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-xs font-medium text-slate-400">Disconnected</span>
              </div>
            )}
          </div>

          {/* Connected Dashboard Details */}
          {wallet ? (
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              {/* Wallet Address */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Wallet</div>
                <div className="text-xs font-bold text-slate-100 font-mono flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                  {formatAddress(wallet.address)}
                </div>
              </div>

              {/* Network */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Network</div>
                <div className="text-xs font-bold text-indigo-300 font-mono flex items-center gap-1">
                  <Network className="w-3.5 h-3.5 text-purple-400" />
                  {networkName}
                </div>
              </div>

              {/* ETH Balance (Step 6) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">ETH Balance</div>
                <div className="text-xs font-bold text-emerald-400 font-mono">
                  {ethBalance === null ? 'Unavailable' : `${ethBalance} ETH`}
                </div>
              </div>

              {/* ABCD Token Balance (Step 7) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">ABCD Balance</div>
                <div className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  {abcdBalance === null ? 'Unavailable' : `${abcdBalance} ABCD`}
                </div>
              </div>

              {/* Connected Button Indicator */}
              <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs font-semibold">
                <span>{isSimulated ? 'Demo Wallet' : 'Connect Wallet'}</span>
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              </div>

              {/* Step 15: Disconnect Button */}
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            /* Connect Wallet Trigger */
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-lg shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Transaction Status Banner */}
        {wallet && txStatus !== 'idle' && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {txStatus === 'pending' && (
                <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Transaction Pending...</span>
                </span>
              )}
              {txStatus === 'waiting' && (
                <span className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Waiting Confirmation...</span>
                </span>
              )}
              {txStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Transaction Successful</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletDashboardHeader;
