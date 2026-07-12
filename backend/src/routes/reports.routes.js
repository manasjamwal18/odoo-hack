const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const prisma = new PrismaClient();

// GET /api/reports/utilization
router.get('/utilization', auth, async (req, res) => {
  try {
    const depts = await prisma.department.findMany({ include: { assets: { select: { status: true } } } });
    const data = depts.map(d => ({
      department: d.name,
      total: d.assets.length,
      available: d.assets.filter(a => a.status === 'AVAILABLE').length,
      allocated: d.assets.filter(a => a.status === 'ALLOCATED').length,
      maintenance: d.assets.filter(a => a.status === 'UNDER_MAINTENANCE').length,
    }));
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/reports/maintenance-freq
router.get('/maintenance-freq', auth, async (req, res) => {
  try {
    const requests = await prisma.maintenanceRequest.findMany({
      include: { asset: { include: { category: true } } },
      orderBy: { createdAt: 'asc' },
    });
    // Group by month and category
    const grouped = {};
    for (const r of requests) {
      const key = `${r.createdAt.toISOString().slice(0, 7)}`; // YYYY-MM
      if (!grouped[key]) grouped[key] = {};
      const cat = r.asset.category?.name || 'Unknown';
      grouped[key][cat] = (grouped[key][cat] || 0) + 1;
    }
    res.json(grouped);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/reports/most-used
router.get('/most-used', auth, async (req, res) => {
  try {
    const assets = await prisma.asset.findMany({
      include: {
        bookings: { where: { status: { not: 'CANCELLED' } } },
        allocations: true,
        category: true,
      },
    });
    const data = assets.map(a => ({
      tag: a.tag, name: a.name, category: a.category?.name,
      status: a.status, bookingCount: a.bookings.length, allocationCount: a.allocations.length,
      usageScore: a.bookings.length + a.allocations.length,
    })).sort((a, b) => b.usageScore - a.usageScore);
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/reports/retirement-due
router.get('/retirement-due', auth, async (req, res) => {
  try {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const assets = await prisma.asset.findMany({
      where: {
        OR: [
          { acquisitionDate: { lt: fiveYearsAgo } },
          { condition: { in: ['Poor', 'Critical'] } },
        ],
      },
      include: { category: true, department: true },
    });
    res.json(assets);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/reports/booking-heatmap
router.get('/booking-heatmap', auth, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({ where: { status: { not: 'CANCELLED' } } });
    const heatmap = {}; // { 'Mon-09': count }
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const b of bookings) {
      const day = days[new Date(b.startTime).getDay()];
      const hour = new Date(b.startTime).getHours();
      const key = `${day}-${String(hour).padStart(2, '0')}`;
      heatmap[key] = (heatmap[key] || 0) + 1;
    }
    res.json(heatmap);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/reports/summary — all-in-one for the Reports page
router.get('/summary', auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(now.getFullYear() - 5);

    const [depts, assets, maintenanceThisMonth, bookingsThisMonth, allocations] = await Promise.all([
      prisma.department.findMany({ include: { assets: { select: { status: true } } } }),
      prisma.asset.findMany({
        include: {
          bookings: { where: { status: { not: 'CANCELLED' } } },
          allocations: { where: { status: 'ACTIVE' } },
          maintenanceRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
          category: true,
        },
      }),
      prisma.maintenanceRequest.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.booking.count({ where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } }),
      prisma.allocation.findMany({ where: { status: 'ACTIVE' }, include: { asset: { select: { tag: true, name: true } }, user: { select: { name: true } } } }),
    ]);

    // Utilization by dept
    const utilizationByDept = depts.map(d => ({
      department: d.name,
      total: d.assets.length,
      available: d.assets.filter(a => a.status === 'AVAILABLE').length,
      allocated: d.assets.filter(a => a.status === 'ALLOCATED').length,
    })).filter(d => d.total > 0);

    // Maintenance by month (last 6)
    const maintenanceAll = await prisma.maintenanceRequest.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const monthMap = {};
    for (const m of maintenanceAll) {
      const key = m.createdAt.toISOString().slice(0, 7);
      monthMap[key] = (monthMap[key] || 0) + 1;
    }
    const maintenanceByMonth = Object.entries(monthMap).slice(-6).map(([month, count]) => ({ month, count }));

    // Top assets by usage
    const topAssets = assets
      .map(a => ({ ...a, usageScore: a.bookings.length + a.allocations.length }))
      .sort((a, b) => b.usageScore - a.usageScore)
      .slice(0, 5)
      .map(a => ({ id: a.id, tag: a.tag, name: a.name, bookingCount: a.bookings.length }));

    // Idle assets (no booking or allocation in 60 days)
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const idleAssetList = assets.filter(a =>
      a.status === 'AVAILABLE' && a.bookings.length === 0 && a.allocations.length === 0
    ).slice(0, 5).map(a => ({ id: a.id, tag: a.tag, name: a.name, idleDays: 60 }));

    // Maintenance due + near retirement
    const maintenanceDue = assets.filter(a =>
      (a.acquisitionDate && new Date(a.acquisitionDate) < fiveYearsAgo) ||
      ['Poor', 'Critical'].includes(a.condition)
    ).slice(0, 5).map(a => ({
      id: a.id, tag: a.tag, name: a.name,
      nearRetirement: a.acquisitionDate && new Date(a.acquisitionDate) < fiveYearsAgo,
      yearsOld: a.acquisitionDate ? Math.floor((now - new Date(a.acquisitionDate)) / (365.25 * 86400000)) : null,
      daysLeft: 30,
    }));

    // Overdue allocations
    const overdueAllocations = allocations.filter(a => {
      if (!a.expectedReturnDate) return false;
      return new Date(a.expectedReturnDate) < now;
    });

    // Most booked asset
    const topBooked = topAssets[0];

    res.json({
      utilizationByDept,
      maintenanceByMonth,
      topAssets,
      idleAssetList,
      maintenanceDue,
      maintenanceThisMonth,
      bookingsThisMonth,
      mostUsedBookings: topBooked?.bookingCount || 0,
      topBookedAsset: topBooked?.tag,
      idleAssets: idleAssetList.length,
      avgIdleDays: 60,
      overdueCount: overdueAllocations.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/export
router.get('/export', auth, rbac(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD']), async (req, res) => {
  try {
    const [assets, allocations, maintenance] = await Promise.all([
      prisma.asset.findMany({ include: { category: true, department: true } }),
      prisma.allocation.findMany({ include: { asset: true, user: { select: { name: true } } }, where: { status: 'ACTIVE' } }),
      prisma.maintenanceRequest.findMany({ include: { asset: true }, where: { status: { not: 'RESOLVED' } } }),
    ]);

    const html = `<!DOCTYPE html><html><head><title>AssetFlow Report</title>
    <style>body{font-family:Arial;padding:20px} table{border-collapse:collapse;width:100%;margin-bottom:20px} th,td{border:1px solid #ccc;padding:8px;text-align:left} th{background:#f0f0f0}</style>
    </head><body>
    <h1>AssetFlow Report — ${new Date().toLocaleDateString()}</h1>
    <h2>Assets (${assets.length})</h2>
    <table><tr><th>Tag</th><th>Name</th><th>Category</th><th>Status</th><th>Location</th></tr>
    ${assets.map(a => `<tr><td>${a.tag}</td><td>${a.name}</td><td>${a.category?.name}</td><td>${a.status}</td><td>${a.location || '-'}</td></tr>`).join('')}
    </table>
    <h2>Active Allocations (${allocations.length})</h2>
    <table><tr><th>Asset</th><th>Held By</th><th>Expected Return</th></tr>
    ${allocations.map(a => `<tr><td>${a.asset.tag}</td><td>${a.user.name}</td><td>${a.expectedReturnDate ? new Date(a.expectedReturnDate).toLocaleDateString() : '-'}</td></tr>`).join('')}
    </table>
    <h2>Open Maintenance (${maintenance.length})</h2>
    <table><tr><th>Asset</th><th>Issue</th><th>Priority</th><th>Status</th></tr>
    ${maintenance.map(m => `<tr><td>${m.asset.tag}</td><td>${m.issue}</td><td>${m.priority}</td><td>${m.status}</td></tr>`).join('')}
    </table>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
