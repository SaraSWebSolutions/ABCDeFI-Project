import React, { useState } from 'react';

export interface AdminCommissionRecord {
  loanId: number;
  borrower: string;
  principalUSD: number;
  interestUSD: number;
  localityEarned: number;
  areaEarned: number;
  pincodeEarned: number;
  districtEarned: number;
  zoneEarned: number;
  stateEarned: number;
  nationalEarned: number;
  continentalEarned: number;
  aggregatorEarned: number;
  platformTreasuryEarned: number;
  timestamp: Date;
}

export const MOCK_COMMISSION_RECORDS: AdminCommissionRecord[] = [
  {
    loanId: 8801,
    borrower: '0x3C44...93BC',
    principalUSD: 50_000,
    interestUSD: 5_000,
    localityEarned: 4.50,    // 0.09% of 5000 = 4.50
    areaEarned: 4.00,        // 0.08%
    pincodeEarned: 3.50,     // 0.07%
    districtEarned: 3.00,    // 0.06%
    zoneEarned: 2.50,        // 0.05%
    stateEarned: 2.00,       // 0.04%
    nationalEarned: 1.50,    // 0.03%
    continentalEarned: 1.00, // 0.02%
    aggregatorEarned: 5.00,  // 0.10%
    platformTreasuryEarned: 23.00, // 0.46%
    timestamp: new Date('2026-08-01'),
  },
];

export const AdminFranchiseManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tiers' | 'commissions' | 'marketplace'>('tiers');
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const handleTriggerDistribution = () => {
    setTriggerMsg('🚀 Automated 10-way commission distribution executed across all 9 territory tiers & platform treasury!');
    setTimeout(() => setTriggerMsg(null), 5000);
  };

  return (
    <div style={{ padding: '24px', background: '#0b0f19', color: '#f8fafc', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, background: 'linear-gradient(90deg, #f472b6, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ⚙️ Admin Franchise Management & Commission Hub
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Whitepaper 9-tier governance, 10-way loan interest commission distribution, and ownership registry.
          </p>
        </div>
        <button
          onClick={handleTriggerDistribution}
          style={{ padding: '10px 18px', background: 'linear-gradient(90deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
        >
          ⚡ Trigger 10-Way Commission Payout
        </button>
      </div>

      {triggerMsg && (
        <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '10px', color: '#6ee7b7', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
          {triggerMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('tiers')}
          style={{ padding: '8px 16px', background: activeTab === 'tiers' ? '#8b5cf6' : 'rgba(255,255,255,0.04)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
        >
          🗺️ 9 Franchise Tiers Spec
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          style={{ padding: '8px 16px', background: activeTab === 'commissions' ? '#8b5cf6' : 'rgba(255,255,255,0.04)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
        >
          💰 10-Way Loan Commission Log
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tiers' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Franchise Tier</th>
                <th style={{ padding: '12px 16px' }}>Whitepaper Price</th>
                <th style={{ padding: '12px 16px' }}>Loan Commission Rate</th>
                <th style={{ padding: '12px 16px' }}>3-Year Lock</th>
                <th style={{ padding: '12px 16px' }}>100% Token Rebate</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Continental NFT', price: '$10,000,000', rate: '0.02%' },
                { name: 'National NFT', price: '$1,000,000', rate: '0.03%' },
                { name: 'State NFT', price: '$100,000', rate: '0.04%' },
                { name: 'Zone NFT', price: '$35,000', rate: '0.05%' },
                { name: 'District NFT', price: '$10,000', rate: '0.06%' },
                { name: 'Pincode NFT', price: '$5,000', rate: '0.07%' },
                { name: 'Area NFT', price: '$3,000', rate: '0.08%' },
                { name: 'Locality NFT', price: '$1,000', rate: '0.09%' },
                { name: 'Aggregator / Initiator', price: 'N/A', rate: '0.10%' },
                { name: 'ABCDeFi Platform', price: 'N/A', rate: '0.46%' },
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f8fafc' }}>{row.name}</td>
                  <td style={{ padding: '12px 16px', color: '#fbbf24', fontWeight: 700 }}>{row.price}</td>
                  <td style={{ padding: '12px 16px', color: '#38bdf8', fontWeight: 700 }}>{row.rate}</td>
                  <td style={{ padding: '12px 16px', color: '#34d399' }}>🔒 Enforced (1095 Days)</td>
                  <td style={{ padding: '12px 16px', color: '#a78bfa' }}>100% Equivalent ABCD</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'commissions' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#e2e8f0' }}>Live 10-Way Commission Payout Log</h4>
          {MOCK_COMMISSION_RECORDS.map((rec) => (
            <div key={rec.loanId} style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', marginBottom: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: '#a78bfa' }}>Loan #{rec.loanId} (Borrower: {rec.borrower})</strong>
                <span style={{ color: '#94a3b8' }}>Interest Generated: ${rec.interestUSD.toLocaleString()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '12px' }}>
                <div>Locality (0.09%): <strong style={{ color: '#34d399' }}>${rec.localityEarned}</strong></div>
                <div>Area (0.08%): <strong style={{ color: '#34d399' }}>${rec.areaEarned}</strong></div>
                <div>Pincode (0.07%): <strong style={{ color: '#34d399' }}>${rec.pincodeEarned}</strong></div>
                <div>District (0.06%): <strong style={{ color: '#34d399' }}>${rec.districtEarned}</strong></div>
                <div>Zone (0.05%): <strong style={{ color: '#34d399' }}>${rec.zoneEarned}</strong></div>
                <div>State (0.04%): <strong style={{ color: '#34d399' }}>${rec.stateEarned}</strong></div>
                <div>National (0.03%): <strong style={{ color: '#34d399' }}>${rec.nationalEarned}</strong></div>
                <div>Continental (0.02%): <strong style={{ color: '#34d399' }}>${rec.continentalEarned}</strong></div>
                <div>Aggregator (0.10%): <strong style={{ color: '#fbbf24' }}>${rec.aggregatorEarned}</strong></div>
                <div>Platform (0.46%): <strong style={{ color: '#f472b6' }}>${rec.platformTreasuryEarned}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
