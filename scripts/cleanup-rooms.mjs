#!/usr/bin/env node
// Cotygodniowe sprzątanie starych pokoi gry online (GitHub Actions: .github/workflows/cleanup-rooms.yml).
// Te same zasady co w aplikacji i w regułach bazy (src/online/room.ts, firebase/database.rules.json):
//   - pokój bez aktywności przez 14 dni (act, a bez niego at) – usuwany,
//   - pokój zastąpiony rewanżem (ma next) – po 2 dniach,
//   - śmieci (brak cfg i czasu założenia) – usuwane.
// Aplikacja sprząta tylko pokoje ze swojej listy; ten skrypt widzi całą bazę (konto usługi omija reguły).
//
//   FIREBASE_SERVICE_ACCOUNT='{...json klucza...}' node scripts/cleanup-rooms.mjs [--dry-run]
//   FIREBASE_DB=http://localhost:9400 node scripts/cleanup-rooms.mjs --no-auth   # udawana baza (fake-firebase)
import { createSign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const DB = 'https://crownforge-5710b-default-rtdb.europe-west1.firebasedatabase.app';
const DAY = 24 * 3600 * 1000;
export const ROOM_TTL_MS = 14 * DAY;
export const OLD_TTL_MS = 2 * DAY;

/**
 * Czy usunąć pokój. `room` = {act?, at?, next?, cfg?} (tylko te pola).
 * Zwraca powód (tekst) albo null, gdy pokój zostaje.
 */
export function deleteReason(room, now = Date.now()) {
  const last = typeof room.act === 'number' ? room.act : typeof room.at === 'number' ? room.at : null;
  if (last === null) return room.cfg == null ? 'pusty' : null;
  const idle = now - last;
  if (idle > ROOM_TTL_MS) return `bez gry ${Math.floor(idle / DAY)} dni`;
  if (room.next && idle > OLD_TTL_MS) return `po rewanżu, ${Math.floor(idle / DAY)} dni`;
  return null;
}

// ---------- dostęp do bazy ----------

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/** Token dostępu z klucza konta usługi (JWT podpisany RS256 → oauth2.googleapis.com). */
async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url({ alg: 'RS256', typ: 'JWT' });
  const claims = b64url({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key).toString('base64url');
  const r = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` }),
  });
  if (!r.ok) throw new Error(`Nie udało się zalogować kontem usługi: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

function client(db, token) {
  const url = (path, q = {}) => {
    const u = new URL(`${db}/${path}.json`);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    if (token) u.searchParams.set('access_token', token);
    return u;
  };
  return {
    async get(path, q) {
      const r = await fetch(url(path, q));
      if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status} ${await r.text()}`);
      return r.json();
    },
    async remove(path) {
      const r = await fetch(url(path, { print: 'silent' }), { method: 'PUT', body: 'null' });
      if (!r.ok && r.status !== 204) throw new Error(`usuwanie ${path}: HTTP ${r.status} ${await r.text()}`);
    },
  };
}

export async function cleanup({ db, token, dryRun, now = Date.now(), log = console.log }) {
  const c = client(db, token);
  const list = (await c.get('rooms', { shallow: 'true' })) ?? {};
  const ids = Object.keys(list);
  let removed = 0;
  for (const id of ids) {
    const [act, at, next, cfg] = await Promise.all(['act', 'at', 'next', 'cfg'].map((f) => c.get(`rooms/${id}/${f}`, { shallow: 'true' })));
    const why = deleteReason({ act, at, next, cfg }, now);
    if (!why) continue;
    log(`${dryRun ? '[próba] ' : ''}usuwam ${id} (${why})`);
    if (!dryRun) await c.remove(`rooms/${id}`);
    removed++;
  }
  log(`Pokoi w bazie: ${ids.length}, ${dryRun ? 'do usunięcia' : 'usunięto'}: ${removed}, zostaje: ${ids.length - removed}.`);
  return { total: ids.length, removed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const db = process.env.FIREBASE_DB || DB;
  let token = null;
  if (!args.includes('--no-auth')) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('Brak klucza: ustaw FIREBASE_SERVICE_ACCOUNT (sekret repozytorium na GitHubie).');
    token = await accessToken(JSON.parse(raw));
  }
  await cleanup({ db, token, dryRun });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  });
}
