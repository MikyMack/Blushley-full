const Reseller = require('../models/Reseller');
const User = require('../models/User');


exports.registerPage = (req, res) => {
    return res.render("user/userLogin");
  };
  
  exports.register = async (req, res) => {
    try {
      const { companyName, email, phone, gstNo, documents } = req.body;
  
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          email,
          phone,
          role: "reseller",
          isVerified: false
        });
      }
  
      await Reseller.create({
        userId: user._id,
        companyName,
        gstNo,
        documents, 
        status: "pending",
        warehouses: []
      });
  
      return res.redirect(`/auth/send-otp?email=${email}&purpose=reseller_verify`);
  
    } catch (err) {
      console.error(err);
      return res.status(500).send("Reseller registration failed");
    }
  };