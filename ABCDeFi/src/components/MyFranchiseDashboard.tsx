import React, { useState } from 'react';

// ─────────────────────────────────────────────
// TYPES & SPECS
// ─────────────────────────────────────────────

export interface FranchiseTierSpec {
  level: string;
  priceUSD: number;
  commissionRatePct: number;
  commissionBps: number;
  description: string;
  color: string;
}

export interface OwnedFranchiseNFT {
  tokenId: number;
  territoryName: string;
  territoryCode: string;
  level: string;
  parentTerritory: string;
  priceUSD: number;
  commissionRatePct: number;
  purchaseDate: Date;
  lockExpiryDate: Date;
  isLocked: boolean;
  totalCommissionEarnedUSD: number;
  abcdTokensRebated: number;
  status: 'Active' | 'Locked' | 'Eligible For Resale';
}

// Whitepaper 9-Tier Pricing & Commission Matrix
export const FRANCHISE_TIER_SPECS: FranchiseTierSpec[] = [
  { level: 'Locality NFT', priceUSD: 1_000, commissionRatePct: 0.09, commissionBps: 9, description: 'Micro-neighborhood territory franchise', color: '#60a5fa' },
  { level: 'Area NFT', priceUSD: 3_000, commissionRatePct: 0.08, commissionBps: 8, description: 'Urban sub-sector territory franchise', color: '#38bdf8' },
  { level: 'Pincode NFT', priceUSD: 5_000, commissionRatePct: 0.07, commissionBps: 7, description: 'Postal code zone territory franchise', color: '#34d399' },
  { level: 'District NFT', priceUSD: 10_000, commissionRatePct: 0.06, commissionBps: 6, description: 'Metropolitan district territory franchise', color: '#a78bfa' },
  { level: 'Zone NFT', priceUSD: 35_000, commissionRatePct: 0.05, commissionBps: 5, description: 'Multi-district economic zone franchise', color: '#c084fc' },
  { level: 'State NFT', priceUSD: 100_000, commissionRatePct: 0.04, commissionBps: 4, description: 'State / Provincial territory franchise', color: '#f472b6' },
  { level: 'National NFT', priceUSD: 1_000_000, commissionRatePct: 0.03, commissionBps: 3, description: 'Sovereign nation territory franchise', color: '#fbbf24' },
  { level: 'Continental NFT', priceUSD: 10_000_000, commissionRatePct: 0.02, commissionBps: 2, description: 'Continental apex territory franchise', color: '#f87171' },
];

export const MOCK_USER_FRANCHISES: OwnedFranchiseNFT[] = [
  {
    tokenId: 101,
    territoryName: 'Hyderabad District NFT',
    territoryCode: 'IN-TG-HYD',
    level: 'District NFT',
    parentTerritory: 'Telangana',
    priceUSD: 10_000,
    commissionRatePct: 0.06,
    purchaseDate: new Date('2024-06-15'),
    lockExpiryDate: new Date('2027-06-15'),
    isLocked: true,
    totalCommissionEarnedUSD: 1_450.50,
    abcdTokensRebated: 100_000,
    status: 'Locked',
  },
  {
    tokenId: 102,
    territoryName: 'Madhapur Area NFT',
    territoryCode: 'IN-TG-HYD-MDP',
    level: 'Area NFT',
    parentTerritory: 'Hyderabad',
    priceUSD: 3_000,
    commissionRatePct: 0.08,
    purchaseDate: new Date('2021-01-10'),
    lockExpiryDate: new Date('2024-01-10'),
    isLocked: false,
    totalCommissionEarnedUSD: 820.25,
    abcdTokensRebated: 30_000,
    status: 'Eligible For Resale',
  },
];

