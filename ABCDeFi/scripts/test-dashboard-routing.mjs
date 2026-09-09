import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import './test-lending-v2-ux.mjs';

const sourcePath = new URL('../src/Utils/dashboardMode.ts', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const walletContextSource = fs.readFileSync(new URL('../src/Context/WalletContext.tsx', import.meta.url), 'utf8');
const authContextSource = fs.readFileSync(new URL('../src/Context/AuthContext.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const dashboard = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const user = { role: 'user' };
const admin = { role: 'admin' };

test('user resolves to the user dashboard', () => {
  assert.equal(dashboard.resolveDashboardMode('/dashboard', user, true), 'user');
});

test('admin resolves to the admin dashboard', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
});

test('admin can switch back to the user dashboard in the same session', () => {
  assert.equal(dashboard.resolveDashboardMode('/dashboard', admin, true), 'user');
});

test('/dashboard always resolves to the user dashboard, including for an administrator', () => {
  assert.equal(dashboard.resolveDashboardMode('/dashboard', user, true), 'user');
  assert.equal(dashboard.resolveDashboardMode('/dashboard', admin, true), 'user');
});

test('only a verified admin can select the admin dashboard', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
  assert.equal(dashboard.resolveDashboardMode('/admin', user, true), 'user');
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, false), null);
});

test('an explicit /admin route is identified without granting admin permission', () => {
  assert.equal(dashboard.isAdminDashboardPath('/admin'), true);
  assert.equal(dashboard.isAdminDashboardPath('/admin/operations'), true);
  assert.equal(dashboard.isAdminDashboardPath('/dashboard'), false);
});

test('admin login is separate from protected admin dashboard routing', () => {
  assert.equal(dashboard.isAdminLoginPath('/admin/login'), true);
  assert.equal(dashboard.isAdminDashboardPath('/admin/login'), false);
  assert.equal(dashboard.modeFromPathname('/admin/login'), null);
});

test('App fails closed for a non-admin direct /admin visit', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /Administrator access denied/);
  assert.match(appSource, /adminAccessDenied/);
  assert.match(appSource, /Verifying authenticated session/);
});

test('the active user dashboard has no admin-only component dependency', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  for (const adminOnlyComponent of [
    'AdminPortalEngine',
    'AdminNftIssuance',
    'ICOAdmin',
    'AdminAuthenticationDiagnostics',
  ]) {
    assert.doesNotMatch(userDashboardSource, new RegExp(`\\b${adminOnlyComponent}\\b`));
  }
});

