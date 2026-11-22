import { Rng } from './rng';
import { CARDS, card } from './cards';
import { isType, potionCost } from './card';
import type {
  Answer,
  Ask,
  Decision,
  GameSetup,
  LogEntry,
  Msg,
  PlayerState,
  Purpose,
  Step,
  TurnState,
} from './types';

export const BASIC_TREASURES = ['copper', 'silver', 'gold'];
export const BASIC_VICTORY = ['homestead', 'manor', 'citadel'];
export const HEX = 'hex';
/** Stosy, które Skarbiec Smoka może dodać do stałych: Smocze Złoto i Pałac. */
export const HOARD_EXTRAS = ['dragongold', 'palace'];

export interface Score {
  player: number;
  vp: number;
  turns: number;
  breakdown: { card: string; count: number; vp: number }[];
  tokens: number;
  rank: number;
}

interface HandChoice {
  prompt: Msg;
  min: number;
  max: number;
  purpose: Purpose;
  source?: string;
  filter?: (id: string) => boolean;
  hint?: Answer;
}

interface PileChoice {
  prompt: Msg;
  maxCost: number;
  /** Maks. koszt w Eliksirach (domyślnie 0 – karty z Eliksirem w koszcie są poza zasięgiem). */
  maxPotion?: number;
  filter?: (id: string) => boolean;
  optional?: boolean;
  purpose?: Purpose;
  source?: string;
}

export class Game {
  readonly setup: GameSetup;
  readonly rng: Rng;
  readonly players: PlayerState[];
  readonly supply: Record<string, number> = {};
  readonly pileOrder: string[];
  /** Stałe stosy (pieniądze, punkty, Urok, ew. Smocze Złoto i Pałac). */
  readonly basics: string[];
  /** Karty Królestwa (posortowane wg kosztu). */
  readonly kingdom: string[];
  readonly trash: string[] = [];
  readonly log: LogEntry[] = [];
  readonly answers: Answer[] = [];
  turn: TurnState;
  pending: Decision | null = null;
  over = false;
  /** Zmienia się po każdej zmianie stanu (dla UI). */
  version = 0;
  /**
   * Cofanie ruchów: odpowiedzi o indeksach < undoFloor są nieodwracalne. Próg przesuwa się,
   * gdy zmienia się tura, ktoś inny (bot) coś wybiera albo odkrywa się nowe karty (dobranie,
   * odkrycie z talii, tasowanie) – wtedy cofnięcie ujawniłoby ukrytą informację.
   */
  undoFloor = 0;
  private reveals = 0;
  private gen: Step;

  constructor(setup: GameSetup) {
    this.setup = setup;
    this.rng = new Rng(setup.seed);
    const n = setup.players.length;
    this.players = setup.players.map((ps, id) => ({
      id,
      name: ps.name,
      bot: ps.bot,
      deck: [],
      hand: [],
      discard: [],
      play: [],
      vpTokens: 0,
      turns: 0,
    }));

    const vpCount = n <= 2 ? 8 : 12;
    this.supply.copper = 60 - 7 * n;
    this.supply.silver = 40;
    this.supply.gold = 30;
    this.supply.homestead = vpCount;
    this.supply.manor = vpCount;
    this.supply.citadel = vpCount;
    this.supply.hex = Math.max(10, 10 * (n - 1));
    const kingdom = [...setup.kingdom].sort(
      (a, b) => card(a).cost - card(b).cost || potionCost(card(a)) - potionCost(card(b)) || a.localeCompare(b),
    );
    for (const id of kingdom) {
      if (!CARDS[id]) throw new Error(`Nieznana karta: ${id}`);
      this.supply[id] = isType(card(id), 'victory') ? vpCount : 10;
    }
    const extras = HOARD_EXTRAS.filter((id) => setup.extras?.includes(id));
    // Eliksir – gdy jakakolwiek karta Królestwa kosztuje Eliksir
    const elixir = kingdom.some((id) => potionCost(card(id)) > 0);
    if (elixir) this.supply.elixir = 16;
    if (extras.includes('dragongold')) this.supply.dragongold = 12;
    if (extras.includes('palace')) this.supply.palace = vpCount;
    this.basics = [
      ...BASIC_TREASURES,
      ...(elixir ? ['elixir'] : []),
      ...(extras.includes('dragongold') ? ['dragongold'] : []),
      ...BASIC_VICTORY,
      ...(extras.includes('palace') ? ['palace'] : []),
      HEX,
    ];
    this.kingdom = kingdom;
    this.pileOrder = [...this.basics, ...kingdom];

    for (const p of this.players) {
      p.deck = this.rng.shuffle([...Array(7).fill('copper'), ...Array(3).fill('homestead')]);
      this.draw(p, 5);
    }
    const first = this.rng.int(n);
    this.turn = this.freshTurn(first, 1);
    this.gen = this.run(first);
    this.advance(undefined);
  }

