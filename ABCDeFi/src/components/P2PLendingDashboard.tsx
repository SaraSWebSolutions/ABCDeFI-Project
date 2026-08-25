import React from 'react';
import { LendingPool } from './LendingPool';

/** Active dashboard lending sub-routes share the canonical Phase 6B surface. */
export default function P2PLendingDashboard(_props: { activeTab: string }) {
  return <LendingPool />;
}
