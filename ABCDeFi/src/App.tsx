import React, { useCallback, useEffect, useState } from 'react';
import { WalletProvider } from './Context/WalletContext';
import { AuthProvider, useAuth } from './Context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Navbar } from './components/Navbar';
import { UserDashboard } from './components/UserDashboard';
import { LendingPool } from './components/LendingPool';
import { LendingV2 } from './components/LendingV2';
import { NFTEcosystem } from './components/NFTEcosystem';
import { PresaleICO } from './components/PresaleICO';
import { StakingPools } from './components/StakingPools';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { AdminPortalEngine } from './components/AdminPortalEngine';
import { KYCModal } from './components/KycModal';
import { AuthModal } from './components/AuthModal';
import {
  DashboardMode,
  isApplicationAdmin,
  pathForDashboardMode,
  resolveDashboardMode,
} from './Utils/dashboardMode';

export function AppContent() {
  const { user, token, sessionVerified } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Helper functions for UserDashboard (vesting/claim system)
  const computeVestedAmount = (_sch: any, _ts: number): bigint => BigInt(0);
  const computeReleasableAmount = (_sch: any, _ts: number): bigint => BigInt(0);
  const formatUnits = (amt: bigint): string => (Number(amt) / 1e18).toFixed(4);
  const formatDuration = (sec: number): string => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
  };

  const dashboardMode = resolveDashboardMode(pathname, user, sessionVerified);
  const canAccessAdmin = isApplicationAdmin(user, sessionVerified);

  const navigateDashboard = useCallback((mode: DashboardMode, replace = false) => {
    const destination = pathForDashboardMode(mode);
    if (window.location.pathname !== destination) {
      window.history[replace ? 'replaceState' : 'pushState']({ dashboardMode: mode }, '', destination);
    }
    setPathname(destination);
    if (mode === 'user') setActiveTab('dashboard');
  }, []);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!user || !token || !dashboardMode) return;
    const canonicalPath = pathForDashboardMode(dashboardMode);
    if (window.location.pathname !== canonicalPath) {
      navigateDashboard(dashboardMode, true);
    }
  }, [dashboardMode, navigateDashboard, token, user]);

  // Production web app: authenticated users only.
  // Guest/demo access is intentionally disabled so the UI cannot imply that
  // simulated protocol actions are real user activity.
  if (!user || !token) {
    return <LoginPage />;
  }

  // Show Navbar, Dashboard and platform views once authenticated or exploring as guest
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'admin') {
            if (canAccessAdmin) navigateDashboard('admin');
            return;
          }
          if (dashboardMode === 'admin') navigateDashboard('user');
          setActiveTab(tab);
        }}
        dashboardMode={dashboardMode || 'user'}
        canAccessAdmin={canAccessAdmin}
        onSwitchDashboard={navigateDashboard}
        onOpenKyc={() => setKycModalOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {dashboardMode === 'admin' ? (
          <AdminPortalEngine onOpenUserDashboard={() => navigateDashboard('user')} />
        ) : activeTab === 'dashboard' && (
          <UserDashboard
            schedules={[]}
            selectedAccount={null}
            currentTimestamp={Math.floor(Date.now() / 1000)}
            computeVestedAmount={computeVestedAmount}
            computeReleasableAmount={computeReleasableAmount}
            onClaim={() => {}}
            formatUnits={formatUnits}
            formatDuration={formatDuration}
            paused={false}
            canAccessAdmin={canAccessAdmin}
            onOpenAdminDashboard={() => navigateDashboard('admin')}
          />
        )}
        {dashboardMode === 'user' && activeTab === 'lending' && <LendingPool />}
        {dashboardMode === 'user' && activeTab === 'lending-v2' && <LendingV2 />}
        {dashboardMode === 'user' && (activeTab === 'nft' || activeTab === 'nfts') && <NFTEcosystem />}
        {dashboardMode === 'user' && activeTab === 'presale' && <PresaleICO />}
        {dashboardMode === 'user' && activeTab === 'staking' && <StakingPools />}
        {dashboardMode === 'user' && (activeTab === 'reports' || activeTab === 'portfolio') && <PortfolioDashboard />}
      </main>

      {/* Auth Modal for Login & Registration */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* KYC Modal */}
      {kycModalOpen && (
        <KYCModal isOpen={kycModalOpen} onClose={() => setKycModalOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </WalletProvider>
  );
}