export const MyFranchiseDashboard: React.FC = () => {
  const [selectedTier, setSelectedTier] = useState<FranchiseTierSpec>(FRANCHISE_TIER_SPECS[3]); // District NFT default
  const [territoryInput, setTerritoryInput] = useState<string>('Warangal District');
  const [kycCompleted, setKycCompleted] = useState<boolean>(true);
  const [purchaseSuccessMessage, setPurchaseSuccessMessage] = useState<string | null>(null);
  const [resaleModalNFT, setResaleModalNFT] = useState<OwnedFranchiseNFT | null>(null);
  const [resalePriceInput, setResalePriceInput] = useState<number>(15000);

  const handlePurchaseFranchise = () => {
    if (!kycCompleted) {
      alert('Please complete KYC verification before purchasing a Franchise NFT.');
      return;
    }
    const tokenAmountRebated = (selectedTier.priceUSD * 10).toLocaleString();
    setPurchaseSuccessMessage(
      `🎉 Success! You purchased ${selectedTier.level} (${territoryInput}) for $${selectedTier.priceUSD.toLocaleString()}. ` +
      `You received ${tokenAmountRebated} ABCD Tokens (100% equivalent value) and a 3-Year Transfer Lock was activated!`
    );
    setTimeout(() => setPurchaseSuccessMessage(null), 8000);
  };

  return (
    <div style={{ padding: '24px', background: '#0b0f19', color: '#f8fafc', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🏢 My Franchise Portal & Territory Earnings
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            ABCDeFi Legion Franchise Model — Earn passive interest commissions from loan volume in your territory.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ padding: '6px 12px', background: kycCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${kycCompleted ? '#10b981' : '#ef4444'}`, borderRadius: '20px', fontSize: '12px', color: kycCompleted ? '#34d399' : '#f87171', fontWeight: 700 }}>
            {kycCompleted ? '✅ KYC Verified' : '⚠️ KYC Required'}
          </span>
          <span style={{ padding: '6px 12px', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid #fbbf24', borderRadius: '20px', fontSize: '12px', color: '#fbbf24', fontWeight: 700 }}>
            100% Token Rebate Active
          </span>
        </div>
      </div>

      {purchaseSuccessMessage && (
        <div style={{ padding: '14px 18px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '12px', color: '#6ee7b7', fontSize: '14px', fontWeight: 600, marginBottom: '20px' }}>
          {purchaseSuccessMessage}
        </div>
      )}

      {/* Owned Franchises Grid */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>
          My Owned Territory Franchises ({MOCK_USER_FRANCHISES.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {MOCK_USER_FRANCHISES.map((nft) => {
            const daysRemaining = Math.max(0, Math.ceil((nft.lockExpiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
            return (
              <div key={nft.tokenId} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, padding: '4px 10px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', borderRadius: '6px' }}>
                    {nft.level}
                  </span>
                  <span style={{ fontSize: '12px', padding: '4px 10px', background: nft.isLocked ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: nft.isLocked ? '#fbbf24' : '#34d399', borderRadius: '6px', fontWeight: 700 }}>
                    {nft.isLocked ? `🔒 Locked (${daysRemaining}d left)` : '🔓 Eligible For Resale'}
                  </span>
                </div>

                <h4 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800 }}>{nft.territoryName}</h4>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8' }}>Territory Code: {nft.territoryCode} | Parent: {nft.parentTerritory}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', fontSize: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ color: '#64748b' }}>Purchase Price</div>
                    <div style={{ fontWeight: 700, color: '#fbbf24' }}>${nft.priceUSD.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Commission Rate</div>
                    <div style={{ fontWeight: 700, color: '#38bdf8' }}>{nft.commissionRatePct}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Loan Commission Earned</div>
                    <div style={{ fontWeight: 700, color: '#34d399' }}>${nft.totalCommissionEarnedUSD.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>100% ABCD Token Rebate</div>
                    <div style={{ fontWeight: 700, color: '#a78bfa' }}>{nft.abcdTokensRebated.toLocaleString()} ABCD</div>
                  </div>
                </div>

                <button
                  disabled={nft.isLocked}
                  onClick={() => setResaleModalNFT(nft)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: nft.isLocked ? 'rgba(255,255,255,0.05)' : 'linear-gradient(90deg, #10b981, #059669)',
                    color: nft.isLocked ? '#64748b' : '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: nft.isLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  {nft.isLocked ? `🔒 Resale Locked Until ${nft.lockExpiryDate.toISOString().split('T')[0]}` : '🏷️ List for Resale on Marketplace'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Purchase Franchise Section */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800, color: '#e2e8f0' }}>
          🛒 Purchase New Franchise Territory (100% ABCD Token Rebate + 3-Year Lock)
        </h3>

        {/* 9-Tier Matrix Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {FRANCHISE_TIER_SPECS.map((spec) => {
            const isSelected = selectedTier.level === spec.level;
            return (
              <div
                key={spec.level}
                onClick={() => setSelectedTier(spec)}
                style={{
                  background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${isSelected ? spec.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '12px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: spec.color, textTransform: 'uppercase' }}>{spec.level}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0', color: '#f8fafc' }}>${spec.priceUSD.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 700 }}>Commission: {spec.commissionRatePct}%</div>
              </div>
            );
          })}
        </div>

        {/* Purchase Summary */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Target Territory Name:</label>
            <input
              type="text"
              value={territoryInput}
              onChange={(e) => setTerritoryInput(e.target.value)}
              style={{ width: '90%', padding: '10px 14px', background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Whitepaper Benefits Summary:</div>
            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
              • <strong>Ownership:</strong> Exclusive {selectedTier.level} Franchise NFT<br/>
              • <strong>100% Token Rebate:</strong> Receive ${(selectedTier.priceUSD).toLocaleString()} in ABCD Tokens<br/>
              • <strong>3-Year Lock:</strong> Locked until {new Date(new Date().setFullYear(new Date().getFullYear() + 3)).toISOString().split('T')[0]}<br/>
              • <strong>Territory Commission:</strong> Earn {selectedTier.commissionRatePct}% on every loan interest generated in {territoryInput}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button
            onClick={handlePurchaseFranchise}
            style={{ padding: '14px 28px', background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}
          >
            💳 Purchase {selectedTier.level} (${selectedTier.priceUSD.toLocaleString()})
          </button>
        </div>
      </div>

      {/* Resale Modal Calculator */}
      {resaleModalNFT && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #10b981', borderRadius: '20px', padding: '24px', maxWidth: '500px', width: '100%', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>🏷️ Resale Rule Calculator</h3>
              <button onClick={() => setResaleModalNFT(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px' }}>
              Per whitepaper rules: Platform automatically receives <strong>Initial Price + 30%</strong> ($
              {(resaleModalNFT.priceUSD * 1.3).toLocaleString()}), and remaining proceeds go to you!
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>Your Asking Resale Price (USD):</label>
              <input
                type="number"
                value={resalePriceInput}
                onChange={(e) => setResalePriceInput(Number(e.target.value))}
                style={{ width: '90%', padding: '10px 14px', background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '16px', fontWeight: 700 }}
              />
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Initial Purchase Price:</span>
                <strong style={{ color: '#fbbf24' }}>${resaleModalNFT.priceUSD.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Platform Fee (Initial + 30%):</span>
                <strong style={{ color: '#f87171' }}>${(resaleModalNFT.priceUSD * 1.3).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                <span>Your Net Seller Proceeds:</span>
                <strong style={{ color: '#34d399', fontSize: '15px' }}>${Math.max(0, resalePriceInput - (resaleModalNFT.priceUSD * 1.3)).toLocaleString()}</strong>
              </div>
            </div>

            <button
              onClick={() => {
                alert(`Franchise NFT listed at $${resalePriceInput.toLocaleString()} on Marketplace!`);
                setResaleModalNFT(null);
              }}
              style={{ width: '100%', padding: '12px', background: 'linear-gradient(90deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
            >
              🚀 Confirm Listing on Marketplace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
