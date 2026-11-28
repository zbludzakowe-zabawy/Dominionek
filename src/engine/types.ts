// Wspólne typy silnika. Silnik jest czysty (bez DOM) i deterministyczny:
// stan gry = ustawienia + ziarno + lista odpowiedzi na decyzje.

export type Lang = 'en' | 'pl';
export type Text = Record<Lang, string>;

/** Komunikat do przetłumaczenia: klucz z i18n + parametry. Parametr zaczynający się od "@" to id karty. */
export interface Msg {
  k: string;
  p?: Record<string, string | number>;
}

export type CardType = 'action' | 'treasure' | 'victory' | 'curse' | 'attack' | 'reaction';

export type BotLevel = 'easy' | 'medium' | 'hard';

export interface PlayerSetup {
  name: string;
  bot: BotLevel | null;
}

export interface GameSetup {
  seed: number;
  players: PlayerSetup[];
  kingdom: string[];
  /** Dodatkowe stosy stałe (Skarbiec Smoka): 'dragongold', 'palace'. */
  extras?: string[];
}

export interface PlayerState {
  id: number;
  name: string;
  bot: BotLevel | null;
  deck: string[]; // indeks 0 = wierzch talii
  hand: string[];
  discard: string[];
  play: string[];
  vpTokens: number;
  turns: number;
}

export interface TurnState {
  player: number;
  number: number; // numer tury w całej grze (od 1)
  phase: 'action' | 'buy' | 'cleanup';
  actions: number;
  buys: number;
  coins: number;
  /** Eliksiry (druga waluta, Wieża Alchemika). */
  potions: number;
  boughtSomething: boolean;
  gained: string[];
}

/** Na co bot ma patrzeć przy wyborze kart. */
export type Purpose =
  | 'trash'
  | 'discard' // wymuszone odrzucenie (atak)
  | 'discardFor' // dobrowolne odrzucenie za korzyść
  | 'topdeck'
  | 'replay' // zagraj kartę akcji dwukrotnie
  | 'keepOnDeck' // podejrzane karty: co odrzucić
  | 'take' // weź kartę z innego miejsca na rękę/talię
  | 'gain'
  | 'loseTreasure';

interface DecisionBase {
  player: number;
  prompt: Msg;
  /** Karta, która wywołała decyzję (kontekst dla UI i botów). */
  source?: string;
  /** Podpowiedź dla botów, liczona przez kartę. */
  hint?: Answer;
}

export type Decision =
  | (DecisionBase & { kind: 'action'; playable: number[] })
  | (DecisionBase & { kind: 'buy'; treasures: number[]; buyable: string[] })
  | (DecisionBase & {
      kind: 'cards';
      zone: 'hand' | 'list';
      cards: string[]; // karty do wyboru (dla 'hand' kopia ręki)
      allowed: number[];
      min: number;
      max: number;
      purpose: Purpose;
    })
  | (DecisionBase & { kind: 'pile'; allowed: string[]; optional: boolean; purpose: Purpose })
  | (DecisionBase & { kind: 'options'; options: Msg[]; count: number })
  /** Pytanie tak/nie o kartę `card` (UI pokazuje ją w okienku); `yes`/`no` = napisy na przyciskach. */
  | (DecisionBase & { kind: 'yesno'; card?: string; yes?: Msg; no?: Msg });

export type Answer =
  | { t: 'play'; i: number }
  | { t: 'playAll' }
  | { t: 'buy'; pile: string }
  | { t: 'end' }
  | { t: 'cards'; is: number[] }
  | { t: 'pile'; pile: string | null }
  | { t: 'opts'; is: number[] }
  | { t: 'yes'; v: boolean };

export type Step = Generator<Decision, void, Answer>;
export type Ask<T> = Generator<Decision, T, Answer>;

/** Zdarzenie do animacji (UI): karty na rękę (dobrane / włożone), zdobyta karta, spalone karty. */
export type Fx =
  | { k: 'hand'; p: number; cards: string[]; how: 'draw' | 'put' }
  | { k: 'gain'; p: number; card: string; to: 'discard' | 'hand' | 'deck'; bought: boolean }
  | { k: 'trash'; p: number; cards: string[] }
  /** Skutek ataku gracza `by` (karta `src`) u gracza `p`: karty i co się stało z każdą; `show` = komu pokazać. */
  | { k: 'reveal'; p: number; by: number; src: string; cards: string[]; out: RevealOut[]; show: number[] };

/** Co stało się z kartą: odrzucona, wraca na talię, spalona, zdobyta (na odrzucone / na talię). */
export type RevealOut = 'discard' | 'deck' | 'trash' | 'gain' | 'gainDeck';

export interface LogEntry {
  turn: number;
  player: number;
  msg: Msg;
}
