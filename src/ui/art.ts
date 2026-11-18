// Obrazki kart: rysunek kreską (motifs.ts) na spokojnym, wzorzystym tle
// generowanym deterministycznie z id karty.
import { Rng } from '../engine/rng';
import type { CardDef } from '../engine/card';
import { MOTIFS } from './motifs';

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

export interface Art {
  /** Tło (data URI) – kratownica, poświata, pierścień. */
  bg: string;
  /** Rysunek karty (SVG). */
  svg: string;
}

const cache = new Map<string, Art>();

export function cardArt(c: CardDef): Art {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const r = new Rng(hash(c.id));
  const [bg, line, accent] = PALETTE[typeKey(c)];
  const W = 100;
  const H = 60;
  const cx = W / 2;
  const cy = H / 2;
  const parts: string[] = [];

  parts.push(
    `<defs><radialGradient id="g" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="${line}" stop-opacity=".2"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="${bg}"/>`,
    `<rect width="${W}" height="${H}" fill="url(#g)"/>`,
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
  parts.push(`<path d="${grid}" stroke="${line}" stroke-opacity=".13" stroke-width=".5" fill="none"/>`);
  const R = 26;
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${accent}" stroke-opacity=".22" stroke-width=".5"/>`);
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${R + 4}" fill="none" stroke="${line}" stroke-opacity=".16" stroke-width=".4" stroke-dasharray="${1 + r.int(3)} ${2 + r.int(3)}"/>`,
  );
  const dots = 12 + 4 * r.int(3);
  let dd = '';
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2 - Math.PI / 2;
    dd += `<circle cx="${f(cx + Math.cos(a) * (R + 8))}" cy="${f(cy + Math.sin(a) * (R + 8))}" r=".6"/>`;
  }
  parts.push(`<g fill="${accent}" fill-opacity=".3">${dd}</g>`);
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${parts.join('')}</svg>`;

  const m = MOTIFS[c.id];
  let svg = '';
  if (m) {
    svg =
      `<svg viewBox="-6 -3 60 54" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
      `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35">` +
      `<path d="${m.m}" stroke="${line}"/>` +
      (m.a ? `<path d="${m.a}" stroke="${accent}"/>` : '') +
      `</g>` +
      (m.f ? `<path d="${m.f}" fill="${accent}"/>` : '') +
      `</svg>`;
  }
  const art = { bg: `url("data:image/svg+xml,${encodeURIComponent(bgSvg)}")`, svg };
  cache.set(c.id, art);
  return art;
}
