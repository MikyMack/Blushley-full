const Freelancer = require('../models/Freelancer');
const User = require('../models/User');
const { uploadBuffer } = require("../config/s3");
const Otp = require("../models/Otp");
const { genOtp,verifyOtpHash } = require("../services/otpService");
const { sendOtpEmail } = require("../services/otpService");
const nodemailer = require("nodemailer");
const generateBookingToken = require('../utils/bookingToken');
const FreelancerBooking = require('../models/FreelancerBooking');

const OTP_TTL_MINUTES = 5;

const ADMIN_EMAIL = process.env.SMTP_USER;
const ADMIN_PASSWORD = process.env.SMTP_PASS;

const dayMap = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

exports.getFreelancerDashboard = async (req, res) => {
  try {
    const freelancerUserId = req.session.user._id;

    // Get freelancer profile
    const freelancer = await Freelancer.findOne({ userId: freelancerUserId });

    if (!freelancer) {
      return res.status(404).render('error', { error: "Freelancer profile not found" });
    }

    const freelancerId = freelancer._id;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    // Fetch all bookings for this freelancer
    const bookings = await FreelancerBooking.find({
      "freelancer.freelancerId": freelancerId
    }).sort({ createdAt: -1 });

    // Today's bookings
    const todaysBookings = await FreelancerBooking.find({
      "freelancer.freelancerId": freelancerId,
      bookingDate: { $gte: startOfDay, $lte: endOfDay }
    });

    // Pending confirmations
    const pendingBookings = await FreelancerBooking.find({
      "freelancer.freelancerId": freelancerId,
      status: "approved_by_admin"
    });

    // Completed bookings this month
    const completedThisMonth = await FreelancerBooking.find({
      "freelancer.freelancerId": freelancerId,
      status: "completed",
      updatedAt: { $gte: startOfMonth }
    });

    // Total earnings calculation
    const completedBookings = await FreelancerBooking.find({
      "freelancer.freelancerId": freelancerId,
      status: "completed",
      "payment.status": "paid"
    });

    const totalEarnings = completedBookings.reduce((total, booking) => {
      return total + (booking.service?.price || 0);
    }, 0);

    // Today's earnings
    const todayEarnings = todaysBookings
      .filter(b => b.status === "completed" && b.payment?.status === "paid")
      .reduce((sum, b) => sum + (b.service?.price || 0), 0);

    // Pending payout amount
    const pendingAmount = completedBookings
      .filter(b => b.payment?.status !== "paid")
      .reduce((sum, b) => sum + (b.service?.price || 0), 0);

    // Send everything to dashboard with proper defaults
    res.render("freelancer/beautician_dashboard", {
      freelancer: freelancer || {},
      allBookings: bookings || [],
      todaysBookings: todaysBookings || [],
      pendingConfirmations: pendingBookings || [],
      completedThisMonth: completedThisMonth?.length || 0,
      totalEarnings: totalEarnings || 0,
      todayEarnings: todayEarnings || 0,
      pendingAmount: pendingAmount || 0
    });

  } catch (error) {
    console.error("Freelancer Dashboard Error:", error);
    res.status(500).render('error', { error: "Failed to load dashboard" });
  }
};

