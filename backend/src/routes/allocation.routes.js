const router = require('express').Router();
const { PrismaClient, Prisma } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const notify = require('../lib/notify');
const prisma = new PrismaClient();

// Prisma error code for a serialization conflict between concurrent transactions
const TX_CONFLICT = 'P2034';

// An allocation in either of these states means the asset is currently held
const HELD = ['ACTIVE', 'OVERDUE'];

// Department heads may only act on allocations tied to their own department
const inDeptScope = (allocation, user) =>
  user.role !== 'DEPT_HEAD' ||
  allocation.departmentId === user.departmentId ||
  allocation.user?.departmentId === user.departmentId;

// GET /api/allocations
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.id;
    if (req.user.role === 'DEPT_HEAD') {
      where.OR = [
        { departmentId: req.user.departmentId },
        { user: { departmentId: req.user.departmentId } },
        { userId: req.user.id },
      ];
    }
    const allocations = await prisma.allocation.findMany({
      where,
      include: {
        asset: { include: { category: true } },
        user: { select: { id: true, name: true, email: true, departmentId: true } },
        department: { select: { id: true, name: true } },
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
      where: { status: { in: HELD }, expectedReturnDate: { lt: now } },
      include: { asset: true, user: { select: { name: true, email: true } }, department: { select: { name: true } } },
    });
    res.json(overdue);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/allocations — allocate to a user OR a department
router.post('/', auth, rbac(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD']), async (req, res) => {
  try {
    const { assetId, userId, departmentId, expectedReturnDate } = req.body;
    if (!userId && !departmentId) return res.status(400).json({ error: 'userId or departmentId is required' });
    if (userId && departmentId) return res.status(400).json({ error: 'Allocate to a user or a department, not both' });

    // Department heads can only allocate within their own department
    if (req.user.role === 'DEPT_HEAD') {
      if (departmentId && departmentId !== req.user.departmentId) {
        return res.status(403).json({ error: 'Department heads can only allocate to their own department' });
      }
      if (userId) {
        const target = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
        if (!target || target.departmentId !== req.user.departmentId) {
          return res.status(403).json({ error: 'Department heads can only allocate to employees in their own department' });
        }
      }
    }

    // Serializable transaction: the conflict check and the create must be
    // atomic, otherwise two concurrent requests can both pass the check
    // and double-allocate the asset.
    const allocation = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw { http: 404, body: { error: 'Asset not found' } };

      // Holder conflict first — the frontend uses heldBy to offer a transfer request
      const existing = await tx.allocation.findFirst({
        where: { assetId, status: { in: HELD } },
        include: { user: { select: { name: true, email: true } }, department: { select: { name: true } } },
      });
      if (existing) {
        throw {
          http: 409,
          body: {
            error: 'Asset already allocated',
            heldBy: existing.user || { name: `${existing.department?.name} (department)` },
            allocationId: existing.id,
          },
        };
      }

      if (!['AVAILABLE', 'RESERVED'].includes(asset.status)) {
        throw { http: 409, body: { error: `Asset cannot be allocated — status is ${asset.status}` } };
      }

      const created = await tx.allocation.create({
        data: {
          assetId,
          userId: userId || null,
          departmentId: departmentId || null,
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
          status: 'ACTIVE',
        },
        include: { asset: true, user: { select: { name: true } }, department: { select: { name: true } } },
      });
      await tx.asset.update({ where: { id: assetId }, data: { status: 'ALLOCATED' } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const holder = allocation.user?.name || allocation.department?.name;
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'ASSET_ALLOCATED', target: `${allocation.asset.tag} → ${holder}` } });
    if (userId) await notify(userId, 'ASSET_ASSIGNED', `Asset ${allocation.asset.tag} (${allocation.asset.name}) has been allocated to you`);

    res.status(201).json(allocation);
  } catch (err) {
    if (err.http) return res.status(err.http).json(err.body);
    if (err.code === TX_CONFLICT) return res.status(409).json({ error: 'Asset was allocated by another request — please retry' });
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/allocations/:id/return
router.put('/:id/return', auth, async (req, res) => {
  try {
    const { conditionNotes } = req.body;
    const allocation = await prisma.allocation.findUnique({
      where: { id: req.params.id },
      include: { asset: true, user: { select: { departmentId: true } } },
    });
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });
    if (!HELD.includes(allocation.status)) return res.status(409).json({ error: 'Allocation is not active' });

    // Only the holder, a manager-level role, or the department's head can return an asset
    const isHolder = allocation.userId === req.user.id;
    const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(req.user.role);
    const isDeptHead = req.user.role === 'DEPT_HEAD' && inDeptScope(allocation, req.user);
    if (!isHolder && !isManager && !isDeptHead) {
      return res.status(403).json({ error: 'Only the current holder or a manager can return this asset' });
    }

    await prisma.$transaction([
      prisma.allocation.update({
        where: { id: req.params.id },
        data: { status: 'RETURNED', returnedAt: new Date(), conditionNotes },
      }),
      prisma.asset.update({ where: { id: allocation.assetId }, data: { status: 'AVAILABLE' } }),
      // Void pending transfers — approving one after return would re-allocate a returned asset
      prisma.transferRequest.updateMany({
        where: { allocationId: req.params.id, status: 'PENDING' },
        data: { status: 'REJECTED' },
      }),
    ]);

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'ASSET_RETURNED', target: allocation.asset.tag } });
    res.json({ message: 'Asset returned successfully' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/allocations/transfer (transfer request)
router.post('/transfer', auth, async (req, res) => {
  try {
    const { allocationId, toUserId } = req.body;

    const allocation = await prisma.allocation.findUnique({ where: { id: allocationId } });
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });
    if (!HELD.includes(allocation.status)) return res.status(409).json({ error: 'Cannot transfer — allocation is not active' });
    if (!allocation.userId) return res.status(400).json({ error: 'Department allocations cannot be transferred — return and re-allocate instead' });
    if (allocation.userId === toUserId) return res.status(400).json({ error: 'Asset is already held by that user' });

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
      include: {
        allocation: { include: { asset: true, user: { select: { departmentId: true } } } },
        toUser: { select: { departmentId: true } },
      },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    // Guard: approving twice would create duplicate ACTIVE allocations
    if (transfer.status !== 'PENDING') return res.status(409).json({ error: `Transfer already ${transfer.status.toLowerCase()}` });
    if (!HELD.includes(transfer.allocation.status)) return res.status(409).json({ error: 'Underlying allocation is no longer active' });

    // Department heads can only approve transfers within their own department
    if (req.user.role === 'DEPT_HEAD') {
      const fromDept = transfer.allocation.user?.departmentId;
      const toDept = transfer.toUser?.departmentId;
      if (fromDept !== req.user.departmentId || toDept !== req.user.departmentId) {
        return res.status(403).json({ error: 'Department heads can only approve transfers within their own department' });
      }
    }

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
    const transfer = await prisma.transferRequest.findUnique({
      where: { id: req.params.id },
      include: { allocation: { include: { user: { select: { departmentId: true } } } }, toUser: { select: { departmentId: true } } },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status !== 'PENDING') return res.status(409).json({ error: `Transfer already ${transfer.status.toLowerCase()}` });
    if (req.user.role === 'DEPT_HEAD') {
      const fromDept = transfer.allocation.user?.departmentId;
      const toDept = transfer.toUser?.departmentId;
      if (fromDept !== req.user.departmentId || toDept !== req.user.departmentId) {
        return res.status(403).json({ error: 'Department heads can only reject transfers within their own department' });
      }
    }
    await prisma.transferRequest.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
    res.json({ message: 'Transfer rejected' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
