const twilio = require("twilio");

const sendSms = async (phoneNumber, otp) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("SMS provider is not configured");
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body: `Your ABCDeFi verification OTP code is ${otp}. Valid for 10 minutes.`,
      from: fromNumber,
      to: phoneNumber,
    });
    console.log(`[TWILIO SMS SUCCESS] Message SID: ${message.sid} sent to ${phoneNumber}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error(`[TWILIO SMS ERROR] Failed to send SMS to ${phoneNumber}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = sendSms;
