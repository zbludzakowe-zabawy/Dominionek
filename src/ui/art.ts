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

/** Symbole pakietów – mały znak w rogu karty. */
const DRAGON_HEAD =
  // łeb smoka z otwartą paszczą (kontur), patrzy w lewo
  'M8 31Q5.5 26 6 22Q6.6 15 11 12.2L2.5 4.5L14.2 9.6L12.6 2.8L18.6 9.2L27.2 11L29.6 13.2L28.4 15.2L16.4 17.4' +
  'L26.4 24.6L25.4 27L16.4 25.4Q14 26.6 14.6 31' +
  'M6.3 25.2L2.6 24.6L6.2 22.2M7.4 18.6L4 16.6L8.4 15.8' +
  'M26.4 15.4L25.4 17.2L24.2 15.8M21.4 16.4L20.6 18L19.6 16.8M23.6 22.6L23.2 20.8L22.2 21.8M20.4 20.4L20.2 18.8L19.2 19.6' +
  'M14.6 11.6L21.4 13.8';
const DRAGON_EYE = 'M15.8 13.2Q18.8 12.8 20.8 15Q18 16.2 15.8 13.2Z';

const SET_SYMBOLS: Record<string, string> = {
  keep:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 14V5H5V3H7V5H9V3H11V5H13V14ZM7 14V10.5a1 1 0 0 1 2 0V14" fill="currentColor" fill-rule="evenodd"/></svg>',
  hoard:
    '<svg viewBox="-1 -0.5 34 33" aria-hidden="true"><g transform="translate(32 0) scale(-1 1)">' +
    `<path d="${DRAGON_HEAD}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="${DRAGON_EYE}" fill="currentColor"/></g></svg>`,
};

export function setSymbol(c: CardDef): string {
  return SET_SYMBOLS[c.symbol ?? c.set] ?? '';
}
