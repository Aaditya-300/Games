const STORAGE_KEY = 'playerId';

function readOrCreate() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// Computed once per session — the ID never changes while this tab is open.
const playerId = readOrCreate();

export function getPlayerId() {
  return playerId;
}
