const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Re-fetch the user so role changes and deactivation take effect
    // immediately instead of persisting until the 24h token expires.
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, status: true, departmentId: true },
    });
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    req.user = { id: user.id, email: user.email, role: user.role, departmentId: user.departmentId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
