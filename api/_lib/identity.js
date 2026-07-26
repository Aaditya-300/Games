const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getPlayerId(req) {
  const id = req.headers['x-player-id'];
  if (typeof id !== 'string' || !UUID_RE.test(id)) return null;
  return id;
}

export function requirePlayerId(req, res) {
  const id = getPlayerId(req);
  if (!id) {
    res.status(401).json({ code: 'MISSING_PLAYER_ID', message: 'X-Player-Id header required' });
    return null;
  }
  return id;
}
