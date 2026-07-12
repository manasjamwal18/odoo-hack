const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const prisma = new PrismaClient();

// GET /api/org/departments
router.get('/departments', auth, async (req, res) => {
  try {
    const depts = await prisma.department.findMany({
      include: {
        employees: { select: { id: true, name: true, role: true } },
        _count: { select: { assets: true, employees: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(depts);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/org/departments
router.post('/departments', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    const { name, headId, parentId, status } = req.body;
    const dept = await prisma.department.create({ data: { name, headId, parentId, status: status || 'ACTIVE' } });
    res.status(201).json(dept);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/org/departments/:id
router.put('/departments/:id', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    const dept = await prisma.department.update({ where: { id: req.params.id }, data: req.body });
    res.json(dept);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/org/departments/:id  (deactivate)
router.delete('/departments/:id', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    await prisma.department.update({ where: { id: req.params.id }, data: { status: 'INACTIVE' } });
    res.json({ message: 'Department deactivated' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/org/categories
router.get('/categories', auth, async (req, res) => {
  try {
    const cats = await prisma.assetCategory.findMany({
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(cats);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/org/categories
router.post('/categories', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    const { name, warrantyMonths } = req.body;
    const cat = await prisma.assetCategory.create({ data: { name, warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : null } });
    res.status(201).json(cat);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/org/categories/:id
router.put('/categories/:id', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    const cat = await prisma.assetCategory.update({ where: { id: req.params.id }, data: req.body });
    res.json(cat);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/org/employees
router.get('/employees', auth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/org/employees/:id/promote
router.put('/employees/:id/promote', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['EMPLOYEE', 'DEPT_HEAD', 'ASSET_MANAGER'];
    if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'USER_PROMOTED', target: `${user.name} → ${role}` } });
    res.json({ ...user, passwordHash: undefined });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/org/employees/:id/status
router.put('/employees/:id/status', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    const { status } = req.body;
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
    res.json({ ...user, passwordHash: undefined });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/org/employees/:id
router.put('/employees/:id', auth, rbac(['ADMIN']), async (req, res) => {
  try {
    const { name, departmentId, status } = req.body;
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { name, departmentId, status } });
    res.json({ ...user, passwordHash: undefined });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
