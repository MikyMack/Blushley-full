const Salon = require('../models/Salon');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

exports.createSalon = async (req, res) => {
    try {
        const { name, email, phone, address, images } = req.body;

        const username = email.split("@")[0] + Math.floor(Math.random() * 1000);
        const password = "salon@" + Math.floor(1000 + Math.random() * 9000);
        const passwordHash = await bcrypt.hash(password, 10);

        await Salon.create({
            name,
            email,
            phone,
            username,
            passwordHash,
            address: JSON.parse(address || "{}"),
            images: images ? images.split(",") : [],
            createdByAdmin: req.session.user._id
        });

        // Setup transporter
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

        const mailOptions = {
            from: `"Salon Registration" <${process.env.SMTP_USER}>`,
            to: [email, adminMail], // Send to new salon and admin
            subject: "Salon Registration Credentials",
            html: `
                <p>Hello,</p>
                <p>Your salon account has been created successfully.</p>
                <p><strong>Username:</strong> ${username}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p>Please use these credentials to log in to your dashboard.</p>
            `
        };

        // Send credentials to both salon and admin mail
        await transporter.sendMail(mailOptions);

        return res.render("admin/saloon", { username, password });

    } catch (err) {
        console.error(err);
        return res.status(500).send("Salon creation failed");
    }
};