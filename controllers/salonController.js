const Salon = require('../models/Salon');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const mongoose = require('mongoose');
const { uploadBuffer } = require("../config/s3");

exports.createSalon = async (req, res) => {
    try {
        const parsedData = typeof req.body.data === "string"
            ? JSON.parse(req.body.data)
            : req.body;

        const {
            username,
            password,
            name,
            salonType,
            ownerName,
            email,
            phone,
            address,
            googleMapLink,
            description,
            slotDurationMinutes,
            closedDates,
            services,
            staff,
            status,
            availability
        } = parsedData;

        let uploadedImageUrls = [];
        if (req.files && req.files.images) {
            const imagesArr = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
            for (const file of imagesArr) {
                // Use uploadBuffer like in freelancerController
                const uploaded = await uploadBuffer(file.buffer, {
                    KeyPrefix: "salons/",
                    contentType: file.mimetype
                });
                uploadedImageUrls.push(uploaded.location || uploaded.Location);
            }
        } else if (req.body.images) {
            if (typeof req.body.images === "string") {
                try {
                    const parsed = JSON.parse(req.body.images);
                    if (Array.isArray(parsed)) {
                        uploadedImageUrls = parsed;
                    } else {
                        uploadedImageUrls = req.body.images.split(",").map(str => str.trim());
                    }
                } catch {
                    uploadedImageUrls = req.body.images.split(",").map(str => str.trim());
                }
            } else if (Array.isArray(req.body.images)) {
                uploadedImageUrls = req.body.images;
            }
        }

        let finalUsername = username;
        let rawPassword = password;
        if (!finalUsername) {
            finalUsername = (email ? email.split("@")[0] : "salon") + Math.floor(Math.random() * 1000);
        }
        if (!rawPassword) {
            rawPassword = "salon@" + Math.floor(1000 + Math.random() * 9000);
        }
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        const salonData = {
            username: finalUsername,
            passwordHash,
            name,
            salonType,
            ownerName,
            email,
            phone,
            address: address
                ? (typeof address === "string" ? JSON.parse(address) : address)
                : undefined,
            googleMapLink,
            description,
            images: uploadedImageUrls,
            availability: availability
                ? (typeof availability === "string" ? JSON.parse(availability) : availability)
                : [],
            slotDurationMinutes: slotDurationMinutes ? Number(slotDurationMinutes) : 30,
            closedDates: closedDates
                ? (typeof closedDates === "string" ? JSON.parse(closedDates) : closedDates)
                : [],
            services: services
                ? (typeof services === "string" ? JSON.parse(services) : services)
                : [],
            staff: staff
                ? (typeof staff === "string" ? JSON.parse(staff) : staff)
                : [],
            status: status || "active",
            createdByAdmin: mongoose.Types.ObjectId.isValid(req.session.user?._id)
                ? req.session.user._id
                : null
        };

        // Remove undefined values from salonData
        Object.keys(salonData).forEach(key => {
            if (salonData[key] === undefined) delete salonData[key];
        });

        // Save the salon record
        await Salon.create(salonData);

        // Prepare to email credentials to owner and admin
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const adminMail = process.env.SMTP_USER;
        const recipients = [email, adminMail].filter(Boolean);

        const mailOptions = {
            from: `"Blushley Salon Team" <${process.env.SMTP_USER}>`,
            to: recipients,
            subject: "🌸 Welcome to Blushley! Your Salon Account is Live! 🌸",
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #24234d;">
                  <h2 style="color: #fc6ca6;">Welcome to Blushley!</h2>
                  <p>Hi there,</p>
                  <p>We're thrilled to welcome your salon to the Blushley family! Your salon account has been <strong>successfully set up</strong>.</p>
                  <p>
                    <strong>Login Details (keep these confidential!):</strong>
                    <ul style="list-style: none; padding:0;">
                      <li><b>Username:</b> <code style="background: #f5f2fc; padding: 2px 7px;">${finalUsername}</code></li>
                      <li><b>Password:</b> <code style="background: #f5f2fc; padding: 2px 7px;">${rawPassword}</code></li>
                    </ul>
                  </p>
                  <p>
                    <a href="https://blushley.com/login" style="background: #fc6ca6; color: #fff; padding: 10px 22px; font-weight: bold; text-decoration: none; border-radius: 5px; display: inline-block;">Log In to Your Blushley Dashboard</a>
                  </p>
                  <p style="color: #b05fa3; margin-top: 14px; font-size: 0.98em;">
                    <strong>For your security:</strong> These credentials are for you and your team only—please do not share with anyone.
                  </p>
                  <p style="color: #787878; font-size: 0.97em;">
                    Need help? Just reply to this email—our Blushley support crew is always ready to help you shine.<br><br>
                    <em>Glam on,</em><br>
                    The Blushley Team 💖
                  </p>
                </div>
            `
        };

        if (email) {
            await transporter.sendMail(mailOptions);
        }

        return res.render("admin/admin_saloon", { username: finalUsername, password: rawPassword });

    } catch (error) {
        console.error(error);
        return res.status(500).send("Salon creation failed");
    }
};

// Show single salon details
exports.getSalonById = async (req, res) => {
    try {
        const salon = await require('../models/Salon').findById(req.params.id);
        if (!salon) return res.status(404).send("Salon not found");
        return res.render("admin/saloon_detail", { salon });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error loading salon");
    }
};

// Render salon edit form
exports.editSalonForm = async (req, res) => {
    try {
        const salon = await require('../models/Salon').findById(req.params.id);
        if (!salon) return res.status(404).json({ error: "Salon not found" });
        return res.json({ salon });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error loading edit form" });
    }
};

exports.editSalon = async (req, res) => {
    try {
        // First, get the current salon
        const salon = await Salon.findById(req.params.id);
        if (!salon) return res.status(404).send("Salon not found");
        let update = { ...req.body };

        const parseJsonField = val => {
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch { return val; }
            }
            return val;
        };
      
        if ('services' in update) update.services = parseJsonField(update.services);
        if ('staff' in update) update.staff = parseJsonField(update.staff);
        if ('closedDates' in update) update.closedDates = parseJsonField(update.closedDates);
        if ('availability' in update) update.availability = parseJsonField(update.availability);
        if ('address' in update) update.address = parseJsonField(update.address);

      
        let updatedImages = salon.images && Array.isArray(salon.images) ? [...salon.images] : [];

        if (req.files && req.files.images) {
            const filesArr = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
         
            for (const file of filesArr) {
                const uploaded = await uploadBuffer(file.buffer, {
                    KeyPrefix: "salons/",
                    contentType: file.mimetype,
                });
                updatedImages.push(uploaded.location || uploaded.Location);
            }
        }

        if (req.body.existingImages) {
            let existingImages;
            if (typeof req.body.existingImages === 'string') {
                try {
                    existingImages = JSON.parse(req.body.existingImages);
                } catch {
                    existingImages = req.body.existingImages.split(',').map(s => s.trim());
                }
            } else {
                existingImages = req.body.existingImages;
            }
       
            updatedImages = existingImages;
        }

        update.images = Array.isArray(updatedImages) ? updatedImages.slice(0, 5) : [];

        // Clean up undefined/null
        Object.keys(update).forEach(key => {
            if (update[key] === undefined || update[key] === null) delete update[key];
        });

        // Actually update
        const updated = await Salon.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!updated) return res.status(404).send("Salon not found");

        return res.redirect('/admin/saloon');
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error updating salon");
    }
};

// Handle salon deletion
exports.deleteSalon = async (req, res) => {
    try {
        const Salon = require('../models/Salon');
        await Salon.findByIdAndDelete(req.params.id);
        return res.redirect('/admin/saloon');
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error deleting salon");
    }
};

// Handle salon status updates (active, inactive, disabled)
exports.updateSalonStatus = async (req, res) => {
    try {
        const Salon = require('../models/Salon');
        const { status } = req.body;
        if (!['active', 'inactive', 'disabled'].includes(status)) {
            return res.status(400).send("Invalid status");
        }
        const updated = await Salon.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!updated) return res.status(404).send("Salon not found");
        return res.json({ success: true, status: updated.status });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error updating salon status");
    }
};

exports.updateProfile = async (req, res) => {
  try {
    const salonId = req.session.user.salonId;

    const salon = await Salon.findById(salonId);
    if (!salon) {
      return res.status(404).json({ success: false, error: "Salon not found" });
    }

    const {
      name,
      salonType,
      ownerName,
      email,
      phone,
      googleMapLink,
      description,
      serviceMode,
      address,
      services,
      availability,
      closedDates,
      slotDurationMinutes
    } = req.body;

    /* ---- Basic Fields ---- */
    salon.name = name || salon.name;
    salon.salonType = salonType || salon.salonType;
    salon.ownerName = ownerName || salon.ownerName;
    salon.email = email || salon.email;
    salon.phone = phone || salon.phone;
    salon.googleMapLink = googleMapLink || salon.googleMapLink;
    salon.description = description || salon.description;
    salon.slotDurationMinutes = slotDurationMinutes || salon.slotDurationMinutes;

    /* ---- Address ---- */
    if (address) {
      const parsedAddress = typeof address === "string" ? JSON.parse(address) : address;
      salon.address = { ...salon.address, ...parsedAddress };
    }

    /* ---- Service Mode ---- */
    if (serviceMode) {
      const parsedMode = typeof serviceMode === "string"
        ? JSON.parse(serviceMode)
        : serviceMode;
      salon.serviceMode = { ...salon.serviceMode, ...parsedMode };
    }

    /* ---- Services ---- */
    if (services) {
      salon.services = typeof services === "string"
        ? JSON.parse(services)
        : services;
    }

    /* ---- Availability ---- */
    if (availability) {
      salon.availability = typeof availability === "string"
        ? JSON.parse(availability)
        : availability;
    }

    /* ---- Closed Dates ---- */
    if (closedDates) {
      salon.closedDates = typeof closedDates === "string"
        ? JSON.parse(closedDates)
        : closedDates;
    }

    /* ---- Handle Image Upload ---- */
    if (req.files?.images?.length) {
      let uploadedUrls = [];
      for (const file of req.files.images) {
        // Use uploadBuffer utility for uploading to S3
        const uploaded = await uploadBuffer(file.buffer, {
          KeyPrefix: `salons/${salon._id}/`,
          contentType: file.mimetype
        });
        uploadedUrls.push(uploaded.location || uploaded.Location);
      }
      // Merge with old images and limit to 5
      salon.images = [...(salon.images || []), ...uploadedUrls].slice(-5);
    }

    await salon.save();

    return res.json({
      success: true,
      message: "Salon profile updated successfully",
      salon
    });

  } catch (error) {
    console.error("Update Salon Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update salon"
    });
  }
};