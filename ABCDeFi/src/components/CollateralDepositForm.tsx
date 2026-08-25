import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { CONTRACTS } from '../Config/contracts';
import { getAllowance } from '../Services/token';
import {
  depositTreasuryERC20,
  getTreasuryState,
  TreasuryState,
  treasuryErrorMessage,
} from '../Services/treasury';

/**
 * Kept at its existing active import path. This page is a Treasury ABCD deposit,
 * not LendingPool/CollateralVault collateral, so it uses Treasury.depositERC20.
 */
export const CollateralDepositForm: React.FC = () => {
  const {
    address,
    balanceABCD,
    isConnected,
    isCorrectNetwork,
    refreshBalances,
  } = useWallet();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [treasuryState, setTreasuryState] = useState<TreasuryState | null>(null);
  const [allowance, setAllowance] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTreasuryData = useCallback(async () => {
    if (!isConnected || !isCorrectNetwork || !address) {
      setTreasuryState(null);
      setAllowance(null);
      setReadError(null);
      return;
    }

    setIsRefreshing(true);
    setReadError(null);
    try {
      const [state, currentAllowance] = await Promise.all([
        getTreasuryState(address),
        getAllowance(address, CONTRACTS.treasury),
      ]);
      setTreasuryState(state);
      setAllowance(currentAllowance);
    } catch (readFailure) {
      setTreasuryState(null);
      setAllowance(null);
      setReadError(treasuryErrorMessage(readFailure));
    } finally {
      setIsRefreshing(false);
    }
  }, [address, isConnected, isCorrectNetwork]);

  useEffect(() => {
    void refreshTreasuryData();
  }, [refreshTreasuryData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestedAmount = amount.trim();
    if (!requestedAmount || !/^\d+(?:\.\d+)?$/.test(requestedAmount) || Number(requestedAmount) <= 0) {
      setError('Enter an ABCD amount greater than zero.');
      return;
    }
    if (!isConnected || !address) {
      setError('Connect the wallet that holds the ABCD you want to deposit.');
      return;
    }
    if (!isCorrectNetwork) {
      setError('Switch MetaMask to Hardhat Local (chain 31337) before depositing ABCD.');
      return;
    }

    setError(null);
    setTxHash(null);
    setLoading(true);

    try {
      // The service validates ABCD balance and, only if necessary, confirms
      // ABCDToken.approve(Treasury, amount) before Treasury.depositERC20.
      const receipt = await depositTreasuryERC20(CONTRACTS.token, requestedAmount);
      setTxHash(receipt.hash);
      setAmount('');
      await Promise.all([refreshBalances(), refreshTreasuryData()]);
    } catch (depositFailure) {
      setError(treasuryErrorMessage(depositFailure));
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return <div className="p-4 bg-gray-800 rounded text-center text-white">Connect a wallet on Hardhat Local to deposit ABCD into Treasury.</div>;
  }

  if (!isCorrectNetwork) {
    return <div className="p-4 bg-gray-800 rounded text-center text-white">Switch MetaMask to Hardhat Local (chain 31337) before depositing ABCD.</div>;
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-white max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-1">Deposit ABCD</h2>
      <p className="text-sm text-gray-400 mb-4">Send ABCD to the canonical deployed Treasury. Approval is requested only when needed.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Asset</label>
          <div className="w-full bg-gray-700 rounded border border-gray-600 px-3 py-2 text-white">ABCD</div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input 
            type="number"
            step="0.0001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-700 rounded border border-gray-600 px-3 py-2 text-white"
            placeholder="0.00"
          />
        </div>

        <div className="rounded border border-gray-700 bg-gray-900/70 p-3 text-xs text-gray-300 space-y-1">
          <div>Wallet ABCD: <span className="font-mono text-white">{balanceABCD ?? 'Unavailable'}</span></div>
          <div>Treasury ABCD: <span className="font-mono text-white">{isRefreshing ? 'Loading...' : treasuryState?.abcdBalance ?? 'Unavailable'}</span></div>
          <div>Current allowance: <span className="font-mono text-white">{isRefreshing ? 'Loading...' : allowance ?? 'Unavailable'}</span></div>
        </div>

        {readError && <div className="text-red-400 text-sm">Treasury read failed: {readError}</div>}

        {error && <div className="text-red-500 text-sm">{error}</div>}
        
        {txHash && (
          <div className="text-green-500 text-sm break-all">
            Transaction confirmed on-chain: {txHash}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className={`w-full py-2 px-4 rounded font-bold ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Confirming transaction...' : 'Approve if needed & Deposit ABCD'}
        </button>
      </form>
    </div>
  );
};
