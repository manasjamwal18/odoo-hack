const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { addClient, removeClient } = require('../lib/events');
const prisma = new PrismaClient();

// GET /api/events?token=<jwt> — SSE stream of live notifications.
// EventSource cannot set an Authorization header, so the JWT rides in the query string.
router.get('/', async (req, res) => {
  try {
    const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, status: true } });
    if (!user || user.status === 'INACTIVE') return res.status(403).end();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': 'http://localhost:5173',
    });
    res.write('event: connected\ndata: {}\n\n');

    addClient(user.id, res);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(user.id, res);
    });
  } catch {
    res.status(401).end();
  }
});

module.exports = router;