exports.register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      bio,
      locations,
      availability,
      skillsArray,
      proofType,
      proofNumber
    } = req.body;

    const [existingUser, existingFreelancer] = await Promise.all([
      User.findOne({ email }),
      Freelancer.findOne({ email })
    ]);

    if (existingFreelancer) {
      return res.status(400).json({
        success: false,
        message: "You already applied as a freelancer with this email."
      });
    }

    let user;
    if (!existingUser) {
      user = await User.create({
        name: fullName,
        email,
        phone,
        role: "freelancer",
        isVerified: false
      });
    } else {
      user = existingUser;
      user.role = "freelancer";
      user.isVerified = false;
      await user.save();
    }

    let profileImageUrl = null;
    let portfolioUrls = [];

    if (req.files?.profileImage?.[0]) {
      const file = req.files.profileImage[0];
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "freelancers/profile/",
        contentType: file.mimetype
      });
      profileImageUrl = uploaded.location;
    }

    if (Array.isArray(req.files?.portfolioImages)) {
      for (let img of req.files.portfolioImages) {
        const uploaded = await uploadBuffer(img.buffer, {
          KeyPrefix: "freelancers/portfolio/",
          contentType: img.mimetype
        });
        portfolioUrls.push(uploaded.location);
      }
    }

    let parsedLocations = [];
    if (locations) {
      const locs = typeof locations === "string" ? JSON.parse(locations) : locations;
      parsedLocations = locs.map(loc => ({
        city: loc,
        state: "",
        pincode: "",
        radius: 5
      }));
    }

    let parsedAvailability = [];

    if (availability) {
      const raw = typeof availability === "string"
        ? JSON.parse(availability)
        : availability;

      parsedAvailability = raw.days.map(day => ({
        dayOfWeek: dayMap[day],
        slots: [{
          start: raw.start,
          end: raw.end
        }]
      }));
    }

    const parsedSkills = skillsArray ? JSON.parse(skillsArray) : [];

    const proof = {
      type: proofType,
      number: proofNumber
    };

    await Freelancer.create({
      userId: user._id,
      fullName,
      phone,
      email,
      bio,
      skills: parsedSkills,
      proof,
      profileImage: profileImageUrl,
      portfolioImages: portfolioUrls,
      locations: parsedLocations,
      availability: parsedAvailability,
      status: "pending"
    });

    const { otp, storedHash } = genOtp();

    await Otp.create({
      phone: email,
      otpHash: storedHash,
      purpose: "freelancer_verify",
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
      from: `"Blushley OTP" <${ADMIN_EMAIL}>`,
      to: email,
      subject: "✨ Your Freelancer OTP - Blushley ✨",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f3f5fa; padding:36px 0">
          <div style="max-width:490px; background:white; margin:auto; border-radius:12px; box-shadow:0 2px 10px #d9e1ea;">
            <div style="background:linear-gradient(90deg,#f17da8 0,#b589f5 100%); border-top-left-radius:12px; border-top-right-radius:12px; padding:24px; color:white; text-align:center;">
              <h2 style="margin:0; font-weight:bold;">Welcome to Blushley!</h2>
              <p style="margin:10px 0 0;">Verify your email to continue your freelance journey</p>
            </div>
            <div style="padding:30px 32px 24px 32px; text-align:center;">
              <p style="font-size:17px; margin:0 0 18px 0; color:#444;">To verify your account, please use the OTP below:</p>
              <div style="margin:18px auto 22px auto; display:inline-block; padding:18px 35px; font-size:29px; font-weight:700; letter-spacing:9px; color:#4d097c; background: #f8e9fa; border-radius:10px;">
                ${otp}
              </div>
              <p style="font-size:15px; color:#747b8a; margin:0 0 20px 0;">
                This OTP is valid for <b>5 minutes</b>.<br>
                Do not share your OTP with anyone for security reasons.
              </p>
              <a href="https://blushley.com" style="background:#e468a6; color:white; padding:11px 32px; border-radius:5px; font-size:16px; font-weight:600; text-decoration:none; margin-top:8px; display:inline-block;">Go to Blushley</a>
            </div>
            <div style="font-size:13px; color:#b1b6bf; text-align:center; padding-bottom:12px;">
              &copy; ${new Date().getFullYear()} Blushley. All rights reserved.
            </div>
          </div>
        </div>
      `.replace(/\s{2,}/g, ' ')
    });

    await transporter.sendMail({
      from: `"Blushley Admin" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: "New Freelancer Registration",
      html: `
        <h3>New Freelancer Application</h3>
        <p>Name: ${fullName}</p>
        <p>Email: ${email}</p>
        <p>Phone: ${phone}</p>
        <p>Skills: ${parsedSkills.join(", ")}</p>
        <p>Locations: ${parsedLocations.map(l => l.city).join(", ")}</p>
      `
    });

    return res.status(200).json({
      success: true,
      message: "Freelancer registered. OTP sent to your email.",
      email,
      purpose: "freelancer_verify"
    });

  } catch (err) {
    console.error("Freelancer register error:", err);
    return res.status(500).json({ success: false, message: "Registration failed" });
  }
};

