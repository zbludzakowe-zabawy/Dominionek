import { describe, expect, it } from 'vitest';
import { decide } from '../engine/bot';
import { Game } from '../engine/game';
import { Rng } from '../engine/rng';
import { randomKingdom } from '../engine/setup';
import { MemoryStore } from './transport';
import { RoomConn, allSeated, createRoom, parseRoom, parseRoomRef, roomLink, rulesMissing, setupOf, type RoomCfg } from './room';
import { reconcile } from './sync';

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(n = 5) {
  for (let i = 0; i < n; i++) await tick();
}

function cfg(seed: number, slots: RoomCfg['slots']): RoomCfg {
  const r = new Rng(seed);
  return { v: 1, rev: 3, seed, kingdom: randomKingdom(['keep', 'hoard', 'tower', 'court'], () => r.next()), extras: [], slots };
}

/** Urządzenie gracza: połączenie z pokojem + lokalna kopia gry (jak GameScreen). */
class Device {
  game: Game | null = null;
  constructor(
    readonly conn: RoomConn,
    readonly seat: number,
    readonly host: boolean,
    readonly rng: Rng,
  ) {}
  sync() {
    const setup = setupOf(this.conn.state, ['B1', 'B2'], (i) => `P${i}`)!;
    if (!this.game) this.game = new Game(setup);
    const r = reconcile(this.game, setup, this.conn.state.moves);
    expect(r.broken).toBe(false);
    this.game = r.game;
  }
  /** Wykonuje wszystkie ruchy, które należą do tego urządzenia (swoje + boty u gospodarza). */
  act(maxMoves = 50): number {
    const g = this.game!;
    let n = 0;
    while (g.pending && n < maxMoves) {
      const d = g.pending;
      const p = g.players[d.player];
      if (d.player !== this.seat && !(p.bot && this.host)) break;
      g.submit(decide(g, d, p.bot ?? 'medium', () => this.rng.next()));
      n++;
    }
    if (n) this.conn.push(g.answers);
    return n;
  }
}

describe('pokój online', () => {
  it('link do pokoju: id i adres bazy', () => {
    const link = roomLink('https://x.github.io/Dominionek/#stare', 'Abcdefghijkmnopqrstu', 'https://db.example', '');
    expect(link).toBe('https://x.github.io/Dominionek/#room=Abcdefghijkmnopqrstu&db=https%3A%2F%2Fdb.example');
    expect(parseRoomRef(link)).toEqual({ id: 'Abcdefghijkmnopqrstu', db: 'https://db.example' });
    expect(parseRoomRef('Abcdefghijkmnopqrstu')).toEqual({ id: 'Abcdefghijkmnopqrstu', db: null });
    expect(parseRoomRef('https://x/#room=krótki')).toBeNull();
    expect(roomLink('https://x/', 'Abcdefghijkmnopqrstu', 'https://db', 'https://db')).toBe('https://x/#room=Abcdefghijkmnopqrstu');
  });

  it('puste tablice i liczbowe klucze z Firebase', () => {
    const st = parseRoom({
      cfg: JSON.stringify(cfg(1, [{ k: 'h' }, { k: 'h' }])),
      seats: [{ name: 'A', cid: 'a' }, { name: 'B', cid: 'b' }],
      moves: { 0: '{"t":"end"}', 1: '{"t":"cards","is":[]}', 3: '{"t":"end"}' },
      start: 5,
    });
    expect(st.moves).toEqual([{ t: 'end' }, { t: 'cards', is: [] }]); // przerwa w numeracji = koniec listy
    expect(allSeated(st)).toBe(true);
  });

  it('dwóch ludzi i bot rozgrywa całą grę, wszyscy widzą to samo', async () => {
    const store = new MemoryStore();
    const t = store.transport();
    const c = cfg(42, [{ k: 'h' }, { k: 'h' }, { k: 'b', level: 'medium' }]);
    const id = await createRoom(t, c, { name: 'Ania', cid: 'cA' });
    expect(await rulesMissing(t, id, { name: 'Ania', cid: 'cA' })).toBe(false);

    const a = new RoomConn(t, id).open();
    const b = new RoomConn(t, id).open();
    await settle();
    expect(await b.join('Bartek', 'cB')).toBe(1);
    expect(await b.join('Bartek', 'cB')).toBe(1); // ponowne dołączenie = to samo miejsce
    await settle();
    expect(await new RoomConn(t, id).open().join('Celina', 'cC')).toBeNull(); // brak miejsc
    expect(allSeated(a.state)).toBe(true);
    expect(await a.begin()).toBe(true);
    expect(await b.begin()).toBe(false);
    await settle();

    const devs = [new Device(a, 0, true, new Rng(1)), new Device(b, 1, false, new Rng(2))];
    for (let round = 0; round < 5000; round++) {
      devs.forEach((d) => d.sync());
      if (!devs[0].game!.pending) break;
      const moved = devs.reduce((s, d) => s + d.act(), 0);
      await settle();
      if (!moved) expect.unreachable('nikt nie może się ruszyć');
    }
    await settle();
    devs.forEach((d) => d.sync());
    const [ga, gb] = devs.map((d) => d.game!);
    expect(ga.over).toBe(true);
    expect(gb.over).toBe(true);
    expect(gb.answers).toEqual(ga.answers);
    expect(a.state.moves.length).toBe(ga.answers.length);
    expect(gb.scores()).toEqual(ga.scores());
    expect(ga.players.map((p) => p.name)).toEqual(['Ania', 'Bartek', 'B1']);
  });

  it('konflikt: dwa urządzenia na tym samym miejscu – przegrany odtwarza grę z bazy', async () => {
    const store = new MemoryStore();
    const t = store.transport();
    const c = cfg(7, [{ k: 'h' }, { k: 'h' }]);
    const id = await createRoom(t, c, { name: 'A', cid: 'a' });
    const a = new RoomConn(t, id).open();
    const b = new RoomConn(t, id).open();
    await settle();
    await b.join('B', 'b');
    await a.begin();
    await settle();
    const setup = setupOf(a.state, [], String)!;
    expect(new Game(setup).pending!.kind).toBe('buy'); // ręka startowa: same skarby i punkty
    // teraz różne ruchy na tym samym miejscu
    const g3 = new Game(setup);
    const g4 = new Game(setup);
    g3.submit({ t: 'end' });
    g4.submit({ t: 'playAll' });
    a.push(g3.answers);
    b.push(g4.answers);
    await settle();
    expect(a.conflicts + b.conflicts).toBe(1);
    const loser = a.conflicts ? g3 : g4;
    const r = reconcile(loser, setup, a.state.moves);
    expect(r.changed).toBe(true);
    expect(r.game.answers).toEqual(a.state.moves);
  });
});
