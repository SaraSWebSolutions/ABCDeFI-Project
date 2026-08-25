import React, { useState } from 'react';

// ─────────────────────────────────────────────
// TYPES & MOCK DATA
// ─────────────────────────────────────────────

export interface AIGameModule {
  id: string;
  title: string;
  category: 'Game' | 'Course' | 'Quiz';
  description: string;
  wixEmbedUrl: string;
  rewardABCD: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  completionRatePct: number;
  icon: string;
}

export interface UserCertificate {
  certificateId: string;
  courseName: string;
  issuedAt: Date;
  grade: string;
  ipfsCertificateURI: string;
}

export const MOCK_AI_GAMES: AIGameModule[] = [
  {
    id: 'game-2',
    title: 'P2P Micro-Lending Challenge',
    category: 'Game',
    description: 'Simulate borrower credit scoring, collateral valuation, and loan interest calculation.',
    wixEmbedUrl: 'https://www.wix.com',
    rewardABCD: 1_000,
    difficulty: 'Intermediate',
    completionRatePct: 60,
    icon: '🤝',
  },
  {
    id: 'course-1',
    title: 'Legion Franchise Economics 101',
    category: 'Course',
    description: 'Learn how 4-tier territory population pricing and 4-tier commission routing work.',
    wixEmbedUrl: 'https://www.wix.com',
    rewardABCD: 750,
    difficulty: 'Beginner',
    completionRatePct: 100,
    icon: '📚',
  },
  {
    id: 'quiz-1',
    title: 'Global Territory & Tokenomics Quiz',
    category: 'Quiz',
    description: 'Test your knowledge on BEP-20 tokens, 3-year transfer locks, and reserve wallet logic.',
    wixEmbedUrl: 'https://www.wix.com',
    rewardABCD: 300,
    difficulty: 'Advanced',
    completionRatePct: 40,
    icon: '🧠',
  },
];

export const MOCK_CERTIFICATES: UserCertificate[] = [
  {
    certificateId: 'CERT-59C-8821',
    courseName: '59C Certified DeFi Practitioner',
    issuedAt: new Date('2026-07-20'),
    grade: 'A+',
    ipfsCertificateURI: 'ipfs://QmCert59cDeFiPractitionerCID/certificate.pdf',
  },
];

export const AIGamesDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'games' | 'leaderboard' | 'certificates'>('games');
  const [selectedGame, setSelectedGame] = useState<AIGameModule | null>(null);
  const [claimedRewardMsg, setClaimedRewardMsg] = useState<string | null>(null);

  const handleClaimReward = (reward: number, title: string) => {
    setClaimedRewardMsg(`🎉 Success! You claimed ${reward} ABCD tokens for completing "${title}"!`);
    setTimeout(() => setClaimedRewardMsg(null), 5000);
  };

  return (
    <div style={{ padding: '24px', background: '#0b0f19', color: '#f8fafc', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🤖 59C AI Financial Learning & Games Hub
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Interactive Wix AI Financial Games, Quizzes, Certificates, and Token Rewards.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ padding: '6px 14px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', borderRadius: '20px', fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>
            Single Sign-On (SSO) Active
          </span>
          <span style={{ padding: '6px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '20px', fontSize: '12px', color: '#34d399', fontWeight: 700 }}>
            Total Earned: 2,550 ABCD
          </span>
        </div>
      </div>

      {claimedRewardMsg && (
        <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '10px', color: '#6ee7b7', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
          {claimedRewardMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('games')}
          style={{ padding: '8px 16px', background: activeTab === 'games' ? '#8b5cf6' : 'rgba(255,255,255,0.04)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
        >
          🎮 AI Games & Courses ({MOCK_AI_GAMES.length})
        </button>
        <button
          onClick={() => setActiveTab('certificates')}
          style={{ padding: '8px 16px', background: activeTab === 'certificates' ? '#8b5cf6' : 'rgba(255,255,255,0.04)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
        >
          🎓 Certificates Earned ({MOCK_CERTIFICATES.length})
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          style={{ padding: '8px 16px', background: activeTab === 'leaderboard' ? '#8b5cf6' : 'rgba(255,255,255,0.04)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
        >
          🏆 Global Leaderboard
        </button>
      </div>

      {/* Content */}
      {activeTab === 'games' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
          {MOCK_AI_GAMES.map((game) => (
            <div key={game.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{game.icon}</span>
                  <span style={{ padding: '4px 10px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                    {game.category} • {game.difficulty}
                  </span>
                </div>

                <h4 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800 }}>{game.title}</h4>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{game.description}</p>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '16px' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>+ {game.rewardABCD} ABCD Reward</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{game.completionRatePct}% Completed</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setSelectedGame(game)}
                  style={{ flex: 1, padding: '10px', background: 'linear-gradient(90deg, #38bdf8, #3b82f6)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ▶️ Play Game (Wix AI)
                </button>
                <button
                  onClick={() => handleClaimReward(game.rewardABCD, game.title)}
                  style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🎁 Claim
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'certificates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {MOCK_CERTIFICATES.map((cert) => (
            <div key={cert.certificateId} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎓</div>
              <h4 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>{cert.courseName}</h4>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>ID: {cert.certificateId} | Grade: <strong style={{ color: '#34d399' }}>{cert.grade}</strong></div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Issued: {cert.issuedAt.toLocaleDateString()}</div>

              <button
                onClick={() => alert(`Opening certificate ${cert.certificateId} on IPFS: ${cert.ipfsCertificateURI}`)}
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                📜 View Certificate on IPFS
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Wix AI Game Modal Viewer */}
      {selectedGame && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '20px', padding: '24px', maxWidth: '800px', width: '100%', height: '80vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{selectedGame.icon} {selectedGame.title} (Wix AI Embed)</h3>
              <button onClick={() => setSelectedGame(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ flex: 1, background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
              <iframe
                src={selectedGame.wixEmbedUrl}
                title={selectedGame.title}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