  /** Odtwarza grę z zapisu. */
  static replay(setup: GameSetup, answers: Answer[]): Game {
    const g = new Game(setup);
    for (const a of answers) {
      if (!g.pending) break;
      g.submit(a);
    }
    return g;
  }

  // ---------- sterowanie ----------

  submit(a: Answer): void {
    const d = this.pending;
    if (!d) throw new Error('Brak oczekującej decyzji');
    if (!validAnswer(d, a)) throw new Error(`Nieprawidłowa odpowiedź ${JSON.stringify(a)} na ${d.kind}`);
    const turnBefore = this.turn;
    const revealsBefore = this.reveals;
    this.answers.push(a);
    this.advance(a);
    if (this.players[d.player].bot || this.turn !== turnBefore || this.reveals !== revealsBefore) {
      this.undoFloor = this.answers.length;
    }
  }

  /** Ile ostatnich odpowiedzi można cofnąć (0 = nic). */
  undoable(): number {
    return this.answers.length - this.undoFloor;
  }

  private advance(a: Answer | undefined): void {
    const r = this.gen.next(a as Answer);
    this.version++;
    if (r.done) {
      this.pending = null;
      this.over = true;
    } else {
      this.pending = r.value;
    }
  }

  // ---------- przebieg gry ----------

  private freshTurn(player: number, number: number): TurnState {
    return { player, number, phase: 'action', actions: 1, buys: 1, coins: 0, potions: 0, boughtSomething: false, gained: [] };
  }

  private *run(first: number): Step {
    let current = first;
    let number = 1;
    for (;;) {
      this.turn = this.freshTurn(current, number);
      yield* this.takeTurn(this.players[current]);
      if (this.isGameOver()) break;
      current = (current + 1) % this.players.length;
      number++;
    }
    this.logMsg(-1, 'log.gameOver');
  }

  isGameOver(): boolean {
    if (this.supply.citadel <= 0) return true;
    if (this.supply.palace !== undefined && this.supply.palace <= 0) return true;
    return this.emptyPiles() >= 3;
  }

  emptyPiles(): number {
    return this.pileOrder.filter((id) => this.supply[id] <= 0).length;
  }

  private *takeTurn(p: PlayerState): Step {
    p.turns++;
    const t = this.turn;
    this.logMsg(p.id, 'log.turn', { n: p.turns });

    // Akcje
    while (t.actions > 0) {
      const playable = indicesOf(p.hand, (id) => isType(card(id), 'action'));
      if (playable.length === 0) break;
      const a = yield { kind: 'action', player: p.id, prompt: { k: 'prompt.action' }, playable };
      if (a.t !== 'play') break;
      t.actions--;
      yield* this.playFromHand(p, a.i);
    }

    // Zakupy
    t.phase = 'buy';
    for (;;) {
      // przy 0 zakupach gracz tylko kończy turę (interfejs może to zrobić sam – opcja w menu)
      const treasures = t.boughtSomething ? [] : indicesOf(p.hand, (id) => isType(card(id), 'treasure'));
      const buyable = t.buys > 0 ? this.pileOrder.filter((id) => this.supply[id] > 0 && this.canAfford(id)) : [];
      const prompt = { k: t.buys > 0 ? 'prompt.buy' : 'prompt.noBuys' };
      const a = yield { kind: 'buy', player: p.id, prompt, treasures, buyable };
      if (a.t === 'end') break;
      if (a.t === 'play') {
        yield* this.playFromHand(p, a.i);
      } else if (a.t === 'playAll') {
        for (;;) {
          const i = p.hand.findIndex((id) => isType(card(id), 'treasure'));
          if (i < 0) break;
          yield* this.playFromHand(p, i);
        }
      } else if (a.t === 'buy') {
        t.coins -= card(a.pile).cost;
        t.potions -= potionCost(card(a.pile));
        t.buys--;
        t.boughtSomething = true;
        this.logMsg(p.id, 'log.buy', { card: '@' + a.pile });
        this.gain(p, a.pile, 'discard', true);
      }
    }

    // Porządki
    t.phase = 'cleanup';
    for (const id of [...p.play]) {
      const c = card(id);
      if (c.onCleanup && p.play.includes(id)) yield* c.onCleanup(this, p);
    }
    p.discard.push(...p.play, ...p.hand);
    p.play = [];
    p.hand = [];
    this.draw(p, 5);
  }

