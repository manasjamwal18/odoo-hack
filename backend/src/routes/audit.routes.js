const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const notify = require('../lib/notify');
const prisma = new PrismaClient();

// GET /api/audits
router.get('/', auth, async (req, res) => {
  try {
    const audits = await prisma.auditCycle.findMany({
      include: { auditors: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(audits);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/audits
router.post('/', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const { name, scope, startDate, endDate, auditorIds, departmentId, location } = req.body;

    // Fetch in-scope assets
    const assetWhere = {};
    if (departmentId) assetWhere.departmentId = departmentId;
    if (location) assetWhere.location = { contains: location, mode: 'insensitive' };
    const assets = await prisma.asset.findMany({ where: assetWhere, select: { id: true } });

    const cycle = await prisma.auditCycle.create({
      data: {
        name,
        scope,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        auditors: { connect: (auditorIds || []).map(id => ({ id })) },
        items: { create: assets.map(a => ({ assetId: a.id })) },
      },
      include: { auditors: { select: { name: true } }, items: { include: { asset: { select: { tag: true, name: true } } } } },
    });

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'AUDIT_CREATED', target: name } });
    res.status(201).json(cycle);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/audits/:id/items
router.get('/:id/items', auth, async (req, res) => {
  try {
    const items = await prisma.auditItem.findMany({
      where: { auditCycleId: req.params.id },
      include: { asset: { include: { category: true } } },
    });
    res.json(items);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/audits/:id/items/:itemId
router.put('/:id/items/:itemId', auth, async (req, res) => {
  try {
    const { result, notes } = req.body;
    const cycle = await prisma.auditCycle.findUnique({ where: { id: req.params.id } });
    if (!cycle) return res.status(404).json({ error: 'Audit cycle not found' });
    if (cycle.status === 'CLOSED') return res.status(409).json({ error: 'Audit cycle is closed — items can no longer be edited' });
    const item = await prisma.auditItem.update({
      where: { id: req.params.itemId },
      data: { result, notes },
    });
    res.json(item);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/audits/:id/report
router.get('/:id/report', auth, async (req, res) => {
  try {
    const items = await prisma.auditItem.findMany({
      where: { auditCycleId: req.params.id, result: { in: ['MISSING', 'DAMAGED'] } },
      include: { asset: { include: { category: true, department: true } } },
    });
    res.json(items);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/audits/:id/close
router.put('/:id/close', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { asset: true } }, auditors: true },
    });
    if (!cycle) return res.status(404).json({ error: 'Audit cycle not found' });
    if (cycle.status === 'CLOSED') return res.status(409).json({ error: 'Audit cycle is already closed' });

    // Update asset statuses for flagged items; DAMAGED items self-heal by
    // auto-raising a maintenance request so the repair workflow starts itself
    const updates = [];
    const damaged = [];
    for (const item of cycle.items) {
      if (item.result === 'MISSING') {
        updates.push(prisma.asset.update({ where: { id: item.assetId }, data: { status: 'LOST' } }));
      }
      if (item.result === 'DAMAGED') {
        damaged.push(item);
        updates.push(prisma.maintenanceRequest.create({
          data: {
            assetId: item.assetId,
            raisedById: req.user.id,
            issue: `Flagged DAMAGED during audit "${cycle.name}"${item.notes ? ` — ${item.notes}` : ''}`,
            priority: 'HIGH',
            status: 'PENDING',
          },
        }));
      }
    }
    updates.push(prisma.auditCycle.update({ where: { id: req.params.id }, data: { status: 'CLOSED' } }));

    await prisma.$transaction(updates);

    // Notify admins about the close, and asset managers about auto-raised repairs
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const a of admins) {
      await notify(a.id, 'AUDIT_CLOSED', `Audit cycle "${cycle.name}" has been closed. Discrepancies found: ${cycle.items.filter(i => i.result && i.result !== 'VERIFIED').length}`);
    }
    if (damaged.length > 0) {
      const managers = await prisma.user.findMany({ where: { role: 'ASSET_MANAGER', status: 'ACTIVE' } });
      for (const m of managers) {
        await notify(m.id, 'AUDIT_DISCREPANCY', `${damaged.length} asset(s) flagged DAMAGED in audit "${cycle.name}" — maintenance requests auto-raised`);
      }
    }

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'AUDIT_CLOSED', target: cycle.name } });
    res.json({ message: 'Audit cycle closed' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
