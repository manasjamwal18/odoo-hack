const { PrismaClient } = require('@prisma/client');
const notify = require('./lib/notify');
const prisma = new PrismaClient();

const REMINDER_LEAD_MS = 15 * 60 * 1000;

// One sweep of time-driven state: booking lifecycle, booking reminders,
// overdue allocation flagging + notifications.
async function sweep() {
  const now = new Date();

  // UPCOMING → ONGOING
  await prisma.booking.updateMany({
    where: { status: 'UPCOMING', startTime: { lte: now }, endTime: { gt: now } },
    data: { status: 'ONGOING' },
  });

  // UPCOMING/ONGOING → COMPLETED
  await prisma.booking.updateMany({
    where: { status: { in: ['UPCOMING', 'ONGOING'] }, endTime: { lte: now } },
    data: { status: 'COMPLETED' },
  });

  // Booking reminders ~15 minutes before start
  const dueReminders = await prisma.booking.findMany({
    where: {
      status: 'UPCOMING',
      reminderSent: false,
      startTime: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
    },
    include: { asset: { select: { name: true, tag: true } } },
  });
  for (const b of dueReminders) {
    await prisma.booking.update({ where: { id: b.id }, data: { reminderSent: true } });
    await notify(b.userId, 'BOOKING_REMINDER', `Reminder: your booking for ${b.asset.name} starts at ${new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  }

  // Overdue allocations: flag ACTIVE → OVERDUE and notify holder + managers once
  const newlyOverdue = await prisma.allocation.findMany({
    where: { status: 'ACTIVE', expectedReturnDate: { lt: now }, overdueNotifiedAt: null },
    include: { asset: { select: { name: true, tag: true } }, user: { select: { id: true, name: true } } },
  });
  if (newlyOverdue.length > 0) {
    const managers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'ASSET_MANAGER'] }, status: 'ACTIVE' }, select: { id: true } });
    for (const a of newlyOverdue) {
      await prisma.allocation.update({ where: { id: a.id }, data: { status: 'OVERDUE', overdueNotifiedAt: now } });
      if (a.userId) await notify(a.userId, 'OVERDUE_RETURN', `Overdue: ${a.asset.name} (${a.asset.tag}) was due back on ${new Date(a.expectedReturnDate).toLocaleDateString()}`);
      for (const m of managers) {
        await notify(m.id, 'OVERDUE_RETURN', `${a.asset.tag} held by ${a.user?.name || 'a department'} is overdue for return`);
      }
    }
  }
}

function startScheduler(intervalMs = 60000) {
  sweep().catch(err => console.error('Scheduler sweep failed:', err.message));
  const timer = setInterval(() => sweep().catch(err => console.error('Scheduler sweep failed:', err.message)), intervalMs);
  timer.unref();
  console.log(`⏱  Scheduler running (every ${intervalMs / 1000}s)`);
  return timer;
}

module.exports = { startScheduler, sweep };
