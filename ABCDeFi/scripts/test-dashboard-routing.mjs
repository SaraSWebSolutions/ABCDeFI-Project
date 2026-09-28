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

test('user-facing Franchise and canonical Legion views cannot issue administrator certificates', () => {
  const franchiseSource = fs.readFileSync(new URL('../src/components/FranchiseNFT.tsx', import.meta.url), 'utf8');
  const legionSource = fs.readFileSync(new URL('../src/components/LegionCredentialDashboard.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(franchiseSource, /\bmintFranchise\b/);
  assert.doesNotMatch(franchiseSource, /Issue a Franchise certificate/);
  assert.doesNotMatch(legionSource, /\bmintCredential\b/);
  assert.doesNotMatch(legionSource, /Issue a Legion certificate/);
  assert.doesNotMatch(legionSource, /Mint Legion certificate/);
});

test('legacy issuance controls remain outside the active Phase 12 Admin console', () => {
  const adminSource = fs.readFileSync(new URL('../src/components/AdminPortalEngine.tsx', import.meta.url), 'utf8');
  const activeAdminSource = adminSource.slice(
    adminSource.indexOf('export const AdminPortalEngine'),
    adminSource.indexOf('// Legacy mock-backed control-center'),
  );
  assert.match(activeAdminSource, /<CanonicalAdminDashboard\s*\/>/);
  assert.match(activeAdminSource, /<AdminAuthenticationDiagnostics\s*\/>/);
  assert.doesNotMatch(activeAdminSource, /<AdminNftIssuance\s*\/>|<ICOAdmin\s*\/>/);
});

test('the active admin route is narrow, real-capability-only, and separate from legacy mock controls', () => {
  const adminSource = fs.readFileSync(new URL('../src/components/AdminPortalEngine.tsx', import.meta.url), 'utf8');
  const activeAdminSource = adminSource.slice(
    adminSource.indexOf('export const AdminPortalEngine'),
    adminSource.indexOf('// Legacy mock-backed control-center'),
  );

  assert.match(activeAdminSource, /user\?\.role !== 'admin'/);
  assert.match(activeAdminSource, /Application administrator access does not grant any on-chain role/);
  assert.match(activeAdminSource, /does not create a universal/);
  assert.match(activeAdminSource, /<AdminAuthenticationDiagnostics\s*\/>/);
  assert.match(activeAdminSource, /<CanonicalAdminDashboard\s*\/>/);
  assert.doesNotMatch(activeAdminSource, /<ICOAdmin\s*\/>|<AdminNftIssuance\s*\/>/);
  assert.doesNotMatch(activeAdminSource, /mockApiStore/);
  assert.doesNotMatch(activeAdminSource, /RoleManager/);
  assert.doesNotMatch(activeAdminSource, /AdminPanel/);
});

test('legacy Governance feature is absent from canonical sources, routes, and deployments', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const financialWellnessSource = fs.readFileSync(new URL('../src/components/FinancialWellnessDashboard.tsx', import.meta.url), 'utf8');
  const canonicalAdminConfigSource = fs.readFileSync(new URL('../backend/backend/modules/admin/canonicalAdmin/canonicalAdmin.config.cjs', import.meta.url), 'utf8');
  const ecosystemDeploymentSource = fs.readFileSync(new URL('./deploy-ecosystem.ts', import.meta.url), 'utf8');
  const v2DeploymentSource = fs.readFileSync(new URL('./deploy-lending-v2-local.ts', import.meta.url), 'utf8');

  assert.equal(fs.existsSync(new URL('../contracts/governance/Governance.sol', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../contracts/governance/ABCDeFiGovernor.sol', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../src/Services/governance.ts', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../src/components/AdminGovernanceDashboard.tsx', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../src/components/NFTMarketplaceGovernancePortal.tsx', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../types/ethers-contracts/governance/Governance.ts', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../types/ethers-contracts/governance/ABCDeFiGovernor.sol/ABCDeFiGovernor.ts', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../types/ethers-contracts/factories/governance/Governance__factory.ts', import.meta.url)), false);
  assert.doesNotMatch(appSource, /FinancialWellnessDashboard|AdminGovernanceDashboard|NFTMarketplaceGovernancePortal/);
  assert.doesNotMatch(userDashboardSource, /FinancialWellnessDashboard|AdminGovernanceDashboard|NFTMarketplaceGovernancePortal/);
  assert.doesNotMatch(financialWellnessSource, /COMMUNITY_PROPOSALS|voteOnProposal|DAO Governance|Vote FOR|Vote AGAINST/);
  assert.doesNotMatch(canonicalAdminConfigSource, /name: 'Governance'/);
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

test('the primary UserDashboard groups Lending views while preserving the isolated V2 workflow', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const mobileDashboardSource = fs.readFileSync(new URL('../src/components/MobileUserDashboard.tsx', import.meta.url), 'utf8');
  const navigationSource = userDashboardSource.slice(
    userDashboardSource.indexOf('const USER_NAVIGATION_GROUPS'),
    userDashboardSource.indexOf('const LENDING_VIEW_DESCRIPTIONS'),
  );
  assert.match(navigationSource, /id: 'lending',\s+label: 'Lending'/);
  assert.match(navigationSource, /id: 'p2p-loans', label: 'P2P Loans'/);
  assert.match(navigationSource, /id: 'deposit', label: 'Collateral'/);
  assert.match(navigationSource, /id: 'emi', label: 'Repayment & EMI'/);
  assert.doesNotMatch(navigationSource, /id: 'lending-v2'/);
  assert.doesNotMatch(navigationSource, /id: 'security'|id: 'ai-copilot'|id: 'credit'|id: 'notifications'|id: 'settings'/);
  assert.match(userDashboardSource, /activeTab === 'lending' && <LendingV2\s*\/>/);
  assert.match(userDashboardSource, /activeTab === 'p2p-loans' &&/);
  assert.match(userDashboardSource, /aria-label="P2P lending workspace"/);
  assert.doesNotMatch(userDashboardSource, /from ['"]\.\/LendingPool['"]/);
  assert.doesNotMatch(userDashboardSource, /from ['"]\.\/P2PLendingDashboard['"]/);
  assert.doesNotMatch(mobileDashboardSource, /from ['"]\.\/P2PLendingDashboard['"]/);
});

test('the canonical user shell groups NFT features and keeps administrative routes separate', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const navigationSource = userDashboardSource.slice(
    userDashboardSource.indexOf('const USER_NAVIGATION_GROUPS'),
    userDashboardSource.indexOf('const LENDING_VIEW_DESCRIPTIONS'),
  );

  assert.match(navigationSource, /id: 'nft-ecosystem',\s+label: 'NFT Ecosystem'/);
  for (const id of ['legion', 'franchise', 'abcd-nft-marketplace', 'legion-marketplace']) {
    assert.match(navigationSource, new RegExp(`id: '${id}'`));
  }
  assert.match(navigationSource, /id: 'account',\s+label: 'Account'/);
  assert.doesNotMatch(navigationSource, /id: 'admin'/);
});

test('Profile stays inside the canonical dashboard and no longer targets a dead browser route', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const navbarSource = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(userDashboardSource, /window\.location\.assign\(['"]\/profile['"]\)/);
  assert.match(userDashboardSource, /activeTab === 'profile'/);
  assert.match(navbarSource, /setActiveTab\('profile'\)/);
  assert.doesNotMatch(navbarSource, /Security & 2FA Settings/);
});

test('active summary and NFT surfaces use canonical V2 sources rather than the legacy NFT marketplace service', () => {
  const overviewSource = fs.readFileSync(new URL('../src/components/NextGenProtocolDashboard.tsx', import.meta.url), 'utf8');
  const portfolioSource = fs.readFileSync(new URL('../src/components/PortfolioDashboard.tsx', import.meta.url), 'utf8');
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const ecosystemServiceSource = fs.readFileSync(new URL('../src/Services/nftEcosystem.ts', import.meta.url), 'utf8');

  assert.match(overviewSource, /getV2WalletSummary/);
  assert.match(portfolioSource, /getV2WalletSummary/);
  assert.doesNotMatch(overviewSource, /getCanonicalLendingReadState/);
  assert.doesNotMatch(portfolioSource, /getLendingPoolState/);
  assert.doesNotMatch(overviewSource, /getNftEcosystemSnapshot/);
  assert.doesNotMatch(portfolioSource, /getNftEcosystemSnapshot/);
  assert.doesNotMatch(userDashboardSource, /from ['"]\.\/NFTEcosystem['"]/);
  assert.doesNotMatch(userDashboardSource, /id: 'nft-ecosystem', label: 'Owned NFTs'/);
  assert.match(userDashboardSource, /id: 'loan-nft-certificates', label: 'Loan Completion NFTs'/);
  assert.match(userDashboardSource, /LoanNftV2Certificates/);
  assert.match(ecosystemServiceSource, /Historical\/non-canonical NFT V1 service/);
});

test('the active dashboard does not route through the retired Treasury mock while Treasury reads remain canonical', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const treasuryServiceSource = fs.readFileSync(new URL('../src/Services/treasury.ts', import.meta.url), 'utf8');

  assert.match(treasuryServiceSource, /return \{ ethBalance: state\.ethBalance, abcdBalance: state\.abcdBalance \};/);
  assert.doesNotMatch(userDashboardSource, /from ['"]\.\/ProtocolDashboard['"]/);
  assert.doesNotMatch(userDashboardSource, /treasuryEth: '50\.50'/);
  assert.doesNotMatch(userDashboardSource, /treasuryAbcd: '2,500,000'/);
});

test('V2 direct lending exposes only the canonical V2 deposit handler while legacy V1 P2P is explicitly labelled', () => {
  const v2Source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const v1P2pSource = fs.readFileSync(new URL('../src/components/P2PLendingDashboard.tsx', import.meta.url), 'utf8');
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  assert.match(v2Source, /aria-label="Lending V2 direct lending flow"/);
  assert.match(v2Source, /depositV2Collateral\(collateral, progress\)/);
  assert.match(v2Source, /LendingPoolV2/);
  assert.match(v1P2pSource, /Legacy Lending V1 \/ P2P/);
  assert.match(v1P2pSource, /It exposes no transaction controls/);
  assert.doesNotMatch(v1P2pSource, /<LendingPool/);
  assert.doesNotMatch(userDashboardSource, /ContractInteractDashboard/);
  assert.doesNotMatch(v2Source, /ContractInteractDashboard/);
});

test('the V2 collateral-deposit trigger is a visible, guarded real transaction button', () => {
  const v2Source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(v2Source, /aria-label="Deposit collateral into LendingPoolV2"/);
  assert.match(v2Source, /disabled=\{!canWrite \|\| !positiveAmount\(collateral\)\}/);
  assert.match(v2Source, /depositV2Collateral\(collateral, progress\)/);
  assert.match(service, /pool\.depositCollateral\.estimateGas\(\{ value \}\)/);
  assert.match(service, /canonicalProvider\.getTransactionCount\(await signer\.getAddress\(\), 'pending'\)/);
  assert.match(service, /pool\.depositCollateral\(await walletTransactionOverrides\(signer, gas, value\)\)/);
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
