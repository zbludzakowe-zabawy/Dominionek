import type { CardType, PlayerState, Step, Text } from './types';
import type { Game } from './game';

export type SetId = 'basic' | 'keep' | 'hoard' | 'tower' | 'court';

export type AiRole = 'village' | 'draw' | 'cantrip' | 'money' | 'attack' | 'trash' | 'gain' | 'victory' | 'other';

export interface Plus {
  cards?: number;
  actions?: number;
  buys?: number;
  coins?: number;
  potions?: number;
}

export interface CardDef {
  id: string;
  set: SetId;
  /** Symbol pakietu w rogu karty (domyślnie wg `set`). */
  symbol?: SetId;
  name: Text;
  /** Tekst poza standardowymi bonusami (te UI rysuje z `plus`). */
  text: Text;
  types: CardType[];
  cost: number;
  /** Koszt w Eliksirach (Wieża Alchemika). */
  potionCost?: number;
  /** Wartość skarbu. */
  coins?: number;
  /** Ile Eliksirów daje skarb. */
  potions?: number;
  /** Stałe punkty zwycięstwa. */
  vp?: number;
  /** Punkty zależne od talii właściciela (wszystkie jego karty). */
  vpFn?: (cards: string[]) => number;
  plus?: Plus;
  play?: (g: Game, p: PlayerState) => Step;
  /** Na koniec tury, zanim karty z gry trafią na stos odrzuconych (raz na każdy egzemplarz w grze). */
  onCleanup?: (g: Game, p: PlayerState) => Step;
  /** Reakcja chroniąca przed atakami, gdy karta jest na ręce. */
  blocksAttacks?: boolean;
  /** Wskazówki dla botów. value ~ siła karty (0–10), role ~ do czego służy. */
  ai: { value: number; role: AiRole; terminal?: boolean };
}

export const isType = (c: CardDef, t: CardType) => c.types.includes(t);

export const potionCost = (c: CardDef) => c.potionCost ?? 0;
