const { PrismaClient } = require('@prisma/client');
const { sendToUser } = require('./events');
const prisma = new PrismaClient();

// Persist a notification and push it live over SSE
async function notify(userId, type, message) {
  const notification = await prisma.notification.create({ data: { userId, type, message } });
  sendToUser(userId, 'notification', notification);
  return notification;
}

module.exports = notify;
