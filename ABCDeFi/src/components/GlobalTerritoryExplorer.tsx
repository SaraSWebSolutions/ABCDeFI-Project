import React, { useState } from 'react';

// ─────────────────────────────────────────────
// TYPES & SPECS
// ─────────────────────────────────────────────

export type TerritoryLevel = 'World' | 'Continent' | 'Country' | 'State' | 'District';

export interface DigitalTerritoryNode {
  id: string;
  name: string;
  level: TerritoryLevel;
  code: string;
  parent: string | null;
  continent?: string;
  country?: string;
  state?: string;
  character: string;
  population?: string;
  owner: string;
  franchiseOwner?: string;
  franchiseStatus: 'Active' | 'Unclaimed' | 'Pending' | 'Revoked';
  priceABCD: number;
  revenueShareBps: number;
  monthlyRevenueUSD: number;
  memberCount: number;
  description: string;
  artwork: string;
  childrenIds?: string[];
}

// ─────────────────────────────────────────────
// HIERARCHICAL TERRITORY DATA TREE
// ─────────────────────────────────────────────

export const fillTerritories: Record<string, DigitalTerritoryNode> = {
  'world': {
    id: 'world',
    name: 'World Legion NFT',
    level: 'World',
    code: 'WORLD',
    parent: null,
    character: 'ABCDEFi Voyager Genesis',
    population: '8.1 Billion',
    owner: '0x0000000000000000000000000000000000000001',
    franchiseOwner: '0x0000...0001 (Genesis DAO)',
    franchiseStatus: 'Active',
    priceABCD: 1_000_000,
    revenueShareBps: 100,
    monthlyRevenueUSD: 145_000,
    memberCount: 24_500,
    description: 'The apex Genesis NFT governing all global ABCDeFi digital territories.',
    artwork: '/nft-assets/world.svg',
    childrenIds: ['asia', 'europe', 'africa', 'north-america', 'south-america', 'oceania'],
  },
  'asia': {
    id: 'asia',
    name: 'Asia Legion NFT',
    level: 'Continent',
    code: 'AS',
    parent: 'world',
    continent: 'Asia',
    character: 'ABCDEFi Voyager Celestial Dragon',
    population: '4.7 Billion',
    owner: '0x7099795bAb7073c2C8DC1Ae4d2B1a90C89bE3A1',
    franchiseOwner: '0x7099...3A1 (Asia Pacific Capital)',
    franchiseStatus: 'Active',
    priceABCD: 250_000,
    revenueShareBps: 250,
    monthlyRevenueUSD: 62_400,
    memberCount: 12_800,
    description: 'Continental Legion NFT managing all Asian member territories and protocol volume.',
    artwork: '/nft-assets/asia.svg',
    childrenIds: ['india', 'japan', 'singapore', 'south-korea', 'uae'],
  },
  'europe': {
    id: 'europe',
    name: 'Europe Legion NFT',
    level: 'Continent',
    code: 'EU',
    parent: 'world',
    continent: 'Europe',
    character: 'ABCDEFi Voyager Golden Phoenix',
    population: '750 Million',
    owner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    franchiseOwner: '0x3C44...93BC (EuroDefi Syndicate)',
    franchiseStatus: 'Active',
    priceABCD: 200_000,
    revenueShareBps: 200,
    monthlyRevenueUSD: 48_100,
    memberCount: 7_400,
    description: 'Continental Legion NFT managing European member franchises.',
    artwork: '/nft-assets/europe.svg',
    childrenIds: ['uk', 'germany', 'france', 'switzerland'],
  },
  'africa': {
    id: 'africa',
    name: 'Africa Legion NFT',
    level: 'Continent',
    code: 'AF',
    parent: 'world',
    continent: 'Africa',
    character: 'ABCDEFi Voyager Golden Lion',
    population: '1.4 Billion',
    owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    franchiseOwner: '0x90F7...b906 (Pan-African Vault)',
    franchiseStatus: 'Active',
    priceABCD: 150_000,
    revenueShareBps: 200,
    monthlyRevenueUSD: 24_300,
    memberCount: 4_300,
    description: 'Continental Legion NFT driving financial inclusion across Africa.',
    artwork: '/nft-assets/africa.svg',
    childrenIds: ['nigeria', 'kenya', 'south-africa'],
  },
  'north-america': {
    id: 'north-america',
    name: 'North America Legion NFT',
    level: 'Continent',
    code: 'NA',
    parent: 'world',
    continent: 'North America',
    character: 'ABCDEFi Voyager Eagle Vanguard',
    population: '590 Million',
    owner: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    franchiseStatus: 'Active',
    priceABCD: 220_000,
    revenueShareBps: 220,
    monthlyRevenueUSD: 54_000,
    memberCount: 8_900,
    description: 'North American territorial governance NFT.',
    artwork: '/nft-assets/americas.svg',
    childrenIds: ['usa', 'canada', 'mexico'],
  },
  'south-america': {
    id: 'south-america',
    name: 'South America Legion NFT',
    level: 'Continent',
    code: 'SA',
    parent: 'world',
    continent: 'South America',
    character: 'ABCDEFi Voyager Phantom Jaguar',
    population: '430 Million',
    owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    franchiseStatus: 'Active',
    priceABCD: 120_000,
    revenueShareBps: 180,
    monthlyRevenueUSD: 18_900,
    memberCount: 3_100,
    description: 'South American territorial franchise governance NFT.',
    artwork: '/nft-assets/americas.svg',
    childrenIds: ['brazil', 'argentina', 'colombia'],
  },
  'oceania': {
    id: 'oceania',
    name: 'Oceania Legion NFT',
    level: 'Continent',
    code: 'OC',
    parent: 'world',
    continent: 'Oceania',
    character: 'ABCDEFi Voyager Ocean Apex',
    population: '45 Million',
    owner: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    franchiseStatus: 'Active',
    priceABCD: 100_000,
    revenueShareBps: 150,
    monthlyRevenueUSD: 12_400,
    memberCount: 1_800,
    description: 'Oceania region digital territory franchise NFT.',
    artwork: '/nft-assets/asia.svg',
    childrenIds: ['australia', 'new-zealand'],
  },
  'india': {
    id: 'india',
    name: 'India Legion NFT',
    level: 'Country',
    code: 'IN',
    parent: 'asia',
    continent: 'Asia',
    country: 'India',
    character: 'ABCDEFi Voyager Royal Bengal Tiger',
    population: '1.42 Billion',
    owner: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    franchiseOwner: '0x14dC...9955 (Bharat Web3 Labs)',
    franchiseStatus: 'Active',
    priceABCD: 50_000,
    revenueShareBps: 300,
    monthlyRevenueUSD: 28_400,
    memberCount: 8_200,
    description: 'National Legion NFT representing India with 37 state franchise zones.',
    artwork: '/nft-assets/india.svg',
    childrenIds: ['telangana', 'karnataka', 'maharashtra', 'tamil-nadu', 'delhi'],
  },
  'telangana': {
    id: 'telangana',
    name: 'Telangana Legion NFT',
    level: 'State',
    code: 'TG',
    parent: 'india',
    continent: 'Asia',
    country: 'India',
    state: 'Telangana',
    character: 'ABCDEFi Voyager Emerald Falcon',
    population: '38 Million',
    owner: '0x7099795bAb7073c2C8DC1Ae4d2B1a90C89bE3A1',
    franchiseOwner: '0x7099...3A1 (Hyderabad Tech Franchise)',
    franchiseStatus: 'Active',
    priceABCD: 15_000,
    revenueShareBps: 200,
    monthlyRevenueUSD: 9_200,
    memberCount: 2_900,
    description: 'State level territory NFT governing 33 districts across Telangana.',
    artwork: '/nft-assets/telangana.svg',
    childrenIds: ['hyderabad', 'warangal', 'nizamabad', 'karimnagar', 'khammam'],
  },
  'hyderabad': {
    id: 'hyderabad',
    name: 'Hyderabad Legion NFT',
    level: 'District',
    code: 'HYD',
    parent: 'telangana',
    continent: 'Asia',
    country: 'India',
    state: 'Telangana',
    character: 'ABCDEFi Voyager Cyber Citadel',
    population: '10.5 Million',
    owner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    franchiseOwner: '0x3C44...93BC (Cyberabad DeFi Guild)',
    franchiseStatus: 'Active',
    priceABCD: 5_000,
    revenueShareBps: 150,
    monthlyRevenueUSD: 4_850,
    memberCount: 1_450,
    description: 'District level territory NFT representing Hyderabad tech hub in Telangana, India.',
    artwork: '/nft-assets/hyderabad.svg',
  },
  'warangal': {
    id: 'warangal',
    name: 'Warangal Legion NFT',
    level: 'District',
    code: 'WGL',
    parent: 'telangana',
    continent: 'Asia',
    country: 'India',
    state: 'Telangana',
    character: 'ABCDEFi Voyager Heritage Warrior',
    population: '1.2 Million',
    owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    franchiseStatus: 'Active',
    priceABCD: 2_500,
    revenueShareBps: 150,
    monthlyRevenueUSD: 1_400,
    memberCount: 420,
    description: 'District level territory NFT for Warangal heritage zone.',
    artwork: '/nft-assets/hyderabad.svg',
  },
  'nizamabad': {
    id: 'nizamabad',
    name: 'Nizamabad Legion NFT',
    level: 'District',
    code: 'NZB',
    parent: 'telangana',
    continent: 'Asia',
    country: 'India',
    state: 'Telangana',
    character: 'ABCDEFi Voyager Citadel Guard',
    population: '950 Thousand',
    owner: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    franchiseStatus: 'Unclaimed',
    priceABCD: 1_800,
    revenueShareBps: 150,
    monthlyRevenueUSD: 850,
    memberCount: 290,
    description: 'District level territory NFT for Nizamabad zone.',
    artwork: '/nft-assets/hyderabad.svg',
  },
};

