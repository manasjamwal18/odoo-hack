require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/org',           require('./routes/org.routes'));
app.use('/api/assets',        require('./routes/assets.routes'));
app.use('/api/allocations',   require('./routes/allocation.routes'));
app.use('/api/transfers',     require('./routes/allocation.routes')); // transfer endpoints in same file
app.use('/api/bookings',      require('./routes/booking.routes'));
app.use('/api/maintenance',   require('./routes/maintenance.routes'));
app.use('/api/audits',        require('./routes/audit.routes'));
app.use('/api/reports',       require('./routes/reports.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/dashboard',     require('./routes/dashboard.routes'));
app.use('/api/events',        require('./routes/events.routes'));
app.use('/api/copilot',       require('./routes/copilot.routes'));

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manual scheduler sweep — lets admins force time-driven transitions immediately
const { startScheduler, sweep } = require('./scheduler');
app.post('/api/dev/sweep', require('./middleware/auth'), require('./middleware/rbac')(['ADMIN', 'ASSET_MANAGER']), async (req, res) => {
  await sweep();
  res.json({ message: 'Sweep complete' });
});

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 AssetFlow API running on http://localhost:${PORT}`);
  startScheduler();
});
