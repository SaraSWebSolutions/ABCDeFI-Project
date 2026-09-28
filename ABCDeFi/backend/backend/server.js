const path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { isOneQLocalSelected, selectedRuntimeFamily, loadBackendRuntimeFamily, verifyBackendRuntimeFamilyLive } = require('./config/runtimeFamily.cjs');
// Resolve before routes load so omitted/unsupported configuration cannot select
// a legacy deployment by accident.
selectedRuntimeFamily();
const runtimeFamily = loadBackendRuntimeFamily();
process.on('uncaughtException', err => {
  console.error('❗ UncaughtException:', err);
});
process.on('unhandledRejection', reason => {
  console.error('❗ UnhandledRejection:', reason);
});
const express = require('express');
const app = express();
const config = require("./config/default");
const connectDb = require("./config/db");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const logger = require('./logger');

const passport = require('passport');
require('./modules/user/userAccount/authSocial.controller');

// Router file calling

const UserRouter = require("./modules/user/userAccount/userAccount.routes");
const AuthSocialRouter = require("./modules/user/userAccount/authSocial.routes");
const SplashRouter = require("./modules/user/splashScreen/splashScreen.routes");
const IcoRouter = require("./modules/ico/ico.routes");
const WhitePaperRouter = require("./modules/user/whitePaper/whitePaper.routes");
const privacyRouter = require("./modules/user/privacyPolicy/privacyPolicy.routes");
const rewardRouter = require("./modules/user/rewards/rewards.routes");
const AdminUserRouter = require("./modules/admin/userManagement/userManagement.routes");
const TermsRouter = require("./modules/user/terms/terms.routes");
const AdminAuthRouter = require("./modules/user/userAccount/adminAuth.routes");
const CanonicalAdminRouter = require("./modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs");
const FaqRouter = require("./modules/user/faq/faq.routes");
const AboutRouter = require("./modules/user/about/about.routes");
const UserNotificationRouter = require("./modules/user/notification/notification.routes");
const ReferRouter = require("./modules/user/referral/referral.routes");
const DepositRouter = require("./modules/user/deposit/deposit.routes");
const LoanRouter = require("./modules/loan/loan.routes");
const NftRouter = isOneQLocalSelected() ? null : require("./modules/nft/nft.routes");
const DashboardRouter = require("./modules/dashboard/dashboard.routes");
const TransactionRouter = require("./modules/transactions/transaction.routes");
const LendingReadRouter = isOneQLocalSelected() ? null : require("./modules/lendingProjection/lendingRead.routes");
const LendingV2ReadRouter = require("./modules/lendingV2Projection/lendingV2Read.routes.cjs");
const LendingV2MetadataRouter = require("./modules/lendingV2Metadata/lendingV2Metadata.routes.cjs");
const FranchiseReadRouter = isOneQLocalSelected() ? null : require("./modules/franchiseProjection/franchiseRead.routes");
const FranchiseV2ReadRouter = require("./modules/franchiseV2Projection/franchiseV2Read.routes.cjs");
const NftStorageRouter = require("./modules/nftStorage/nftStorage.routes");
const IcoV2Router = require("./modules/icoV2/icoV2.routes.cjs");
const IcoV3Router = require("./modules/icoV3/icoV3.routes.cjs");
const LegionCredentialReadRouter = require("./modules/legionCredentialProjection/legionCredentialRead.routes.cjs");
const LegionNFTV2ReadRouter = require("./modules/legionNFTV2Projection/legionNFTV2Read.routes.cjs");
const ABCDMarketplaceReadRouter = require("./modules/abcdMarketplaceProjection/read.routes.cjs");
const LegionMarketplaceReadRouter = require("./modules/legionMarketplaceProjection/read.routes.cjs");
const TreasuryV2ReadRouter = require("./modules/treasuryProjection/read.routes.cjs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, "public")));

app.use(passport.initialize());

app.get("/reset-password/:token", (req, res) => {
    res.sendFile(path.join(__dirname, "public/reset-password.html"));
});

app.use(cors());
app.use(helmet());

app.set("trust proxy", 1);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "Request limit reached. Please try again later.",
});

app.use(limiter);

