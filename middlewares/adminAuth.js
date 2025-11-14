// middlewares/adminAuth.js
module.exports.isAdmin = (req, res, next) => {
    if (!req.session.adminUser) {
      return res.redirect('/auth/admin-login');
    }
    if (req.session.adminUser.role === 'admin' || req.session.adminUser.role === 'superadmin') {
      return next();
    }
    return res.status(403).send("Forbidden");
  };
  
  module.exports.isSuperAdmin = (req, res, next) => {
    if (!req.session.adminUser) return res.redirect('/auth/admin-login');
    if (req.session.adminUser.role === 'superadmin') return next();
    return res.status(403).send("Forbidden");
  };
  
  module.exports.isStaff = (req, res, next) => {
    if (!req.session.adminUser) return res.redirect('/auth/admin-login');
    if (['staff', 'admin', 'superadmin'].includes(req.session.adminUser.role)) return next();
    return res.status(403).send("Forbidden");
  };
  