exports.updateFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.findById(req.params.id);
    if (!freelancer) return res.status(404).json({ message: "Freelancer not found" });

    const {
      fullName,
      phone,
      email,
      bio,
      experience,
      skills,
      proofType,
      proofNumber,
      locations,
      availability,
      services,
      removedPortfolioImages,
      status
    } = req.body;

    // BASIC INFO
    freelancer.fullName = fullName || freelancer.fullName;
    freelancer.phone = phone || freelancer.phone;
    freelancer.email = email || freelancer.email;
    freelancer.bio = bio || freelancer.bio;

    // EXPERIENCE
    if (experience) {
      freelancer.experience = Number(experience) || 0;
    }

    // SKILLS
    if (skills) {
      freelancer.skills = Array.isArray(skills) ? skills : JSON.parse(skills);
    }

    // PROOF
    freelancer.proof = {
      type: proofType || freelancer.proof?.type,
      number: proofNumber || freelancer.proof?.number
    };

    // LOCATIONS
    if (locations) {
      const parsed = typeof locations === "string" ? JSON.parse(locations) : locations;
      freelancer.locations = parsed.map(loc => ({
        city: loc.city,
        state: loc.state || "",
        pincode: loc.pincode || "",
        radius: Number(loc.radius) || 5
      }));
    }

    // AVAILABILITY
    if (availability) {
      const parsed = typeof availability === "string" ? JSON.parse(availability) : availability;
      freelancer.availability = parsed
        .map(day => ({
          ...day,
          enabled: day.enabled === true || day.enabled === "true"
        }))
        .map(day => ({
          dayOfWeek: Number(day.dayOfWeek),
          enabled: day.enabled,
          slots: Array.isArray(day.slots) ? day.slots.map(slot => ({
            start: slot.start,
            end: slot.end
          })) : []
        }));
    }

    // SERVICES (rewrite all, preserving correct status)
    if (services) {
      const parsedServices = typeof services === "string" ? JSON.parse(services) : services;

      freelancer.freelancerServices = parsedServices.map(service => ({
        serviceId: service.serviceId,
        freelancerBasePrice: Number(service.freelancerBasePrice),
        adminPrice: Number(service.adminPrice),
        adminCommissionPercent: Number(service.adminCommissionPercent || 0),
        finalPrice: Number(service.finalPrice),
        durationMinutes: Number(service.durationMinutes),
        // Use supplied status ("approved", "pending", "rejected", etc.)
        status: typeof service.status !== "undefined" ? service.status : "pending"
      }));
    }

    // PROFILE IMAGE
    if (req.files?.profileImage?.[0]) {
      const file = req.files.profileImage[0];
      const uploaded = await uploadBuffer(file.buffer, {
        KeyPrefix: "freelancers/profile/",
        contentType: file.mimetype
      });
      freelancer.profileImage = uploaded.location;
    }

    // PORTFOLIO IMAGES
    if (removedPortfolioImages) {
      let toRemove = removedPortfolioImages;
      if (typeof toRemove === "string") {
        try {
          toRemove = JSON.parse(toRemove);
        } catch {
          toRemove = [toRemove];
        }
      }
      if (!Array.isArray(toRemove)) toRemove = [toRemove];

      if (freelancer.portfolioImages && Array.isArray(freelancer.portfolioImages)) {
        freelancer.portfolioImages = freelancer.portfolioImages.filter(
          img => !toRemove.includes(img)
        );
      }
    }
    if (req.files?.portfolioImages) {
      let portfolioUrls = [];
      for (let img of req.files.portfolioImages) {
        const uploaded = await uploadBuffer(img.buffer, {
          KeyPrefix: "freelancers/portfolio/",
          contentType: img.mimetype
        });
        portfolioUrls.push(uploaded.location);
      }
      freelancer.portfolioImages = [
        ...(freelancer.portfolioImages || []),
        ...portfolioUrls
      ];
    }

    // DOCUMENTS
    if (req.files?.documents) {
      const documentUrls = [];
      for (let doc of req.files.documents) {
        const uploaded = await uploadBuffer(doc.buffer, {
          KeyPrefix: "freelancers/documents/",
          contentType: doc.mimetype
        });
        documentUrls.push(uploaded.location);
      }
      freelancer.documents = documentUrls;
    }

    if (typeof status !== "undefined" && status !== null && status !== "") {
      freelancer.status = status;
    }

    await freelancer.save();

    res.json({
      success: true,
      message: "Freelancer updated successfully",
      freelancer
    });

  } catch (error) {
    console.error("Update Freelancer Error:", error);
    res.status(500).json({ message: "Failed to update freelancer" });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const freelancer = await Freelancer.findById(req.params.id);

    if (!freelancer) {
      return res.status(404).json({ message: "Freelancer not found" });
    }

    freelancer.status = status;

    if (status === "approved") {
      await User.findByIdAndUpdate(freelancer.userId, {
        isVerified: true,
        role: "freelancer"
      });
    }

    await freelancer.save();

    // Send status update email if approved or inactive
    if (status === "approved" || status === "inactive") {
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
        subject = "🎉 You're Now a Verified Blushley Freelancer!";
        html = `
          <div style="max-width:430px;margin:auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 32px 0 rgba(51,34,64,.12);border:1.2px solid #eee;font-family:system-ui,sans-serif;">
            <div style="background:linear-gradient(90deg, #ff85a2 0, #a583fe 100%);padding:26px 0;text-align:center;">
              <h2 style="margin:0;font-weight:700;color:white;">Congratulations!</h2>
            </div>
            <div style="padding:30px 32px 24px 32px;text-align:center;">
              <p style="font-size:18px;color:#444;margin-bottom:22px;">
                Hi <b>${freelancer.fullName}</b>,<br>
                Welcome aboard! Your freelancer profile has been <span style="color:#19be71;font-weight:600">approved</span> by the Blushley team.<br><br>
                You can now start offering your services, connect with clients, and shine in the Blushley community.<br>
                We're excited to have you with us 🚀✨
              </p>
              <a href="https://blushley.com/freelance/beautician_register" style="background:#753abf;color:white;padding:13px 36px;border-radius:6px;font-size:17px;font-weight:600;text-decoration:none;display:inline-block;margin-top:10px;">
                Start Your Journey
              </a>
            </div>
            <div style="font-size:14px;color:#8a95ad;text-align:center;padding-bottom:12px;">
              &copy; ${new Date().getFullYear()} Blushley. All rights reserved.
            </div>
          </div>
        `.replace(/\s{2,}/g, ' ');
      } else if (status === "inactive") {
        subject = "Account Status Update – Blushley Freelancer";
        html = `
          <div style="max-width:430px;margin:auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 32px 0 rgba(51,34,64,.12);border:1.2px solid #eee;font-family:system-ui,sans-serif;">
            <div style="background:linear-gradient(90deg, #ffd6d2 0, #efeefa 100%);padding:26px 0;text-align:center;">
              <h2 style="margin:0;font-weight:700;color:#bb2649;">Your Blushley freelance status is now Inactive</h2>
            </div>
            <div style="padding:30px 32px 24px 32px;text-align:center;">
              <p style="font-size:17px;color:#444;margin-bottom:22px;">
                Hi <b>${freelancer.fullName}</b>,<br>
                Your Blushley freelancer account status has been changed to <span style="color:#fa5858;font-weight:600">inactive</span>.<br>
                If you believe this was a mistake, or want to reactivate your status, please get in touch with our support team.<br>
                We're always here to assist you! 💌
              </p>
              <a href="tel:+917994907723" style="background:#bb2649;color:white;padding:11px 30px;border-radius:6px;font-size:16px;font-weight:600;text-decoration:none;display:inline-block;margin-top:8px;">
                Contact Support
              </a>
            </div>
            <div style="font-size:14px;color:#b1b6bf;text-align:center;padding-bottom:12px;">
              &copy; ${new Date().getFullYear()} Blushley. All rights reserved.
            </div>
          </div>
        `.replace(/\s{2,}/g, ' ');
      }

      if (freelancer.email) {
        try {
          await transporter.sendMail({
            from: `"Blushley Team" <${process.env.SMTP_USER}>`,
            to: freelancer.email,
            subject,
            html
          });
        } catch (mailErr) {
          console.error("Status Email Error:", mailErr);
        }
      }
    }

    res.json({
      success: true,
      message: `Freelancer status updated to ${status}`
    });

  } catch (error) {
    console.error("Status Update Error:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
};

exports.getFreelancerById = async (req, res) => {
  const freelancer = await Freelancer.findById(req.params.id).populate("userId");

  if (!freelancer) {
    return res.status(404).json({ message: "Freelancer not found" });
  }

  res.json(freelancer);
};

/* ---------- 5. Delete Freelancer ---------- */
exports.deleteFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.findById(req.params.id);
    if (!freelancer) return res.status(404).json({ message: "Freelancer not found" });

    await User.findByIdAndUpdate(freelancer.userId, {
      role: "user",
      isVerified: false
    });

    await Freelancer.deleteOne({ _id: freelancer._id });

    res.json({
      success: true,
      message: "Freelancer deleted successfully"
    });

  } catch (error) {
    console.error("Delete Freelancer Error:", error);
    res.status(500).json({ message: "Failed to delete freelancer" });
  }
};

