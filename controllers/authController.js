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
const Address = require("../models/Address");
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

    // Mark user verified and push notification
    const now = new Date();
    const notif = {
      message: `Login successful via OTP.`,
      read: false,
      createdAt: now
    };

    user.notifications = user.notifications || [];
    user.notifications.push(notif);
    if (!user.isVerified) user.isVerified = true;
    await user.save();

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      notifications: user.notifications
    };

    // remove OTP entry
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

function getSessionUserId(req) {
  if (!req.session || !req.session.user) return null;
  return req.session.user.id || req.session.user._id || req.session.user;
}

exports.removeNotification = async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const notificationId = req.params.id;

    if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });
    if (!notificationId) return res.status(400).json({ success: false, message: "Notification id is required" });

    // Use $pull to atomically remove
    const updated = await User.findByIdAndUpdate(
      userId,
      { $pull: { notifications: { _id: notificationId } } },
      { new: true, select: 'notifications' }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "User not found" });

    // If no change (notification didn't exist), return 404
    const stillHas = (updated.notifications || []).some(n => String(n._id) === String(notificationId));
    if (stillHas) {
      // unlikely because $pull should remove, but defensive
      return res.status(500).json({ success: false, message: "Failed to remove notification" });
    }

    // Update session copy so template rendering or other session reads are current
    if (req.session && req.session.user) {
      req.session.user.notifications = updated.notifications;
    }

    return res.json({ success: true, message: "Notification removed", notifications: updated.notifications });

  } catch (err) {
    console.error("REMOVE NOTIFICATION ERROR:", err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
};

exports.removeAllNotifications = async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { notifications: [] } },
      { new: true, select: 'notifications' }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "User not found" });

    if (req.session && req.session.user) req.session.user.notifications = [];

    return res.json({ success: true, message: "All notifications removed", notifications: [] });

  } catch (err) {
    console.error("REMOVE ALL NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const sessionUser = req.session.user;
    if (!sessionUser || !sessionUser.id)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    const userId = sessionUser.id;
    const { name, email, phone } = req.body;

    // Build update object ONLY with non-empty values
    const updateData = {};
    if (name && name.trim() !== "") updateData.name = name.trim();
    if (email && email.trim() !== "") updateData.email = email.trim();
    if (phone && phone.trim() !== "") updateData.phone = phone.trim();

    // Track changed fields for notification
    const changedFields = [];
    if (updateData.name && updateData.name !== sessionUser.name) changedFields.push("name");
    if (updateData.email && updateData.email !== sessionUser.email) changedFields.push("email");
    if (updateData.phone && updateData.phone !== sessionUser.phone) changedFields.push("phone");

    // Validate uniqueness (email, phone)
    if (updateData.email) {
      const exists = await User.findOne({ email: updateData.email, _id: { $ne: userId } });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another account"
        });
      }
    }

    if (updateData.phone) {
      const exists = await User.findOne({ phone: updateData.phone, _id: { $ne: userId } });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use by another account"
        });
      }
    }

    // If there are changes, push notification about them
    let notification = null;
    if (changedFields.length > 0) {
      // Create a notification message
      let notifMsg = "Profile updated: ";
      notifMsg += changedFields
        .map(field =>
          field === "name"
            ? "Name"
            : field === "email"
            ? "Email"
            : field === "phone"
            ? "Phone"
            : field
        )
        .join(", ");
      notification = {
        _id: new mongoose.Types.ObjectId(),
        message: notifMsg,
        type: "profile_update",
        createdAt: new Date(),
        read: false
      };

      // Add the notification to updateData
      updateData.$push = { notifications: notification };
    }

    // Prepare update operations
    let updateOperation = {};
    if (Object.keys(updateData).length > 0) {
      // Separate direct fields and $push if needed
      Object.keys(updateData).forEach(key => {
        if (key !== '$push') {
          if (!updateOperation.$set) updateOperation.$set = {};
          updateOperation.$set[key] = updateData[key];
        }
      });
      if (updateData.$push) updateOperation.$push = updateData.$push;
    }

    // Perform update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateOperation,
      { new: true }
    ).lean();

    if (!updatedUser)
      return res.status(404).json({ success: false, message: "User not found" });

    // Update session info
    req.session.user.name = updatedUser.name;
    req.session.user.email = updatedUser.email;
    req.session.user.phone = updatedUser.phone;
    req.session.user.notifications = updatedUser.notifications;

    let response = {
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    };
    if (notification) {
      response.notification = notification;
    }

    return res.json(response);

  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listAddresses = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const addresses = await Address.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    const formatted = addresses.map(addr => ({
      _id: addr._id,
      userId: addr.userId,

      name: `${addr.firstName || ""} ${addr.lastName || ""}`.trim(),
      email: addr.email || "",
      phone: addr.phone || "",

      line1: addr.addressLine1 || "",
      line2: addr.addressLine2 || "",

      country: addr.country || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.zipCode || "",

      isDefault: Boolean(addr.isDefault),
      addressType: addr.addressType || "home",

      createdAt: addr.createdAt,
      updatedAt: addr.updatedAt
    }));

    return res.json({
      success: true,
      addresses: formatted
    });

  } catch (err) {
    console.error("LIST ADDRESS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



exports.createAddress = async (req, res) => {

  try {
    const userId = req.session.user.id;

    const {
      name,         
      email,
      phone,
      line1,      
      addressLine2 = "",
      country,
      state,
      city,
      pincode,   
      addressType,
      isDefault
    } = req.body;

    let firstName = "";
    let lastName = "";

    if (typeof name === "string" && name.trim() !== "") {
      const parts = name.trim().split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }

    const hasDefault = await Address.exists({ userId, isDefault: true });

    const address = await Address.create({
      userId,
      firstName,
      lastName,
      email,
      phone,
      addressLine1: line1,  
      addressLine2,
      country,
      state,
      city,
      zipCode: pincode,   
      addressType: addressType || "home",
      isDefault: typeof isDefault === "boolean" ? isDefault : !hasDefault
    });

    return res.json({
      success: true,
      message: "Address added successfully",
      address
    });

  } catch (err) {
    console.error("CREATE ADDRESS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.updateAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address)
      return res.status(404).json({ success: false, message: "Address not found" });

    const {
      name,
      email,
      phone,
      line1,
      addressLine2,
      country,
      state,
      city,
      pincode,
      addressType,
      isDefault
    } = req.body;

    // split name
    if (typeof name === "string" && name.trim() !== "") {
      const parts = name.trim().split(" ");
      address.firstName = parts[0];
      address.lastName = parts.slice(1).join(" ");
    }

    address.email = email || address.email;
    address.phone = phone || address.phone;
    address.addressLine1 = line1 || address.addressLine1;
    address.addressLine2 = addressLine2 || address.addressLine2;
    address.country = country || address.country;
    address.state = state || address.state;
    address.city = city || address.city;
    address.zipCode = pincode || address.zipCode;
    address.addressType = addressType || address.addressType;

    if (typeof isDefault === "boolean") {
      address.isDefault = isDefault;
    }

    await address.save();

    return res.json({
      success: true,
      message: "Address updated successfully",
      address
    });

  } catch (err) {
    console.error("UPDATE ADDRESS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address)
      return res.status(404).json({ success: false, message: "Address not found" });

    const wasDefault = address.isDefault;

    await Address.deleteOne({ _id: addressId });

    // If deleted address was default, assign another as default
    if (wasDefault) {
      const another = await Address.findOne({ userId }).sort({ createdAt: 1 });
      if (another) {
        another.isDefault = true;
        await another.save();
      }
    }

    return res.json({
      success: true,
      message: "Address deleted successfully"
    });

  } catch (err) {
    console.error("DELETE ADDRESS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.markDefault = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address)
      return res.status(404).json({ success: false, message: "Address not found" });

    // Remove default flag from all user addresses
    await Address.updateMany({ userId }, { $set: { isDefault: false } });

    // Set chosen one as default
    address.isDefault = true;
    await address.save();

    return res.json({
      success: true,
      message: "Default address updated successfully"
    });

  } catch (err) {
    console.error("MARK DEFAULT ADDRESS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};