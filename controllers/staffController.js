const User = require("../models/User");
const Otp = require("../models/Otp");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

// Helper to generate a catchy/fun OTP email
function generateCatchyOtpEmail(otp) {
  return `
    <div style="font-family: Arial, sans-serif">
      <h2 style="color:#e26ee5;">🚀 Welcome, Marvelous Staff Member! 🚀</h2>
      <p>
        Your one-time magic code for Blushelys is:
      </p>
      <div style="margin: 25px 0 20px 0; border: 2px dashed #e26ee5; background: #fcf7fe; padding: 16px; display:inline-block;">
        <span style="font-size: 32px; letter-spacing: 6px; font-weight: 600; color:#e26ee5;">${otp}</span>
      </div>
      <p>
        <b>Use this OTP to log in. It’s secret, it’s swift, and it disappears in 5 minutes! 💨</b>
      </p>
      <p>
        If this wasn’t you, ignore this email.<br>
        <span style="color:#e26ee5;">– The Blushelys Team</span>
      </p>
    </div>
  `;
}

// Setup Nodemailer transport using .env vars
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendStaffLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" });

    const staff = await User.findOne({ email, role: "staff" });

    if (!staff)
      return res.status(404).json({ success: false, message: "Staff not found" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Save or Update OTP entry
    await Otp.findOneAndUpdate(
      { email, purpose: "staff_login" },
      {
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 min
      },
      { upsert: true, new: true }
    );

    // Send catchy OTP Email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "✨ Your Blushelys Staff Login OTP is Here! ✨",
      html: generateCatchyOtpEmail(otp)
    });

    return res.json({
      success: true,
      message: "OTP sent to registered staff email"
    });

  } catch (err) {
    console.error("STAFF OTP SEND ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyStaffLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ success: false, message: "Email & OTP required" });

    const otpEntry = await Otp.findOne({ email, purpose: "staff_login" });

    if (!otpEntry)
      return res.status(400).json({ success: false, message: "No OTP found or expired" });

    // Check expiry
    if (otpEntry.expiresAt < new Date())
      return res.status(400).json({ success: false, message: "OTP expired" });

    // Check attempts
    if (otpEntry.attempts >= 5) {
      return res.status(429).json({ success: false, message: "Too many attempts" });
    }

    // Validate OTP
    const isValid = await bcrypt.compare(otp, otpEntry.otpHash);
    if (!isValid) {
      await Otp.updateOne(
        { _id: otpEntry._id },
        { $inc: { attempts: 1 } }
      );
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // OTP is correct → login staff
    const staff = await User.findOne({ email });

    if (!staff || staff.role !== "staff")
      return res.status(403).json({ success: false, message: "Not authorized" });

    // Create session
    req.session.staff = {
      id: staff._id,
      email: staff.email,
      role: staff.role
    };

    // Remove OTP entry
    await Otp.deleteOne({ _id: otpEntry._id });

    return res.json({
      success: true,
      message: "Staff logged in successfully",
      redirect: "/staff/dashboard"
    });

  } catch (err) {
    console.error("STAFF OTP VERIFY ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
