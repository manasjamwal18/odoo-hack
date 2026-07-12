const router = require('express').Router();
const { PrismaClient, Prisma } = require('@prisma/client');
const auth = require('../middleware/auth');
const notify = require('../lib/notify');
const prisma = new PrismaClient();

// Prisma error code for a serialization conflict between concurrent transactions
const TX_CONFLICT = 'P2034';

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

    // Serializable transaction: the overlap check and the create must be
    // atomic, otherwise two concurrent requests can both pass the check
    // and double-book the slot.
    const booking = await prisma.$transaction(async (tx) => {
      // Enforce isBookable server-side
      const asset = await tx.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw { http: 404, body: { error: 'Asset not found' } };
      if (!asset.isBookable) throw { http: 400, body: { error: 'This asset is not bookable' } };

      // Overlap validation: startA < endB && endA > startB
      const overlap = await tx.booking.findFirst({
        where: {
          assetId,
          status: { in: ['UPCOMING', 'ONGOING'] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
        include: { user: { select: { name: true } } },
      });
      if (overlap) {
        throw {
          http: 409,
          body: {
            error: 'Time slot overlaps with an existing booking',
            conflict: { start: overlap.startTime, end: overlap.endTime, bookedBy: overlap.user.name },
          },
        };
      }

      return tx.booking.create({
        data: { assetId, userId: req.user.id, startTime: start, endTime: end, status: 'UPCOMING' },
        include: { asset: { select: { name: true, tag: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'BOOKING_CREATED', target: `${booking.asset.tag} ${start.toLocaleString()}` } });
    await notify(req.user.id, 'BOOKING_CONFIRMED', `Booking confirmed for ${booking.asset.name} — ${start.toLocaleTimeString()} to ${end.toLocaleTimeString()}`);

    res.status(201).json(booking);
  } catch (err) {
    if (err.http) return res.status(err.http).json(err.body);
    if (err.code === TX_CONFLICT) return res.status(409).json({ error: 'Slot was booked by another request — please retry' });
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/bookings/:id/reschedule
router.put('/:id/reschedule', auth, async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (start >= end) return res.status(400).json({ error: 'Start time must be before end time' });

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { asset: { select: { name: true, tag: true } } } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id && !['ADMIN', 'ASSET_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Cannot reschedule another user\'s booking' });
    }
    if (!['UPCOMING', 'ONGOING'].includes(booking.status)) {
      return res.status(409).json({ error: `Cannot reschedule a ${booking.status.toLowerCase()} booking` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const overlap = await tx.booking.findFirst({
        where: {
          assetId: booking.assetId,
          id: { not: booking.id },
          status: { in: ['UPCOMING', 'ONGOING'] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
        include: { user: { select: { name: true } } },
      });
      if (overlap) {
        throw {
          http: 409,
          body: {
            error: 'New time slot overlaps with an existing booking',
            conflict: { start: overlap.startTime, end: overlap.endTime, bookedBy: overlap.user.name },
          },
        };
      }
      return tx.booking.update({
        where: { id: booking.id },
        data: { startTime: start, endTime: end, status: 'UPCOMING', reminderSent: false },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'BOOKING_RESCHEDULED', target: `${booking.asset.tag} → ${start.toLocaleString()}` } });
    await notify(booking.userId, 'BOOKING_RESCHEDULED', `Your booking for ${booking.asset.name} was moved to ${start.toLocaleString()}`);
    res.json(updated);
  } catch (err) {
    if (err.http) return res.status(err.http).json(err.body);
    if (err.code === TX_CONFLICT) return res.status(409).json({ error: 'Slot was booked by another request — please retry' });
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/bookings/:id/cancel
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id && !['ADMIN', 'ASSET_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Cannot cancel another user\'s booking' });
    }
    if (!['UPCOMING', 'ONGOING'].includes(booking.status)) {
      return res.status(409).json({ error: `Booking is already ${booking.status.toLowerCase()}` });
    }
    const updated = await prisma.booking.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    await notify(booking.userId, 'BOOKING_CANCELLED', `Your booking has been cancelled`);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
