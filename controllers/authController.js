// controllers/authController.js
const { body, validationResult } = require('express-validator');
const Otp = require('../models/Otp');
const User = require('../models/User');
const Salon = require('../models/Salon');
const mongoose = require("mongoose");
const {
  genOtp,
  sendOtpSms,
  verifyOtpHash,
  sendOtpEmail 
} = require('../services/otpService');

const bcrypt = require('bcryptjs');
const nodemailer = require("nodemailer");

// === ENV Admin Login ===
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ;

const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;


exports.sendOtp = async (req, res) => {
  const { phone, email, purpose = "login" } = req.body;

  if (!phone && !email) {
    return res.status(400).json({ error: "Phone or email is required" });
  }

  try {
    const { otp, storedHash } = genOtp();

    await Otp.create({
      phone: phone || email,
      otpHash: storedHash,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60000)
    });

    if (phone) {
      await sendOtpSms(phone, otp);
    } else {
      await sendOtpEmail(email, otp);
    }

    return res.json({ ok: true, msg: "OTP sent successfully" });
  } catch (err) {
    console.error("sendOtp error:", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};


exports.verifyOtp = async (req, res) => {
  const { phone, email, otp, purpose = "login" } = req.body;

  const identifier = phone || email;
  if (!identifier) {
    return res.status(400).json({ error: "Phone or email required" });
  }

  try {
    const otpDoc = await Otp.findOne({ phone: identifier, purpose })
      .sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ error: "OTP expired or invalid" });
    }

    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ error: "Too many attempts" });
    }

    const valid = verifyOtpHash(otp, otpDoc.otpHash);
    if (!valid) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Delete OTP after success
    await Otp.deleteMany({ phone: identifier, purpose });

    let user = await User.findOne({ email });

    /* ---------- ROLE LOGIC ----------- */
    if (purpose === "freelancer_verify") {

      user = await User.findOneAndUpdate(
        { email },
        { isVerified: true, role: "freelancer" },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        role: "freelancer",
        status: "pending",
        message: "OTP verified. Your freelancer profile is under admin review."
      });
    }

    if (purpose === "reseller_verify") {

      user = await User.findOneAndUpdate(
        { email },
        { isVerified: true, role: "reseller" },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        role: "reseller",
        status: "pending",
        message: "OTP verified. Your reseller account is under admin review."
      });
    }

    /* ---------- NORMAL USER LOGIN ----------- */
    if (phone && purpose === "login") {
      user = await User.findOneAndUpdate(
        { phone },
        { isVerified: true },
        { new: true, upsert: true }
      );

      req.session.user = {
        _id: user._id,
        name: user.name || "",
        phone: user.phone,
        email: user.email,
        role: user.role || "user"
      };

      return res.redirect("/user/dashboard");
    }

    /* ---------- SALON LOGIN ----------- */
    if (user && user.role === "salon") {
      return res.redirect("/salon/dashboard");
    }

    return res.redirect("/user/dashboard");

  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ error: "OTP verification failed" });
  }
};



exports.logout = async (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("Session destroy error:", err);
    res.clearCookie("blushley.sid");
    return res.redirect("/");
  });
};


exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(400).render("admin/adminLogin", { error: "Invalid admin credentials" });
  }

 
  const fixedAdminId = new mongoose.Types.ObjectId('000000000000000000000001');

  req.session.user = {
    _id: fixedAdminId.toString(), 
    name: "Super Admin",
    email: ADMIN_EMAIL,
    role: "admin"
  };

  return res.redirect("/admin/dashboard");
};


