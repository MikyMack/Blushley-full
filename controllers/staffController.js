const AdminStaff = require('../models/AdminStaff');
const bcrypt = require('bcryptjs');


exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);

    await AdminStaff.create({
      name,
      email,
      passwordHash,
      role: "staff",
      permissions: JSON.parse(permissions || "{}"),
      createdBy: req.session.user._id
    });

    return res.redirect("/staff");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Staff creation failed");
  }
};