app.use("/api/user", UserRouter);
app.use("/api/auth", AuthSocialRouter);
app.use("/api/splash-screen", SplashRouter);
app.use("/api/ico", IcoRouter);
// Phase 6 reads only canonical ICOManagerV2 on-chain state. The legacy
// /api/ico routes remain isolated historical surfaces and are never used by
// the canonical ICO dashboard.
app.use("/api/ico-v2", IcoV2Router);
// The 1Q ICO is a distinct ICOManagerV3 read model. It never shares the V2
// ABI, event collection, or checkpoint identity.
app.use("/api/ico-v3", IcoV3Router);
// Canonical Legion reads are isolated from the legacy territorial LegionNFT
// surfaces. Before an explicit LegionCredentialV2 manifest entry exists, the
// route reports UNDEPLOYED rather than falling back to legacy/mock records.
app.use("/api/legion-v2", LegionCredentialReadRouter);
// Hierarchical Phase 8 LegionNFTV2 is an independent, fail-closed canonical
// projection. It never falls back to legacy territorial/mock screens.
app.use("/api/legion-nft-v2", LegionNFTV2ReadRouter);
// Phase 10A is a manifest-bound, event-indexed ABCD sale read surface. It
// never falls back to the legacy seeded /api/marketplace routes.
app.use("/api/abcd-nft-marketplace-v2", ABCDMarketplaceReadRouter);
// Phase 10B is a separate, fail-closed projection for the narrowly approved
// targeted Legion settlement extension. It never falls back to generic or legacy marketplace data.
app.use("/api/legion-marketplace-v2", LegionMarketplaceReadRouter);
app.use("/api/treasury-v2", TreasuryV2ReadRouter);
app.use("/api/whitePaper", WhitePaperRouter);
app.use("/api/privacyPolicy", privacyRouter);
app.use("/api/reward", rewardRouter);
app.use("/api/admin/user", AdminUserRouter);
app.use("/api/terms", TermsRouter);
// Canonical admin authentication shares the UserAccount database and requires
// bcrypt password verification plus the existing login OTP flow. The legacy
// standalone Admin model is intentionally not mounted.
app.use("/api/admin", AdminAuthRouter);
// Canonical Phase 12 Admin reads are authenticated and manifest/indexer-bound.
// They never grant a wallet an on-chain role or fall back to legacy/mock data.
app.use("/api/admin/canonical", CanonicalAdminRouter);
app.use("/api/faq", FaqRouter);
app.use("/api/about", AboutRouter);
app.use("/api/user/notification", UserNotificationRouter);
app.use("/api/refer/", ReferRouter);
app.use("/api/deposits", DepositRouter);
const PresaleRouter = require("./routes/presale");

app.use("/api/loans", LoanRouter);
if (LendingReadRouter) app.use("/api/lending", LendingReadRouter);
app.use("/api/lending-v2", LendingV2MetadataRouter);
app.use("/api/lending-v2", LendingV2ReadRouter);
if (FranchiseReadRouter) app.use("/api/franchise", FranchiseReadRouter);
// The Legion-bound Franchise V2 projection is distinct from the historical
// foundation path and never falls back to legacy/mock Franchise records.
app.use("/api/franchise-v2", FranchiseV2ReadRouter);
app.use("/api/nft-storage", NftStorageRouter);
if (NftRouter) app.use("/api/nfts", NftRouter);
app.use("/api/presale", PresaleRouter);
app.use("/api/dashboard", DashboardRouter);
app.use("/api/transactions", TransactionRouter);

app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || "internal server error",
    });
});

const PORT = config.port;
(async () => {
  try {
    config.validateRuntimeConfig();
    await verifyBackendRuntimeFamilyLive(runtimeFamily);
    await connectDb();

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running at ${PORT}`);
      logger.info(`Strict ${runtimeFamily.family} runtime loaded for ${runtimeFamily.rpcUrl} (${runtimeFamily.chainId}) with deployment identity ${runtimeFamily.deploymentIdentity}.`);
      logger.info("Canonical indexers are disabled in the API process; start only matching 1Q indexer runners explicitly.");
    });
  } catch (err) {
    logger.error(`Server startup aborted: ${err.message}`);
    process.exit(1);
  }
})();
