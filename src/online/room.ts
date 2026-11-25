// Pokój gry online. Dane w bazie (rooms/<id>):
//   cfg    – JSON (tekst) z ustawieniami gry: ziarno, Królestwo, miejsca (człowiek / bot); zapisywany raz
//   seats  – {<nr miejsca>: {name, cid}} – zajęte miejsca ludzi (zapis tylko w puste miejsce)
//   start  – czas rozpoczęcia (zapis raz, przez gospodarza)
//   moves  – {<nr>: JSON odpowiedzi} – lista odpowiedzi na decyzje; zapis tylko w puste miejsce,
//            więc dwa urządzenia nie nadpiszą sobie ruchów
//   ping   – {<nr miejsca>: czas} – kiedy gracz ostatnio miał otwartą grę
// Stan gry = cfg + seats + moves; każde urządzenie odtwarza go silnikiem (Game.replay).
// Odpowiedzi trzymamy jako tekst JSON, bo Firebase gubi puste tablice (np. {t:'cards', is: []}).
import type { Answer, BotLevel, GameSetup } from '../engine/types';
import type { LinkState, Transport } from './transport';
import { TransportError } from './transport';

/** Format pokoju – zmiana wymaga podbicia. */
export const ROOM_V = 1;
const ID_LEN = 20;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export type Slot = { k: 'h' } | { k: 'b'; level: BotLevel };

export interface RoomCfg {
  v: number;
  /** Wersja działania kart (CARDS_REV) – wszyscy muszą mieć tę samą wersję gry. */
  rev: number;
  seed: number;
  kingdom: string[];
  extras: string[];
  /** Miejsca przy stole; 0 = gospodarz (człowiek). */
  slots: Slot[];
}

export interface Seat {
  name: string;
  cid: string;
}

export interface RoomState {
  cfg: RoomCfg | null;
  seats: Record<number, Seat>;
  start: number | null;
  moves: Answer[];
  ping: Record<number, number>;
}

export function randomId(len = ID_LEN): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const validRoomId = (id: string) => /^[A-Za-z0-9]{20,40}$/.test(id);

// ---------- link do pokoju ----------

/** Link do pokoju: adres gry + #room=<id>. */
export function roomLink(base: string, id: string): string {
  return `${base.replace(/#.*$/, '')}#room=${id}`;
}

/** Odczytuje id pokoju z linku, fragmentu „#room=…” albo samego identyfikatora. */
export function parseRoomRef(text: string): { id: string } | null {
  const s = text.trim();
  if (validRoomId(s)) return { id: s };
  const hash = s.includes('#') ? s.slice(s.indexOf('#') + 1) : s;
  const params = new URLSearchParams(hash);
  const id = params.get('room');
  if (!id || !validRoomId(id)) return null;
  return { id };
}

// ---------- odczyt danych pokoju ----------

const num = (k: string) => (/^\d{1,5}$/.test(k) ? Number(k) : -1);

function entries(v: unknown): [number, unknown][] {
  if (Array.isArray(v)) return v.map((x, i) => [i, x] as [number, unknown]).filter(([, x]) => x != null);
  if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => [num(k), x] as [number, unknown]).filter(([i]) => i >= 0);
  return [];
}

export function parseRoom(raw: unknown): RoomState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let cfg: RoomCfg | null = null;
  try {
    if (typeof r.cfg === 'string') cfg = JSON.parse(r.cfg) as RoomCfg;
  } catch {
    cfg = null;
  }
  const seats: Record<number, Seat> = {};
  for (const [i, s] of entries(r.seats)) {
    const seat = s as Partial<Seat>;
    if (typeof seat?.name === 'string' && typeof seat.cid === 'string') seats[i] = { name: seat.name, cid: seat.cid };
  }
  const byIndex = new Map(entries(r.moves));
  const moves: Answer[] = [];
  for (let i = 0; byIndex.has(i); i++) {
    const m = byIndex.get(i);
    try {
      moves.push(JSON.parse(m as string) as Answer);
    } catch {
      break;
    }
  }
  const ping: Record<number, number> = {};
  for (const [i, t] of entries(r.ping)) if (typeof t === 'number') ping[i] = t;
  return { cfg, seats, start: typeof r.start === 'number' ? r.start : null, moves, ping };
}

/** Ustawienia gry dla silnika: ludzie z nazwami z zajętych miejsc, boty z nazwami z listy. */
export function setupOf(state: RoomState, botNames: string[], fallbackName: (i: number) => string): GameSetup | null {
  const cfg = state.cfg;
  if (!cfg) return null;
  let b = 0;
  return {
    seed: cfg.seed,
    kingdom: cfg.kingdom,
    extras: cfg.extras ?? [],
    players: cfg.slots.map((s, i) =>
      s.k === 'b' ? { name: botNames[b++ % botNames.length], bot: s.level } : { name: state.seats[i]?.name || fallbackName(i), bot: null },
    ),
  };
}

export const humanSlots = (cfg: RoomCfg) => cfg.slots.map((s, i) => (s.k === 'h' ? i : -1)).filter((i) => i >= 0);
export const allSeated = (st: RoomState) => !!st.cfg && humanSlots(st.cfg).every((i) => st.seats[i]);
export const seatOf = (st: RoomState, cid: string) => {
  const e = Object.entries(st.seats).find(([, s]) => s.cid === cid);
  return e ? Number(e[0]) : null;
};

// ---------- zakładanie i dołączanie ----------

