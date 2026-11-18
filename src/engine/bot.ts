// Boty: łatwy, średni, trudny. Bot dostaje decyzję i stan gry, zwraca odpowiedź.
// Odpowiedzi botów są zapisywane jak odpowiedzi człowieka, więc mogą używać Math.random.
import { isType } from './card';
import type { CardDef } from './card';
import { card } from './cards';
import type { Game } from './game';
import type { Answer, BotLevel, Decision, PlayerState } from './types';

type Rnd = () => number;

const c = card;
const isAction = (id: string) => isType(c(id), 'action');
const isTreasure = (id: string) => isType(c(id), 'treasure');
const isJunkVictory = (id: string) => (isType(c(id), 'victory') || isType(c(id), 'curse')) && !isAction(id) && !isTreasure(id);
const isTerminal = (d: CardDef) => isType(d, 'action') && !(d.plus?.actions && d.plus.actions > 0);

export function decide(g: Game, d: Decision, level: BotLevel, rnd: Rnd = Math.random, plan?: Plan): Answer {
  const p = g.players[d.player];
  const sloppy = level === 'easy' && rnd() < 0.35;
  if (sloppy && d.kind !== 'buy' && d.kind !== 'action') return randomAnswer(d, rnd);
  if (d.hint && level !== 'easy') return d.hint;

  switch (d.kind) {
    case 'action':
      return chooseAction(g, p, d.playable, level, rnd);
    case 'buy': {
      if (d.treasures.length) return { t: 'playAll' };
      const pile = chooseBuy(g, p, g.turn.coins, d.buyable, level, rnd, plan);
      return pile ? { t: 'buy', pile } : { t: 'end' };
    }
    case 'pile': {
      const maxCost = Math.max(...d.allowed.map((id) => c(id).cost));
      let pile = chooseBuy(g, p, maxCost, d.allowed, level === 'easy' ? 'medium' : level, rnd, plan);
      if (!pile && !d.optional) {
        pile = [...d.allowed].sort((a, b) => score(b) - score(a))[0];
      }
      return { t: 'pile', pile: pile ?? null };
    }
    case 'cards':
      return { t: 'cards', is: chooseCards(g, p, d, level) };
    case 'options':
      return { t: 'opts', is: Array.from({ length: Math.min(d.count, d.options.length) }, (_, i) => i) };
    case 'yesno':
      return { t: 'yes', v: true };
  }
}

function score(id: string): number {
  const d = c(id);
  if (isType(d, 'curse')) return -10;
  return d.cost + d.ai.value / 10;
}

// ---------- akcje ----------

function chooseAction(_g: Game, p: PlayerState, playable: number[], level: BotLevel, rnd: Rnd): Answer {
  const others = (i: number) => playable.filter((j) => j !== i).length;
  const usable = playable.filter((i) => p.hand[i] !== 'horn' || others(i) > 0);
  if (!usable.length) return { t: 'end' };
  if (level === 'easy') return { t: 'play', i: usable[Math.floor(rnd() * usable.length)] };

  const rank = (i: number) => {
    const d = c(p.hand[i]);
    const actions = d.plus?.actions ?? 0;
    let s = d.ai.value;
    if (actions >= 2) s += 30; // wioski najpierw
    else if (actions === 1) s += 20; // potem karty nie zużywające akcji
    if (p.hand[i] === 'horn') s += 15;
    // jeśli to ostatnia akcja, a na ręce czeka lepsza karta dobierania – w porządku, wybierz najwyżej ocenianą
    return s;
  };
  const best = [...usable].sort((a, b) => rank(b) - rank(a))[0];
  return { t: 'play', i: best };
}

// ---------- zakupy ----------

interface DeckStats {
  size: number;
  money: number; // suma monet ze skarbów
  terminals: number;
  villages: number;
  counts: Map<string, number>;
}

function stats(g: Game, p: PlayerState): DeckStats {
  const all = g.allCards(p);
  const counts = new Map<string, number>();
  let money = 0;
  let terminals = 0;
  let villages = 0;
  for (const id of all) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const d = c(id);
    money += d.coins ?? 0;
    if (isTerminal(d)) terminals++;
    if ((d.plus?.actions ?? 0) >= 2) villages++;
  }
  return { size: all.length, money, terminals, villages, counts };
}

/** Ile zostało w stosie, którego wyczerpanie kończy grę (Pałac, jeśli jest; inaczej Cytadela). */
function endPileLeft(g: Game): number {
  return g.supply.palace !== undefined ? g.supply.palace : g.supply.citadel;
}

function vpLead(g: Game, p: PlayerState): number {
  const mine = g.scoreOf(p).vp;
  const best = Math.max(...g.players.filter((o) => o !== p).map((o) => g.scoreOf(o).vp));
  return mine - best;
}

export interface Plan {
  /** Karty Królestwa do kupienia (w kolejności ważności) i docelowa liczba egzemplarzy. */
  want: [string, number][];
}

