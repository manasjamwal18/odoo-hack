const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const prisma = new PrismaClient();

const notify = async (userId, type, message) => {
  await prisma.notification.create({ data: { userId, type, message } });
};

// GET /api/allocations
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.id;
    const allocations = await prisma.allocation.findMany({
      where,
      include: {
        asset: { include: { category: true } },
        user: { select: { id: true, name: true, email: true } },
        transferRequests: { include: { toUser: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(allocations);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/allocations/overdue
router.get('/overdue', auth, async (req, res) => {
  try {
    const now = new Date();
    const overdue = await prisma.allocation.findMany({
      where: { status: 'ACTIVE', expectedReturnDate: { lt: now } },
      include: { asset: true, user: { select: { name: true, email: true } } },
    });
    res.json(overdue);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/allocations
router.post('/', auth, rbac(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD']), async (req, res) => {
  try {
    const { assetId, userId, expectedReturnDate } = req.body;

    // Conflict check
    const existing = await prisma.allocation.findFirst({
      where: { assetId, status: 'ACTIVE' },
      include: { user: { select: { name: true, email: true } } },
    });
    if (existing) {
      return res.status(409).json({
        error: 'Asset already allocated',
        heldBy: existing.user,
        allocationId: existing.id,
      });
    }

    const allocation = await prisma.allocation.create({
      data: {
        assetId, userId,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        status: 'ACTIVE',
      },
      include: { asset: true, user: { select: { name: true } } },
    });

    await prisma.asset.update({ where: { id: assetId }, data: { status: 'ALLOCATED' } });
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'ASSET_ALLOCATED', target: `${allocation.asset.tag} → ${allocation.user.name}` } });
    await notify(userId, 'ASSET_ASSIGNED', `Asset ${allocation.asset.tag} (${allocation.asset.name}) has been allocated to you`);

    res.status(201).json(allocation);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/allocations/:id/return
router.put('/:id/return', auth, async (req, res) => {
  try {
    const { conditionNotes } = req.body;
    const allocation = await prisma.allocation.findUnique({
      where: { id: req.params.id },
      include: { asset: true },
    });
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });

    await prisma.$transaction([
      prisma.allocation.update({
        where: { id: req.params.id },
        data: { status: 'RETURNED', returnedAt: new Date(), conditionNotes },
      }),
      prisma.asset.update({ where: { id: allocation.assetId }, data: { status: 'AVAILABLE' } }),
    ]);

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'ASSET_RETURNED', target: allocation.asset.tag } });
    res.json({ message: 'Asset returned successfully' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/transfers (transfer request)
router.post('/transfer', auth, async (req, res) => {
  try {
    const { allocationId, toUserId } = req.body;
    const transfer = await prisma.transferRequest.create({
      data: { allocationId, requestedById: req.user.id, toUserId, status: 'PENDING' },
      include: { allocation: { include: { asset: true } }, toUser: { select: { name: true } } },
    });
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'TRANSFER_REQUESTED', target: transfer.allocation.asset.tag } });
    res.status(201).json(transfer);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/allocations/transfer/:id/approve
router.put('/transfer/:id/approve', auth, rbac(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD']), async (req, res) => {
  try {
    const transfer = await prisma.transferRequest.findUnique({
      where: { id: req.params.id },
      include: { allocation: { include: { asset: true } } },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

    await prisma.$transaction([
      prisma.allocation.update({ where: { id: transfer.allocationId }, data: { status: 'RETURNED', returnedAt: new Date() } }),
      prisma.allocation.create({ data: { assetId: transfer.allocation.assetId, userId: transfer.toUserId, status: 'ACTIVE' } }),
      prisma.transferRequest.update({ where: { id: req.params.id }, data: { status: 'APPROVED' } }),
    ]);

    await notify(transfer.toUserId, 'TRANSFER_APPROVED', `Transfer approved — ${transfer.allocation.asset.tag} is now allocated to you`);
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'TRANSFER_APPROVED', target: transfer.allocation.asset.tag } });
    res.json({ message: 'Transfer approved' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/allocations/transfer/:id/reject
router.put('/transfer/:id/reject', auth, rbac(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD']), async (req, res) => {
  try {
    await prisma.transferRequest.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
    res.json({ message: 'Transfer rejected' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
