import React, { useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { Wallet, Loader2, LogOut, Copy, Check, X } from 'lucide-react';
import { Web3WalletConnectModal } from './Web3WalletConnectModal';

export interface ConnectWalletButtonProps {
  onConnect?: (address: string | null) => void;
  className?: string;
}

export const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({
  onConnect,
  className = '',
}) => {
  const wallet = useWallet();
  const [copied, setCopied] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (wallet.isConnected && wallet.address) {
    return (
      <div className={`inline-flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-200 shadow-md backdrop-blur-sm transition-all ${className}`}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono font-medium text-slate-200">{formatAddress(wallet.address)}</span>
        </div>

        <div className="h-4 w-[1px] bg-slate-700 mx-1" />

        <button
          onClick={copyAddress}
          title="Copy address"
          className="p-1 text-slate-400 hover:text-slate-200 rounded transition cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>

        <button
          onClick={() => {
            wallet.disconnectWallet();
            onConnect?.(null);
          }}
          title="Disconnect wallet"
          className="p-1 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="inline-flex flex-col items-start gap-1 font-mono">
        <button
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl px-4 py-2.5 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer ${className}`}
        >
          <Wallet className="w-4 h-4 text-slate-950" />
          <span>Connect Wallet 🦊</span>
        </button>
      </div>

      <Web3WalletConnectModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

export default ConnectWalletButton;
