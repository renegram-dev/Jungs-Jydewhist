import { describe, it, expect } from 'vitest';
import {
  addHandPatch,
  undoPatch,
  deleteHandPatch,
  archivePatch,
  deleteArchivedPatch,
  buildExport,
  parseExport,
  validateHistoryDoc,
} from '../lib/historyOps.js';
import { buildSeed, verifyAgainstSeed, checkHand } from '../lib/seed.js';
import { cumulativeTotals, getArchivedSessions } from '../lib/sharedGameUtils.js';
import { PLAYERS } from '../lib/scoring.js';

function hand(id, a = 10, b = 10, c = -10, d = -10, ts = '2026-06-05T18:00:00.000Z') {
  return { id, timestamp: ts, delta: { René: a, Thomas: b, Carsten: c, Tom: d } };
}
function room(code, n, month) {
  const hands = Array.from({ length: n }, (_, i) =>
    i % 2 ? hand(`${code}-${i}`, -20, 20, 0, 0, `2026-${month}-05T1${i % 10}:00:00.000Z`)
          : hand(`${code}-${i}`, 10, 10, -10, -10, `2026-${month}-05T1${i % 10}:00:00.000Z`),
  );
  return { roomCode: code, sessionName: `Aften ${code}`, hands, archivedSessions: [] };
}
const base = () => ({ roomCode: 'main', sessionName: 'Aften', players: [...PLAYERS], hands: [], archivedSessions: [] });

describe('historyOps (transaction patches)', () => {
  it('adds, undoes and deletes hands without touching archives', () => {
    let d = base();
    d = { ...d, ...addHandPatch(d, hand('a')) };
    d = { ...d, ...addHandPatch(d, hand('b')) };
    expect(d.hands.map((h) => h.id)).toEqual(['a', 'b']);
    expect(addHandPatch(d, hand('a'))).toBeNull(); // idempotent
    d = { ...d, ...deleteHandPatch(d, 'a') };
    expect(d.hands.map((h) => h.id)).toEqual(['b']);
    d = { ...d, ...undoPatch(d) };
    expect(d.hands).toEqual([]);
  });

  it('archiving keeps earlier evenings and cumulative totals', () => {
    let d = base();
    d = { ...d, ...addHandPatch(d, hand('a')) };
    d = { ...d, ...archivePatch(d) };
    d = { ...d, ...addHandPatch(d, hand('b', -20, 20, 0, 0)) };
    d = { ...d, ...archivePatch(d) };
    expect(getArchivedSessions(d)).toHaveLength(2);
    expect(d.hands).toEqual([]);
    const t = cumulativeTotals(d);
    expect(t).toEqual({ René: -10, Thomas: 30, Carsten: -10, Tom: -10 });
    expect(PLAYERS.reduce((s, p) => s + t[p], 0)).toBe(0);
    const id = d.archivedSessions[0].id;
    d = { ...d, ...deleteArchivedPatch(d, id) };
    expect(d.archivedSessions).toHaveLength(1);
  });

  it('refuses to archive nothing', () => {
    expect(() => archivePatch(base())).toThrow();
  });

  it('export round-trips and rejects junk', () => {
    const d = { ...base(), updatedAt: { seconds: 1 } };
    const text = buildExport(d);
    expect(text).not.toContain('updatedAt');
    const p = parseExport(text);
    expect(p.ok).toBe(true);
    expect(validateHistoryDoc(p.doc)).toEqual([]);
    expect(parseExport('nope').ok).toBe(false);
    expect(parseExport(JSON.stringify({ players: ['x'], hands: [] })).ok).toBe(false);
  });
});

describe('historical seed (June 13 + August 7 hands)', () => {
  const rooms = () => ({ '63U82R': room('63U82R', 13, '06'), WVACWK: room('WVACWK', 7, '08') });

  it('builds two evenings, 20 hands, verbatim, zero-sum, with medals', () => {
    const src = rooms();
    const { doc } = buildSeed(src);
    expect(doc.archivedSessions).toHaveLength(2);
    expect(doc.hands).toEqual([]);
    expect(doc.archivedSessions.map((a) => a.hands.length)).toEqual([13, 7]);
    expect(doc.archivedSessions[0].hands).toEqual(src['63U82R'].hands); // verbatim
    for (const a of doc.archivedSessions) {
      expect(PLAYERS.reduce((s, p) => s + a.totals[p], 0)).toBe(0);
      expect(Object.keys(a.medals).sort()).toEqual([...PLAYERS].sort());
    }
    const t = cumulativeTotals(doc);
    expect(PLAYERS.reduce((s, p) => s + t[p], 0)).toBe(0);
  });

  it('uses stored archives verbatim when the room already archived the evening', () => {
    const r = rooms();
    const hands = r['63U82R'].hands;
    r['63U82R'] = {
      ...r['63U82R'],
      hands: [],
      archivedSessions: [{ id: 'orig-id', name: '5. juni', startedAt: hands[0].timestamp, archivedAt: 'x', hands, handCount: 13 }],
    };
    const { doc } = buildSeed(r);
    expect(doc.archivedSessions.find((a) => a.id === 'orig-id').hands).toEqual(hands);
  });

  it('fails loudly on wrong counts, non-zero-sum hands, or mismatching stored totals', () => {
    const r1 = rooms();
    r1.WVACWK.hands.pop();
    expect(() => buildSeed(r1)).toThrow(/expected 7/);

    const r2 = rooms();
    r2.WVACWK.hands[0] = hand('bad', 10, 10, -10, -9);
    expect(() => buildSeed(r2)).toThrow(/not 0/);
    expect(checkHand(hand('x', 1, 1, 1, 1))).not.toEqual([]);

    const r3 = rooms();
    const hs = r3['63U82R'].hands;
    r3['63U82R'] = { ...r3['63U82R'], hands: [], archivedSessions: [{ id: 'e', name: 'x', startedAt: hs[0].timestamp, hands: hs, totals: { René: 999, Thomas: 0, Carsten: 0, Tom: 0 } }] };
    expect(() => buildSeed(r3)).toThrow(/totals differ/);

    expect(() => buildSeed({ '63U82R': room('63U82R', 13, '06') })).toThrow(/WVACWK/);
  });

  it('verify detects any change to the migrated evenings', () => {
    const { doc } = buildSeed(rooms());
    const live = JSON.parse(JSON.stringify({ ...doc, hands: [hand('new')] })); // new hands are fine
    expect(verifyAgainstSeed(live, doc).ok).toBe(true);
    live.archivedSessions[1].hands[0].delta.René += 1;
    live.archivedSessions[1].hands[0].delta.Thomas -= 1;
    expect(verifyAgainstSeed(live, doc).ok).toBe(false);
    const missing = { ...doc, archivedSessions: [doc.archivedSessions[0]] };
    expect(verifyAgainstSeed(missing, doc).problems.join()).toMatch(/missing evening/);
  });
});
