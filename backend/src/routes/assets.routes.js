const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const prisma = new PrismaClient();

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

// GET /api/assets/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        department: true,
        allocations: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } },
        maintenanceRequests: { include: { raisedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        bookings: { include: { user: { select: { name: true } } }, orderBy: { startTime: 'desc' } },
      },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset);
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
