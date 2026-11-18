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
  // Skarbiec Smoka: tło ze smoczych łusek zamiast kratki
  const scales = (c.symbol ?? c.set) === 'hoard';
  const lattice = scales ? 3 : r.int(3);
  const step = 8 + r.int(5);
  let grid = '';
  if (lattice === 0) {
    for (let x = -H; x < W + H; x += step) grid += `M${f(x)} 0L${f(x + H)} ${H}M${f(x + H)} 0L${f(x)} ${H}`;
  } else if (lattice === 1) {
    for (let x = step / 2; x < W; x += step) grid += `M${f(x)} 0V${H}`;
    for (let y = step / 2; y < H; y += step) grid += `M0 ${f(y)}H${W}`;
  } else if (lattice === 3) {
    const sw = 9;
    for (let row = 0, y = -2; y < H + sw; row++, y += sw / 2) {
      for (let x = row % 2 ? -sw / 2 : 0; x < W + sw; x += sw) grid += `M${f(x)} ${f(y)}a${sw / 2} ${sw / 2} 0 0 0 ${sw} 0`;
    }
  } else {
    for (let y = 0; y < H + step; y += step / 1.6) {
      grid += `M0 ${f(y)}`;
      for (let x = 0; x <= W; x += step) grid += `Q${f(x + step / 2)} ${f(y + (r.next() > 0.5 ? 2 : -2))} ${f(x + step)} ${f(y)}`;
    }
  }
  parts.push(`<path d="${grid}" stroke="${scales ? accent : line}" stroke-opacity="${scales ? '.2' : '.13'}" stroke-width=".5" fill="none"/>`);
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

/** Symbole pakietów (pole 16×16) – mały znak w rogu karty. */
const SET_SYMBOLS: Record<string, string> = {
  keep: 'M3 14V5H5V3H7V5H9V3H11V5H13V14ZM7 14V10.5a1 1 0 0 1 2 0V14',
  // łeb smoka z profilu, z rogiem, ziejący ogniem
  hoard: 'M0.8 16L2.2 9.6Q2.6 6.4 5.2 5.2L2.6 0.9L7 4.1L9.6 4.3L12.6 5.3L11.9 6.8L9.1 7.3L11.4 8.9L8.3 10Q6.6 11.8 6.4 16ZM7.9 5.4a0.75 0.75 0 1 0 0.01 0ZM2.3 10.2L0.2 9.6L2.4 8.6ZM2.7 7.6L1 6.3L3.3 6.4ZM12.2 7.1Q14 5.2 15.9 4.8Q14.6 6.2 13.3 7.5ZM12.4 7.8L16 7.9L13.5 8.6ZM12.1 8.6Q13.9 10.3 15.6 11Q14.4 9.4 13.1 8.3Z',
};

export function setSymbol(c: CardDef): string {
  const d = SET_SYMBOLS[c.symbol ?? c.set];
  return d
    ? `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>`
    : '';
}