  /** Czy obecny gracz stać na kartę (monety i Eliksiry). */
  canAfford(id: string, coins = this.turn.coins, potions = this.turn.potions): boolean {
    const c = card(id);
    return c.cost <= coins && potionCost(c) <= potions;
  }

  *playFromHand(p: PlayerState, i: number): Step {
    const [id] = p.hand.splice(i, 1);
    p.play.push(id);
    this.logMsg(p.id, 'log.play', { card: '@' + id });
    yield* this.resolve(p, id);
  }

  /** Wykonuje efekt karty (bez przenoszenia jej). */
  *resolve(p: PlayerState, id: string): Step {
    const c = card(id);
    const t = this.turn;
    if (c.coins) t.coins += c.coins;
    if (c.potions) t.potions += c.potions;
    if (c.plus) {
      if (c.plus.cards) this.draw(p, c.plus.cards);
      if (c.plus.actions) t.actions += c.plus.actions;
      if (c.plus.buys) t.buys += c.plus.buys;
      if (c.plus.coins) t.coins += c.plus.coins;
      if (c.plus.potions) t.potions += c.plus.potions;
    }
    if (c.play) yield* c.play(this, p);
  }

  // ---------- operacje na kartach ----------

  /** Zapewnia, że talia ma co najmniej n kart (tasuje odrzucone, jeśli trzeba). */
  private ensureDeck(p: PlayerState, n: number): void {
    if (p.deck.length >= n || p.discard.length === 0) return;
    this.reveals++;
    const shuffled = this.rng.shuffle(p.discard.splice(0));
    p.deck.push(...shuffled);
    this.logMsg(p.id, 'log.shuffle');
  }

  draw(p: PlayerState, n: number): string[] {
    const drawn: string[] = [];
    for (let k = 0; k < n; k++) {
      this.ensureDeck(p, 1);
      const id = p.deck.shift();
      if (!id) break;
      drawn.push(id);
    }
    if (drawn.length) this.reveals++;
    p.hand.push(...drawn);
    sortCards(p.hand);
    return drawn;
  }

  /** Zdejmuje z wierzchu talii do n kart (odkrywa je). */
  takeTop(p: PlayerState, n: number): string[] {
    const out: string[] = [];
    for (let k = 0; k < n; k++) {
      this.ensureDeck(p, 1);
      const id = p.deck.shift();
      if (!id) break;
      out.push(id);
    }
    if (out.length) this.reveals++;
    return out;
  }

  addToHand(p: PlayerState, ids: string[]): void {
    p.hand.push(...ids);
    sortCards(p.hand);
  }

  /** Usuwa karty z ręki wg indeksów i zwraca je. */
  takeFromHand(p: PlayerState, is: number[]): string[] {
    const sorted = [...is].sort((a, b) => b - a);
    const out: string[] = [];
    for (const i of sorted) out.unshift(...p.hand.splice(i, 1));
    return out;
  }

  /** Żetony Punktów Zwycięstwa. */
  addVp(p: PlayerState, n: number): void {
    p.vpTokens += n;
    this.logMsg(p.id, 'log.vpToken', { n });
  }

  trashCards(p: PlayerState, ids: string[]): void {
    for (const id of ids) {
      this.trash.push(id);
      this.logMsg(p.id, 'log.trash', { card: '@' + id });
    }
  }