export function chooseBuy(
  g: Game,
  p: PlayerState,
  coins: number,
  allowed: string[],
  level: BotLevel,
  rnd: Rnd = Math.random,
  plan?: Plan,
): string | null {
  const can = (id: string) => allowed.includes(id) && c(id).cost <= coins;
  const citadels = endPileLeft(g);
  const hasPalace = g.supply.palace !== undefined;

  if (level === 'easy') {
    if (can('palace') && rnd() < 0.7) return 'palace';
    if (can('dragongold') && rnd() < 0.5) return 'dragongold';
    if (can('citadel') && rnd() < 0.7) return 'citadel';
    if (can('gold') && rnd() < 0.6) return 'gold';
    const options = allowed.filter((id) => c(id).cost <= coins && id !== 'hex' && id !== 'copper' && c(id).cost >= Math.min(3, coins - 2));
    if (!options.length) return null;
    return options[Math.floor(rnd() * options.length)];
  }
  if (plan) return planBuy(g, p, coins, allowed, plan);

  const s = stats(g, p);
  const endgame = citadels <= 3 || g.emptyPiles() >= 2;
  if (can('palace')) return 'palace';
  if (hasPalace && can('dragongold') && citadels > 4) return 'dragongold';
  if (can('citadel') && (!hasPalace || citadels <= 6)) return 'citadel';
  if (coins >= 6) {
    if (citadels <= 4 && can('manor')) return 'manor';
    const act = bestAction(g, p, s, coins, allowed, 6);
    if (act && c(act).ai.value >= 7 && (s.counts.get(act) ?? 0) < 2) return act;
    if (can('gold')) return 'gold';
  }
  if (coins >= 5 && citadels <= 5 && can('manor')) return 'manor';

  const act = bestAction(g, p, s, coins, allowed, 0);
  if (act) {
    const v = c(act).ai.value;
    // nie zamieniaj Srebra na słabą kartę
    if (!(can('silver') && v < 4 && c(act).ai.role !== 'trash')) return act;
  }
  if (coins >= 2 && coins <= 4 && endgame && citadels <= 2 && can('homestead')) return 'homestead';
  if (can('silver')) return 'silver';
  if (endgame && can('homestead') && citadels <= 2) return 'homestead';
  return null;
}

/** Zakupy trudnego bota według planu wyliczonego na starcie gry. */
function planBuy(g: Game, p: PlayerState, coins: number, allowed: string[], plan: Plan): string | null {
  const can = (id: string) => allowed.includes(id) && c(id).cost <= coins;
  const s = stats(g, p);
  const citadels = endPileLeft(g);
  const piles = g.emptyPiles();
  const lead = vpLead(g, p);
  const hasPalace = g.supply.palace !== undefined;
  const top = hasPalace ? 'palace' : 'citadel';
  const topVp = c(top).vp ?? 6;

  if (can(top)) {
    // nie bierz przedostatniego/ostatniego stosu kończącego grę, jeśli to oznacza przegraną
    const fallback = hasPalace ? 'citadel' : 'manor';
    if (citadels === 1 && lead + topVp <= 0 && can(fallback)) return fallback;
    if (citadels === 2 && lead + topVp < -topVp && can(fallback)) return fallback;
    return top;
  }
  if (hasPalace) {
    if (can('dragongold') && citadels > 3) return 'dragongold';
    if (can('citadel') && citadels <= 6) return 'citadel';
  }
  if (coins >= 5 && can('manor') && (citadels <= 4 || piles >= 2)) return 'manor';
  for (const [id, n] of plan.want) {
    if (!can(id) || (s.counts.get(id) ?? 0) >= n) continue;
    if (coins >= 6 && c(id).cost < 5 && can('gold')) continue;
    return id;
  }
  if (can('gold')) return 'gold';
  if (coins <= 4 && (citadels <= 2 || piles >= 2) && can('homestead')) return 'homestead';
  if (can('silver')) return 'silver';
  if ((citadels <= 2 || piles >= 2) && can('homestead')) return 'homestead';
  return null;
}

function bestAction(
  g: Game,
  p: PlayerState,
  s: DeckStats,
  coins: number,
  allowed: string[],
  minCost: number,
): string | null {
  const candidates = allowed.filter((id) => {
    const d = c(id);
    if (d.set === 'basic' || !(isType(d, 'action') || isType(d, 'treasure')) || d.cost > coins || d.cost < minCost) return false;
    const have = s.counts.get(id) ?? 0;
    if (d.ai.role === 'trash' && (have >= 1 || p.turns > 6)) return false;
    if (d.ai.role === 'attack' && have >= (id === 'weaver' ? 2 : 1)) return false;
    if (isTerminal(d)) {
      if (s.terminals >= 2) return false;
    } else if (d.ai.role === 'village') {
      return false;
    } else {
      if (have >= 2) return false;
    }
    return true;
  });
  if (!candidates.length) return null;
  const val = (id: string) => {
    const d = c(id);
    let v = d.ai.value + d.cost * 0.3;
    if (d.ai.role === 'trash' && p.turns <= 2) v += 1;
    if (d.ai.role === 'gain' && g.isGameOver()) v -= 5;
    return v;
  };
  return candidates.sort((a, b) => val(b) - val(a))[0];
}

