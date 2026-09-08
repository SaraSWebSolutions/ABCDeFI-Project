const nodemailer = require("nodemailer");
const logger = require("../logger");

let transporter = null;

try {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure:
        String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
  }
} catch (err) {
  logger.warn(`SMTP Transporter initialization warning: ${err.message}`);
}

module.exports = async function sendMail({ to, subject, html }) {
  const environment = String(process.env.NODE_ENV || "").toLowerCase();
  const developmentAuthentication = environment !== "production"
    && String(process.env.AUTH_MODE || "").toLowerCase() === "development";

  // Development login OTPs are printed by the authenticated login controller.
  // This mailer never sends a development authentication message or fabricates
  // delivery when SMTP is absent.
  if (developmentAuthentication) {
    return { suppressed: true };
  }

  // PRODUCTION:
  // Actually send email through SMTP.
  if (!transporter) {
    throw new Error("SMTP Transporter not configured or missing credentials");
  }

  return await transporter.sendMail({
    from: `"ABCDeFi" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};