/** Zakłada pokój (gospodarz zajmuje miejsce 0). Zwraca id pokoju. */
export async function createRoom(t: Transport, cfg: RoomCfg, host: Seat): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomId();
    const ok = await t.create(`rooms/${id}`, { cfg: JSON.stringify(cfg), seats: { 0: host }, at: Date.now() });
    if (ok) return id;
  }
  throw new TransportError('Nie udało się założyć pokoju (reguły bazy?)', 'other');
}

/**
 * Sprawdza, czy reguły bazy chronią zapisane dane: próbuje nadpisać zajęte miejsce gospodarza
 * (tą samą wartością). Jeśli się uda – reguły nie są ustawione (baza w „trybie testowym”).
 */
export async function rulesMissing(t: Transport, id: string, host: Seat): Promise<boolean> {
  try {
    return await t.create(`rooms/${id}/seats/0`, host);
  } catch {
    return false;
  }
}

// ---------- połączenie z pokojem ----------

export class RoomConn {
  state: RoomState = { cfg: null, seats: {}, start: null, moves: [], ping: {} };
  link: LinkState = 'offline';
  /** Ile razy przyszły dane (0 = jeszcze nic). */
  loaded = 0;
  /** Zapis ruchu odrzucony (miejsce zajęte) – urządzenie powinno wczytać grę z bazy. */
  conflicts = 0;
  private subs = new Set<() => void>();
  private stop: (() => void) | null = null;
  private outbox: [number, Answer][] = [];
  private next = 0;
  private sending = false;
  private retry = 0;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly t: Transport,
    readonly id: string,
  ) {}

  open(): this {
    this.stop = this.t.listen(
      `rooms/${this.id}`,
      (raw) => {
        this.state = parseRoom(raw);
        this.loaded++;
        this.emit();
        this.pump();
      },
      (s) => {
        if (s !== this.link) {
          this.link = s;
          this.emit();
        }
      },
    );
    return this;
  }

  close(): void {
    this.stop?.();
    this.stop = null;
    clearInterval(this.pingTimer);
    this.subs.clear();
  }

  on(fn: () => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private emit() {
    this.subs.forEach((f) => f());
  }

  /** Dołącza do pierwszego wolnego miejsca człowieka. Zwraca nr miejsca albo null (brak miejsc). */
  async join(name: string, cid: string): Promise<number | null> {
    const cfg = this.state.cfg;
    if (!cfg) return null;
    const mine = seatOf(this.state, cid);
    if (mine !== null) return mine;
    for (const i of humanSlots(cfg)) {
      if (this.state.seats[i]) continue;
      if (await this.t.create(`rooms/${this.id}/seats/${i}`, { name, cid })) return i;
    }
    return null;
  }

  async begin(): Promise<boolean> {
    return this.t.create(`rooms/${this.id}/start`, Date.now());
  }

  /** Co 30 s zapisuje „jestem” dla danego miejsca (tylko gdy aplikacja jest widoczna). */
  startPing(seat: number): void {
    const beat = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.t.set(`rooms/${this.id}/ping/${seat}`, Date.now()).catch(() => undefined);
    };
    beat();
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(beat, 30000);
  }

  /**
   * Wysyła odpowiedzi, których baza jeszcze nie ma (wszystkie odpowiedzi lokalnej gry; te, które już są
   * w bazie, są pomijane). Zapis po kolei, każdy tylko w puste miejsce.
   */
  push(all: Answer[]): void {
    this.next = Math.max(this.next, this.state.moves.length);
    for (; this.next < all.length; this.next++) this.outbox.push([this.next, all[this.next]]);
    this.pump();
  }

  /** Czy są ruchy czekające na wysłanie. */
  get unsent(): number {
    return this.outbox.length;
  }

  private async pump(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.outbox.length) {
        const [i, a] = this.outbox[0];
        const have = this.state.moves[i];
        if (have) {
          if (JSON.stringify(have) !== JSON.stringify(a)) return this.conflict();
          this.outbox.shift();
          continue;
        }
        let ok: boolean;
        try {
          ok = await this.t.create(`rooms/${this.id}/moves/${i}`, JSON.stringify(a));
        } catch {
          // sieć: spróbuj ponownie za chwilę (coraz rzadziej)
          this.retry = Math.min(this.retry + 1, 6);
          this.link = 'offline';
          this.emit();
          setTimeout(() => this.pump(), 1000 * this.retry);
          return;
        }
        this.retry = 0;
        if (!ok) return this.conflict();
        this.outbox.shift();
        if (!this.outbox.length) this.emit();
      }
    } finally {
      this.sending = false;
    }
  }

  private conflict() {
    this.outbox = [];
    this.next = 0;
    this.conflicts++;
    this.emit();
  }
}

// ---------- moje pokoje (na tym urządzeniu) ----------

export interface MyRoom {
  id: string;
  cid: string;
  /** Moje miejsce (po dołączeniu). */
  seat: number | null;
  host: boolean;
  at: number;
  /** Nazwy graczy (do listy na ekranie startowym). */
  names?: string[];
  over?: boolean;
}

const ROOMS_KEY = 'crownforge-rooms';

export function loadRooms(): MyRoom[] {
  try {
    const v = JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveRoom(r: MyRoom): void {
  const list = [r, ...loadRooms().filter((x) => x.id !== r.id)].slice(0, 8);
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(list));
  } catch {
    /* trudno */
  }
}

export function forgetRoom(id: string): void {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(loadRooms().filter((x) => x.id !== id)));
  } catch {
    /* trudno */
  }
}
