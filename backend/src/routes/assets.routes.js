const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Helper: generate next asset tag
async function generateTag() {
  const count = await prisma.asset.count();
  return `AF-${String(count + 1).padStart(4, '0')}`;
}

// GET /api/assets
router.get('/', auth, async (req, res) => {
  try {
    const { tag, category, status, location, search, bookable } = req.query;
    const where = {};
    if (tag) where.tag = { contains: tag, mode: 'insensitive' };
    if (category) where.categoryId = category;
    if (status) where.status = status;
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (bookable === 'true') where.isBookable = true;
    if (search) {
      where.OR = [
        { tag: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }
    const assets = await prisma.asset.findMany({
      where,
      include: { category: true, department: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assets);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/assets
router.post('/', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const tag = await generateTag();
    const {
      name, categoryId, serialNumber, acquisitionDate, acquisitionCost,
      condition, location, departmentId, isBookable, photoUrl,
    } = req.body;

    const asset = await prisma.asset.create({
      data: {
        tag, name, categoryId, serialNumber,
        acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
        acquisitionCost: acquisitionCost ? parseFloat(acquisitionCost) : null,
        condition: condition || 'Good',
        location, departmentId,
        isBookable: Boolean(isBookable),
        photoUrl,
      },
      include: { category: true },
    });

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'ASSET_REGISTERED', target: `${asset.name} ${asset.tag}` } });
    res.status(201).json(asset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/assets/by-tag/:tag — used by the QR scan page; resolves the asset
// and, if one exists, its unmarked item in an open audit cycle
router.get('/by-tag/:tag', auth, async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { tag: req.params.tag },
      include: {
        category: true,
        department: true,
        allocations: {
          where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
          include: { user: { select: { name: true } }, department: { select: { name: true } } },
        },
        auditItems: {
          where: { auditCycle: { status: 'OPEN' } },
          include: { auditCycle: { select: { id: true, name: true } } },
        },
      },
    });
    if (!asset) return res.status(404).json({ error: 'No asset with that tag' });
    res.json(asset);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/assets/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        department: true,
        allocations: { include: { user: { select: { name: true, email: true } }, department: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        maintenanceRequests: { include: { raisedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        bookings: { include: { user: { select: { name: true } } }, orderBy: { startTime: 'desc' } },
        auditItems: { include: { auditCycle: { select: { name: true, status: true } } }, orderBy: { updatedAt: 'desc' } },
      },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/assets/:id/qr — QR generated locally (no external service),
// encoding a deep link to the scan-to-audit page for this asset
router.get('/:id/qr', auth, async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      select: { tag: true, name: true },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const scanUrl = `${FRONTEND_URL}/scan/${asset.tag}`;
    const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 240, margin: 1 });
    res.json({ tag: asset.tag, name: asset.name, scanUrl, qrDataUrl });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/assets/:id
router.put('/:id', auth, rbac(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  try {
    const asset = await prisma.asset.update({ where: { id: req.params.id }, data: req.body });
    res.json(asset);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
