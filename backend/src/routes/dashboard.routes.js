const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

// ── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const now = new Date();

    const [available, allocated, maintenanceToday, activeBookings, pendingTransfers, overdueAllocations] =
      await Promise.all([
        prisma.asset.count({ where: { status: 'AVAILABLE' } }),
        prisma.asset.count({ where: { status: 'ALLOCATED' } }),
        prisma.maintenanceRequest.count({
          where: {
            status: { in: ['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] },
            createdAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            },
          },
        }),
        prisma.booking.count({ where: { status: { in: ['UPCOMING', 'ONGOING'] } } }),
        prisma.transferRequest.count({ where: { status: 'PENDING' } }),
        prisma.allocation.findMany({
          where: {
            status: 'ACTIVE',
            expectedReturnDate: { lt: now },
          },
          include: { asset: true, user: true },
        }),
      ]);

    const upcomingReturns = await prisma.allocation.count({
      where: {
        status: 'ACTIVE',
        expectedReturnDate: {
          gte: now,
          lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Recent activity (last 10 logs)
    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true } } },
    });

    res.json({
      available,
      allocated,
      maintenanceToday,
      activeBookings,
      pendingTransfers,
      upcomingReturns,
      overdueCount: overdueAllocations.length,
      overdueAllocations,
      recentActivity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
