const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const notify = require('../lib/notify');
const prisma = new PrismaClient();

// GET /api/maintenance
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'EMPLOYEE') where.raisedById = req.user.id;
    const requests = await prisma.maintenanceRequest.findMany({
      where,
      include: {
        asset: { select: { tag: true, name: true } },
        raisedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/maintenance
router.post('/', auth, async (req, res) => {
  try {
    const { assetId, issue, priority, photoUrl } = req.body;
    const request = await prisma.maintenanceRequest.create({
      data: { assetId, raisedById: req.user.id, issue, priority: priority || 'MEDIUM', photoUrl, status: 'PENDING' },
      include: { asset: { select: { tag: true, name: true } } },
    });
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'MAINTENANCE_RAISED', target: request.asset.tag } });

    // Notify all asset managers
    const managers = await prisma.user.findMany({ where: { role: 'ASSET_MANAGER' } });
    for (const m of managers) {
      await notify(m.id, 'MAINTENANCE_REQUEST', `Maintenance request raised for ${request.asset.name} — priority: ${priority}`);
    }
    res.status(201).json(request);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/maintenance/:id/approve
router.put('/:id/approve', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const req2 = await prisma.maintenanceRequest.findUnique({ where: { id: req.params.id }, include: { asset: true, raisedBy: true } });
    if (!req2) return res.status(404).json({ error: 'Not found' });
    if (req2.status !== 'PENDING') return res.status(409).json({ error: `Request is already ${req2.status.toLowerCase().replace(/_/g, ' ')}` });

    await prisma.$transaction([
      prisma.maintenanceRequest.update({ where: { id: req.params.id }, data: { status: 'APPROVED' } }),
      prisma.asset.update({ where: { id: req2.assetId }, data: { status: 'UNDER_MAINTENANCE' } }),
    ]);

    await notify(req2.raisedById, 'MAINTENANCE_APPROVED', `Your maintenance request for ${req2.asset.name} has been approved`);
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'MAINTENANCE_APPROVED', target: req2.asset.tag } });
    res.json({ message: 'Approved' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/maintenance/:id/reject
router.put('/:id/reject', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const req2 = await prisma.maintenanceRequest.findUnique({ where: { id: req.params.id }, include: { raisedBy: true, asset: true } });
    if (!req2) return res.status(404).json({ error: 'Maintenance request not found' });
    if (req2.status !== 'PENDING') return res.status(409).json({ error: `Request is already ${req2.status.toLowerCase().replace(/_/g, ' ')}` });
    await prisma.maintenanceRequest.update({ where: { id: req.params.id }, data: { status: 'REJECTED', notes: req.body.notes } });
    await notify(req2.raisedById, 'MAINTENANCE_REJECTED', `Your maintenance request for ${req2.asset.name} was rejected`);
    res.json({ message: 'Rejected' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/maintenance/:id/assign
router.put('/:id/assign', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const { technicianId } = req.body;
    const existing = await prisma.maintenanceRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Maintenance request not found' });
    if (!['APPROVED', 'TECHNICIAN_ASSIGNED'].includes(existing.status)) {
      return res.status(409).json({ error: 'Technician can only be assigned to an approved request' });
    }
    const updated = await prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: { status: 'TECHNICIAN_ASSIGNED', technicianId },
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/maintenance/:id/progress
router.put('/:id/progress', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const existing = await prisma.maintenanceRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Maintenance request not found' });
    if (!['APPROVED', 'TECHNICIAN_ASSIGNED'].includes(existing.status)) {
      return res.status(409).json({ error: 'Only an approved or assigned request can move to in progress' });
    }
    const updated = await prisma.maintenanceRequest.update({ where: { id: req.params.id }, data: { status: 'IN_PROGRESS' } });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/maintenance/:id/resolve
router.put('/:id/resolve', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const req2 = await prisma.maintenanceRequest.findUnique({ where: { id: req.params.id }, include: { asset: true, raisedBy: true } });
    if (!req2) return res.status(404).json({ error: 'Maintenance request not found' });
    if (!['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(req2.status)) {
      return res.status(409).json({ error: `Cannot resolve a ${req2.status.toLowerCase().replace(/_/g, ' ')} request` });
    }

    await prisma.$transaction([
      prisma.maintenanceRequest.update({ where: { id: req.params.id }, data: { status: 'RESOLVED', resolvedAt: new Date(), notes: req.body.notes } }),
      prisma.asset.update({ where: { id: req2.assetId }, data: { status: 'AVAILABLE' } }),
    ]);

    await notify(req2.raisedById, 'MAINTENANCE_RESOLVED', `Maintenance resolved — ${req2.asset.name} is now available`);
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'MAINTENANCE_RESOLVED', target: req2.asset.tag } });
    res.json({ message: 'Resolved' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
