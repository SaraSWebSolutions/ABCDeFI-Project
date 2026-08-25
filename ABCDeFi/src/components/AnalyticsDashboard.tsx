import React, { useState } from 'react';
import {
  TrendingUp,
  Landmark,
  Coins,
  CreditCard,
  DollarSign,
  Users,
  PieChart,
  ArrowUpRight,
  BarChart2,
  Activity,
} from 'lucide-react';
import {
  TVL_DATA, TREASURY_DATA, LENDING_DATA, BORROWING_DATA,
  STAKING_DATA, REVENUE_DATA, USER_GROWTH_DATA,
  TOKEN_DISTRIBUTION, METRIC_CARDS, DataPoint,
} from '../Services/analytics';

// ─────────────────────────────────────────
// SVG Line Chart Component
// ─────────────────────────────────────────
interface LineChartProps {
  data: DataPoint[];
  color: string;
  gradientId: string;
  unit?: string;
  prefix?: string;
}

const LineChart: React.FC<LineChartProps> = ({ data, color, gradientId, unit = '', prefix = '' }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; val: number; label: string } | null>(null);
  const W = 400; const H = 120; const PAD = 8;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const xStep = (W - PAD * 2) / (data.length - 1);

  const pts = data.map((d, i) => ({
    x: PAD + i * xStep,
    y: H - PAD - ((d.value - min) / range) * (H - PAD * 2),
    val: d.value,
    label: d.label,
  }));

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${H} ${pts.map((p) => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${H} Z`;

  return (
    <div className="relative w-full" style={{ aspectRatio: '3.5/1' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={PAD} y1={PAD + (H - PAD * 2) * r}
            x2={W - PAD} y2={PAD + (H - PAD * 2) * r}
            stroke="#1e293b" strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path d={area} fill={`url(#${gradientId})`} />

        {/* Line */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Data Points */}
        {pts.map((p, i) => (
          <g key={i}
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, val: p.val, label: p.label })}
            onMouseLeave={() => setTooltip(null)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="#0f172a" strokeWidth="2" />
          </g>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 28, W - 62)} y={tooltip.y - 30}
              width="60" height="22" rx="5"
              fill="#1e293b" stroke={color} strokeWidth="1"
            />
            <text
              x={Math.min(tooltip.x - 28, W - 62) + 30}
              y={tooltip.y - 15}
              textAnchor="middle" fill="white" fontSize="9" fontWeight="bold"
            >
              {prefix}{tooltip.val.toLocaleString()}{unit}
            </text>
          </g>
        )}

        {/* X labels */}
        {pts.map((p, i) => (
          <text key={i} x={p.x} y={H + 1} textAnchor="middle" fill="#475569" fontSize="7.5">
            {data[i].label}
          </text>
        ))}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────
// SVG Bar Chart Component
// ─────────────────────────────────────────
interface BarChartProps {
  data: DataPoint[];
  color: string;
  unit?: string;
  prefix?: string;
}

