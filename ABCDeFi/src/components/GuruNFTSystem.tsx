import React, { useState } from 'react';
import {
  Sparkles,
  Star,
  Users,
  BookOpen,
  Coins,
  Loader2,
  Crown,
  Zap,
  Shield,
  CheckCircle2,
  ChevronRight,
  Trophy,
  Flame,
} from 'lucide-react';
import {
  GuruNFT,
  GuruRank,
  GURU_RANKS,
  SAMPLE_GURU_NFTS,
  mintGuruNFT,
  getGuruRank,
} from '../Services/guruNFT';

const rankIcon: Record<GuruNFT['rank'], string> = {
  'Apprentice Guru': '🌱',
  'Rising Guru': '⚡',
  'Master Guru': '🔥',
  'Grand Guru': '👑',
  'Legend Guru': '💎',
};

const rankColor: Record<GuruNFT['rank'], string> = {
  'Apprentice Guru': 'text-slate-300 border-slate-500/40 bg-slate-700/20',
  'Rising Guru':     'text-blue-300 border-blue-500/40 bg-blue-700/20',
  'Master Guru':     'text-purple-300 border-purple-500/40 bg-purple-700/20',
  'Grand Guru':      'text-amber-300 border-amber-500/40 bg-amber-700/20',
  'Legend Guru':     'text-cyan-300 border-cyan-400/50 bg-cyan-600/20',
};

