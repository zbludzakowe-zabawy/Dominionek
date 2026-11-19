import type { CardDef, SetId } from '../card';
import { BASIC } from './basic';
import { KEEP } from './keep';
import { HOARD, HOARD_BASICS } from './hoard';
import { TOWER, TOWER_BASICS } from './tower';

export const CARDS: Record<string, CardDef> = {};
for (const c of [...BASIC, ...HOARD_BASICS, ...TOWER_BASICS, ...KEEP, ...HOARD, ...TOWER]) CARDS[c.id] = c;

export function card(id: string): CardDef {
  const c = CARDS[id];
  if (!c) throw new Error(`Nieznana karta: ${id}`);
  return c;
}

export interface SetInfo {
  id: SetId;
  name: { en: string; pl: string };
  available: boolean;
}

export const SETS: SetInfo[] = [
  { id: 'keep', name: { en: 'The Crossroads Keep', pl: 'Twierdza na Rozstajach' }, available: true },
  { id: 'hoard', name: { en: "Dragon's Hoard", pl: 'Skarbiec Smoka' }, available: true },
  { id: 'tower', name: { en: "Alchemist's Tower", pl: 'Wieża Alchemika' }, available: true },
  { id: 'court', name: { en: 'Court Whispers', pl: 'Szepty Dworu' }, available: false },
];

export function kingdomCards(sets: SetId[]): string[] {
  return Object.values(CARDS)
    .filter((c) => c.set !== 'basic' && sets.includes(c.set))
    .map((c) => c.id);
}