const BarChart: React.FC<BarChartProps> = ({ data, color, unit = '', prefix = '' }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 400; const H = 120; const PAD = 8;
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals);
  const barW = (W - PAD * 2) / data.length - 4;
  const xStep = (W - PAD * 2) / data.length;

  return (
    <div className="relative w-full" style={{ aspectRatio: '3.5/1' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
        {/* Grid */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1={PAD} y1={PAD + (H - PAD * 2 - 8) * r} x2={W - PAD} y2={PAD + (H - PAD * 2 - 8) * r}
            stroke="#1e293b" strokeWidth="1" />
        ))}

        {data.map((d, i) => {
          const bH = ((d.value / max) * (H - PAD * 2 - 8));
          const x = PAD + i * xStep + 2;
          const y = H - PAD - 8 - bH;
          const isH = hovered === i;
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
              <rect x={x} y={y} width={barW} height={bH} rx="3"
                fill={color} opacity={isH ? 1 : 0.7} />
              {isH && (
                <g>
                  <rect x={Math.min(x + barW / 2 - 28, W - 62)} y={y - 22} width="60" height="18" rx="4"
                    fill="#1e293b" stroke={color} strokeWidth="1" />
                  <text x={Math.min(x + barW / 2 - 28, W - 62) + 30} y={y - 9}
                    textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
                    {prefix}{d.value.toLocaleString()}{unit}
                  </text>
                </g>
              )}
              <text x={x + barW / 2} y={H - 1} textAnchor="middle" fill="#475569" fontSize="7.5">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────
// Donut Chart Component (Token Distribution)
// ─────────────────────────────────────────
const DonutChart: React.FC = () => {
  const [hovered, setHovered] = useState<number | null>(null);
  const CX = 80; const CY = 80; const R = 60; const IR = 36;
  const total = TOKEN_DISTRIBUTION.reduce((s, d) => s + d.pct, 0);
  let startAngle = -90;

  const slices = TOKEN_DISTRIBUTION.map((d, i) => {
    const sweep = (d.pct / total) * 360;
    const start = startAngle;
    const end = startAngle + sweep;
    startAngle += sweep;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = CX + R * Math.cos(toRad(start));
    const y1 = CY + R * Math.sin(toRad(start));
    const x2 = CX + R * Math.cos(toRad(end));
    const y2 = CY + R * Math.sin(toRad(end));
    const ix1 = CX + IR * Math.cos(toRad(start));
    const iy1 = CY + IR * Math.sin(toRad(start));
    const ix2 = CX + IR * Math.cos(toRad(end));
    const iy2 = CY + IR * Math.sin(toRad(end));
    const large = sweep > 180 ? 1 : 0;
    const path = `M${ix1},${iy1} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${IR},${IR} 0 ${large} 0 ${ix1},${iy1} Z`;
    return { ...d, path, index: i };
  });

  const hov = hovered !== null ? TOKEN_DISTRIBUTION[hovered] : null;

  return (
    <div className="flex items-center gap-5">
      <div className="shrink-0" style={{ width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" width="160" height="160">
          {slices.map((s) => (
            <path key={s.index} d={s.path} fill={s.color}
              opacity={hovered === null || hovered === s.index ? 1 : 0.4}
              stroke="#0f172a" strokeWidth="1.5"
              onMouseEnter={() => setHovered(s.index)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer transition-opacity"
            />
          ))}
          <circle cx={CX} cy={CY} r={IR - 1} fill="#0f172a" />
          {hov ? (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{hov.pct}%</text>
              <text x={CX} y={CY + 8} textAnchor="middle" fill="#94a3b8" fontSize="6.5">{hov.label.split(' ')[0]}</text>
            </>
          ) : (
            <>
              <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">1B</text>
              <text x={CX} y={CY + 8} textAnchor="middle" fill="#64748b" fontSize="7">ABCD</text>
            </>
          )}
        </svg>
      </div>
      <div className="flex-1 space-y-1.5 text-xs">
        {TOKEN_DISTRIBUTION.map((d, i) => (
          <div key={i} className={`flex items-center gap-2 cursor-pointer transition-opacity ${hovered !== null && hovered !== i ? 'opacity-40' : ''}`}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-slate-400 truncate">{d.label}</span>
            <span className="ml-auto font-bold text-white">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// Chart Card Wrapper
// ─────────────────────────────────────────
interface ChartCardProps {
  title: string;
  subtitle: string;
  value: string;
  change: string;
  positive: boolean;
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, value, change, positive, color, icon, children }) => (
  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500">{icon}<span>{subtitle}</span></div>
        <h3 className="text-sm font-extrabold text-white mt-0.5">{title}</h3>
      </div>
      <div className="text-right">
        <div className={`text-base font-black ${color}`}>{value}</div>
        <div className={`text-[11px] font-bold flex items-center gap-0.5 justify-end ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          <ArrowUpRight className={`w-3 h-3 ${!positive ? 'rotate-180' : ''}`} />
          {change} this month
        </div>
      </div>
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────
// Analytics Dashboard
// ─────────────────────────────────────────
export const AnalyticsDashboard: React.FC = () => {
  const [range] = useState<'7D' | '1M' | '3M' | '6M' | 'ALL'>('1M');

  return (
    <div id="analytics-dashboard" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <span>Phase 8 — Analytics</span>
            <span className="text-slate-600">↓</span>
            <span>Step 21: Analytics Dashboard</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            ABCDeFi Protocol Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time charts for TVL, Treasury, Lending, Borrowing, Token Distribution, Staking Growth, Revenue, and User Growth.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {(['7D', '1M', '3M', '6M', 'ALL'] as const).map((r) => (
            <button key={r}
              className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer transition ${r === range ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* METRIC CARDS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {METRIC_CARDS.map((m) => (
          <div key={m.title} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
            <div className="text-[10px] text-slate-500 uppercase">{m.title}</div>
            <div className={`text-base font-extrabold mt-0.5 ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5 mt-0.5">
              <ArrowUpRight className="w-2.5 h-2.5" />{m.change} MoM
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS GRID — Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: TVL */}
        <ChartCard title="Total Value Locked (TVL)" subtitle="Cumulative • $M USD" value="$11.3M" change="+33%" positive color="text-emerald-400" icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}>
          <LineChart data={TVL_DATA} color="#10b981" gradientId="tvl-grad" prefix="$" unit="M" />
        </ChartCard>

        {/* Chart 2: Treasury */}
        <ChartCard title="Treasury Balance" subtitle="Protocol Reserve • $M USD" value="$2.8M" change="+21%" positive color="text-indigo-400" icon={<Landmark className="w-3.5 h-3.5 text-indigo-400" />}>
          <BarChart data={TREASURY_DATA} color="#6366f1" prefix="$" unit="M" />
        </ChartCard>
      </div>

      {/* CHARTS GRID — Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 3: Lending */}
        <ChartCard title="Lending Volume" subtitle="Monthly • $M USD" value="$7.4M" change="+25%" positive color="text-amber-400" icon={<Coins className="w-3.5 h-3.5 text-amber-400" />}>
          <LineChart data={LENDING_DATA} color="#f59e0b" gradientId="lend-grad" prefix="$" unit="M" />
        </ChartCard>

        {/* Chart 4: Borrowing */}
        <ChartCard title="Borrowing Volume" subtitle="Monthly • $M USD" value="$6.1M" change="+32%" positive color="text-purple-400" icon={<CreditCard className="w-3.5 h-3.5 text-purple-400" />}>
          <BarChart data={BORROWING_DATA} color="#a855f7" prefix="$" unit="M" />
        </ChartCard>
      </div>

      {/* CHARTS GRID — Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 5: Staking Growth */}
        <ChartCard title="Staking Growth" subtitle="ABCD Tokens Staked • Millions" value="241M ABCD" change="+32%" positive color="text-cyan-400" icon={<Coins className="w-3.5 h-3.5 text-cyan-400" />}>
          <LineChart data={STAKING_DATA} color="#06b6d4" gradientId="stake-grad" unit="M" />
        </ChartCard>

        {/* Chart 6: Revenue */}
        <ChartCard title="Protocol Revenue" subtitle="Monthly Fees Collected • $K USD" value="$392K" change="+41%" positive color="text-teal-400" icon={<DollarSign className="w-3.5 h-3.5 text-teal-400" />}>
          <BarChart data={REVENUE_DATA} color="#14b8a6" prefix="$" unit="K" />
        </ChartCard>
      </div>

      {/* CHARTS GRID — Row 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 7: User Growth */}
        <ChartCard title="User Growth" subtitle="Monthly Active Users" value="14,800" change="+32%" positive color="text-rose-400" icon={<Users className="w-3.5 h-3.5 text-rose-400" />}>
          <LineChart data={USER_GROWTH_DATA} color="#f43f5e" gradientId="user-grad" />
        </ChartCard>

        {/* Chart 8: Token Distribution */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <PieChart className="w-3.5 h-3.5 text-blue-400" /><span>Supply Breakdown</span>
              </div>
              <h3 className="text-sm font-extrabold text-white mt-0.5">Token Distribution</h3>
            </div>
            <div className="text-right">
              <div className="text-base font-black text-blue-400">1B ABCD</div>
              <div className="text-[11px] text-slate-500">Total Supply</div>
            </div>
          </div>
          <DonutChart />
        </div>
      </div>

      {/* STEP 38 — NFT ANALYTICS SECTION */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
              <span>Step 38</span>
              <span className="text-slate-600">↓</span>
              <span>NFT Analytics</span>
            </div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2 mt-0.5">
              <BarChart2 className="w-4 h-4 text-pink-400" />
              NFT Ecosystem & Marketplace Analytics
            </h3>
          </div>
          <span className="text-xs text-pink-400 font-bold">$485,000 Volume Driven</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* TOTAL NFTS */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">1. Total NFTs Minted</div>
            <div className="text-xl font-black text-white">2,845 NFTs</div>
            <div className="text-[10px] text-emerald-400 font-bold">+18% MoM Growth</div>
          </div>

          {/* LEGION NFTS */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">2. Legion Territory NFTs</div>
            <div className="text-xl font-black text-amber-300">269 NFTs</div>
            <div className="text-[10px] text-slate-400">6 Continents · 193 Countries · 37 States · 33 Districts</div>
          </div>

          {/* LOAN NFTS */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">3. Loan Soulbound NFTs</div>
            <div className="text-xl font-black text-purple-300">1,420 NFTs</div>
            <div className="text-[10px] text-slate-400">Borrower & Lender Proof Tokens</div>
          </div>

          {/* MARKETPLACE VOLUME */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">4. Marketplace Volume</div>
            <div className="text-xl font-black text-pink-400">$485,000 USD</div>
            <div className="text-[10px] text-emerald-400 font-bold">+42.5% Trading Volume</div>
          </div>
        </div>
      </div>

      {/* Protocol Health Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-3xl">
        {[
          { label: 'Utilization Rate', value: '82.4%', color: 'text-emerald-400', note: 'Lending/TVL' },
          { label: 'Avg. Loan APY', value: '9.2%', color: 'text-amber-400', note: 'Weighted Average' },
          { label: 'Protocol Health', value: 'Excellent', color: 'text-teal-400', note: 'All KPIs Green' },
        ].map((h) => (
          <div key={h.label} className="flex items-center gap-3 text-xs">
            <Activity className="w-4 h-4 text-slate-600 shrink-0" />
            <div>
              <div className="text-slate-500">{h.label}</div>
              <div className={`font-extrabold text-sm ${h.color}`}>{h.value}</div>
              <div className="text-slate-600 text-[10px]">{h.note}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default AnalyticsDashboard;
