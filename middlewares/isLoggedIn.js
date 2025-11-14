module.exports = function isLoggedIn(req, res, next) {
    if (req.session && req.session.user) return next();
  
    return res.redirect('/auth/login?next=' + req.originalUrl);
  };