import React, { useState, useMemo } from 'react';
import {
  MOCK_LOAN_NFT_TRIPLES,
  LoanNFTTriple,
  LoanNFTToken,
  LoanStatus,
  LoanNFTType,
  getLoanNFTsByOwner,
  formatAddress,
  LOAN_STATUS_COLORS,
  NFT_TYPE_COLORS,
  NFT_TYPE_ICONS,
  NFT_ECOSYSTEM_STATS,
} from '../Services/nftServices';

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const s = {
  container: { padding: '24px', background: 'transparent' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '18px',
    textAlign: 'center' as const,
  },
  statValue: { fontSize: '26px', fontWeight: 800, color: '#60a5fa', marginBottom: '4px' },
  statLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.7px' },
  explainerBox: {
    background: 'rgba(96,165,250,0.06)',
    border: '1px solid rgba(96,165,250,0.2)',
    borderRadius: '14px',
    padding: '18px 22px',
    marginBottom: '24px',
  },
  explainerTitle: { fontSize: '14px', fontWeight: 700, color: '#60a5fa', marginBottom: '8px' },
  tripleRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    marginBottom: '8px',
  },
  nftTypePill: (type: LoanNFTType): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: `${NFT_TYPE_COLORS[type]}22`,
    border: `1px solid ${NFT_TYPE_COLORS[type]}44`,
    color: NFT_TYPE_COLORS[type],
    fontSize: '12px',
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: '20px',
  }),
  filtersRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  filterBtn: (active: boolean, color?: string): React.CSSProperties => ({
    padding: '7px 16px',
    borderRadius: '20px',
    border: `1px solid ${active ? (color || '#60a5fa') : 'rgba(255,255,255,0.12)'}`,
    background: active ? `${color || '#60a5fa'}22` : 'transparent',
    color: active ? (color || '#60a5fa') : 'rgba(255,255,255,0.55)',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),
  // Loan Triple Card
  tripleCard: (status: LoanStatus): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${LOAN_STATUS_COLORS[status]}33`,
    borderRadius: '18px',
    marginBottom: '16px',
    overflow: 'hidden',
  }),
  tripleCardHeader: (status: LoanStatus): React.CSSProperties => ({
    background: `${LOAN_STATUS_COLORS[status]}12`,
    borderBottom: `1px solid ${LOAN_STATUS_COLORS[status]}22`,
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  }),
  loanId: { fontSize: '16px', fontWeight: 800, color: '#f1f5f9' },
  statusBadge: (status: LoanStatus): React.CSSProperties => ({
    background: `${LOAN_STATUS_COLORS[status]}22`,
    border: `1px solid ${LOAN_STATUS_COLORS[status]}44`,
    color: LOAN_STATUS_COLORS[status],
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: '20px',
  }),
  tripleCardBody: { padding: '18px 20px' },
  loanMeta: { display: 'flex', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' as const },
  loanMetaItem: { flex: '0 0 auto' },
  loanMetaLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '3px' },
  loanMetaValue: { fontSize: '15px', fontWeight: 700, color: '#f1f5f9' },
  nftCardsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  nftMiniCard: (type: LoanNFTType): React.CSSProperties => ({
    background: `${NFT_TYPE_COLORS[type]}10`,
    border: `1px solid ${NFT_TYPE_COLORS[type]}33`,
    borderRadius: '12px',
    padding: '14px',
  }),
  nftMiniHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  nftMiniType: (type: LoanNFTType): React.CSSProperties => ({
    fontSize: '11px',
    fontWeight: 700,
    color: NFT_TYPE_COLORS[type],
  }),
  nftMiniId: { fontSize: '10px', color: 'rgba(255,255,255,0.4)' },
  nftMiniOwner: { fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' },
  nftMiniAddress: { fontSize: '11px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' },
  // Single token view
  tokenCard: (type: LoanNFTType): React.CSSProperties => ({
    background: `${NFT_TYPE_COLORS[type]}08`,
    border: `1px solid ${NFT_TYPE_COLORS[type]}33`,
    borderRadius: '14px',
    padding: '18px',
    marginBottom: '14px',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  }),
  tokenIcon: (type: LoanNFTType): React.CSSProperties => ({
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: `${NFT_TYPE_COLORS[type]}22`,
    border: `2px solid ${NFT_TYPE_COLORS[type]}44`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0,
  }),
  tokenBody: { flex: 1 },
  tokenName: { fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' },
  tokenSub: { fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' },
  tokenAmounts: { display: 'flex', gap: '16px' },
  tokenAmount: { fontSize: '13px', fontWeight: 700, color: '#f59e0b' },
};

// ─────────────────────────────────────────────
// STATUS ICONS
// ─────────────────────────────────────────────

const STATUS_ICONS: Record<LoanStatus, string> = {
  Active: '🟢',
  Repaid: '✅',
  Defaulted: '🔴',
  Liquidated: '⚡',
};

// ─────────────────────────────────────────────
// LOAN TRIPLE CARD
// ─────────────────────────────────────────────

const LoanTripleCard: React.FC<{ triple: LoanNFTTriple }> = ({ triple }) => {
  const [expanded, setExpanded] = useState(false);
  const color = LOAN_STATUS_COLORS[triple.status];

  return (
    <div style={s.tripleCard(triple.status)}>
      <div style={s.tripleCardHeader(triple.status)} onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={s.loanId}>Loan #{triple.loanId}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
            3 NFTs Minted · {triple.mintedAt.toLocaleDateString()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={s.statusBadge(triple.status)}>
            {STATUS_ICONS[triple.status]} {triple.status}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      <div style={s.tripleCardBody}>
        <div style={s.loanMeta}>
          <div style={s.loanMetaItem}>
            <div style={s.loanMetaLabel}>Principal</div>
            <div style={{ ...s.loanMetaValue, color: '#f59e0b' }}>${triple.principal.toLocaleString()}</div>
          </div>
          <div style={s.loanMetaItem}>
            <div style={s.loanMetaLabel}>Interest</div>
            <div style={{ ...s.loanMetaValue, color: '#34d399' }}>${triple.interest.toLocaleString()}</div>
          </div>
          <div style={s.loanMetaItem}>
            <div style={s.loanMetaLabel}>Total Repayment</div>
            <div style={{ ...s.loanMetaValue, color: '#60a5fa' }}>${(triple.principal + triple.interest).toLocaleString()}</div>
          </div>
          <div style={s.loanMetaItem}>
            <div style={s.loanMetaLabel}>Due Date</div>
            <div style={s.loanMetaValue}>{triple.dueDate.toLocaleDateString()}</div>
          </div>
          <div style={s.loanMetaItem}>
            <div style={s.loanMetaLabel}>Borrower</div>
            <div style={{ ...s.loanMetaValue, fontSize: '12px', fontFamily: 'monospace' }}>
              {formatAddress(triple.borrower)}
            </div>
          </div>
          <div style={s.loanMetaItem}>
            <div style={s.loanMetaLabel}>Lender</div>
            <div style={{ ...s.loanMetaValue, fontSize: '12px', fontFamily: 'monospace' }}>
              {formatAddress(triple.lender)}
            </div>
          </div>
        </div>

        {/* NFT Type Summary Chips */}
        <div style={s.tripleRow}>
          {(['BorrowerNFT', 'LenderNFT', 'PlatformNFT'] as LoanNFTType[]).map(type => {
            const tokenMap: Record<LoanNFTType, LoanNFTToken> = {
              BorrowerNFT: triple.borrowerNFT,
              LenderNFT: triple.lenderNFT,
              PlatformNFT: triple.platformNFT,
            };
            const token = tokenMap[type];
            return (
              <span key={type} style={s.nftTypePill(type)}>
                {NFT_TYPE_ICONS[type]} #{token.tokenId} {type}
              </span>
            );
          })}
        </div>

        {/* Expanded 3-way NFT details */}
        {expanded && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '12px' }}>
              NFT Certificate Details
            </div>
            <div style={s.nftCardsRow}>
              {([
                { type: 'BorrowerNFT', token: triple.borrowerNFT },
                { type: 'LenderNFT', token: triple.lenderNFT },
                { type: 'PlatformNFT', token: triple.platformNFT },
              ] as { type: LoanNFTType; token: LoanNFTToken }[]).map(({ type, token }) => (
                <div key={type} style={s.nftMiniCard(type)}>
                  <div style={s.nftMiniHeader}>
                    <span style={s.nftMiniType(type)}>{NFT_TYPE_ICONS[type]} {type.replace('NFT', ' NFT')}</span>
                    <span style={s.nftMiniId}>#{token.tokenId}</span>
                  </div>
                  <div style={s.nftMiniOwner}>Owner</div>
                  <div style={s.nftMiniAddress}>{formatAddress(token.owner)}</div>
                  <div style={{ marginTop: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {token.metadataURI.slice(0, 30)}…
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MY LOAN NFT TOKENS (for wallet owner)
// ─────────────────────────────────────────────

const MyLoanTokenCard: React.FC<{ token: LoanNFTToken }> = ({ token }) => (
  <div style={s.tokenCard(token.nftType)}>
    <div style={s.tokenIcon(token.nftType)}>{NFT_TYPE_ICONS[token.nftType]}</div>
    <div style={s.tokenBody}>
      <div style={s.tokenName}>
        {token.nftType.replace('NFT', ' Certificate')} — Loan #{token.loanId}
      </div>
      <div style={s.tokenSub}>
        Token #{token.tokenId} · Issued {token.issueTime.toLocaleDateString()}
      </div>
      <div style={s.tokenAmounts}>
        <span style={s.tokenAmount}>Principal: ${token.principal.toLocaleString()}</span>
        <span style={{ ...s.tokenAmount, color: '#34d399' }}>Interest: ${token.interest.toLocaleString()}</span>
      </div>
    </div>
    <span style={s.statusBadge(token.status)}>
      {STATUS_ICONS[token.status]} {token.status}
    </span>
  </div>
);

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

const LoanNFTDashboard: React.FC<{
  connectedWallet?: string;
  isAdmin?: boolean;
}> = ({ connectedWallet, isAdmin }) => {
  const [view, setView] = useState<'all' | 'my'>('all');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'All'>('All');

  const filteredTriples = useMemo(() => {
    let list = MOCK_LOAN_NFT_TRIPLES;
    if (statusFilter !== 'All') list = list.filter(t => t.status === statusFilter);
    return list;
  }, [statusFilter]);

  const myTokens = useMemo(() => {
    if (!connectedWallet) return [];
    return getLoanNFTsByOwner(connectedWallet);
  }, [connectedWallet]);

  const totalVolume = MOCK_LOAN_NFT_TRIPLES.reduce((a, t) => a + t.principal, 0);
  const activeCount = MOCK_LOAN_NFT_TRIPLES.filter(t => t.status === 'Active').length;
  const repaidCount = MOCK_LOAN_NFT_TRIPLES.filter(t => t.status === 'Repaid').length;

  return (
    <div style={s.container}>
      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statValue}>{NFT_ECOSYSTEM_STATS.totalLoanNFTs}</div>
          <div style={s.statLabel}>Total Loan NFTs</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statValue, color: '#51cf66' }}>{activeCount}</div>
          <div style={s.statLabel}>Active Loans</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statValue, color: '#339af0' }}>{repaidCount}</div>
          <div style={s.statLabel}>Repaid Loans</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statValue, color: '#f59e0b' }}>${(totalVolume / 1000).toFixed(0)}K</div>
          <div style={s.statLabel}>Total Loan Volume</div>
        </div>
      </div>

      {/* Explainer */}
      <div style={s.explainerBox}>
        <div style={s.explainerTitle}>⚡ Auto-Minted 3-Way Loan NFT System</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          When a P2P loan is completed on ABCDeFi, 3 NFTs are automatically minted — one for the Borrower (repayment certificate), one for the Lender (investment certificate), and one for the Platform (record-keeping). These are permanent, immutable on-chain records.
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          {(['BorrowerNFT', 'LenderNFT', 'PlatformNFT'] as LoanNFTType[]).map(type => (
            <span key={type} style={s.nftTypePill(type)}>
              {NFT_TYPE_ICONS[type]} {type.replace('NFT', '')}
            </span>
          ))}
        </div>
      </div>

      {/* View Toggle */}
      <div style={s.filtersRow}>
        <button style={s.filterBtn(view === 'all', '#60a5fa')} onClick={() => setView('all')}>
          🌐 All Loan NFTs
        </button>
        {connectedWallet && (
          <button style={s.filterBtn(view === 'my', '#a78bfa')} onClick={() => setView('my')}>
            👤 My NFTs ({myTokens.length})
          </button>
        )}
        {view === 'all' && (
          <>
            <div style={{ flex: 1 }} />
            {(['All', 'Active', 'Repaid', 'Defaulted', 'Liquidated'] as (LoanStatus | 'All')[]).map(s2 => (
              <button
                key={s2}
                style={s.filterBtn(
                  statusFilter === s2,
                  s2 !== 'All' ? LOAN_STATUS_COLORS[s2 as LoanStatus] : '#60a5fa'
                )}
                onClick={() => setStatusFilter(s2)}
              >
                {s2 === 'All' ? 'All Status' : `${STATUS_ICONS[s2 as LoanStatus]} ${s2}`}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Content */}
      {view === 'my' && connectedWallet ? (
        myTokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>No Loan NFTs in your wallet</div>
            <div style={{ fontSize: '12px', marginTop: '8px', color: 'rgba(255,255,255,0.3)' }}>
              Loan NFTs are minted automatically when a loan is completed
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
              {myTokens.length} Loan NFT{myTokens.length !== 1 ? 's' : ''} in your wallet
            </div>
            {myTokens.map(token => <MyLoanTokenCard key={token.tokenId} token={token} />)}
          </div>
        )
      ) : (
        filteredTriples.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>No Loan NFTs match your filter</div>
          </div>
        ) : (
          <div>
            {filteredTriples.map(triple => <LoanTripleCard key={triple.loanId} triple={triple} />)}
          </div>
        )
      )}
    </div>
  );
};

export default LoanNFTDashboard;
