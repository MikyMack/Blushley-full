// middlewares/isReseller.js
module.exports = (req, res, next) => {
    if (!req.session.user) return res.redirect('/auth/login');
  
    if (req.session.user.role === 'reseller') return next();
  
    return res.status(403).send('Access denied');
  };
  