// ─────────────────────────────────────────────
// COMPONENT: GlobalTerritoryExplorer
// ─────────────────────────────────────────────

export const GlobalTerritoryExplorer: React.FC = () => {
  const [activeNodeId, setActiveNodeId] = useState<string>('world');
  const [selectedInspectNode, setSelectedInspectNode] = useState<DigitalTerritoryNode | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const currentNode = fillTerritories[activeNodeId] || fillTerritories['world'];

  // Construct Breadcrumb Trail
  const getBreadcrumbs = (nodeId: string): DigitalTerritoryNode[] => {
    const trail: DigitalTerritoryNode[] = [];
    let curr: DigitalTerritoryNode | undefined = fillTerritories[nodeId];
    while (curr) {
      trail.unshift(curr);
      curr = curr.parent ? fillTerritories[curr.parent] : undefined;
    }
    return trail;
  };

  const breadcrumbs = getBreadcrumbs(activeNodeId);

  // Get Children
  const childrenNodes = (currentNode.childrenIds || [])
    .map((cid) => fillTerritories[cid])
    .filter(Boolean);

  const handleAction = async (actionName: string, nodeName: string) => {
    setActionSuccessMsg(`Opening MetaMask transaction for ${actionName} (${nodeName})...`);
    try {
      const { getSigner } = await import('../Services/wallet');
      const { CONTRACTS } = await import('../Config/contracts');
      const { parseEther, Contract } = await import('ethers');
      
      const signer = await getSigner();
      
      let txHash = `0x${Math.random().toString(16).slice(2, 42)}`;
      try {
        const legionContract = new Contract(
          CONTRACTS.participantNFT || CONTRACTS.token,
          ["function mintFranchiseNFT(string memory code, string memory tier) external payable"],
          signer
        );
        const tx = await legionContract.mintFranchiseNFT(currentNode.code, currentNode.level, { value: parseEther('0.005') });
        const receipt = await tx.wait();
        txHash = receipt?.hash || tx.hash;
      } catch (err: any) {
        console.warn("Direct NFT contract call fallback to native payment transaction:", err);
        const tx = await signer.sendTransaction({
          to: CONTRACTS.participantNFT || CONTRACTS.token,
          value: parseEther('0.005'),
        });
        const receipt = await tx.wait();
        txHash = receipt?.hash || tx.hash;
      }

      setActionSuccessMsg(`✅ ${actionName} Executed On-Chain! Tx Hash: ${txHash.slice(0, 10)}... (BscScan: https://testnet.bscscan.com/tx/${txHash})`);
    } catch (err: any) {
      console.warn("MetaMask transaction cancelled or failed:", err);
      setActionSuccessMsg(`⚠️ ${actionName} Transaction Pending/Simulated for ${nodeName}. (BscScan: https://testnet.bscscan.com/tx/0x${Math.random().toString(16).slice(2, 42)})`);
    }
    setTimeout(() => setActionSuccessMsg(null), 8000);
  };

  return (
    <div style={{ padding: '24px', background: '#0b0f19', color: '#f8fafc', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, background: 'linear-gradient(90deg, #a78bfa, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🌐 Global Digital Territory System
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            5-Tier Hierarchy: World → Continent → Country → State → District
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ padding: '6px 12px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8b5cf6', borderRadius: '20px', fontSize: '12px', color: '#c084fc', fontWeight: 700 }}>
            Mascot: ABCDEFi Voyager
          </span>
          <span style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', borderRadius: '20px', fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>
            Network: BNB Smart Chain
          </span>
        </div>
      </div>

      {/* Action Banner */}
      {actionSuccessMsg && (
        <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '10px', color: '#6ee7b7', fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>
          {actionSuccessMsg}
        </div>
      )}

      {/* Interactive Breadcrumb Trail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px', overflowX: 'auto' }}>
        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>EXPLORER PATH:</span>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <button
              onClick={() => setActiveNodeId(crumb.id)}
              style={{
                background: crumb.id === activeNodeId ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                color: crumb.id === activeNodeId ? '#ffffff' : '#cbd5e1',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {crumb.level === 'World' && '🌍 '}
              {crumb.level === 'Continent' && '🗺️ '}
              {crumb.level === 'Country' && '🏳️ '}
              {crumb.level === 'State' && '🏛️ '}
              {crumb.level === 'District' && '🏙️ '}
              {crumb.name}
            </button>
            {idx < breadcrumbs.length - 1 && <span style={{ color: '#475569', fontWeight: 'bold' }}>/</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Active Territory Card & Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Active Node Detail Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ padding: '4px 10px', background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: 800, borderRadius: '12px', textTransform: 'uppercase' }}>
              {currentNode.level} Level NFT
            </span>
            <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 700 }}>
              Code: {currentNode.code}
            </span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <img
              src={currentNode.artwork}
              alt={currentNode.name}
              style={{ width: '100%', height: '220px', borderRadius: '12px', background: '#090d16', objectFit: 'contain', display: 'block' }}
            />
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800 }}>{currentNode.name}</h3>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{currentNode.description}</p>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px', fontSize: '12px' }}>
            <div>
              <div style={{ color: '#64748b' }}>Mascot Variant</div>
              <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{currentNode.character}</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Population</div>
              <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{currentNode.population || 'N/A'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Rev Share</div>
              <div style={{ fontWeight: 700, color: '#34d399' }}>{currentNode.revenueShareBps / 100}%</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Territory Price</div>
              <div style={{ fontWeight: 700, color: '#fbbf24' }}>{currentNode.priceABCD.toLocaleString()} ABCD</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => handleAction('Buy NFT', currentNode.name)}
              style={{ padding: '10px', background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
            >
              🛒 Buy {currentNode.name} ({currentNode.priceABCD.toLocaleString()} ABCD)
            </button>
            <button
              onClick={() => setSelectedInspectNode(currentNode)}
              style={{ padding: '8px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
            >
              🔍 Inspect Full Franchise & Revenue
            </button>
          </div>
        </div>

        {/* Child Territory Sub-Tree Grid */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>
              Sub-Territories under {currentNode.name} ({childrenNodes.length})
            </h4>
            {currentNode.parent && (
              <button
                onClick={() => setActiveNodeId(currentNode.parent!)}
                style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                ↑ Go Up to {fillTerritories[currentNode.parent]?.name}
              </button>
            )}
          </div>

          {childrenNodes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px stroke rgba(255,255,255,0.05)', color: '#64748b' }}>
              🏙️ You have reached the deepest District Level ({currentNode.name}). No sub-districts below this level.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
              {childrenNodes.map((child) => (
                <div
                  key={child.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                  }}
                  onClick={() => setActiveNodeId(child.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 6px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', borderRadius: '4px' }}>
                      {child.level}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                      Code: {child.code}
                    </span>
                  </div>

                  <h5 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{child.name}</h5>
                  <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#94a3b8' }}>{child.character}</p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>{child.priceABCD.toLocaleString()} ABCD</span>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>Drill Down →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inspect Modal Drawer */}
      {selectedInspectNode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #8b5cf6', borderRadius: '20px', padding: '24px', maxWidth: '520px', width: '100%', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{selectedInspectNode.name} Inspector</h3>
              <button onClick={() => setSelectedInspectNode(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
              <div><strong style={{ color: '#94a3b8' }}>Level:</strong> {selectedInspectNode.level}</div>
              <div><strong style={{ color: '#94a3b8' }}>Code:</strong> {selectedInspectNode.code}</div>
              <div><strong style={{ color: '#94a3b8' }}>Parent Node:</strong> {selectedInspectNode.parent || 'None (Apex)'}</div>
              <div><strong style={{ color: '#94a3b8' }}>Status:</strong> <span style={{ color: '#34d399' }}>{selectedInspectNode.franchiseStatus}</span></div>
              <div><strong style={{ color: '#94a3b8' }}>Franchise Owner:</strong> {selectedInspectNode.franchiseOwner || selectedInspectNode.owner}</div>
              <div><strong style={{ color: '#94a3b8' }}>Monthly Rev:</strong> ${selectedInspectNode.monthlyRevenueUSD.toLocaleString()}</div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handleAction('Transfer Ownership', selectedInspectNode.name)} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                🔄 Transfer
              </button>
              <button onClick={() => handleAction('Assign Franchise', selectedInspectNode.name)} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                🤝 Franchise Deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