export const GuruNFTSystem: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'my-guru' | 'leaderboard' | 'ranks' | 'mint'>('my-guru');
  const [guruNFTs, setGuruNFTs] = useState<GuruNFT[]>(SAMPLE_GURU_NFTS);
  const [minting, setMinting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const myGuru = guruNFTs.find((g) => g.isOwned);

  const handleMint = async () => {
    setMinting(true);
    setFeedbackMsg('Minting your Guru NFT on ABCDeFi protocol...');
    try {
      const newNFT = await mintGuruNFT('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
      setGuruNFTs([newNFT, ...guruNFTs.filter((g) => !g.isOwned)]);
      setFeedbackMsg(`Guru NFT ${newNFT.tokenId} minted! Welcome, ${newNFT.rank}! 🎉`);
      setActiveTab('my-guru');
    } catch {
      setFeedbackMsg('Failed to mint Guru NFT.');
    } finally {
      setMinting(false);
    }
  };

  return (
    <div id="guru-nft-system" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>Phase 6 — NFT Ecosystem</span>
            <span className="text-slate-600">↓</span>
            <span>Step 16: Guru NFT</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Crown className="w-5 h-5 text-amber-400" />
            Guru NFT — Knowledge Leader System
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Earn the Guru NFT by mentoring, creating lessons, and contributing to the ABCDeFi ecosystem. Unlock elite platform perks with 5 rank tiers.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('mint')}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-lg shadow-amber-500/25 transition cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          Mint / Upgrade Guru NFT
        </button>
      </div>

      {/* FEEDBACK */}
      {feedbackMsg && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* TABS */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-3 no-scrollbar">
        {[
          { id: 'my-guru', label: 'My Guru NFT' },
          { id: 'leaderboard', label: 'Guru Leaderboard' },
          { id: 'ranks', label: '5 Rank Tiers' },
          { id: 'mint', label: 'Mint Guru NFT' },
        ].map((tab) => {
          const sel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                sel
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/25 border border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===== MY GURU NFT ===== */}
      {activeTab === 'my-guru' && (
        <div className="space-y-5">
          {myGuru ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* NFT CARD */}
              <div className={`bg-gradient-to-b ${GURU_RANKS.find(r => r.rank === myGuru.rank)?.color} border rounded-3xl p-5 space-y-4 relative overflow-hidden`}>
                <div className="absolute top-3 right-3 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-amber-300">
                  {myGuru.tokenId}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-amber-500/50 shadow-xl">
                    <img src={myGuru.image} alt={myGuru.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{myGuru.name}</h3>
                    <p className="text-[11px] text-slate-400">{myGuru.title}</p>
                  </div>
                </div>

                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-black ${rankColor[myGuru.rank]}`}>
                  <span>{rankIcon[myGuru.rank]}</span>
                  <span>{myGuru.rank}</span>
                </div>

                {/* XP Progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>XP Progress</span>
                    <span className="text-amber-300 font-bold">{myGuru.xp} / {myGuru.xpToNext} XP</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                      style={{ width: `${Math.min(100, (myGuru.xp / myGuru.xpToNext) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="text-[10px] text-slate-500">Minted: {myGuru.mintedAt}</div>
              </div>

              {/* STATS */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Guru Stats</h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl">
                    <div className="text-[10px] text-slate-500">Mentees</div>
                    <div className="text-base font-extrabold text-indigo-400">{myGuru.mentees}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl">
                    <div className="text-[10px] text-slate-500">Lessons Created</div>
                    <div className="text-base font-extrabold text-teal-400">{myGuru.lessonsCreated}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl col-span-2">
                    <div className="text-[10px] text-slate-500">Total Earnings</div>
                    <div className="text-base font-extrabold text-emerald-400">{myGuru.totalEarnings}</div>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl space-y-1.5 text-xs">
                  <div className="text-[10px] text-slate-500 uppercase">Specialties</div>
                  <div className="flex flex-wrap gap-1.5">
                    {myGuru.specialties.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* PERKS */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Guru Perks Unlocked</h4>
                <div className="space-y-2 text-xs">
                  {myGuru.perks.map((perk) => (
                    <div key={perk} className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-200">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center space-y-4 bg-slate-950 border border-slate-800 rounded-3xl">
              <div className="text-5xl">🌱</div>
              <h3 className="text-sm font-bold text-white">You don't have a Guru NFT yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">Mint your Guru NFT to start your journey as an ABCDeFi knowledge leader and earn mentorship rewards.</p>
              <button onClick={() => setActiveTab('mint')} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-2xl text-xs shadow-lg shadow-amber-500/25 transition cursor-pointer flex items-center gap-2 mx-auto">
                <Sparkles className="w-4 h-4" /> Mint Guru NFT
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== LEADERBOARD ===== */}
      {activeTab === 'leaderboard' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase">Guru NFT Global Leaderboard</h3>
          </div>

          <div className="divide-y divide-slate-800/60">
            {guruNFTs.map((guru, idx) => (
              <div key={guru.tokenId} className={`flex items-center gap-4 p-4 transition hover:bg-slate-900/40 ${guru.isOwned ? 'bg-amber-900/10 border-l-2 border-amber-500' : ''}`}>
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                  idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-slate-400 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {idx + 1}
                </div>

                <div className="w-10 h-10 rounded-2xl overflow-hidden ring-1 ring-slate-700 shrink-0">
                  <img src={guru.image} alt={guru.name} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{guru.name}</span>
                    {guru.isOwned && <span className="text-[10px] text-amber-400 font-normal">(You)</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">{guru.title}</div>
                </div>

                <div className={`px-2.5 py-1 rounded-xl border text-[11px] font-black ${rankColor[guru.rank]}`}>
                  {rankIcon[guru.rank]} {guru.rank}
                </div>

                <div className="text-right text-xs hidden sm:block">
                  <div className="font-bold text-amber-300">{guru.xp.toLocaleString()} XP</div>
                  <div className="text-[10px] text-slate-500">{guru.mentees} Mentees</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 5 RANK TIERS ===== */}
      {activeTab === 'ranks' && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">5 Guru NFT Rank Tiers</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {GURU_RANKS.map((rank) => {
              const isCurrent = myGuru?.rank === rank.rank;
              return (
                <div
                  key={rank.rank}
                  className={`bg-gradient-to-b ${rank.color} border rounded-3xl p-4 space-y-3 relative ${isCurrent ? 'ring-2 ring-amber-400 scale-[1.03]' : ''}`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-black">
                      YOUR RANK ✓
                    </span>
                  )}

                  <div className="text-center">
                    <div className="text-3xl mb-1">{rank.icon}</div>
                    <h4 className="text-xs font-extrabold text-white">{rank.rank}</h4>
                    <div className="text-[10px] text-slate-400">{rank.minXP}+ XP</div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max LTV:</span>
                      <span className="font-bold text-emerald-400">{rank.ltv}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Staking:</span>
                      <span className="font-bold text-indigo-400">{rank.stakingBonus}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800/60 pt-1">
                      <span className="text-slate-400">Fees:</span>
                      <span className="font-bold text-amber-400">{rank.feeDiscount} off</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mentees:</span>
                      <span className="font-bold text-slate-200">{rank.menteeLimit === 9999 ? '∞' : rank.menteeLimit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== MINT GURU NFT ===== */}
      {activeTab === 'mint' && (
        <div className="max-w-lg mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-7 space-y-5 text-center">
          <div className="text-5xl">👑</div>
          <h3 className="text-lg font-black text-white">Mint Your Guru NFT</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The Guru NFT marks you as a knowledge leader in the ABCDeFi ecosystem. Earn XP by mentoring users, creating educational content, and achieving protocol milestones. Higher ranks unlock superior platform perks.
          </p>

          <div className="grid grid-cols-3 gap-3 text-xs text-left">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="text-[10px] text-slate-500">Starting Rank</div>
              <div className="font-bold text-amber-300">🌱 Apprentice</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="text-[10px] text-slate-500">Mint Price</div>
              <div className="font-bold text-emerald-400">Free (Earned)</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="text-[10px] text-slate-500">Max Rank</div>
              <div className="font-bold text-cyan-300">💎 Legend</div>
            </div>
          </div>

          <div className="text-left space-y-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs">
            <div className="text-slate-300 font-bold">How to earn Guru XP:</div>
            {[
              '📚 Create a course lesson (+50 XP)',
              '👤 Mentor a new user to first stake (+25 XP)',
              '✅ Help resolve a support query (+10 XP)',
              '🏆 Complete financial education quiz (+30 XP)',
              '💰 Refer users who borrow ABCD (+20 XP)',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-slate-400">
                <span className="shrink-0">{item.split(' ')[0]}</span>
                <span>{item.split(' ').slice(1).join(' ')}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleMint}
            disabled={minting}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black py-3 rounded-2xl text-sm shadow-xl shadow-amber-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {minting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
            <span>{minting ? 'Minting Guru NFT...' : 'Mint Guru NFT (Start Journey)'}</span>
          </button>
        </div>
      )}

    </div>
  );
};

export default GuruNFTSystem;
