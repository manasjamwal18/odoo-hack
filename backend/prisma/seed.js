const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AssetFlow database...');

  // ── Departments ──────────────────────────────────────────────
  const engineering = await prisma.department.upsert({
    where: { id: 'dept-engineering' },
    update: {},
    create: { id: 'dept-engineering', name: 'Engineering', status: 'ACTIVE' },
  });
  const facilities = await prisma.department.upsert({
    where: { id: 'dept-facilities' },
    update: {},
    create: { id: 'dept-facilities', name: 'Facilities', status: 'ACTIVE' },
  });
  const fieldOps = await prisma.department.upsert({
    where: { id: 'dept-fieldops' },
    update: {},
    create: { id: 'dept-fieldops', name: 'Field Ops', status: 'ACTIVE' },
  });

  // ── Users ─────────────────────────────────────────────────────
  const hash = await bcrypt.hash('test123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@co.com' },
    update: {},
    create: {
      id: 'user-admin',
      name: 'Admin User',
      email: 'admin@co.com',
      passwordHash: hash,
      role: 'ADMIN',
      status: 'ACTIVE',
      departmentId: engineering.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@co.com' },
    update: {},
    create: {
      id: 'user-manager',
      name: 'Asset Manager',
      email: 'manager@co.com',
      passwordHash: hash,
      role: 'ASSET_MANAGER',
      status: 'ACTIVE',
      departmentId: engineering.id,
    },
  });

  const head = await prisma.user.upsert({
    where: { email: 'head@co.com' },
    update: {},
    create: {
      id: 'user-head',
      name: 'Priya Shah',
      email: 'head@co.com',
      passwordHash: hash,
      role: 'DEPT_HEAD',
      status: 'ACTIVE',
      departmentId: engineering.id,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'emp@co.com' },
    update: {},
    create: {
      id: 'user-emp',
      name: 'Raj Kumar',
      email: 'emp@co.com',
      passwordHash: hash,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      departmentId: facilities.id,
    },
  });

  // Set dept heads
  await prisma.department.update({ where: { id: engineering.id }, data: { headId: head.id } });

  // ── Asset Categories ──────────────────────────────────────────
  const electronics = await prisma.assetCategory.upsert({
    where: { id: 'cat-electronics' },
    update: {},
    create: { id: 'cat-electronics', name: 'Electronics', warrantyMonths: 24 },
  });
  const furniture = await prisma.assetCategory.upsert({
    where: { id: 'cat-furniture' },
    update: {},
    create: { id: 'cat-furniture', name: 'Furniture' },
  });
  const vehicles = await prisma.assetCategory.upsert({
    where: { id: 'cat-vehicles' },
    update: {},
    create: { id: 'cat-vehicles', name: 'Vehicles' },
  });
  const officeSupplies = await prisma.assetCategory.upsert({
    where: { id: 'cat-office' },
    update: {},
    create: { id: 'cat-office', name: 'Office Supplies' },
  });

  // ── Assets ────────────────────────────────────────────────────
  const laptop = await prisma.asset.upsert({
    where: { tag: 'AF-0114' },
    update: {},
    create: {
      id: 'asset-laptop',
      tag: 'AF-0114',
      name: 'Dell Laptop',
      categoryId: electronics.id,
      serialNumber: 'SN-DL-2024-001',
      acquisitionDate: new Date('2024-01-15'),
      acquisitionCost: 85000,
      condition: 'Good',
      location: 'Bangalore',
      departmentId: engineering.id,
      status: 'ALLOCATED',
      isBookable: false,
    },
  });

  const projector = await prisma.asset.upsert({
    where: { tag: 'AF-0062' },
    update: {},
    create: {
      id: 'asset-projector',
      tag: 'AF-0062',
      name: 'Epson Projector',
      categoryId: electronics.id,
      serialNumber: 'SN-EP-2023-007',
      acquisitionDate: new Date('2023-06-10'),
      acquisitionCost: 45000,
      condition: 'Good',
      location: 'Conference Room A',
      departmentId: engineering.id,
      status: 'UNDER_MAINTENANCE',
      isBookable: false,
    },
  });

  const room = await prisma.asset.upsert({
    where: { tag: 'AF-0079' },
    update: {},
    create: {
      id: 'asset-room',
      tag: 'AF-0079',
      name: 'Conference Room B2',
      categoryId: furniture.id,
      acquisitionDate: new Date('2022-01-01'),
      acquisitionCost: 0,
      condition: 'Excellent',
      location: 'Floor 2',
      departmentId: facilities.id,
      status: 'AVAILABLE',
      isBookable: true,
    },
  });

  const chair = await prisma.asset.upsert({
    where: { tag: 'AF-0201' },
    update: {},
    create: {
      id: 'asset-chair',
      tag: 'AF-0201',
      name: 'Office Chair',
      categoryId: furniture.id,
      acquisitionDate: new Date('2023-03-20'),
      acquisitionCost: 8000,
      condition: 'Good',
      location: 'Warehouse',
      departmentId: facilities.id,
      status: 'AVAILABLE',
      isBookable: false,
    },
  });

  const monitor = await prisma.asset.upsert({
    where: { tag: 'AF-4988' },
    update: {},
    create: {
      id: 'asset-monitor',
      tag: 'AF-4988',
      name: 'Dell Monitor 27"',
      categoryId: electronics.id,
      serialNumber: 'SN-DM-2024-022',
      acquisitionDate: new Date('2024-02-10'),
      acquisitionCost: 28000,
      condition: 'Good',
      location: 'Maintenance',
      departmentId: engineering.id,
      status: 'AVAILABLE',
      isBookable: false,
    },
  });

  const van = await prisma.asset.upsert({
    where: { tag: 'AF-0330' },
    update: {},
    create: {
      id: 'asset-van',
      tag: 'AF-0330',
      name: 'Toyota Innova Van',
      categoryId: vehicles.id,
      serialNumber: 'KA01AB1234',
      acquisitionDate: new Date('2021-08-15'),
      acquisitionCost: 1800000,
      condition: 'Good',
      location: 'Basement Parking',
      departmentId: fieldOps.id,
      status: 'AVAILABLE',
      isBookable: true,
    },
  });

  // ── Allocations ───────────────────────────────────────────────
  await prisma.allocation.upsert({
    where: { id: 'alloc-laptop' },
    update: {},
    create: {
      id: 'alloc-laptop',
      assetId: laptop.id,
      userId: head.id,
      status: 'ACTIVE',
      expectedReturnDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000), // 17 days from now
    },
  });

  // ── Booking ───────────────────────────────────────────────────
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(10, 0, 0, 0);

  await prisma.booking.upsert({
    where: { id: 'booking-room1' },
    update: {},
    create: {
      id: 'booking-room1',
      assetId: room.id,
      userId: manager.id,
      startTime: today,
      endTime: todayEnd,
      status: 'UPCOMING',
    },
  });

  // ── Maintenance Request ───────────────────────────────────────
  await prisma.maintenanceRequest.upsert({
    where: { id: 'maint-projector' },
    update: {},
    create: {
      id: 'maint-projector',
      assetId: projector.id,
      raisedById: employee.id,
      issue: 'Lamp flickering and overheating during presentations',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      technicianId: manager.id,
    },
  });

  // ── Notifications ─────────────────────────────────────────────
  const notifs = [
    { userId: head.id,     type: 'ASSET_ASSIGNED',    message: 'Laptop AF-0114 assigned to you by Asset Manager' },
    { userId: manager.id,  type: 'MAINTENANCE_REQUEST', message: 'Maintenance request raised for Projector AF-0062 — priority: HIGH' },
    { userId: employee.id, type: 'BOOKING_CONFIRMED',  message: 'Booking confirmed for Conference Room B2 — 9:00 to 10:00 AM' },
    { userId: admin.id,    type: 'TRANSFER_APPROVED',  message: 'Transfer request for AF-0062 approved by Engineering dept head' },
    { userId: head.id,     type: 'OVERDUE_RETURN',     message: 'Overdue return alert — AF-0062 was due 3 days ago' },
  ];

  for (const n of notifs) {
    await prisma.notification.create({ data: n });
  }

  // ── Activity Logs ─────────────────────────────────────────────
  const logs = [
    { userId: manager.id, action: 'ASSET_REGISTERED',   target: 'Laptop AF-0114' },
    { userId: manager.id, action: 'ASSET_ALLOCATED',     target: 'AF-0114 → Priya Shah' },
    { userId: employee.id, action: 'MAINTENANCE_RAISED', target: 'Projector AF-0062' },
    { userId: manager.id, action: 'BOOKING_CONFIRMED',   target: 'Room B2 — 9:00 to 10:00 AM' },
    { userId: admin.id,   action: 'USER_PROMOTED',       target: 'Priya Shah → DEPT_HEAD' },
  ];

  for (const log of logs) {
    await prisma.activityLog.create({ data: log });
  }

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo accounts (password: test123):');
  console.log('  admin@co.com    → ADMIN');
  console.log('  manager@co.com  → ASSET_MANAGER');
  console.log('  head@co.com     → DEPT_HEAD (Priya Shah)');
  console.log('  emp@co.com      → EMPLOYEE (Raj Kumar)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
