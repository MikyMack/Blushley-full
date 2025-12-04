
// Check if logged in
function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) return next();

  // AJAX
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.redirect('/userLogin');
}

// Check role (usage: isRole('reseller') or isRole(['reseller','freelancer']))
function isRole(role) {
  return function (req, res, next) {
    if (!req.session || !req.session.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.redirect('/userLogin');
    }

    const userRole = req.session.user.role;

    if (Array.isArray(role)) {
      if (role.includes(userRole)) return next();
    } else {
      if (userRole === role) return next();
    }

    return res.status(403).json({ error: 'Forbidden' });
  };
}

// Admin check (admin & superadmin)
function isAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/admin/adminLogin');
  }

  if (['admin','superadmin'].includes(req.session.user.role)) {
    return next();
  }

  return res.status(403).send('Forbidden');
}

// Staff check
function isStaff(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/staff/staffLogin');
  }

  if (['staff'].includes(req.session.user.role)) {
    return next();
  }

  return res.status(403).send('Forbidden');
}

module.exports = { isLoggedIn, isRole, isAdmin, isStaff };
