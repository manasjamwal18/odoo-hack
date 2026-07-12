// In-memory SSE client registry: userId → Set of open responses
const clients = new Map();

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
}

function sendToUser(userId, event, data) {
  const set = clients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* client gone; cleaned up on close */ }
  }
}

function broadcast(event, data) {
  for (const userId of clients.keys()) sendToUser(userId, event, data);
}

module.exports = { addClient, removeClient, sendToUser, broadcast };
