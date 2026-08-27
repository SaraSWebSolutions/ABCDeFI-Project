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
  const isLocalDevelopment = environment === "development" || environment === "local";
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  // Development authentication uses an actual wallet signature instead of an
  // out-of-band OTP. Never turn a missing SMTP configuration into a logged or
  // fabricated email delivery path.
  if (isLocalDevelopment && !smtpConfigured) {
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
