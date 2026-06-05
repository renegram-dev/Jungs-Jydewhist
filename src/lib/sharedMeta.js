// Lightweight shared-room metadata in localStorage so the app can RESUME a shared
// room after a restart (the PWA/home-screen relaunch opens the base URL without
// ?room=). This stores only pointers — never the shared hands/history, which
// remain in Firestore (the source of truth).

const KEY = 'jungs-jydewhist.shared.v1';
const MAX_RECENT = 8;

export function loadSharedMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lastRoomCode: null, lastJoinedAt: null, recent: [] };
    const m = JSON.parse(raw);
    return {
      lastRoomCode: typeof m.lastRoomCode === 'string' ? m.lastRoomCode : null,
      lastJoinedAt: typeof m.lastJoinedAt === 'string' ? m.lastJoinedAt : null,
      recent: Array.isArray(m.recent)
        ? m.recent.filter((r) => r && typeof r.roomCode === 'string')
        : [],
    };
  } catch {
    return { lastRoomCode: null, lastJoinedAt: null, recent: [] };
  }
}

function save(meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

/** Remember a room as the last/most-recent one joined or created. */
export function recordSharedRoom({ roomCode, sessionName } = {}) {
  if (!roomCode) return loadSharedMeta();
  const meta = loadSharedMeta();
  const now = new Date().toISOString();
  const entry = { roomCode, sessionName: sessionName || '', joinedAt: now };
  const recent = [entry, ...meta.recent.filter((r) => r.roomCode !== roomCode)].slice(0, MAX_RECENT);
  const next = { lastRoomCode: roomCode, lastJoinedAt: now, recent };
  save(next);
  return next;
}

/** Keep a remembered room's display name fresh once the doc loads. */
export function updateRecentRoomName(roomCode, sessionName) {
  if (!roomCode || !sessionName) return;
  const meta = loadSharedMeta();
  let changed = false;
  const recent = meta.recent.map((r) => {
    if (r.roomCode === roomCode && r.sessionName !== sessionName) {
      changed = true;
      return { ...r, sessionName };
    }
    return r;
  });
  if (changed) save({ ...meta, recent });
}

/** Forget the "last" room (used by "Bliv lokal" / leaving) — keeps the recent list. */
export function clearLastSharedRoom() {
  const meta = loadSharedMeta();
  save({ ...meta, lastRoomCode: null });
  return loadSharedMeta();
}

export function getLastSharedRoomCode() {
  return loadSharedMeta().lastRoomCode;
}

export function getRecentSharedRooms() {
  return loadSharedMeta().recent;
}