  discardCards(p: PlayerState, ids: string[], log = true): void {
    p.discard.push(...ids);
    if (log) for (const id of ids) this.logMsg(p.id, 'log.discard', { card: '@' + id });
  }

  /** Zdobywa kartę z zasobów. Zwraca true, jeśli się udało. */
  gain(p: PlayerState, id: string, to: 'discard' | 'hand' | 'deck' = 'discard', bought = false): boolean {
    if (!(this.supply[id] > 0)) return false;
    this.supply[id]--;
    if (to === 'hand') this.addToHand(p, [id]);
    else if (to === 'deck') p.deck.unshift(id);
    else p.discard.push(id);
    if (p.id === this.turn.player) this.turn.gained.push(id);
    if (!bought) this.logMsg(p.id, to === 'discard' ? 'log.gain' : to === 'hand' ? 'log.gainHand' : 'log.gainDeck', { card: '@' + id });
    return true;
  }

  /** Atak: dla każdego innego gracza (zgodnie z ruchem wskazówek zegara), chyba że się obroni. */
  *attack(p: PlayerState, fn: (v: PlayerState) => Step): Step {
    const n = this.players.length;
    for (let k = 1; k < n; k++) {
      const v = this.players[(p.id + k) % n];
      const blocker = v.hand.find((id) => card(id).blocksAttacks);
      if (blocker) {
        this.logMsg(v.id, 'log.blocked', { card: '@' + blocker });
        continue;
      }
      yield* fn(v);
    }
  }

  others(p: PlayerState): PlayerState[] {
    const n = this.players.length;
    return Array.from({ length: n - 1 }, (_, k) => this.players[(p.id + k + 1) % n]);
  }

  // ---------- pytania do gracza ----------

  /** Wybór kart z ręki. Zwraca indeksy (w kolejności rosnącej). */
  *chooseFromHand(p: PlayerState, o: HandChoice): Ask<number[]> {
    const allowed = indicesOf(p.hand, o.filter ?? (() => true));
    const max = Math.min(o.max, allowed.length);
    const min = Math.min(o.min, max);
    if (max === 0) return [];
    if (min === max && min === allowed.length) return allowed; // brak wyboru
    const a = yield {
      kind: 'cards',
      zone: 'hand',
      player: p.id,
      prompt: o.prompt,
      source: o.source,
      cards: [...p.hand],
      allowed,
      min,
      max,
      purpose: o.purpose,
      hint: o.hint,
    };
    return a.t === 'cards' ? [...a.is].sort((x, y) => x - y) : [];
  }

  /** Wybór kart z listy (np. odkrytych). Zwraca indeksy w liście. */
  *chooseFromList(
    p: PlayerState,
    cards: string[],
    o: HandChoice,
  ): Ask<number[]> {
    const allowed = indicesOf(cards, o.filter ?? (() => true));
    const max = Math.min(o.max, allowed.length);
    const min = Math.min(o.min, max);
    if (max === 0) return [];
    if (min === max && min === allowed.length) return allowed;
    const a = yield {
      kind: 'cards',
      zone: 'list',
      player: p.id,
      prompt: o.prompt,
      source: o.source,
      cards: [...cards],
      allowed,
      min,
      max,
      purpose: o.purpose,
      hint: o.hint,
    };
    return a.t === 'cards' ? [...a.is].sort((x, y) => x - y) : [];
  }

  *choosePile(p: PlayerState, o: PileChoice): Ask<string | null> {
    const allowed = this.pileOrder.filter(
      (id) =>
        this.supply[id] > 0 &&
        card(id).cost <= o.maxCost &&
        potionCost(card(id)) <= (o.maxPotion ?? 0) &&
        (!o.filter || o.filter(id)),
    );
    if (allowed.length === 0) return null;
    const a = yield {
      kind: 'pile',
      player: p.id,
      prompt: o.prompt,
      source: o.source,
      allowed,
      optional: !!o.optional,
      purpose: o.purpose ?? 'gain',
    };
    return a.t === 'pile' ? a.pile : null;
  }