exports.salonLogin = async (req, res) => {
  const { username, password } = req.body;

  const salon = await Salon.findOne({ username });
  if (!salon) return res.status(400).render("salon/login", { error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, salon.passwordHash || "");
  if (!ok) return res.status(400).render("salon/login", { error: "Invalid credentials" });

  req.session.user = {
    _id: salon._id,
    name: salon.name,
    role: "salon"
  };

  return res.redirect("/salon/dashboard");
};


exports.makeUserStaff = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent changing roles of admin/superadmin
    if (["admin", "superadmin"].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: "Cannot change role of admin or superadmin"
      });
    }

    // Update the role
    user.role = "staff";
    await user.save();

    return res.json({
      success: true,
      message: `User promoted to staff successfully`,
      user
    });

  } catch (err) {
    console.error("MAKE STAFF ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
};

exports.removeStaffRole = async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "staff") {
      return res.status(400).json({
        success: false,
        message: "User is not a staff member"
      });
    }

    user.role = "user";
    await user.save();

    return res.json({
      success: true,
      message: "Staff role removed successfully",
      user
    });

  } catch (err) {
    console.error("REMOVE STAFF ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Prevent blocking superadmin or admin
    if (["admin", "superadmin"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Cannot block admin or superadmin"
      });
    }

    user.isBlocked = true;
    await user.save();

    res.json({
      success: true,
      message: "User blocked successfully",
      user
    });

  } catch (err) {
    console.error("BLOCK USER ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    user.isBlocked = false;
    await user.save();

    res.json({
      success: true,
      message: "User unblocked successfully",
      user
    });

  } catch (err) {
    console.error("UNBLOCK USER ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.sendUserLoginOtp = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email)
      return res.status(400).json({ success: false, message: "Name & Email required" });

    // Check if user exists
    let user = await User.findOne({ email });

    // Auto-create user if not exist
    if (!user) {
      user = await User.create({
        name,
        email,
        role: "user",
        isVerified: false
      });
    }

    if (user.isBlocked)
      return res.status(403).json({ success: false, message: "User is blocked" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Save OTP
    await Otp.findOneAndUpdate(
      { email, purpose: "user_login" },
      {
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      },
      { upsert: true, new: true }
    );

    // SETUP LOCAL transporter here (nodemailer) so it's always defined:
    const transporter = require("nodemailer").createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email template
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff4fa; padding: 32px; border-radius:14px; border:1px solid #f3a7be; max-width: 480px; margin: 0 auto;">
        <div style="text-align:center;">
          <img src="https://blushley.com/images/logo/logoggg.png" alt="Blushley Logo" style="height: 50px; margin-bottom: 12px;" />
        </div>
        <h2 style="color: #f01c38; text-align:center; margin-bottom: 0;">Welcome to Blushley!</h2>
        <p style="text-align:center; font-size: 1.15em; color: #333;">Hi <b>${name}</b>,</p>
        <div style="background: #fbdfeb; border-radius: 8px; padding: 18px 0; margin: 24px 0;">
          <span style="display: block; color:#8e2378; font-size: 1em; letter-spacing: 0.1em; margin-bottom: 8px; text-align:center;">
            Your One-Time Password (OTP):
          </span>
          <span style="display: block; color: #f01c38; font-size: 2.4em; letter-spacing: 14px; font-weight: bold; text-align:center;">
            ${otp}
          </span>
        </div>
        <p style="font-size:1em; color: #333; text-align:center;">
          Please enter this OTP to verify your login.<br>
          <span style="color: #8e2378;">This code is valid for <b>5 minutes</b>.</span>
        </p>
        <p style="margin-top:32px; text-align:center; color:#888; font-size:.98em;">
          Need help? Contact <a href="mailto:support@blushley.com" style="color:#f01c38;text-decoration:underline;">support@blushley.com</a>
        </p>
        <div style="margin-top:20px;text-align:center;font-size:.9em;color:#bbb;">&mdash; The Blushley Team &mdash;</div>
      </div>
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "Your Login OTP",
      html
    });

    return res.json({
      success: true,
      message: "OTP sent to your email"
    });

  } catch (err) {
    console.error("USER LOGIN OTP ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyUserLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ success: false, message: "Email & OTP required" });

    const otpEntry = await Otp.findOne({ email, purpose: "user_login" });

    if (!otpEntry)
      return res.status(400).json({ success: false, message: "OTP expired or not found" });

    // OTP expiry check
    if (otpEntry.expiresAt < new Date())
      return res.status(400).json({ success: false, message: "OTP expired" });

    // Attempt check
    if (otpEntry.attempts >= 5)
      return res.status(429).json({ success: false, message: "Too many failed attempts" });

    const isValid = await bcrypt.compare(otp, otpEntry.otpHash);
    if (!isValid) {
      await Otp.updateOne({ _id: otpEntry._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // OTP correct: Login user
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ success: false, message: "User record missing" });

    if (user.isBlocked)
      return res.status(403).json({ success: false, message: "User is blocked" });

    // Create session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Mark user verified
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    // Remove OTP
    await Otp.deleteOne({ _id: otpEntry._id });

    return res.json({
      success: true,
      message: "Logged in successfully",
      redirect: "/"
    });

  } catch (err) {
    console.error("USER LOGIN VERIFY ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

