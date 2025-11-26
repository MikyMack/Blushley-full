const Reseller = require('../models/Reseller');
const User = require('../models/User');
const bcrypt = require("bcrypt");
const { uploadBuffer } = require("../config/s3");
const Otp = require('../models/Otp');
const { genOtp,verifyOtpHash } = require("../services/otpService");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const OTP_TTL_MINUTES = 5;
const ADMIN_EMAIL = process.env.SMTP_USER;
const ADMIN_PASSWORD = process.env.SMTP_PASS;

exports.registerPage = (req, res) => {
    return res.render("user/userLogin");
  };
  
  exports.registerReseller = async (req, res) => {
  
    try {
      const {
        companyName,
        gstNumber,       
        contactPerson,   
        phone,
        email,
        address,
        city,
        state,
        pincode,
        googleMapLink,
        businessDescription
      } = req.body;
  
      if (!companyName || !email || !phone) {
        return res.status(400).json({ error: "Company, email and phone are required" });
      }
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: "Email already registered" });
      }
  
      // ✅ UPLOAD DOCUMENTS
      let documents = [];
      if (req.files?.documents) {
        const docsArr = Array.isArray(req.files.documents)
          ? req.files.documents
          : [req.files.documents];
  
        for (const file of docsArr) {
          const uploaded = await uploadBuffer(file.buffer, {
            KeyPrefix: "resellers/documents/",
            contentType: file.mimetype
          });
  
          documents.push({
            name: file.originalname,
            url: uploaded.location,
            uploadedAt: new Date()
          });
        }
      }
  
      // ✅ Default Warehouse Creation
      const defaultWarehouse = {
        name: companyName + " Main Warehouse",
        address,
        city,
        state,
        pincode,
        phone,
        businessDescription,
        googleMapLink: googleMapLink || null,
        isDefault: true
      };
  
      // ✅ Create User
      const newUser = await User.create({
        name: contactPerson || companyName,
        email,
        phone,
        role: "reseller",
        status: "pending"
      });
  
      // ✅ Create Reseller
      const reseller = await Reseller.create({
        userId: newUser._id,
  
        companyName,
        gstNo: gstNumber,              // ✅ Mapped correctly
        contactName: contactPerson,    // ✅ Mapped correctly
        phone,
        email,
  
        documents,
  
        warehouses: [defaultWarehouse],
  
        status: "pending",
  
        totalSales: 0,
        totalOrders: 0,
        totalEarnings: 0
      });
  
      res.json({
        success: true,
        message: "Registration successful. Awaiting admin approval",
        reseller
      });
  
    } catch (err) {
      console.error("Reseller Register Error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  };
  
  
  exports.sendLoginOtp = async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: "Email is required" });
      }

      const reseller = await Reseller.findOne({ email });

      if (!reseller) {
        return res.status(404).json({
          success: false,
          message: "Reseller not found. Please register first."
        });
      }

      const { otp, storedHash } = genOtp();

      await Otp.create({
        phone: email,
        otpHash: storedHash,
        purpose: "reseller_login",
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60000)
      });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: ADMIN_EMAIL,
          pass: ADMIN_PASSWORD
        }
      });

      await transporter.sendMail({
        from: `"Blushley Login" <${ADMIN_EMAIL}>`,
        to: email,
        subject: "🚀 Your Blushley Reseller Login OTP is Here!",
        html: `
          <div style="font-family: Arial, sans-serif; color: #363636; padding: 24px;">
            <h2>✨ Welcome Back, Reseller! ✨</h2>
            <p>Your magic key to login:</p>
            <div style="margin:28px 0;">
              <span style="font-size: 2em; font-weight: bold; color: #D6336C; letter-spacing: 4px;">
                ${otp}
              </span>
            </div>
            <p style="margin-bottom: 0;">This OTP unlocks your Blushley dashboard for <b>5 minutes</b> only!</p>
            <p style="font-size:0.95em; color: #888; margin-top:8px;">Need help? Reach out to our team. Shine on! 💖</p>
          </div>
        `
      });

      return res.json({
        success: true,
        message: "OTP sent to your email.",
        email
      });

    } catch (err) {
      console.error("Reseller send OTP error:", err);
      return res.status(500).json({ success: false, message: "OTP send failed" });
    }
  };

  /* ---------------- VERIFY LOGIN OTP ---------------- */
  exports.verifyLoginOtp = async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ success: false, message: "Email and OTP required" });
      }

      const otpDoc = await Otp.findOne({
        phone: email,
        purpose: "reseller_login"
      }).sort({ createdAt: -1 });

      if (!otpDoc) {
        return res.status(400).json({ success: false, message: "OTP expired or invalid" });
      }

      const valid = verifyOtpHash(otp, otpDoc.otpHash);

      if (!valid) {
        otpDoc.attempts += 1;
        await otpDoc.save();
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      const reseller = await Reseller.findOne({ email }).populate("userId");

      if (!reseller) {
        return res.status(404).json({ success: false, message: "Reseller account not found" });
      }

      /* 🔐 ADMIN APPROVAL CHECK */
      if (reseller.status !== "approved") {
        let statusMessage = "";

        if (reseller.status === "pending")
          statusMessage = "Your account is still under admin review.";
        else if (reseller.status === "rejected")
          statusMessage = "Your reseller application was rejected.";
        else if (reseller.status === "inactive")
          statusMessage = "Your account is currently inactive. Contact support.";

        return res.status(403).json({
          success: false,
          status: reseller.status,
          message: statusMessage
        });
      }

      const user = reseller.userId;

      req.session.user = {
        _id: user._id,
        name: user.name || reseller.contactName || reseller.companyName,
        email: user.email,
        phone: user.phone,
        role: "reseller",
        resellerId: reseller._id
      };

      await Otp.deleteMany({ phone: email, purpose: "reseller_login" });

      return res.json({
        success: true,
        message: "Login successful",
        redirect: "/reseller/reseller_dashboard"
      });

    } catch (err) {
      console.error("Reseller verify OTP error:", err);
      return res.status(500).json({
        success: false,
        message: "OTP verification failed"
      });
    }
  };

  exports.approveReseller = async (req, res) => {
    try {
      const { resellerId } = req.params;
      const { status, rejectionReason } = req.body;

      // Validate required fields
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const allowedStatuses = ['pending', 'approved', 'rejected', 'disabled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(", ")}` });
      }

      // Check admin session
      if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Unauthorized. Please log in." });
      }

      // Handle hardcoded admin ID
      let adminId = req.session.user._id;
      if (adminId === "admin") {
        adminId = "000000000000000000000001";
      }

      // Validate adminId format
      if (!adminId || typeof adminId !== "string" || !/^[a-f\d]{24}$/i.test(adminId)) {
        return res.status(500).json({
          error: "Invalid admin ID format: " + JSON.stringify(adminId)
        });
      }

      const reseller = await Reseller.findById(resellerId);
      if (!reseller) {
        return res.status(404).json({ error: "Reseller not found" });
      }

      // Only update if status has changed
      if (reseller.status !== status) {
        reseller.status = status;
        reseller.verifiedAt = new Date();
        reseller.verifiedByAdmin = new mongoose.Types.ObjectId(adminId);

        // Handle rejection reason
        if (status === "rejected") {
          if (!rejectionReason || rejectionReason.trim() === '') {
            return res.status(400).json({ error: "Rejection reason is required when rejecting a reseller" });
          }
          reseller.rejectionReason = rejectionReason.trim();
        } else {
          reseller.rejectionReason = undefined;
        }

        await reseller.save();

        // Update linked user status
        if (reseller.userId) {
          let userStatusUpdate = {};

          if (status === "approved") {
            userStatusUpdate = {
              status: "active",
              isVerified: true,
              role: "reseller"
            };
          } else if (status === "rejected" || status === "disabled") {
            userStatusUpdate = {
              status: "inactive",
              isVerified: false
            };
          } else if (status === "pending") {
            userStatusUpdate = {
              status: "pending",
              isVerified: false
            };
          }

          await User.findByIdAndUpdate(reseller.userId, userStatusUpdate);
        }

        await sendResellerStatusEmail(reseller, status, rejectionReason);
      }

      res.json({
        success: true,
        status: reseller.status,
        message: `Reseller status updated to '${reseller.status}' successfully.`
      });

    } catch (err) {
      console.error("Error updating reseller status:", err);
      res.status(500).json({ error: "Status update failed: " + err.message });
    }
  };

  async function sendResellerStatusEmail(reseller, status, rejectionReason = '') {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      let subject, html;

      if (status === "approved") {
        subject = "You're In! 🎉 Welcome to the Blushley Reseller Family";
        html = `
          <div style="max-width:460px;margin:auto;border-radius:16px;overflow:hidden;box-shadow:0 3px 24px 0 rgba(120,35,120,0.14);border:1.5px solid #e4dffa;font-family:system-ui,sans-serif;">
            <div style="background:linear-gradient(90deg, #ff85a2 0, #a583fe 100%);padding:32px 0 18px 0;text-align:center;">
              <h1 style="margin:0;font-weight:800;color:white;font-size:2em;">Welcome Aboard!</h1>
              <p style="color:white;font-size:19px;margin:12px 0 0 0;font-weight:500;">Blushley Reseller Partner</p>
            </div>
            <div style="padding:30px 36px 26px 36px;text-align:center;">
              <img src="https://cdn-icons-png.flaticon.com/512/484/484582.png" width="72" alt="Confetti" style="margin-bottom:14px;">
              <p style="font-size:18px;color:#433d5b;margin-bottom:20px;">
                Hi <b>${reseller.contactName}</b> 👋,<br>
                Great news! Your reseller account for <b>${reseller.companyName}</b> has <span style="color:#19be71;font-weight:700">rocketed to Approval</span>. 🚀<br>
                <br>We can't wait for you to start your profit journey with us.<br>
                <span style="color:#b50957;">Your dashboard awaits!</span>
              </p>
              <a href="https://blushley.com/reseller/dashboard"
                 style="background:#753abf;color:white;padding:15px 42px;border-radius:7px;font-size:18px;font-weight:700;text-decoration:none;display:inline-block;margin-top:8px;">
                Go to Dashboard
              </a>
              <div style="margin-top:24px;font-size:15px;color:#7a36cb">See you at the top!<br><b>Team Blushley</b></div>
            </div>
            <div style="font-size:13.5px;color:#a59acf;text-align:center;padding-bottom:14px;background:#f9f6ff;">
              &copy; ${new Date().getFullYear()} Blushley. You're officially a success partner!
            </div>
          </div>
        `.replace(/\s{2,}/g, ' ');
      } else if (status === "pending") {
        subject = "Your Application is In Review! 🧐";
        html = `
          <div style="max-width:460px;margin:auto;border-radius:13px;overflow:hidden;box-shadow:0 2px 16px 0 rgba(153,102,153,0.10);border:1.2px solid #eee;font-family:system-ui,sans-serif;">
            <div style="background:#fae0f1;padding:26px 0;text-align:center;">
              <h2 style="margin:0;color:#753abf;font-weight:700;">Hang Tight, ${reseller.contactName.split(' ')[0]}</h2>
            </div>
            <div style="padding:28px 26px 18px 26px;text-align:center;">
              <img src="https://cdn-icons-png.flaticon.com/512/565/565547.png" width="54" style="margin-bottom:12px;">
              <p style="font-size:17px;color:#753abf;margin-bottom:18px;font-weight:500;">
                Your reseller application for <b>${reseller.companyName}</b> has been received.<br>
                Our team is reviewing it closely.<br><br>
              </p>
              <span style="color:#8873e6;font-size:15px;">You'll hear from us soon—watch your inbox for updates!</span>
            </div>
            <div style="font-size:13px;color:#a78bb8;text-align:center;padding-bottom:12px;">
              &copy; ${new Date().getFullYear()} Blushley. We value your enthusiasm!
            </div>
          </div>
        `.replace(/\s{2,}/g, ' ');
      } else if (status === "rejected") {
        subject = "We’re Sorry: Your Blushley Reseller Application Update 💬";
        html = `
          <div style="max-width:460px;margin:auto;border-radius:13px;overflow:hidden;box-shadow:0 2px 16px 0 rgba(213,94,94,0.12);border:1.2px solid #ffeeee;font-family:system-ui,sans-serif;">
            <div style="background:linear-gradient(90deg,#fee7e7 0,#ffe0e9 100%);padding:26px 0;text-align:center;">
              <h2 style="margin:0;color:#e6385d;font-weight:750;">Important Update</h2>
            </div>
            <div style="padding:29px 30px 24px 30px;text-align:center;">
              <img src="https://cdn-icons-png.flaticon.com/512/463/463612.png" width="60" alt="Alert" style="margin-bottom:13px;">
              <p style="font-size:16.5px;color:#69343e;margin-bottom:20px;">
                Hi <b>${reseller.contactName}</b>,<br>
                Thank you for your interest in partnering with us as a reseller at <b>${reseller.companyName}</b>.<br><br>
                <span style="color:#f24468;font-weight:700;">We’re unable to approve your application at this time.</span>
                ${rejectionReason ? `<div style="margin:10px auto 0 auto;color:#d10d39;padding:8px 10px 7px 10px;border-radius:7px;font-weight:bold;background:#fff7f7;font-size:15px;max-width:330px;">
                  <b>Reason:</b> ${rejectionReason}
                </div>` : ''}
                <br>
                If you have questions or believe this decision needs clarification,<br> please reach out to us. We’d love to hear from you!
              </p>
              <a href="mailto:support@blushley.com"
                 style="background:#e6385d;color:white;padding:12px 30px;border-radius:6px;font-size:16px;font-weight:600;text-decoration:none;display:inline-block;margin-top:8px;">
                Contact Support
              </a>
            </div>
            <div style="font-size:13px;color:#d68a9f;text-align:center;padding-bottom:13px;background:#fff7fa;">
              &copy; ${new Date().getFullYear()} Blushley. You’re always welcome to apply in the future!
            </div>
          </div>
        `.replace(/\s{2,}/g, ' ');
      } else if (status === "disabled") {
        subject = "Your Blushley Reseller Account Has Been Disabled";
        html = `
          <div style="max-width:440px;margin:auto;border-radius:13px;overflow:hidden;box-shadow:0 2px 16px 0 rgba(90,52,120,0.12);border:1.2px solid #eef0fa;font-family:system-ui,sans-serif;">
            <div style="background:#fdf6e9;padding:26px 0;text-align:center;">
              <h2 style="margin:0;color:#e59108;font-weight:600;">Account Disabled</h2>
            </div>
            <div style="padding:26px 26px 18px 26px;text-align:center;">
              <img src="https://cdn-icons-png.flaticon.com/512/1019/1019607.png" width="48" style="margin-bottom:12px;">
              <p style="font-size:16.5px;color:#775c2a;margin-bottom:15px;">
                Hello <b>${reseller.contactName}</b>,<br>
                Your reseller account (${reseller.companyName}) has been <span style="color:#e59108;font-weight:700;">disabled</span>.<br>
                If you believe this is in error or need more details, please write to us!
              </p>
              <a href="mailto:support@blushley.com"
                 style="background:#e59108;color:white;padding:10px 23px;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;margin-top:7px;">
                Reach Blushley Support
              </a>
            </div>
            <div style="font-size:13px;color:#c6a449;text-align:center;padding-bottom:12px;">
              &copy; ${new Date().getFullYear()} Blushley. Talk soon!
            </div>
          </div>
        `.replace(/\s{2,}/g, ' ');
      }

      if (reseller.email && html) {
        await transporter.sendMail({
          from: `"Blushley Team" <${process.env.SMTP_USER}>`,
          to: reseller.email,
          subject,
          html
        });
        console.log(`Catchy status email sent to ${reseller.email}`);
      }
    } catch (mailErr) {
      console.error("Reseller status email error:", mailErr);
      // Never fail the main request if email fails
    }
  }