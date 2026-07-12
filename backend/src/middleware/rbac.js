/**
 * Role-Based Access Control middleware factory.
 * Usage: router.get('/route', auth, rbac(['ADMIN', 'ASSET_MANAGER']), handler)
 */
module.exports = function rbac(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
};