test('user-facing Franchise and Legion views cannot issue administrator certificates', () => {
  const franchiseSource = fs.readFileSync(new URL('../src/components/FranchiseNFT.tsx', import.meta.url), 'utf8');
  const legionSource = fs.readFileSync(new URL('../src/components/LegionNFT.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(franchiseSource, /\bmintFranchise\b/);
  assert.doesNotMatch(franchiseSource, /Issue a Franchise certificate/);
  assert.doesNotMatch(legionSource, /\bmintLegion\b/);
  assert.doesNotMatch(legionSource, /Issue a Legion certificate/);
  assert.doesNotMatch(legionSource, /Mint Legion certificate/);
});

test('administrator issuance remains structurally isolated in AdminPortalEngine', () => {
  const adminSource = fs.readFileSync(new URL('../src/components/AdminPortalEngine.tsx', import.meta.url), 'utf8');
  assert.match(adminSource, /<AdminNftIssuance\s*\/>/);
  assert.match(adminSource, /<ICOAdmin\s*\/>/);
  assert.match(adminSource, /<AdminAuthenticationDiagnostics\s*\/>/);
});

test('the active admin route is narrow, real-capability-only, and separate from legacy mock controls', () => {
  const adminSource = fs.readFileSync(new URL('../src/components/AdminPortalEngine.tsx', import.meta.url), 'utf8');
  const activeAdminSource = adminSource.slice(
    adminSource.indexOf('export const AdminPortalEngine'),
    adminSource.indexOf('// Legacy mock-backed control-center'),
  );

  assert.match(activeAdminSource, /user\?\.role !== 'admin'/);
  assert.match(activeAdminSource, /Application administrator access does not grant any on-chain role/);
  assert.match(activeAdminSource, /canonical ICO remains inactive/);
  assert.match(activeAdminSource, /<AdminAuthenticationDiagnostics\s*\/>/);
  assert.match(activeAdminSource, /<ICOAdmin\s*\/>/);
  assert.match(activeAdminSource, /<AdminNftIssuance\s*\/>/);
  assert.doesNotMatch(activeAdminSource, /mockApiStore/);
  assert.doesNotMatch(activeAdminSource, /RoleManager/);
  assert.doesNotMatch(activeAdminSource, /AdminPanel/);
});

test('unconfigured governance remains fail-closed instead of exposing mock proposals or votes', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const governanceServiceSource = fs.readFileSync(new URL('../src/Services/governance.ts', import.meta.url), 'utf8');
  const ecosystemDeploymentSource = fs.readFileSync(new URL('./deploy-ecosystem.ts', import.meta.url), 'utf8');
  const v2DeploymentSource = fs.readFileSync(new URL('./deploy-lending-v2-local.ts', import.meta.url), 'utf8');

  // The whitepaper describes democratic governing as a principle, but does
  // not specify voting power, quorum, duration, execution authority, or a
  // proposal payload. Until those mechanics are approved, mock records must
  // never become an active user-facing governance surface.
  assert.match(governanceServiceSource, /COMMUNITY_PROPOSALS/);
  assert.match(governanceServiceSource, /setTimeout/);
  assert.doesNotMatch(appSource, /FinancialWellnessDashboard|AdminGovernanceDashboard|NFTMarketplaceGovernancePortal/);
  assert.doesNotMatch(userDashboardSource, /FinancialWellnessDashboard|AdminGovernanceDashboard|NFTMarketplaceGovernancePortal/);
  assert.doesNotMatch(ecosystemDeploymentSource, /getContractFactory\(["'](?:Governance|ABCDeFiGovernor)["']\)/);
  assert.doesNotMatch(v2DeploymentSource, /getContractFactory\(["'](?:Governance|ABCDeFiGovernor)["']\)/);
});

test('App mounts admin controls only for the explicit admin route branch', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /dashboardMode === 'admin' \? \(\s*<AdminPortalEngine/s);
  assert.match(appSource, /\) : \(\s*<UserDashboard/s);
});

test('top-level incomplete navigation renders an explicit state instead of a blank page', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  assert.match(userDashboardSource, /Security controls/);
  assert.match(userDashboardSource, /AI Copilot/);
  assert.match(userDashboardSource, /not implemented in the active canonical runtime/);
});

test('Staking Pools remains a labeled, reachable top-level dashboard destination', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const navbarSource = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  assert.match(userDashboardSource, /\{ id: 'staking-pools', label: 'Staking Pools'/);
  assert.match(userDashboardSource, /activeTab === 'staking-pools' && <StakingPools\s*\/>/);
  assert.doesNotMatch(navbarSource, /Dashboard navigation/);
});

test('the primary UserDashboard lending and P2P tabs use the isolated V2 workflow', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  assert.match(userDashboardSource, /\{ id: 'lending', label: 'Lending'/);
  assert.match(userDashboardSource, /\{ id: 'lending-v2', label: 'Lending V2'/);
  assert.match(userDashboardSource, /\{ id: 'p2p-loans', label: 'P2P Loans'/);
  assert.match(userDashboardSource, /activeTab === 'lending' && <LendingV2\s*\/>/);
  assert.match(userDashboardSource, /activeTab === 'lending-v2' && <LendingV2\s*\/>/);
  assert.match(userDashboardSource, /activeTab === 'p2p-loans' && <LendingV2\s*\/>/);
});

test('active summary and NFT surfaces do not query legacy V1 lending or LoanNFT state', () => {
  const overviewSource = fs.readFileSync(new URL('../src/components/NextGenProtocolDashboard.tsx', import.meta.url), 'utf8');
  const portfolioSource = fs.readFileSync(new URL('../src/components/PortfolioDashboard.tsx', import.meta.url), 'utf8');
  const ecosystemSource = fs.readFileSync(new URL('../src/components/NFTEcosystem.tsx', import.meta.url), 'utf8');
  const ecosystemServiceSource = fs.readFileSync(new URL('../src/Services/nftEcosystem.ts', import.meta.url), 'utf8');
  const activeSnapshotSource = ecosystemServiceSource.slice(
    ecosystemServiceSource.indexOf('export async function getNftEcosystemSnapshot'),
    ecosystemServiceSource.indexOf('interface IndexedEvidence'),
  );

  assert.match(overviewSource, /getV2WalletSummary/);
  assert.match(portfolioSource, /getV2WalletSummary/);
  assert.doesNotMatch(overviewSource, /getCanonicalLendingReadState/);
  assert.doesNotMatch(portfolioSource, /getLendingPoolState/);
  assert.doesNotMatch(ecosystemSource, /getLoanNftCertificateSnapshot|LoanNFT certificates/);
  assert.doesNotMatch(activeSnapshotSource, /assertLoanNftDeployment|loan\.balanceOf/);
});

test('the active Treasury dashboard uses canonical balances and approved eight-way allocation policy', () => {
  const protocolDashboardSource = fs.readFileSync(new URL('../src/components/ProtocolDashboard.tsx', import.meta.url), 'utf8');
  const treasuryServiceSource = fs.readFileSync(new URL('../src/Services/treasury.ts', import.meta.url), 'utf8');

  assert.match(treasuryServiceSource, /return \{ ethBalance: state\.ethBalance, abcdBalance: state\.abcdBalance \};/);
  assert.match(protocolDashboardSource, /treasury\.abcdBalance/);
  assert.match(protocolDashboardSource, /Canonical contract read/);
  assert.match(protocolDashboardSource, /Allocation policy percentages are not live Treasury asset holdings/);
  assert.doesNotMatch(protocolDashboardSource, /treasuryEth: '50\.50'/);
  assert.doesNotMatch(protocolDashboardSource, /treasuryAbcd: '2,500,000'/);
  for (const allocation of ['Infrastructure', 'Liquidity & Financial Activities', 'Marketing / Ad / Promo / PR', 'Contracts / Endorsements / Tie-ups', 'Community', 'ACF Education / Welfare / Excellence', 'Contingency', 'Reserve']) {
    assert.match(protocolDashboardSource, new RegExp(allocation.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')));
  }
  for (const legacyAllocation of ['Staking Rewards', 'Public Presale', 'ETH Reserve', 'Yield Farming']) {
    assert.doesNotMatch(protocolDashboardSource, new RegExp(`name: '${legacyAllocation}'`));
  }
});

test('V2 direct lending exposes only the canonical V2 deposit handler while legacy V1 P2P is explicitly labelled', () => {
  const v2Source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const v1P2pSource = fs.readFileSync(new URL('../src/components/P2PLendingDashboard.tsx', import.meta.url), 'utf8');
  const legacyContractSource = fs.readFileSync(new URL('../src/components/ContractInteractDashboard.tsx', import.meta.url), 'utf8');
  assert.match(v2Source, /aria-label="Lending V2 direct lending flow"/);
  assert.match(v2Source, /depositV2Collateral\(collateral, progress\)/);
  assert.match(v2Source, /LendingPoolV2/);
  assert.match(v1P2pSource, /Legacy Lending V1 \/ P2P/);
  assert.doesNotMatch(v1P2pSource, /<LendingPool/);
  assert.match(legacyContractSource, /Legacy \/ Compatibility \/ Historical V1/);
  assert.doesNotMatch(legacyContractSource, /<LendingPool/);
});

test('the V2 collateral-deposit trigger is a visible, guarded real transaction button', () => {
  const v2Source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(v2Source, /aria-label="Deposit collateral into LendingPoolV2"/);
  assert.match(v2Source, /disabled=\{!canWrite \|\| !positiveAmount\(collateral\)\}/);
  assert.match(v2Source, /depositV2Collateral\(collateral, progress\)/);
  assert.match(service, /pool\.depositCollateral\.estimateGas\(\{ value \}\)/);
  assert.match(service, /pool\.depositCollateral\(\{ value, gasLimit: gas \}\)/);
  assert.match(service, /pool\.maxBorrowable\(collateral\)/);
  assert.doesNotMatch(service, /pool\.maxBorrowable\(depositId\)/);
  assert.match(service, /log\.address\.toLowerCase\(\) !== expectedPool/);
  assert.match(service, /eventBorrower !== expectedBorrower \|\| eventCollateral !== collateralETH/);
});

test('an active V2 deposit with authoritative capacity renders a constrained borrow form', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(source, /data-testid="v2-pending-deposit-preview"/);
  assert.match(source, /data-testid="v2-borrow-form"/);
  assert.match(source, /aria-label="Borrow ABCD against active V2 deposit"/);
  assert.match(source, /borrowV2\(depositId, principal, Number\(term\), progress\)/);
  assert.match(service, /pool\.borrowABCD\.estimateGas\(depositId, amount, termDays \* 86400\)/);
});

test('the header logo returns to the UserDashboard overview instead of an obsolete tab ID', () => {
  const navbarSource = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  assert.match(navbarSource, /setActiveTab\('overview'\)/);
  assert.doesNotMatch(navbarSource, /setActiveTab\('dashboard'\)/);
});

test('a refresh preserves an authorised selected dashboard and blocks unauthorised URLs', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
  assert.equal(dashboard.resolveDashboardMode('/admin', user, true), 'user');
});

test('a cleared session resolves no dashboard after logout', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', null, false), null);
  assert.equal(dashboard.resolveDashboardMode('/dashboard', null, false), null);
});

test('unauthenticated route guards replace protected browser URLs with the correct login route', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /Route guards must update the actual browser location/);
  assert.match(appSource, /isAdminDashboardPath\(pathname\) \|\| isAdminLoginPath\(pathname\)/);
  assert.match(appSource, /window\.history\.replaceState\(\{\}, '', destination\)/);
});

test('wallet disconnect clears wallet verification but cannot dispatch an application logout', () => {
  const disconnectSlice = walletContextSource.slice(
    walletContextSource.indexOf('const disconnectWallet = () =>'),
    walletContextSource.indexOf('const loginWithSignature = async'),
  );
  assert.doesNotMatch(disconnectSlice, /abcdefi_jwt/);
  assert.doesNotMatch(walletContextSource, /abcdefi-wallet-auth-invalidated/);
});

test('only application logout clears the authenticated JWT session', () => {
  const clearSessionSlice = authContextSource.slice(
    authContextSource.indexOf('const clearAuthSession'),
    authContextSource.indexOf('const setPendingAuth'),
  );
  assert.match(clearSessionSlice, /localStorage\.removeItem\(STORAGE_KEY_TOKEN\)/);
});
