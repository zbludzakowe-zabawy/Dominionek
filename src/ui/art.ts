// Abstrakcyjne, spokojne wzory kart generowane w SVG – deterministycznie z id karty.
// Rozety, kratownice i pierścienie przypominające witraże i herby.
import { Rng } from '../engine/rng';
import type { CardDef } from '../engine/card';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function typeKey(c: CardDef): string {
  if (c.types.includes('curse')) return 'curse';
  if (c.types.includes('attack')) return 'attack';
  if (c.types.includes('reaction')) return 'reaction';
  if (c.types.includes('treasure')) return 'treasure';
  if (c.types.includes('victory') && !c.types.includes('action')) return 'victory';
  return 'action';
}

const PALETTE: Record<string, [string, string, string]> = {
  // tło, linia główna, akcent
  action: ['#2c3440', '#a9b8c6', '#d7c9a7'],
  attack: ['#3a2a28', '#c99a86', '#e0c9a0'],
  reaction: ['#22393a', '#93c2bd', '#d9cfae'],
  treasure: ['#3a3020', '#d8b968', '#f0e2b8'],
  victory: ['#26331f', '#a7c08c', '#e3d9b5'],
  curse: ['#30243a', '#b79ac6', '#d9c3df'],
};

const f = (n: number) => n.toFixed(1);
const cache = new Map<string, string>();

export function cardArt(c: CardDef): string {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const r = new Rng(hash(c.id));
  const [bg, line, accent] = PALETTE[typeKey(c)];
  const W = 100;
  const H = 60;
  const cx = W / 2;
  const cy = H / 2;
  const parts: string[] = [];

  // tło: delikatny gradient + kratownica
  const gid = `g${hash(c.id).toString(36)}`;
  parts.push(
    `<defs><radialGradient id="${gid}" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="${line}" stop-opacity=".22"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="${bg}"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${gid})"/>`,
  );
  const lattice = r.int(3);
  const step = 8 + r.int(5);
  let grid = '';
  if (lattice === 0) {
    for (let x = -H; x < W + H; x += step) grid += `M${f(x)} 0L${f(x + H)} ${H}M${f(x + H)} 0L${f(x)} ${H}`;
  } else if (lattice === 1) {
    for (let x = step / 2; x < W; x += step) grid += `M${f(x)} 0V${H}`;
    for (let y = step / 2; y < H; y += step) grid += `M0 ${f(y)}H${W}`;
  } else {
    for (let y = 0; y < H + step; y += step / 1.6) {
      grid += `M0 ${f(y)}`;
      for (let x = 0; x <= W; x += step) grid += `Q${f(x + step / 2)} ${f(y + (r.next() > 0.5 ? 2 : -2))} ${f(x + step)} ${f(y)}`;
    }
  }
  parts.push(`<path d="${grid}" stroke="${line}" stroke-opacity=".12" stroke-width=".5" fill="none"/>`);

  // rozeta
  const n = [5, 6, 7, 8, 9, 10, 12][r.int(7)];
  const R = 20 + r.int(7);
  const inner = 5 + r.int(6);
  const bend = 0.3 + r.next() * 0.9;
  let petals = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = a - Math.PI / n;
    const a2 = a + Math.PI / n;
    const px = cx + Math.cos(a) * R;
    const py = cy + Math.sin(a) * R;
    const b1x = cx + Math.cos(a1) * R * bend;
    const b1y = cy + Math.sin(a1) * R * bend;
    const b2x = cx + Math.cos(a2) * R * bend;
    const b2y = cy + Math.sin(a2) * R * bend;
    const sx = cx + Math.cos(a) * inner;
    const sy = cy + Math.sin(a) * inner;
    petals += `M${f(sx)} ${f(sy)}Q${f(b1x)} ${f(b1y)} ${f(px)} ${f(py)}Q${f(b2x)} ${f(b2y)} ${f(sx)} ${f(sy)}Z`;
  }
  parts.push(`<path d="${petals}" fill="${line}" fill-opacity=".08" stroke="${line}" stroke-opacity=".75" stroke-width=".7"/>`);

  // pierścienie i wielokąt
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${f(R + 3)}" fill="none" stroke="${accent}" stroke-opacity=".35" stroke-width=".5"/>`);
  if (r.next() > 0.4) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${f(R + 6)}" fill="none" stroke="${line}" stroke-opacity=".25" stroke-width=".4" stroke-dasharray="${f(1 + r.int(3))} ${f(1.5 + r.int(3))}"/>`,
    );
  }
  const m = [3, 4, 6, 8][r.int(4)];
  const pr = inner + 3 + r.int(4);
  let poly = '';
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + (r.next() > 0.5 ? Math.PI / m : 0) - Math.PI / 2;
    poly += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * pr)} ${f(cy + Math.sin(a) * pr)}`;
  }
  parts.push(`<path d="${poly}Z" fill="none" stroke="${accent}" stroke-opacity=".8" stroke-width=".7"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${f(1.6 + r.next() * 1.4)}" fill="${accent}" fill-opacity=".85"/>`);

  // kropki na zewnątrz
  const dots = n * (r.next() > 0.5 ? 2 : 1);
  let dd = '';
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2 - Math.PI / 2;
    dd += `<circle cx="${f(cx + Math.cos(a) * (R + 9))}" cy="${f(cy + Math.sin(a) * (R + 9))}" r=".7"/>`;
  }
  parts.push(`<g fill="${accent}" fill-opacity=".45">${dd}</g>`);

  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
  cache.set(c.id, svg);
  return svg;
}
