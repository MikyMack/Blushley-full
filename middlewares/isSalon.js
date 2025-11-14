// middlewares/isSalon.js
module.exports = (req, res, next) => {
    if (req.session && req.session.salon) return next();
    return res.redirect('/auth/salon-login');
  };
  