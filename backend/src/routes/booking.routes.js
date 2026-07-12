const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

const notify = async (userId, type, message) => {
  await prisma.notification.create({ data: { userId, type, message } });
};

// GET /api/bookings?assetId=
router.get('/', auth, async (req, res) => {
  try {
    const { assetId } = req.query;
    const where = {};
    if (assetId) where.assetId = assetId;
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.id;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        asset: { select: { tag: true, name: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/bookings
router.post('/', auth, async (req, res) => {
  try {
    const { assetId, startTime, endTime } = req.body;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) return res.status(400).json({ error: 'Start time must be before end time' });

    // Overlap validation: startA < endB && endA > startB
    const overlap = await prisma.booking.findFirst({
      where: {
        assetId,
        status: { in: ['UPCOMING', 'ONGOING'] },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      include: { user: { select: { name: true } } },
    });

    if (overlap) {
      return res.status(409).json({
        error: 'Time slot overlaps with an existing booking',
        conflict: { start: overlap.startTime, end: overlap.endTime, bookedBy: overlap.user.name },
      });
    }

    const booking = await prisma.booking.create({
      data: { assetId, userId: req.user.id, startTime: start, endTime: end, status: 'UPCOMING' },
      include: { asset: { select: { name: true, tag: true } } },
    });

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'BOOKING_CREATED', target: `${booking.asset.tag} ${start.toLocaleString()}` } });
    await notify(req.user.id, 'BOOKING_CONFIRMED', `Booking confirmed for ${booking.asset.name} — ${start.toLocaleTimeString()} to ${end.toLocaleTimeString()}`);

    res.status(201).json(booking);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/bookings/:id/cancel
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id && !['ADMIN', 'ASSET_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Cannot cancel another user\'s booking' });
    }
    const updated = await prisma.booking.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    await notify(booking.userId, 'BOOKING_CANCELLED', `Your booking has been cancelled`);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
