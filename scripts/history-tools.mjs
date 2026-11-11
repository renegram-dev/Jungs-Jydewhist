// Offline tools for the one-time history migration. No network, no credentials.
//
//   node scripts/history-tools.mjs build  <backupDir> <seedOut.json>
//       Reads the verified Firestore backup (read-only), validates the two real
//       evenings (63U82R: 13 hands, WVACWK: 7 hands) and writes a seed file for
//       the in-app "Importér historik". Other rooms are ignored.
//   node scripts/history-tools.mjs verify <exportFromApp.json> <seed.json>
//       Confirms the live history (exported from the app) still contains both
//       evenings byte-for-byte equal (hands, ids, timestamps, totals, medals).
//
// Prints only non-secret summaries (ids, counts, totals, hashes).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildSeed, verifyAgainstSeed, canonicalJson, EXPECTED_ROOMS } from '../src/lib/seed.js';
import { buildExport, parseExport } from '../src/lib/historyOps.js';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.toLowerCase().endsWith('.json')) out.push(p);
  }
  return out;
}

// Accepts a plain room doc, {data:{...}}, {doc:{...}}, or arrays/{documents:[...]} of those.
function* candidates(node) {
  if (Array.isArray(node)) {
    for (const x of node) yield* candidates(x);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.hands) && typeof node.roomCode === 'string') yield node;
  for (const k of ['data', 'doc', 'document', 'documents', 'rooms']) {
    if (node[k]) yield* candidates(node[k]);
  }
}

function sha(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex').slice(0, 12);
}

function build(dir, outFile) {
  const found = {};
  for (const file of walk(dir)) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const room of candidates(parsed)) {
      if (!(room.roomCode in EXPECTED_ROOMS)) continue;
      const prev = found[room.roomCode];
      if (prev && canonicalJson(prev) !== canonicalJson(room)) {
        throw new Error(`room ${room.roomCode}: two different copies found (${file}) - resolve manually`);
      }
      found[room.roomCode] = room;
    }
  }
  const { doc, report } = buildSeed(found);
  fs.writeFileSync(outFile, buildExport(doc), 'utf8');
  console.log('Seed OK ->', outFile);
  for (const r of report) console.log(`  room ${r.room}: "${r.name}" ${r.hands} hands`);
  for (const a of doc.archivedSessions) {
    console.log(`  ${a.id}: totals ${JSON.stringify(a.totals)} medals ${JSON.stringify(a.medals)} hands# ${sha(a.hands)}`);
  }
  console.log(`  total hands: ${doc.archivedSessions.reduce((n, a) => n + a.hands.length, 0)}`);
}

function verify(liveFile, seedFile) {
  const live = parseExport(fs.readFileSync(liveFile, 'utf8'));
  const seed = parseExport(fs.readFileSync(seedFile, 'utf8'));
  if (!live.ok || !seed.ok) throw new Error(live.error || seed.error);
  const res = verifyAgainstSeed(live.doc, seed.doc);
  if (!res.ok) {
    console.error('VERIFY FAILED:\n- ' + res.problems.join('\n- '));
    process.exit(1);
  }
  console.log('VERIFY OK: both evenings identical to the seed (hands, ids, timestamps, totals, medals).');
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === 'build' && a && b) build(a, b);
  else if (cmd === 'verify' && a && b) verify(a, b);
  else {
    console.error('usage: history-tools.mjs build <backupDir> <seedOut.json> | verify <export.json> <seed.json>');
    process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
