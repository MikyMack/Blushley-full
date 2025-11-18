// middlewares/auth.js

// require this to protect routes
function isLoggedIn(req, res, next) {
    if (req.session && req.session.user) return next();
    // JSON vs HTML
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.redirect('/auth/send-otp');
  }
  
  // check role (usage: isRole('reseller'))
  function isRole(role) {
    return function (req, res, next) {
      if (!req.session || !req.session.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(401).json({ error: 'Unauthorized' });
        return res.redirect('/auth/send-otp');
      }
      if (req.session.user.role === role || (Array.isArray(role) && role.includes(req.session.user.role))) return next();
      return res.status(403).json({ error: 'Forbidden' });
    };
  }
  
  const isAdmin = (req, res, next) => {
    if (!req.session || !req.session.user) return res.redirect('/auth/admin-login');
    if (['admin','superadmin'].includes(req.session.user.role)) return next();
    return res.status(403).send('Forbidden');
  };
  
  module.exports = { isLoggedIn, isRole, isAdmin };
  