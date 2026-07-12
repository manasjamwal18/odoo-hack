const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

const HELD = ['ACTIVE', 'OVERDUE'];

// Compact operational snapshot the copilot reasons over. Bounded so the
// context stays small even on a grown database.
async function buildContext() {
  const now = new Date();
  const [assets, allocations, bookings, maintenance, overdue] = await Promise.all([
    prisma.asset.findMany({
      take: 200,
      include: { category: { select: { name: true } }, department: { select: { name: true } } },
      orderBy: { tag: 'asc' },
    }),
    prisma.allocation.findMany({
      where: { status: { in: HELD } },
      include: {
        asset: { select: { tag: true, name: true } },
        user: { select: { name: true, email: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.booking.findMany({
      where: { status: { in: ['UPCOMING', 'ONGOING'] } },
      take: 100,
      include: { asset: { select: { tag: true, name: true } }, user: { select: { name: true } } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.maintenanceRequest.findMany({
      where: { status: { notIn: ['RESOLVED', 'REJECTED'] } },
      take: 100,
      include: { asset: { select: { tag: true, name: true } }, raisedBy: { select: { name: true } } },
    }),
    prisma.allocation.findMany({
      where: { status: { in: HELD }, expectedReturnDate: { lt: now } },
      include: { asset: { select: { tag: true, name: true } }, user: { select: { name: true } } },
    }),
  ]);

  return {
    now: now.toISOString(),
    assets: assets.map(a => ({
      tag: a.tag, name: a.name, status: a.status, category: a.category?.name,
      department: a.department?.name, location: a.location, condition: a.condition, bookable: a.isBookable,
    })),
    currentAllocations: allocations.map(a => ({
      asset: `${a.asset.tag} ${a.asset.name}`,
      heldBy: a.user?.name || `${a.department?.name} (department)`,
      expectedReturn: a.expectedReturnDate, status: a.status,
    })),
    upcomingBookings: bookings.map(b => ({
      asset: `${b.asset.tag} ${b.asset.name}`, by: b.user.name, start: b.startTime, end: b.endTime, status: b.status,
    })),
    openMaintenance: maintenance.map(m => ({
      asset: `${m.asset.tag} ${m.asset.name}`, issue: m.issue, priority: m.priority, status: m.status, raisedBy: m.raisedBy.name,
    })),
    overdueReturns: overdue.map(a => ({
      asset: `${a.asset.tag} ${a.asset.name}`, heldBy: a.user?.name, dueBack: a.expectedReturnDate,
    })),
  };
}

// Deterministic fallback when no ANTHROPIC_API_KEY is configured —
// pattern-matched intents over the same snapshot.
function answerDeterministically(question, ctx) {
  const q = question.toLowerCase();

  if (/who (has|holds)|held by/.test(q)) {
    const hits = ctx.currentAllocations.filter(a => q.includes(a.asset.split(' ')[0].toLowerCase()) ||
      a.asset.toLowerCase().split(/\s+/).some(w => w.length > 3 && q.includes(w)));
    if (hits.length) {
      return hits.map(h => `${h.asset} is held by ${h.heldBy}${h.expectedReturn ? `, due back ${new Date(h.expectedReturn).toLocaleDateString()}` : ''}${h.status === 'OVERDUE' ? ' (OVERDUE)' : ''}.`).join(' ');
    }
    return ctx.currentAllocations.length
      ? `Currently held assets: ${ctx.currentAllocations.map(a => `${a.asset} → ${a.heldBy}`).join('; ')}.`
      : 'No assets are currently allocated.';
  }

  if (/overdue|late/.test(q)) {
    return ctx.overdueReturns.length
      ? `${ctx.overdueReturns.length} overdue: ${ctx.overdueReturns.map(o => `${o.asset} (${o.heldBy}, due ${new Date(o.dueBack).toLocaleDateString()})`).join('; ')}.`
      : 'Nothing is overdue right now.';
  }

  if (/available|free|allocate|book(able)?/.test(q)) {
    const available = ctx.assets.filter(a => a.status === 'AVAILABLE');
    const bookable = ctx.assets.filter(a => a.bookable);
    if (/book/.test(q)) return `Bookable resources: ${bookable.map(a => `${a.tag} ${a.name}`).join(', ') || 'none'}.`;
    return `${available.length} assets available: ${available.map(a => `${a.tag} ${a.name}`).join(', ') || 'none'}.`;
  }

  if (/maintenance|repair|broken/.test(q)) {
    return ctx.openMaintenance.length
      ? `${ctx.openMaintenance.length} open maintenance requests: ${ctx.openMaintenance.map(m => `${m.asset} — ${m.issue} (${m.priority}, ${m.status.toLowerCase().replace(/_/g, ' ')})`).join('; ')}.`
      : 'No open maintenance requests.';
  }

  if (/booking|booked|schedule/.test(q)) {
    return ctx.upcomingBookings.length
      ? `Upcoming bookings: ${ctx.upcomingBookings.map(b => `${b.asset} by ${b.by}, ${new Date(b.start).toLocaleString()}`).join('; ')}.`
      : 'No upcoming bookings.';
  }

  if (/how many|count|total/.test(q)) {
    const byStatus = {};
    for (const a of ctx.assets) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    return `${ctx.assets.length} assets total — ${Object.entries(byStatus).map(([s, n]) => `${n} ${s.toLowerCase().replace(/_/g, ' ')}`).join(', ')}.`;
  }

  return 'I can answer questions about who holds an asset, what is available or bookable, overdue returns, open maintenance, and upcoming bookings. Try: "Who has the projector?"';
}

// POST /api/copilot/ask
router.post('/ask', auth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required' });

    const ctx = await buildContext();

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic();
        const response = await anthropic.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          thinking: { type: 'adaptive' },
          system:
            'You are the AssetFlow operations copilot. Answer questions about the organization\'s assets, allocations, bookings, and maintenance using ONLY the JSON snapshot in the user message. ' +
            'Be concise (1-3 sentences), name specific asset tags and people, and say so plainly when the data does not contain the answer. Never invent assets or people.',
          messages: [{
            role: 'user',
            content: `Operational snapshot:\n${JSON.stringify(ctx)}\n\nQuestion: ${question}`,
          }],
        });
        if (response.stop_reason !== 'refusal') {
          const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
          if (text) return res.json({ answer: text, source: 'ai' });
        }
        // fall through to deterministic on refusal/empty
      } catch (err) {
        console.error('Copilot LLM call failed, using deterministic fallback:', err.message);
      }
    }

    res.json({ answer: answerDeterministically(question, ctx), source: 'rules' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
