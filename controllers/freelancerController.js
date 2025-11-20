const Freelancer = require('../models/Freelancer');
const User = require('../models/User');

exports.register = async (req, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        bio,
        locations,
        documents,   
        profileImage,
        portfolioImages
      } = req.body;
  
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: fullName,
          email,
          phone,
          role: "freelancer",
          isVerified: false
        });
      }
  
      // Create freelancer profile
      await Freelancer.create({
        userId: user._id,
        fullName,
        email,
        phone,
        bio,
        profileImage,
        portfolioImages,
        documents,
        locations: JSON.parse(locations || "[]"),
        status: "pending"
      });
  
      // send email OTP (reuse sendOtp)
      return res.redirect(`/auth/send-otp?email=${email}&purpose=freelancer_verify`);
  
    } catch (err) {
      console.error(err);
      return res.status(500).send("Freelancer registration failed");
    }
  };

