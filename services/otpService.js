// services/otpService.js
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_SENDER = process.env.FAST2SMS_SENDER || 'FSTSMS';

// generate 6-digit OTP and return plain + hash
function genOtp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(otp).digest('hex');
  // store salt + hash together so we can verify: salt$hash
  return { otp, storedHash: `${salt}$${hash}` };
}

// verify plainOtp against stored storedHash string "salt$hash"
function verifyOtpHash(plainOtp, storedHash) {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split('$');
  const compare = crypto.createHmac('sha256', salt).update(plainOtp).digest('hex');
  return compare === hash;
}
// transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// email OTP sender
async function sendOtpEmail(email, otpPlain) {
  const html = `
    <h2>Your Blushley OTP</h2>
    <p>Your OTP is <strong>${otpPlain}</strong></p>
    <p>Valid for 5 minutes.</p>
  `;

  return transporter.sendMail({
    to: email,
    from: `Blushley <${process.env.SMTP_USER}>`,
    subject: "Blushley OTP Verification",
    html
  });
}
// send OTP using Fast2SMS
async function sendOtpSms(phone, otpPlain) {
  if (!FAST2SMS_KEY) throw new Error('FAST2SMS_API_KEY not set');

  const msg = `Your Blushley OTP is ${otpPlain}. Do not share with anyone.`;
  const payload = {
    route: "v3",
    sender_id: FAST2SMS_SENDER,
    message: msg,
    numbers: phone
  };

  const headers = {
    authorization: FAST2SMS_KEY,
    'Content-Type': 'application/json'
  };

  const resp = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, { headers, timeout: 10000 });
  return resp.data;
}

module.exports = {
  genOtp,
  verifyOtpHash,
  sendOtpSms,
  sendOtpEmail   
};