  *chooseOptions(p: PlayerState, options: Msg[], count: number, prompt: Msg, source?: string, hint?: Answer): Ask<number[]> {
    const a = yield { kind: 'options', player: p.id, prompt, source, options, count, hint };
    return a.t === 'opts' ? a.is : [];
  }

  *yesNo(p: PlayerState, prompt: Msg, source?: string, hint?: boolean): Ask<boolean> {
    const a = yield {
      kind: 'yesno',
      player: p.id,
      prompt,
      source,
      hint: hint === undefined ? undefined : { t: 'yes', v: hint },
    };
    return a.t === 'yes' && a.v;
  }

  // ---------- informacje ----------

  allCards(p: PlayerState): string[] {
    return [...p.deck, ...p.hand, ...p.discard, ...p.play];
  }

  logMsg(player: number, k: string, params?: Msg['p']): void {
    this.log.push({ turn: this.turn?.number ?? 0, player, msg: { k, p: params } });
  }

  scoreOf(p: PlayerState): Omit<Score, 'rank'> {
    const all = this.allCards(p);
    const counts = new Map<string, number>();
    for (const id of all) counts.set(id, (counts.get(id) ?? 0) + 1);
    const breakdown: Score['breakdown'] = [];
    let vp = p.vpTokens;
    for (const [id, count] of counts) {
      const c = card(id);
      let each = c.vp ?? 0;
      let total = each * count;
      if (c.vpFn) total += c.vpFn(all) * count;
      if (total !== 0 || c.vp !== undefined || c.vpFn) {
        breakdown.push({ card: id, count, vp: total });
        vp += total;
      }
    }
    breakdown.sort((a, b) => b.vp - a.vp);
    return { player: p.id, vp, turns: p.turns, breakdown, tokens: p.vpTokens };
  }

  scores(): Score[] {
    const list = this.players.map((p) => this.scoreOf(p));
    const better = (a: typeof list[0], b: typeof list[0]) => b.vp - a.vp || a.turns - b.turns;
    const sorted = [...list].sort(better);
    return sorted.map((s) => ({
      ...s,
      rank: 1 + sorted.filter((o) => better(o, s) < 0).length,
    }));
  }
}

// ---------- pomocnicze ----------

function indicesOf(arr: string[], pred: (id: string) => boolean): number[] {
  const out: number[] = [];
  arr.forEach((id, i) => pred(id) && out.push(i));
  return out;
}

const TYPE_ORDER = (id: string): number => {
  const c = card(id);
  if (isType(c, 'action')) return 0;
  if (isType(c, 'treasure')) return 1;
  if (isType(c, 'victory')) return 2;
  return 3;
};

/** Ręka zawsze posortowana: akcje, skarby, punkty, klątwy; w grupie wg kosztu malejąco. */
export function sortCards(arr: string[]): void {
  arr.sort((a, b) => TYPE_ORDER(a) - TYPE_ORDER(b) || card(b).cost - card(a).cost || a.localeCompare(b));
}

function uniqueIn(is: number[], allowed: number[] | number): boolean {
  if (new Set(is).size !== is.length) return false;
  return is.every((i) => Number.isInteger(i) && (typeof allowed === 'number' ? i >= 0 && i < allowed : allowed.includes(i)));
}

export function validAnswer(d: Decision, a: Answer): boolean {
  switch (d.kind) {
    case 'action':
      return a.t === 'end' || (a.t === 'play' && d.playable.includes(a.i));
    case 'buy':
      return (
        a.t === 'end' ||
        (a.t === 'playAll' && d.treasures.length > 0) ||
        (a.t === 'play' && d.treasures.includes(a.i)) ||
        (a.t === 'buy' && d.buyable.includes(a.pile))
      );
    case 'cards':
      return a.t === 'cards' && a.is.length >= d.min && a.is.length <= d.max && uniqueIn(a.is, d.allowed);
    case 'pile':
      return a.t === 'pile' && (a.pile === null ? d.optional : d.allowed.includes(a.pile));
    case 'options':
      return a.t === 'opts' && a.is.length === Math.min(d.count, d.options.length) && uniqueIn(a.is, d.options.length);
    case 'yesno':
      return a.t === 'yes';
  }
}
