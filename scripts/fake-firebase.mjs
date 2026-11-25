#!/usr/bin/env node
// Udawana Firebase Realtime Database (REST + strumień zdarzeń) do testów gry online bez internetu.
// Naśladuje reguły z firebase/database.rules.json w uproszczeniu (zapis tylko w puste miejsce itd.).
//   node scripts/fake-firebase.mjs [port] [--open]
// --open = bez reguł (jak baza w „trybie testowym”) – aplikacja powinna ostrzec gospodarza.
import http from 'node:http';

const port = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 9400);
const open = process.argv.includes('--open');
// po ilu ms bez aktywności wolno usunąć pokój (jak w regułach: 14 dni, pokój z rewanżem 2 dni);
// do testów FAKE_TTL_MS / FAKE_OLD_TTL_MS
const ttl = Number(process.env.FAKE_TTL_MS ?? 14 * 24 * 3600 * 1000);
const oldTtl = Number(process.env.FAKE_OLD_TTL_MS ?? 2 * 24 * 3600 * 1000);
let data = null;
const streams = new Set();

const keys = (p) => p.split('/').filter(Boolean);
const get = (p) => keys(p).reduce((c, k) => (c && typeof c === 'object' ? c[k] ?? null : null), data);
function set(p, v) {
  const ks = keys(p);
  if (!ks.length) return void (data = v);
  data = data && typeof data === 'object' ? data : {};
  let cur = data;
  for (const k of ks.slice(0, -1)) cur = cur[k] = cur[k] && typeof cur[k] === 'object' ? cur[k] : {};
  if (v === null) delete cur[ks[ks.length - 1]];
  else cur[ks[ks.length - 1]] = v;
}

/** Uproszczone reguły: czy wolno zapisać `value` pod `p`. */
function allowed(p, value) {
  if (open) return true;
  const [root, room, field, sub, ...rest] = keys(p);
  const exists = get(p) !== null;
  const base = `rooms/${room}`;
  // zmiana imienia w poczekalni: rooms/<id>/seats/<nr>/name
  if (root === 'rooms' && room && field === 'seats' && rest.length === 1 && rest[0] === 'name')
    return exists && get(`${base}/start`) === null && typeof value === 'string' && value.length >= 1 && value.length <= 24;
  if (root !== 'rooms' || !room || rest.length) return false;
  if (!field && value === null) {
    if (!exists) return true;
    const last = typeof get(`${base}/act`) === 'number' ? get(`${base}/act`) : get(`${base}/at`);
    if (typeof last !== 'number') return false;
    return last < Date.now() - ttl || (get(`${base}/next`) !== null && last < Date.now() - oldTtl);
  }
  if (!field) return !exists && room.length >= 20 && room.length <= 40 && typeof value?.cfg === 'string';
  if (field === 'seats') return /^\d$/.test(sub ?? '') && !exists && get(`${base}/cfg`) !== null && get(`${base}/start`) === null && typeof value?.name === 'string';
  if (field === 'start') return !sub && !exists && get(`${base}/cfg`) !== null && typeof value === 'number';
  if (field === 'moves') return /^\d{1,5}$/.test(sub ?? '') && !exists && get(`${base}/start`) !== null && get(`${base}/end`) === null && typeof value === 'string';
  if (field === 'end') return !sub && !exists && get(`${base}/start`) !== null && Number.isInteger(value) && get(`${base}/seats/${value}`) !== null;
  if (field === 'act') return !sub && get(`${base}/cfg`) !== null && typeof value === 'number';
  if (field === 'prep') return !sub && get(`${base}/start`) !== null && typeof value === 'number';
  if (field === 'next') return !sub && !exists && get(`${base}/start`) !== null && typeof value === 'string' && value.length >= 20 && value.length <= 40;
  if (field === 'ping') return /^\d$/.test(sub ?? '') && get(`${base}/cfg`) !== null && typeof value === 'number';
  return false;
}

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.end();
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.endsWith('.json')) return res.writeHead(404).end();
    const path = decodeURIComponent(url.pathname.slice(0, -5));
    if (req.method === 'GET' && (req.headers.accept ?? '').includes('text/event-stream')) {
      if (!keys(path)[1] || keys(path)[0] !== 'rooms') return res.writeHead(401).end();
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const send = () => res.write(`event: put\ndata: ${JSON.stringify({ path: '/', data: get(path) })}\n\n`);
      const s = { path, send };
      streams.add(s);
      send();
      const ka = setInterval(() => res.write('event: keep-alive\ndata: null\n\n'), 15000);
      req.on('close', () => {
        clearInterval(ka);
        streams.delete(s);
      });
      return;
    }
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(get(path)));
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let value;
        try {
          value = JSON.parse(body);
        } catch {
          return res.writeHead(400).end('{"error":"Invalid data"}');
        }
        if (!allowed(path, value)) return res.writeHead(401).end('{"error":"Permission denied"}');
        set(path, value);
        for (const s of streams) if (path.startsWith(s.path) || s.path.startsWith(path)) s.send();
        res.writeHead(url.searchParams.get('print') === 'silent' ? 204 : 200).end(url.searchParams.get('print') === 'silent' ? undefined : body);
      });
      return;
    }
    res.writeHead(405).end();
  })
  .listen(port, () => console.log(`fake firebase: http://localhost:${port}${open ? ' (bez reguł)' : ''}`));
