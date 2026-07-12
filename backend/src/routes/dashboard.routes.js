const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

// An allocation in either of these states means the asset is currently held
const HELD = ['ACTIVE', 'OVERDUE'];

// ── Dashboard Stats — tailored to the caller's role ─────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const { role, id, departmentId } = req.user;

    if (role === 'EMPLOYEE') {
      const [myAssets, myBookings, myOpenRequests, upcomingReturns, overdueAllocations, recentActivity] = await Promise.all([
        prisma.allocation.count({ where: { userId: id, status: { in: HELD } } }),
        prisma.booking.count({ where: { userId: id, status: { in: ['UPCOMING', 'ONGOING'] } } }),
        prisma.maintenanceRequest.count({ where: { raisedById: id, status: { notIn: ['RESOLVED', 'REJECTED'] } } }),
        prisma.allocation.count({ where: { userId: id, status: 'ACTIVE', expectedReturnDate: { gte: now, lt: in7days } } }),
        prisma.allocation.findMany({
          where: { userId: id, status: { in: HELD }, expectedReturnDate: { lt: now } },
          include: { asset: true, user: { select: { name: true } } },
        }),
        prisma.activityLog.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' }, take: 10,
          include: { user: { select: { name: true } } },
        }),
      ]);
      return res.json({
        role,
        myAssets, myBookings, myOpenRequests, upcomingReturns,
        overdueCount: overdueAllocations.length, overdueAllocations, recentActivity,
      });
    }

    // DEPT_HEAD sees their department; ADMIN / ASSET_MANAGER see the whole org
    const deptScoped = role === 'DEPT_HEAD' && departmentId;
    const assetWhere = deptScoped ? { departmentId } : {};
    const allocScope = deptScoped
      ? { OR: [{ departmentId }, { user: { departmentId } }] }
      : {};
    const userScope = deptScoped ? { user: { departmentId } } : {};

    const [available, allocated, maintenanceToday, activeBookings, pendingTransfers, upcomingReturns, overdueAllocations, recentActivity] =
      await Promise.all([
        prisma.asset.count({ where: { ...assetWhere, status: 'AVAILABLE' } }),
        prisma.asset.count({ where: { ...assetWhere, status: 'ALLOCATED' } }),
        prisma.maintenanceRequest.count({
          where: {
            status: { in: ['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] },
            createdAt: { gte: todayStart, lt: todayEnd },
            ...(deptScoped ? { asset: { departmentId } } : {}),
          },
        }),
        prisma.booking.count({ where: { status: { in: ['UPCOMING', 'ONGOING'] }, ...userScope } }),
        prisma.transferRequest.count({
          where: { status: 'PENDING', ...(deptScoped ? { allocation: { user: { departmentId } } } : {}) },
        }),
        prisma.allocation.count({
          where: { status: 'ACTIVE', expectedReturnDate: { gte: now, lt: in7days }, ...allocScope },
        }),
        prisma.allocation.findMany({
          where: { status: { in: HELD }, expectedReturnDate: { lt: now }, ...allocScope },
          include: { asset: true, user: true, department: { select: { name: true } } },
        }),
        prisma.activityLog.findMany({
          where: deptScoped ? { user: { departmentId } } : {},
          orderBy: { createdAt: 'desc' }, take: 10,
          include: { user: { select: { name: true } } },
        }),
      ]);

    res.json({
      role,
      available, allocated, maintenanceToday, activeBookings, pendingTransfers, upcomingReturns,
      overdueCount: overdueAllocations.length, overdueAllocations, recentActivity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
