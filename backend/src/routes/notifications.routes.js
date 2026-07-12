const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const prisma = new PrismaClient();

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/notifications/logs
router.get('/logs', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ count });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
