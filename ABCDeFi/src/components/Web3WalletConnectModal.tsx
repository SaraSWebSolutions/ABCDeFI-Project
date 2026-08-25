import React, { useState } from 'react';
import { useWallet } from '../Context/WalletContext';

interface Web3WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Web3WalletConnectModal: React.FC<Web3WalletConnectModalProps> = ({ isOpen, onClose }) => {
  const { connectWallet, isConnecting, address } = useWallet();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (type: 'metamask' | 'walletconnect' | 'trust' | 'coinbase') => {
    setErrorMsg(null);
    try {
      await connectWallet(type);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to connect wallet');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        padding: '28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>Connect Web3 Wallet</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>Select your preferred wallet for ABCDeFi</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '12px',
            padding: '10px 14px',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* MetaMask */}
          <button
            disabled={isConnecting}
            onClick={() => handleConnect('metamask')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '24px' }}>🦊</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>MetaMask</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Connect browser extension</div>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '12px' }}>Popular</span>
          </button>

          {/* WalletConnect */}
          <button
            disabled={isConnecting}
            onClick={() => handleConnect('walletconnect')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '24px' }}>🌐</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>WalletConnect</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Scan QR with mobile wallet</div>
              </div>
            </div>
          </button>

          {/* Trust Wallet */}
          <button
            disabled={isConnecting}
            onClick={() => handleConnect('trust')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '24px' }}>🛡️</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Trust Wallet</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Mobile & Extension</div>
              </div>
            </div>
          </button>

          {/* Coinbase Wallet */}
          <button
            disabled={isConnecting}
            onClick={() => handleConnect('coinbase')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '24px' }}>🔵</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Coinbase Wallet</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Coinbase app or extension</div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
          Target Network: <strong style={{ color: '#fbbf24' }}>BNB Smart Chain Testnet (Chain ID 97)</strong>
        </div>
      </div>
    </div>
  );
};
