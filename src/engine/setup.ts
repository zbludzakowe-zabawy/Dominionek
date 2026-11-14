import type { SetId } from './card';
import { kingdomCards } from './cards';

export const KINGDOM_SIZE = 10;

/** Losuje 10 różnych kart Królestwa z wybranych pakietów. */
export function randomKingdom(sets: SetId[], rnd: () => number = Math.random): string[] {
  const pool = kingdomCards(sets);
  const out: string[] = [];
  while (out.length < KINGDOM_SIZE && pool.length) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

/** Podmienia jedną kartę na losową spoza obecnego Królestwa. */
export function rerollOne(kingdom: string[], index: number, sets: SetId[], rnd: () => number = Math.random): string[] {
  const pool = kingdomCards(sets).filter((id) => !kingdom.includes(id));
  if (!pool.length) return kingdom;
  const next = [...kingdom];
  next[index] = pool[Math.floor(rnd() * pool.length)];
  return next;
}
