// Skrót działania karty symbolami (widok stosów Królestwa „Symbole”).
// Standardowe bonusy (+karty, +akcje, +zakupy, +monety, +Eliksir) i wartość skarbu
// biorą się z definicji karty; resztę (spalanie, odrzucanie, PZ, „…” = dłuższy opis)
// opisuje lista EXTRA.
import { card } from '../engine/cards';

export type SymKind = 'card' | 'act' | 'buy' | 'coin' | 'potion' | 'vp' | 'trash' | 'discard' | 'more';

export interface Sym {
  k: SymKind;
  /** Liczba (brak = bez liczby, np. „spal kartę”, PZ zależne od talii). */
  n?: number;
  /** Bonus „+N” (karty, akcje, zakupy, monety, żetony PZ). */
  plus?: boolean;
}

const trash = (n?: number): Sym => ({ k: 'trash', n });
const discard = (n?: number): Sym => ({ k: 'discard', n });
const vp = (n?: number, plus = false): Sym => ({ k: 'vp', n, plus });
const more: Sym = { k: 'more' };

/** Efekty spoza `plus`/`coins`, w kolejności wyświetlania (po standardowych bonusach). */
export const EXTRA: Record<string, Sym[]> = {
  // Twierdza na Rozstajach
  ward: [more],
  hedgewitch: [trash(2)],
  pilgrim: [discard(), more],
  gnome: [discard(), more],
  inn: [],
  ranger: [more],
  herald: [more],
  tinker: [more],
  guard: [more],
  lantern: [more],
  tithe: [trash(), more],
  forgemaster: [],
  siren: [more],
  orchard: [vp(), more],
  minstrel: [],
  horn: [more],
  footpad: [more],
  scriptorium: [],
  bazaar: [],
  weaver: [more],
  banditchief: [more],
  smelter: [trash(), more],
  council: [more],
  sage: [more],
  artisan: [more],
  // Skarbiec Smoka
  hoardrat: [more],
  clerk: [],
  moneychanger: [trash(), more],
  gildedscale: [],
  wyrmling: [more],
  gemcutter: [trash(), more],
  tribute: [more],
  ancientcoin: [],
  strongroom: [discard(), more],
  mint: [more],
  altar: [discard(2)],
  map: [more],
  lair: [vp(), more],
  hoardkey: [more],
  dragonpurse: [more],
  goldsmith: [trash(), more],
  elderdragon: [more],
  // Wieża Alchemika
  apprentice: [more],
  mortar: [trash()],
  crystal: [more],
  quicksilver: [more],
  vapors: [more],
  alembic: [trash(), more],
  cauldron: [more],
  transmute: [trash(), more],
  retort: [],
  herbgarden: [vp(), more],
  // Homunkulus: wymiana karty + obrona przed atakiem
  homunculus: [more],
  golem: [],
  // Wielkie Dzieło: Skarb za 3 (moneta z definicji) + zdobywa Złoto i Zagrodę
  magnumopus: [more],
  // Warzelnik: bonusy z definicji + odłożenie na talię na koniec tury
  brewer: [more],
};

export function cardSymbols(id: string): Sym[] {
  const c = card(id);
  const out: Sym[] = [];
  const p = c.plus ?? {};
  if (p.cards) out.push({ k: 'card', n: p.cards, plus: true });
  if (p.actions) out.push({ k: 'act', n: p.actions, plus: true });
  if (p.buys) out.push({ k: 'buy', n: p.buys, plus: true });
  if (p.coins) out.push({ k: 'coin', n: p.coins, plus: true });
  if (p.potions) out.push({ k: 'potion', n: p.potions, plus: true });
  // skarb: wartość monety (bez plusa), Eliksir
  if (c.coins !== undefined && c.coins > 0) out.push({ k: 'coin', n: c.coins });
  if (c.potions) out.push({ k: 'potion', n: c.potions });
  if (c.vp !== undefined) out.push(vp(c.vp));
  const extra = EXTRA[id];
  if (extra) out.push(...extra);
  else if (c.text.en) out.push(more);
  return out;
}