// ---------- wybór kart ----------

/** Jak bardzo chcemy pozbyć się karty (wyżej = bardziej). */
function junk(g: Game, p: PlayerState, id: string, purpose: 'trash' | 'discard'): number {
  const d = c(id);
  if (isType(d, 'curse')) return 100;
  if (isJunkVictory(id)) {
    if (purpose === 'trash') {
      const late = g.supply.citadel <= 4 || g.emptyPiles() >= 2;
      return id === 'homestead' && !late ? 60 : -100;
    }
    return 80;
  }
  if (id === 'copper') {
    if (purpose === 'trash') {
      const s = stats(g, p);
      return s.money - s.counts.get('copper')! >= 4 || p.turns <= 4 ? 40 : -50;
    }
    return 30;
  }
  if (purpose === 'trash') return -100;
  return 20 - d.ai.value - (d.coins ?? 0) * 2;
}

function keepValue(id: string): number {
  const d = c(id);
  if (isType(d, 'curse')) return -10;
  if (isJunkVictory(id)) return -5;
  return d.ai.value + (d.coins ?? 0);
}

function chooseCards(g: Game, p: PlayerState, d: Extract<Decision, { kind: 'cards' }>, _level: BotLevel): number[] {
  const allowed = [...d.allowed];
  const byJunk = (purpose: 'trash' | 'discard') =>
    allowed.map((i) => ({ i, j: junk(g, p, d.cards[i], purpose) })).sort((a, b) => b.j - a.j);
  const pick = (ordered: number[], wanted: number) => ordered.slice(0, Math.max(d.min, Math.min(d.max, wanted)));

  switch (d.purpose) {
    case 'trash': {
      const list = byJunk('trash');
      if (d.source === 'tithe') {
        const cop = allowed.find((i) => d.cards[i] === 'copper');
        if (cop !== undefined) return [cop];
      }
      const good = list.filter((x) => x.j > 0).length;
      return pick(list.map((x) => x.i), good);
    }
    case 'discard':
      return pick(byJunk('discard').map((x) => x.i), d.min);
    case 'discardFor': {
      const list = byJunk('discard');
      const junky = list.filter((x) => x.j >= 80).length;
      return pick(list.map((x) => x.i), d.source === 'pilgrim' ? Math.min(1, junky) : junky);
    }
    case 'keepOnDeck': {
      const bad = allowed.filter((i) => keepValue(d.cards[i]) <= 1);
      return pick(bad, bad.length);
    }
    case 'take': {
      const best = [...allowed].sort((a, b) => keepValue(d.cards[b]) - keepValue(d.cards[a]));
      return keepValue(d.cards[best[0]]) >= 4 ? pick(best, 1) : pick(best, 0);
    }
    case 'topdeck': {
      const afterActions = g.turn.actions === 0 || g.turn.phase !== 'action';
      const acts = allowed.filter((i) => isAction(d.cards[i])).sort((a, b) => keepValue(d.cards[b]) - keepValue(d.cards[a]));
      if (afterActions && acts.length) return pick(acts, 1);
      return pick(byJunk('discard').map((x) => x.i).reverse(), 1);
    }
    case 'replay': {
      const best = [...allowed].sort((a, b) => c(d.cards[b]).ai.value - c(d.cards[a]).ai.value);
      return pick(best, 1);
    }
    case 'loseTreasure': {
      const cheap = [...allowed].sort((a, b) => c(d.cards[a]).cost - c(d.cards[b]).cost);
      return pick(cheap, 1);
    }
    default:
      return pick(allowed, d.min);
  }
}

// ---------- losowo (łatwy bot) ----------

function randomAnswer(d: Decision, rnd: Rnd): Answer {
  const shuffled = <T,>(arr: T[]) => [...arr].sort(() => rnd() - 0.5);
  switch (d.kind) {
    case 'cards': {
      const n = d.min + Math.floor(rnd() * (d.max - d.min + 1));
      return { t: 'cards', is: shuffled(d.allowed).slice(0, n) };
    }
    case 'pile': {
      const nonHex = d.allowed.filter((id) => id !== 'hex');
      const list = nonHex.length ? nonHex : d.allowed;
      return { t: 'pile', pile: list[Math.floor(rnd() * list.length)] };
    }
    case 'options':
      return { t: 'opts', is: shuffled(d.options.map((_, i) => i)).slice(0, Math.min(d.count, d.options.length)) };
    case 'yesno':
      return { t: 'yes', v: rnd() < 0.5 };
    default:
      return { t: 'end' };
  }
}
