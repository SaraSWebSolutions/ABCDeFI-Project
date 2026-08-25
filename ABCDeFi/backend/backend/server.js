const path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
process.on('uncaughtException', err => {
  console.error('❗ UncaughtException:', err);
});
process.on('unhandledRejection', reason => {
  console.error('❗ UnhandledRejection:', reason);
});
const express = require('express');
const app = express();
const config = require("./config/default");
const { loadLendingManifest } = require("./config/lendingManifest.cjs");
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
const AdminRouter = require("./modules/admin/admin/admin.routes");
const FaqRouter = require("./modules/user/faq/faq.routes");
const AboutRouter = require("./modules/user/about/about.routes");
const UserNotificationRouter = require("./modules/user/notification/notification.routes");
const ReferRouter = require("./modules/user/referral/referral.routes");
const DepositRouter = require("./modules/user/deposit/deposit.routes");
const LoanRouter = require("./modules/loan/loan.routes");
const NftRouter = require("./modules/nft/nft.routes");
const DashboardRouter = require("./modules/dashboard/dashboard.routes");
const TransactionRouter = require("./modules/transactions/transaction.routes");

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
app.use("/api/whitePaper", WhitePaperRouter);
app.use("/api/privacyPolicy", privacyRouter);
app.use("/api/reward", rewardRouter);
app.use("/api/admin/user", AdminUserRouter);
app.use("/api/terms", TermsRouter);
app.use("/api/admin", AdminRouter);
app.use("/api/faq", FaqRouter);
app.use("/api/about", AboutRouter);
app.use("/api/user/notification", UserNotificationRouter);
app.use("/api/refer/", ReferRouter);
app.use("/api/deposits", DepositRouter);
const PresaleRouter = require("./routes/presale");

app.use("/api/loans", LoanRouter);
app.use("/api/nfts", NftRouter);
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
    const lendingManifest = loadLendingManifest();
    await connectDb();

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running at ${PORT}`);
      logger.info(`Canonical lending manifest loaded for ${lendingManifest.network} (${lendingManifest.chainId}) at block ${lendingManifest.deploymentBlock}`);
      logger.info("Lending indexing is disabled in the API process; start it explicitly with npm run backend:indexer.");
    });
  } catch (err) {
    logger.error(`Server startup aborted: ${err.message}`);
    process.exit(1);
  }
})();