exports.adminCreateFreelancer = async (req, res) => {
  try {
    // Extract fields from body
    const {
      fullName,
      phone,
      email,
      bio,
      skills,
      proofType,
      proofNumber,
      status,
      rating,
      totalReviews
    } = req.body;

    // For skills: can be string or array
    let skillsArr = [];
    if (skills) {
      if (Array.isArray(skills)) {
        skillsArr = skills;
      } else if (typeof skills === "string") {
        skillsArr = [skills];
      }
    }

    // Extract file uploads
    const profileImg = req.files && req.files.profileImage ? req.files.profileImage[0].path : undefined;
    const portfolioImgs = req.files && req.files.portfolioImages ? req.files.portfolioImages.map(f => f.path) : [];
    const documents = req.files && req.files.documents ? req.files.documents.map(f => f.path) : [];

    // Create a linked user if needed (assuming admin will provide userId for direct link)
    // Here, we'll throw error if userId is missing for forced relation (can be adapted)
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "UserId is required to link freelancer to user" });
    }

    // Compose freelancer data
    const freelancerObj = {
      userId,
      fullName,
      phone,
      email,
      bio,
      skills: skillsArr,
      proof: {
        type: proofType,
        number: proofNumber
      },
      profileImage: profileImg,
      portfolioImages: portfolioImgs,
      documents,
      status: status || "pending",
      rating: rating !== undefined ? Number(rating) : 0,
      totalReviews: totalReviews !== undefined ? Number(totalReviews) : 0
    };

    // Optionally handle: freelancerServices, locations, availability
    if (req.body.freelancerServices) {
      // Expects JSON string or array
      try {
        freelancerObj.freelancerServices = typeof req.body.freelancerServices === "string"
          ? JSON.parse(req.body.freelancerServices)
          : req.body.freelancerServices;
      } catch (e) {
        return res.status(400).json({ success: false, message: "Invalid freelancerServices format" });
      }
    }

    if (req.body.locations) {
      try {
        freelancerObj.locations = typeof req.body.locations === "string"
          ? JSON.parse(req.body.locations)
          : req.body.locations;
      } catch (e) {
        return res.status(400).json({ success: false, message: "Invalid locations format" });
      }
    }

    if (req.body.availability) {
      try {
        freelancerObj.availability = typeof req.body.availability === "string"
          ? JSON.parse(req.body.availability)
          : req.body.availability;
      } catch (e) {
        return res.status(400).json({ success: false, message: "Invalid availability format" });
      }
    }

    // Save freelancer
    const freelancer = await Freelancer.create(freelancerObj);

    // Optionally, update the linked user status/role to freelancer
    await User.findByIdAndUpdate(userId, { role: "freelancer", isVerified: true });

    res.status(201).json({
      success: true,
      message: "Freelancer created successfully",
      freelancer
    });
  } catch (err) {
    console.error("Admin create freelancer error:", err);
    res.status(500).json({ success: false, message: "Failed to create freelancer" });
  }
};


