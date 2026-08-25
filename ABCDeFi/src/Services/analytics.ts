// ==========================================
// Step 21: Analytics Dashboard — Data Layer
// ==========================================

export interface DataPoint {
  label: string;
  value: number;
}

export interface MetricCard {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  color: string;
}

// ── TVL (Total Value Locked) - Monthly ──────────────────────
export const TVL_DATA: DataPoint[] = [
  { label: 'Jan', value: 1.2 },
  { label: 'Feb', value: 2.1 },
  { label: 'Mar', value: 3.4 },
  { label: 'Apr', value: 4.8 },
  { label: 'May', value: 6.2 },
  { label: 'Jun', value: 8.5 },
  { label: 'Jul', value: 11.3 },
];

// ── Treasury Balance (ETH M equiv.) ─────────────────────────
export const TREASURY_DATA: DataPoint[] = [
  { label: 'Jan', value: 0.4 },
  { label: 'Feb', value: 0.7 },
  { label: 'Mar', value: 1.1 },
  { label: 'Apr', value: 1.4 },
  { label: 'May', value: 1.9 },
  { label: 'Jun', value: 2.3 },
  { label: 'Jul', value: 2.8 },
];

// ── Lending Volume (Monthly $M) ──────────────────────────────
export const LENDING_DATA: DataPoint[] = [
  { label: 'Jan', value: 0.5 },
  { label: 'Feb', value: 1.2 },
  { label: 'Mar', value: 2.3 },
  { label: 'Apr', value: 3.1 },
  { label: 'May', value: 4.7 },
  { label: 'Jun', value: 5.9 },
  { label: 'Jul', value: 7.4 },
];

// ── Borrowing Volume (Monthly $M) ───────────────────────────
export const BORROWING_DATA: DataPoint[] = [
  { label: 'Jan', value: 0.3 },
  { label: 'Feb', value: 0.9 },
  { label: 'Mar', value: 1.8 },
  { label: 'Apr', value: 2.5 },
  { label: 'May', value: 3.8 },
  { label: 'Jun', value: 4.6 },
  { label: 'Jul', value: 6.1 },
];

// ── Staking Growth (Staked ABCD M) ──────────────────────────
export const STAKING_DATA: DataPoint[] = [
  { label: 'Jan', value: 12 },
  { label: 'Feb', value: 28 },
  { label: 'Mar', value: 55 },
  { label: 'Apr', value: 89 },
  { label: 'May', value: 134 },
  { label: 'Jun', value: 182 },
  { label: 'Jul', value: 241 },
];

// ── Revenue (Monthly $K) ─────────────────────────────────────
export const REVENUE_DATA: DataPoint[] = [
  { label: 'Jan', value: 18 },
  { label: 'Feb', value: 34 },
  { label: 'Mar', value: 67 },
  { label: 'Apr', value: 112 },
  { label: 'May', value: 189 },
  { label: 'Jun', value: 278 },
  { label: 'Jul', value: 392 },
];

// ── User Growth (Monthly Active Users) ──────────────────────
export const USER_GROWTH_DATA: DataPoint[] = [
  { label: 'Jan', value: 420 },
  { label: 'Feb', value: 1100 },
  { label: 'Mar', value: 2800 },
  { label: 'Apr', value: 5400 },
  { label: 'May', value: 8900 },
  { label: 'Jun', value: 11200 },
  { label: 'Jul', value: 14800 },
];

// ── Token Distribution (%) ───────────────────────────────────
export const TOKEN_DISTRIBUTION: { label: string; pct: number; color: string }[] = [
  { label: 'Circulating Supply',  pct: 22.5, color: '#10b981' },
  { label: 'Staked (Locked)',     pct: 24.1, color: '#6366f1' },
  { label: 'Ecosystem & Rewards', pct: 25.0, color: '#0891b2' },
  { label: 'Treasury',            pct: 20.0, color: '#7c3aed' },
  { label: 'Team & Advisors',     pct: 8.4,  color: '#2563eb' },
];

// ── Summary Metrics ──────────────────────────────────────────
export const METRIC_CARDS: MetricCard[] = [
  { title: 'Total Value Locked',     value: '$11.3M',   change: '+33%',   positive: true,  color: 'text-emerald-400' },
  { title: 'Treasury Balance',       value: '$2.8M',    change: '+21%',   positive: true,  color: 'text-indigo-400'  },
  { title: 'Total Lending Volume',   value: '$7.4M',    change: '+25%',   positive: true,  color: 'text-amber-400'   },
  { title: 'Total Borrowing Volume', value: '$6.1M',    change: '+32%',   positive: true,  color: 'text-purple-400'  },
  { title: 'ABCD Staked',            value: '241M',     change: '+32%',   positive: true,  color: 'text-cyan-400'    },
  { title: 'Monthly Revenue',        value: '$392K',    change: '+41%',   positive: true,  color: 'text-teal-400'    },
  { title: 'Active Users',           value: '14,800',   change: '+32%',   positive: true,  color: 'text-rose-400'    },
  { title: 'Protocol Revenue YTD',   value: '$1.09M',   change: '+118%',  positive: true,  color: 'text-blue-400'    },
];
