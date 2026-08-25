import React, { useState, useEffect } from 'react';
import { isAddress, parseUnits } from 'ethers';
import { getAllowance, getBalanceOf, getTotalSupply, transferTokens, approveSpender } from '../Services/token';
import { getPresaleData, buyTokens } from '../Services/presale';
import { getVestingSchedule, claimVestedTokens } from '../Services/vesting';
import { getStakingInfo, stakeTokens, claimStakingRewards, withdrawStake } from '../Services/staking';
import {
  depositTreasuryBurnPool,
  depositTreasuryERC20,
  depositTreasuryETH,
  depositTreasuryInterestPool,
  distributeTreasuryFunds,
  getTreasuryState,
  TreasuryState,
  transferTreasuryFunds,
  treasuryErrorMessage,
  withdrawTreasuryERC20,
  withdrawTreasuryETH,
} from '../Services/treasury';
import { getLoanInfo, depositCollateral, borrowTokens, repayLoan, withdrawCollateral } from '../Services/lending';
import { getReferralStats, registerReferral, claimReferralReward } from '../Services/referral';
import { getNFTListings, mintNFT, buyNFT } from '../Services/marketplace';
import { CONTRACTS, requireContractAddress } from '../Config/contracts';
import { useWallet } from '../Context/WalletContext';
import LoanMarketplace from './LoanMarketplace';
import {
  Coins,
  ShoppingBag,
  Clock,
  Layers,
  Vault,
  Landmark,
  Share2,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const ContractInteractDashboard: React.FC = () => {
  const wallet = useWallet();
  const [activeModule, setActiveModule] = useState<string>('presale');
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'waiting' | 'success' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState<string>('');
  const [transferStatus, setTransferStatus] = useState<'idle' | 'validating' | 'awaiting-wallet' | 'confirming' | 'success' | 'error'>('idle');
  const [transferMessage, setTransferMessage] = useState<string>('');
  const [transferHash, setTransferHash] = useState<string | null>(null);

  // Contract Read States
  const [tokenData, setTokenData] = useState<{ balance: string | null; supply: string | null }>({ balance: null, supply: null });
  const [presaleData, setPresaleData] = useState({ rate: '1000', softCap: '10', hardCap: '100', tokensSold: '0' });
  const [vestingData, setVestingData] = useState({ totalAmount: '0', released: '0', releasable: '0' });
  const [stakingData, setStakingData] = useState({ stakedAmount: '0', rewards: '0', totalStaked: '0' });
  const [treasuryData, setTreasuryData] = useState<TreasuryState | null>(null);
  const [lendingData, setLendingData] = useState({ collateral: '0', borrowed: '0', healthFactor: '1.0' });
  const [referralData, setReferralData] = useState({ count: '0', rewards: '0', referrer: '0x000...' });
  const [nfts, setNfts] = useState<any[]>([]);

  // Input Form States
  const [buyEthInput, setBuyEthInput] = useState<string>('0.1');
  const [stakeInput, setStakeInput] = useState<string>('100');
  const [transferInput, setTransferInput] = useState({ to: '', amount: '50' });
  const [depositCollateralInput, setDepositCollateralInput] = useState<string>('0.5');
  const [borrowInput, setBorrowInput] = useState<string>('100');
  const [referrerInput, setReferrerInput] = useState<string>('');
  const [treasuryEthInput, setTreasuryEthInput] = useState<string>('');
  const [treasuryAbcdInput, setTreasuryAbcdInput] = useState<string>('');
  const [treasuryInterestInput, setTreasuryInterestInput] = useState<string>('');
  const [treasuryBurnInput, setTreasuryBurnInput] = useState<string>('');
  const [treasuryRecipient, setTreasuryRecipient] = useState<string>('');
  const [treasuryWithdrawInput, setTreasuryWithdrawInput] = useState<string>('');
  const [treasuryReason, setTreasuryReason] = useState<string>('');
  const [treasuryAllowance, setTreasuryAllowance] = useState<string | null>(null);
  const [treasuryStatus, setTreasuryStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [treasuryMessage, setTreasuryMessage] = useState<string>('');

  // Fetch / Auto-refresh all module states
  const refreshAllData = async () => {
    try {
      const [tBal, tSup, pData, vData, sData, trData, lData, rData, nList] = await Promise.all([
        getBalanceOf(),
        getTotalSupply(),
        getPresaleData(),
        getVestingSchedule(),
        getStakingInfo(),
        getTreasuryState(wallet.address || undefined),
        getLoanInfo(),
        getReferralStats(),
        getNFTListings(),
      ]);

      setTokenData({ balance: tBal, supply: tSup });
      setPresaleData(pData);
      setVestingData(vData);
      setStakingData(sData);
      setTreasuryData(trData);
      setLendingData(lData);
      setReferralData(rData);
      setNfts(nList);
      if (wallet.address) {
        setTreasuryAllowance(await getAllowance(wallet.address, CONTRACTS.treasury));
      } else {
        setTreasuryAllowance(null);
      }
    } catch (err) {
      console.error('Error refreshing contract data:', err);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, [wallet.address]);

  // Helper for executing write functions with standard tx flow (Step 7: Auto-refresh UI)
  const runTransaction = async (actionName: string, txPromise: () => Promise<any>) => {
    try {
      setTxStatus('pending');
      setTxMessage(`Requesting MetaMask confirmation for ${actionName}...`);

      const receipt = await txPromise();

      setTxStatus('waiting');
      setTxMessage(`Waiting for block confirmation...`);

      setTimeout(async () => {
        setTxStatus('success');
        setTxMessage(`Transaction ${actionName} successful!`);
        // Step 7: Auto refresh contract state in React without page reload
        await refreshAllData();
      }, 1500);
    } catch (error: any) {
      console.error(`Transaction ${actionName} error:`, error);
      setTxStatus('error');
      setTxMessage(error?.message || `Transaction ${actionName} failed.`);
    }
  };

  const handleTokenTransfer = async () => {
    if (transferStatus === 'awaiting-wallet' || transferStatus === 'confirming') return;

    setTransferStatus('validating');
    setTransferMessage('Validating recipient, amount, and available ABCD balance...');
    setTransferHash(null);

    const recipient = transferInput.to.trim();
    const amountInput = transferInput.amount.trim();

    if (!isAddress(recipient)) {
      setTransferStatus('error');
      setTransferMessage('Enter a valid recipient wallet address.');
      return;
    }

    let amount;
    try {
      amount = parseUnits(amountInput, 18);
    } catch {
      setTransferStatus('error');
      setTransferMessage('Enter a valid ABCD amount.');
      return;
    }

    if (amount <= 0n) {
      setTransferStatus('error');
      setTransferMessage('Transfer amount must be greater than zero.');
      return;
    }

    try {
      const availableBalance = await getBalanceOf();
      if (amount > parseUnits(availableBalance, 18)) {
        setTransferStatus('error');
        setTransferMessage(`Insufficient ABCD balance. Available: ${availableBalance} ABCD.`);
        return;
      }

      setTransferStatus('awaiting-wallet');
      setTransferMessage('Confirm the ABCD transfer in your wallet.');

      const receipt = await transferTokens(recipient, amountInput, (transactionHash) => {
        setTransferHash(transactionHash);
        setTransferStatus('confirming');
        setTransferMessage('Transfer submitted. Waiting for on-chain confirmation...');
      });

      setTransferHash(receipt.hash);
      setTransferStatus('success');
      setTransferMessage(`Transfer confirmed in block ${receipt.blockNumber}.`);
      await refreshAllData();
    } catch (error: unknown) {
      console.error('ABCD transfer failed:', error);
      setTransferStatus('error');
      setTransferMessage(error instanceof Error ? error.message : 'ABCD transfer failed.');
    }
  };

  const runTreasuryTransaction = async (actionName: string, txPromise: () => Promise<unknown>) => {
    setTreasuryStatus('pending');
    setTreasuryMessage(`Confirm ${actionName} in MetaMask. The transaction will refresh Treasury state after confirmation.`);
    try {
      await txPromise();
      await Promise.all([refreshAllData(), wallet.refreshBalances()]);
      setTreasuryStatus('success');
      setTreasuryMessage(`${actionName} confirmed on-chain.`);
    } catch (error) {
      setTreasuryStatus('error');
      setTreasuryMessage(treasuryErrorMessage(error));
    }
  };

  const treasuryWritesAvailable = Boolean(wallet.isConnected && wallet.isCorrectNetwork && treasuryData && !treasuryData.isPaused);

  const modules = [
    { id: 'token', name: 'ABCD Token', icon: Coins },
    { id: 'presale', name: 'Presale (ICO)', icon: ShoppingBag },
    { id: 'vesting', name: 'Token Vesting', icon: Clock },
    { id: 'staking', name: 'Staking Pool', icon: Layers },
    { id: 'treasury', name: 'Treasury', icon: Vault },
    { id: 'lending', name: 'Lending & Collateral', icon: Landmark },
    { id: 'referral', name: 'Referral System', icon: Share2 },
    { id: 'marketplace', name: 'NFT Marketplace', icon: ImageIcon },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl mt-6 text-slate-100">
      {/* Header & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Smart Contract Interactions</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Ethers.js v6 + MetaMask
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Execute write transactions and read real-time blockchain state</p>
        </div>

        <button
          onClick={refreshAllData}
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Transaction Status Bar (Step 13 & Step 7) */}
      {txStatus !== 'idle' && (
        <div
          className={`mt-4 p-3.5 rounded-2xl border text-xs sm:text-sm font-medium flex items-center justify-between ${txStatus === 'pending' || txStatus === 'waiting'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : txStatus === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
        >
          <div className="flex items-center gap-2.5">
            {txStatus === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
            {txStatus === 'waiting' && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
            {txStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{txMessage}</span>
          </div>
          {txStatus === 'success' && (
            <span className="text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-md font-mono">
              Auto-Refreshed UI ✓
            </span>
          )}
        </div>
      )}

      {/* Module Navigation Tabs (Step 8) */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 border-b border-slate-800/80 no-scrollbar">
        {modules.map((m) => {
          const Icon = m.icon;
          const isSelected = activeModule === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${isSelected
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-6">

        {/* 1. TOKEN MODULE */}
        {activeModule === 'token' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Your Balance (Read)</div>
                <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">
                  {tokenData.balance === null ? 'Unavailable' : `${tokenData.balance} ABCD`}
                </div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Total Supply (Read)</div>
                <div className="text-xl font-extrabold text-indigo-300 font-mono mt-1">
                  {tokenData.supply === null ? 'Unavailable' : `${tokenData.supply} ABCD`}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Transfer Tokens (Write)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Recipient Address (0x...)"
                  value={transferInput.to}
                  onChange={(e) => setTransferInput({ ...transferInput, to: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Amount ABCD"
                  value={transferInput.amount}
                  onChange={(e) => setTransferInput({ ...transferInput, amount: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleTokenTransfer}
                  disabled={transferStatus === 'validating' || transferStatus === 'awaiting-wallet' || transferStatus === 'confirming'}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  {transferStatus === 'validating' ? 'Validating...' : transferStatus === 'awaiting-wallet' ? 'Confirm in Wallet...' : transferStatus === 'confirming' ? 'Confirming...' : 'Send ABCD'}
                </button>
                <button
                  onClick={() => runTransaction('Approve', () => approveSpender(requireContractAddress('presale'), transferInput.amount))}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Approve Presale
                </button>
              </div>
              {transferStatus !== 'idle' && (
                <div
                  className={`rounded-xl border p-3 text-xs ${
                    transferStatus === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : transferStatus === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {['validating', 'awaiting-wallet', 'confirming'].includes(transferStatus) && <Loader2 className="h-4 w-4 animate-spin" />}
                    {transferStatus === 'success' && <CheckCircle2 className="h-4 w-4" />}
                    <span>{transferMessage}</span>
                  </div>
                  {transferHash && (
                    <div className="mt-2 break-all font-mono text-[11px]">
                      Transaction hash: {transferHash}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. PRESALE MODULE */}
        {activeModule === 'presale' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Rate (Read)</div>
                <div className="text-lg font-bold text-white font-mono mt-1">1 ETH = {presaleData.rate} ABCD</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Soft Cap</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{presaleData.softCap} ETH</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Hard Cap</div>
                <div className="text-lg font-bold text-purple-400 font-mono mt-1">{presaleData.hardCap} ETH</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Tokens Sold</div>
                <div className="text-lg font-bold text-amber-400 font-mono mt-1">{presaleData.tokensSold} ABCD</div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Buy Tokens (Write Function)</h3>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={buyEthInput}
                  onChange={(e) => setBuyEthInput(e.target.value)}
                  placeholder="ETH Amount (e.g. 0.1)"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                />
                <button
                  onClick={() => runTransaction('buyTokens', () => buyTokens(buyEthInput))}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer w-full sm:w-auto"
                >
                  Buy Tokens (buyTokens)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. VESTING MODULE */}
        {activeModule === 'vesting' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Total Vested</div>
                <div className="text-lg font-bold text-white font-mono mt-1">{vestingData.totalAmount} ABCD</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Released</div>
                <div className="text-lg font-bold text-slate-400 font-mono mt-1">{vestingData.released} ABCD</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Releasable Now</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{vestingData.releasable} ABCD</div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Claim Vested Tokens</h3>
                <p className="text-xs text-slate-400 mt-0.5">Executes claim() on TokenVesting contract</p>
              </div>
              <button
                onClick={() => runTransaction('Claim Vested Tokens', () => claimVestedTokens())}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Claim Tokens (claim)
              </button>
            </div>
          </div>
        )}

        {/* 4. STAKING MODULE */}
        {activeModule === 'staking' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Your Staked Amount</div>
                <div className="text-lg font-bold text-indigo-400 font-mono mt-1">{stakingData.stakedAmount} ABCD</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Pending Rewards</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{stakingData.rewards} ABCD</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Total Pool Staked</div>
                <div className="text-lg font-bold text-slate-300 font-mono mt-1">{stakingData.totalStaked} ABCD</div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Staking Actions (Write)</h3>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  placeholder="Amount ABCD"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-44"
                />
                <button
                  onClick={() => runTransaction('stake', () => stakeTokens(stakeInput))}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Stake (stake)
                </button>
                <button
                  onClick={() => runTransaction('claimRewards', () => claimStakingRewards())}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Claim Rewards (claim)
                </button>
                <button
                  onClick={() => runTransaction('withdraw', () => withdrawStake(stakeInput))}
                  className="bg-rose-600/80 hover:bg-rose-600 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Withdraw (withdraw)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. TREASURY MODULE */}
        {activeModule === 'treasury' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                ['Treasury ETH', treasuryData?.ethBalance, 'ETH'],
                ['Treasury ABCD', treasuryData?.abcdBalance, 'ABCD'],
                ['Interest Pool', treasuryData?.interestPoolBalance, 'ETH'],
                ['Burn Pool', treasuryData?.burnPoolBalance, 'ETH'],
              ].map(([label, value, unit]) => (
                <div key={label} className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="text-xs text-slate-400 uppercase font-mono">{label} (on-chain)</div>
                  <div className="text-lg font-extrabold text-emerald-400 font-mono mt-1">{value ?? 'Unavailable'}{value !== undefined ? ` ${unit}` : ''}</div>
                </div>
              ))}
            </div>

            {!treasuryData && <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">Treasury state is unavailable. Confirm the canonical Hardhat RPC is running and refresh data.</div>}
            {treasuryData?.isPaused && <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-300">Treasury is paused. Deposits and administrative transactions are unavailable until an authorized pauser unpauses it.</div>}
            {wallet.isConnected && !wallet.isCorrectNetwork && <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-300">Switch MetaMask to Hardhat Local (chain 31337) before using Treasury transactions.</div>}
            {!wallet.isConnected && <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">Connect a wallet on Hardhat Local to deposit. Treasury balances remain read-only.</div>}

            {treasuryWritesAvailable && <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div><h3 className="text-sm font-bold text-white uppercase tracking-wider">Treasury Deposits</h3><p className="mt-1 text-xs text-slate-400">Native ETH and the canonical ABCD token are sent to the deployed Treasury contract.</p></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={treasuryEthInput} onChange={(event) => setTreasuryEthInput(event.target.value)} placeholder="ETH amount" inputMode="decimal" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <button onClick={() => runTreasuryTransaction('ETH Treasury deposit', () => depositTreasuryETH(treasuryEthInput.trim()))} disabled={treasuryStatus === 'pending'} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Deposit ETH</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={treasuryAbcdInput} onChange={(event) => setTreasuryAbcdInput(event.target.value)} placeholder="ABCD amount" inputMode="decimal" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <button onClick={() => runTreasuryTransaction('ABCD Treasury deposit', () => depositTreasuryERC20(CONTRACTS.token, treasuryAbcdInput.trim()))} disabled={treasuryStatus === 'pending'} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Approve if needed & Deposit ABCD</button>
              </div>
              <p className="text-xs text-slate-400">Current ABCD allowance to Treasury: {treasuryAllowance ?? 'Unavailable'} ABCD. The deposit flow requests approval only if that allowance is insufficient.</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input value={treasuryInterestInput} onChange={(event) => setTreasuryInterestInput(event.target.value)} placeholder="ETH for interest pool" inputMode="decimal" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <button onClick={() => runTreasuryTransaction('interest-pool deposit', () => depositTreasuryInterestPool(treasuryInterestInput.trim()))} disabled={treasuryStatus === 'pending'} className="rounded-xl border border-amber-500 px-4 py-2 text-sm font-bold text-amber-300 disabled:opacity-50">Interest Pool</button>
                <button onClick={() => runTreasuryTransaction('burn-pool deposit', () => depositTreasuryBurnPool(treasuryBurnInput.trim()))} disabled={treasuryStatus === 'pending'} className="rounded-xl border border-rose-500 px-4 py-2 text-sm font-bold text-rose-300 disabled:opacity-50">Burn Pool</button>
                <input value={treasuryBurnInput} onChange={(event) => setTreasuryBurnInput(event.target.value)} placeholder="ETH for burn pool" inputMode="decimal" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white sm:col-start-1" />
              </div>
            </div>}

            {treasuryData?.canWithdraw && treasuryWritesAvailable && <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div><h3 className="text-sm font-bold text-white uppercase tracking-wider">Authorized Withdrawals</h3><p className="mt-1 text-xs text-slate-400">Visible only to WITHDRAWER_ROLE. Reserved ETH pools remain protected by the contract.</p></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto_auto]">
                <input value={treasuryRecipient} onChange={(event) => setTreasuryRecipient(event.target.value)} placeholder="Recipient address (0x...)" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <input value={treasuryWithdrawInput} onChange={(event) => setTreasuryWithdrawInput(event.target.value)} placeholder="Amount" inputMode="decimal" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <button onClick={() => runTreasuryTransaction('ETH withdrawal', () => withdrawTreasuryETH(treasuryRecipient.trim(), treasuryWithdrawInput.trim()))} disabled={treasuryStatus === 'pending'} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Withdraw ETH</button>
                <button onClick={() => runTreasuryTransaction('ABCD withdrawal', () => withdrawTreasuryERC20(CONTRACTS.token, treasuryRecipient.trim(), treasuryWithdrawInput.trim()))} disabled={treasuryStatus === 'pending'} className="rounded-xl border border-purple-500 px-4 py-2 text-sm font-bold text-purple-300 disabled:opacity-50">Withdraw ABCD</button>
              </div>
            </div>}
            {treasuryData && wallet.isConnected && !treasuryData.canWithdraw && <p className="text-xs text-slate-400">Withdrawals unavailable: the connected wallet does not have WITHDRAWER_ROLE.</p>}

            {treasuryData?.canAdminister && treasuryWritesAvailable && <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div><h3 className="text-sm font-bold text-white uppercase tracking-wider">Treasury Administration</h3><p className="mt-1 text-xs text-slate-400">Visible only to TREASURY_ADMIN_ROLE.</p></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem_1fr_auto]">
                <input value={treasuryRecipient} onChange={(event) => setTreasuryRecipient(event.target.value)} placeholder="Recipient address (0x...)" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <input value={treasuryWithdrawInput} onChange={(event) => setTreasuryWithdrawInput(event.target.value)} placeholder="ETH amount" inputMode="decimal" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <input value={treasuryReason} onChange={(event) => setTreasuryReason(event.target.value)} placeholder="Transfer reason" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <button onClick={() => runTreasuryTransaction('direct Treasury transfer', () => transferTreasuryFunds(treasuryRecipient.trim(), treasuryWithdrawInput.trim(), treasuryReason))} disabled={treasuryStatus === 'pending'} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Transfer ETH</button>
              </div>
              <button onClick={() => runTreasuryTransaction('8-way Treasury distribution', distributeTreasuryFunds)} disabled={treasuryStatus === 'pending'} className="rounded-xl border border-amber-500 px-4 py-2 text-sm font-bold text-amber-300 disabled:opacity-50">Distribute Available ETH</button>
            </div>}
            {treasuryData && wallet.isConnected && !treasuryData.canAdminister && <p className="text-xs text-slate-400">Treasury administration unavailable: the connected wallet does not have TREASURY_ADMIN_ROLE.</p>}
            {treasuryStatus !== 'idle' && <div className={`rounded-xl p-3 text-sm ${treasuryStatus === 'error' ? 'bg-rose-950 text-rose-300' : treasuryStatus === 'success' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>{treasuryMessage}</div>}
          </div>
        )}

        {/* 6. LENDING MODULE */}
        {activeModule === 'lending' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Deposited Collateral</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{lendingData.collateral} ETH</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Borrowed Tokens</div>
                <div className="text-lg font-bold text-rose-400 font-mono mt-1">{lendingData.borrowed} ABCD</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Health Factor</div>
                <div className="text-lg font-bold text-indigo-300 font-mono mt-1">{lendingData.healthFactor}</div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Lending & Collateral Actions</h3>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => runTransaction('Deposit Collateral', () => depositCollateral(depositCollateralInput))}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Deposit Collateral
                </button>
                <button
                  onClick={() => runTransaction('borrowTokens', () => borrowTokens(borrowInput))}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Borrow (borrow)
                </button>
                <button
                  onClick={() => runTransaction('repayLoan', () => repayLoan(borrowInput))}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Repay (repay)
                </button>
              </div>
            </div>

            {/* STEP 4: LOAN MARKETPLACE COMPONENT */}
            <div className="pt-4 border-t border-slate-800">
              <LoanMarketplace onActionSuccess={refreshAllData} />
            </div>
          </div>
        )}

        {/* 7. REFERRAL MODULE */}
        {activeModule === 'referral' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Total Referrals</div>
                <div className="text-lg font-bold text-white font-mono mt-1">{referralData.count} Users</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-mono">Referral Rewards</div>
                <div className="text-lg font-bold text-amber-400 font-mono mt-1">{referralData.rewards} ABCD</div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Register & Claim Rewards</h3>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Referrer Address (0x...)"
                  value={referrerInput}
                  onChange={(e) => setReferrerInput(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                />
                <button
                  onClick={() => runTransaction('registerReferral', () => registerReferral(referrerInput || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'))}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Register Referral
                </button>
                <button
                  onClick={() => runTransaction('claimReferralReward', () => claimReferralReward())}
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Claim Reward
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. NFT MARKETPLACE MODULE */}
        {activeModule === 'marketplace' && (
          <div className="space-y-6">
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mint New NFT</h3>
                <p className="text-xs text-slate-400 mt-0.5">Executes mint() on NFTMarketplace contract</p>
              </div>
              <button
                onClick={() => runTransaction('mintNFT', () => mintNFT('ipfs://Qm...'))}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs shadow-lg transition cursor-pointer"
              >
                Mint NFT (mint)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {nfts.map((nft) => (
                <div key={nft.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Token ID #{nft.tokenId}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">Price: {nft.price} ETH</div>
                  </div>
                  <button
                    onClick={() => runTransaction('buyNFT', () => buyNFT(nft.id, nft.price))}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                  >
                    Buy NFT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ContractInteractDashboard;