exports.sendLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const freelancer = await Freelancer.findOne({ email });

    if (!freelancer) {
      return res.status(404).json({
        success: false,
        message: "Freelancer not found. Please register first."
      });
    }

    const { otp, storedHash } = genOtp();

    await Otp.create({
      phone: email,
      otpHash: storedHash,
      purpose: "freelancer_login",
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
      subject: "🚀 Your Blushley Freelancer Login OTP is Here!",
      html: `
        <div style="font-family: Arial, sans-serif; color: #363636; padding: 24px;">
          <h2>✨ Welcome Back, Freelancer! ✨</h2>
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
    console.error("Freelancer send OTP error:", err);
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
      purpose: "freelancer_login"
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

    const freelancer = await Freelancer.findOne({ email }).populate("userId");

    if (!freelancer) {
      return res.status(404).json({ success: false, message: "Freelancer account not found" });
    }

    /* 🔐 ADMIN APPROVAL CHECK */
    if (freelancer.status !== "approved") {

      let statusMessage = "";

      if (freelancer.status === "pending")
        statusMessage = "Your account is still under admin review.";

      else if (freelancer.status === "rejected")
        statusMessage = "Your freelancer application was rejected.";

      else if (freelancer.status === "inactive")
        statusMessage = "Your account is currently inactive. Contact support.";

      return res.status(403).json({
        success: false,
        status: freelancer.status,
        message: statusMessage
      });
    }

    const user = freelancer.userId;

    req.session.user = {
      _id: user._id,
      name: user.name || freelancer.fullName,
      email: user.email,
      phone: user.phone,
      role: "freelancer",
      freelancerId: freelancer._id
    };

    await Otp.deleteMany({ phone: email, purpose: "freelancer_login" });

    return res.json({
      success: true,
      message: "Login successful",
      redirect: "/freelance/beautician_dashboard"
    });

  } catch (err) {
    console.error("Freelancer verify OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed"
    });
  }
};


exports.createBooking = async (req, res) => {
  try {
    const {
      freelancerId,
      serviceId,
      serviceName,
      durationMinutes,
      price,
      bookingDate,
      bookingTime,
      fullAddress,
      city,
      state,
      pincode,
      lat,
      lng,
      notes
    } = req.body;

    const freelancer = await Freelancer.findById(freelancerId);
    if (!freelancer) {
      return res.status(404).json({ success: false, message: "Freelancer not found" });
    }

    const token = generateBookingToken();

    const booking = await FreelancerBooking.create({

      bookingToken: token,

      user: {
        userId: req.session.user._id,
        name: req.session.user.name,
        phone: req.session.user.phone,
        email: req.session.user.email
      },

      freelancer: {
        freelancerId: freelancer._id,
        freelancerName: freelancer.fullName,
        freelancerPhone: freelancer.phone
      },

      service: {
        serviceId,
        serviceName,
        durationMinutes,
        price
      },

      address: {
        fullAddress,
        city,
        state,
        pincode,
        lat,
        lng
      },

      bookingDate: new Date(bookingDate),
      bookingTime,
      notes

    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully. Waiting for admin approval.",
      bookingToken: token
    });

  } catch (err) {
    console.error("Create Booking Error:", err);
    res.status(500).json({ success: false, message: "Booking creation failed" });
  }
};

exports.adminApproveBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action, message } = req.body;

    const booking = await FreelancerBooking.findById(bookingId);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (action === 'approve') {
      booking.status = "approved_by_admin";
    } else {
      booking.status = "rejected_by_admin";
    }

    booking.adminAction = {
      actionBy: req.session.user._id,
      actionAt: new Date(),
      message
    };

    await booking.save();

    res.json({
      success: true,
      message: `Booking ${booking.status}`
    });

  } catch (err) {
    console.error("Admin Approval Error:", err);
    res.status(500).json({ message: "Admin action failed" });
  }
};

exports.freelancerAcceptBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await FreelancerBooking.findById(bookingId);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.status !== "approved_by_admin") {
      return res.status(400).json({ message: "Booking not approved by admin yet" });
    }

    booking.status = "accepted_by_freelancer";
    booking.freelancerResponse.accepted = true;
    booking.freelancerResponse.respondedAt = new Date();

    await booking.save();

    res.json({ success: true, message: "Booking accepted" });

  } catch (err) {
    console.error("Freelancer Accept Error:", err);
    res.status(500).json({ message: "Failed to accept booking" });
  }
};

exports.getBookingDetails = async (req, res) => {
  try {
    const { bookingToken } = req.params;

    const booking = await FreelancerBooking.findOne({ bookingToken });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const userId = req.session.user && req.session.user._id ? req.session.user._id.toString() : null;
    if (
      booking.user.userId?.toString() !== userId &&
      booking.freelancer.freelancerId?.toString() !== userId
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, booking });
  } catch (err) {
    console.error("Get Booking Details Error:", err);
    res.status(500).json({ success: false, message: "Failed to get booking details" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const {
      fullName,
      professionalTitle,
      bio,
      experience,
      email,
      phone
    } = req.body;

    const freelancer = await Freelancer.findOne({ userId });
    if (!freelancer) return res.status(404).json({ message: "Profile not found" });

    freelancer.fullName = fullName;
    freelancer.bio = bio;
    freelancer.experience = Number(experience);
    freelancer.email = email;
    freelancer.phone = phone;
    freelancer.professionalTitle = professionalTitle; // ADD this field to schema

    await freelancer.save();

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Profile update failed" });
  }
};


// UPDATE AVAILABILITY
exports.updateAvailability = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { availability } = req.body; // array

    const freelancer = await Freelancer.findOne({ userId });

    freelancer.availability = availability.map(a => ({
      dayOfWeek: Number(a.dayOfWeek),
      slots: a.slots
    }));

    await freelancer.save();

    res.json({ success: true, message: "Availability updated" });
  } catch (err) {
    res.status(500).json({ error: "Availability update failed" });
  }
};


// ADD SERVICE
exports.addService = async (req, res) => {
  try {
    const { serviceName, price, durationMinutes } = req.body;
    const userId = req.session.user._id;

    const freelancer = await Freelancer.findOne({ userId });

    freelancer.freelancerServices.push({
      serviceId: serviceName,
      freelancerBasePrice: price,
      finalPrice: price,
      durationMinutes
    });

    await freelancer.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to add service" });
  }
};


// REMOVE SERVICE
exports.removeService = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { serviceId } = req.params;

    const freelancer = await Freelancer.findOne({ userId });

    freelancer.freelancerServices = freelancer.freelancerServices.filter(
      s => s.serviceId !== serviceId
    );

    await freelancer.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
};


// UPDATE LOCATIONS
exports.updateLocations = async (req, res) => {
  try {
    const { locations } = req.body;
    const userId = req.session.user._id;

    const freelancer = await Freelancer.findOne({ userId });

    freelancer.locations = locations.map(loc => ({
      city: loc,
      state: "",
      pincode: "",
      radius: 5
    }));

    await freelancer.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update locations" });
  }
};