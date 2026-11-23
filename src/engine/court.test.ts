import { describe, expect, it } from 'vitest';
import { Game } from './game';
import type { Answer, GameSetup, Step } from './types';

const KINGDOM = ['chambermaid', 'lacefan', 'gallery', 'minuet', 'rumor', 'familytree', 'chamberlain', 'scandal', 'grandball', 'dowry'];

function setup(seed = 1, n = 2): GameSetup {
  return { seed, kingdom: KINGDOM, players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot: null })) };
}

/** Rozgrywa efekt karty, odpowiadając po kolei podanymi odpowiedziami. Zwraca decyzje, o które pytano. */
function run(step: Step, answers: Answer[]) {
  const asked = [];
  let r = step.next(undefined as unknown as Answer);
  while (!r.done) {
    asked.push(r.value);
    const a = answers.shift();
    if (!a) throw new Error('Brak odpowiedzi na ' + JSON.stringify(r.value));
    r = step.next(a);
  }
  return asked;
}

describe('Szepty Dworu', () => {
  it('stosy kart wielotypowych ze Zwycięstwem mają tyle kart co punkty', () => {
    const g = new Game(setup());
    expect(g.supply.gallery).toBe(8);
    expect(g.supply.dowry).toBe(8);
    expect(g.supply.familytree).toBe(8);
    expect(g.supply.minuet).toBe(10);
  });

  it('Pokojówka: wybierz jedno – spalenie karty z ręki', () => {
    const g = new Game(setup());
    const p = g.players[g.turn.player];
    p.hand = ['copper', 'hex', 'silver'];
    const asked = run(g.resolve(p, 'chambermaid'), [
      { t: 'opts', is: [2] },
      { t: 'cards', is: [1] },
    ]);
    expect(asked.map((d) => d.kind)).toEqual(['options', 'cards']);
    expect(g.trash).toEqual(['hex']);
    expect([...p.hand].sort()).toEqual(['copper', 'silver']);
  });

  it('Wielki Bal: dwa różne bonusy', () => {
    const g = new Game(setup());
    const p = g.players[g.turn.player];
    const t0 = { ...g.turn };
    const hand = p.hand.length;
    run(g.resolve(p, 'grandball'), [{ t: 'opts', is: [1, 2] }]);
    expect(g.turn.actions - t0.actions).toBe(2);
    expect(g.turn.coins - t0.coins).toBe(2);
    expect(p.hand.length).toBe(hand);
    expect(() => new Game(setup()).submit({ t: 'opts', is: [0, 0] })).toThrow();
  });

  it('Galeria Portretów i Skrzynia Posagowa liczą się do punktów, Drzewo Rodowe za karty o dwóch typach', () => {
    const g = new Game(setup());
    const p = g.players[0];
    const base = g.scoreOf(p).vp; // 3 Zagrody
    p.discard.push('gallery', 'dowry', 'lacefan', 'familytree');
    // 3 karty o dwóch typach → Drzewo Rodowe 1 PZ; Galeria 1, Skrzynia 1
    expect(g.scoreOf(p).vp).toBe(base + 3);
  });

  it('Koronkowy Wachlarz na ręce chroni przed Skandalem; bez niego ofiara wybiera Urok albo odrzucenie', () => {
    const g = new Game(setup(3));
    const p = g.players[g.turn.player];
    const v = g.players[(p.id + 1) % 2];
    v.hand = ['copper', 'copper', 'lacefan', 'homestead', 'homestead'];
    run(g.resolve(p, 'scandal'), []);
    expect(v.hand.length).toBe(5);

    v.hand = ['copper', 'copper', 'homestead', 'homestead', 'silver'];
    run(g.resolve(p, 'scandal'), [{ t: 'opts', is: [1] }]);
    expect(v.discard).toContain('hex');

    const asked = run(g.resolve(p, 'scandal'), [
      { t: 'opts', is: [0] },
      { t: 'cards', is: [2, 3] },
    ]);
    expect(asked[1].player).toBe(v.id);
    expect([...v.hand].sort()).toEqual(['copper', 'copper', 'silver']);
  });

  it('Plotka: atakujący decyduje, czy odkryta karta ofiary jest odrzucona', () => {
    const g = new Game(setup(4));
    const p = g.players[g.turn.player];
    const v = g.players[(p.id + 1) % 2];
    v.hand = ['copper'];
    v.deck = ['gold', 'copper'];
    const asked = run(g.resolve(p, 'rumor'), [{ t: 'yes', v: true }]);
    expect(asked[0].player).toBe(p.id);
    expect(v.discard).toContain('gold');
    expect(v.deck).toEqual(['copper']);
  });

  it('Skrzynia Posagowa: +1 moneta albo +1 zakup', () => {
    const g = new Game(setup(5));
    const p = g.players[g.turn.player];
    const t0 = { ...g.turn };
    run(g.resolve(p, 'dowry'), [{ t: 'opts', is: [1] }]);
    expect(g.turn.coins - t0.coins).toBe(1);
    expect(g.turn.buys - t0.buys).toBe(1);
  });

  it('Szambelan: spal kartę i zdobądź droższą o maks. 2', () => {
    const g = new Game(setup(6));
    const p = g.players[g.turn.player];
    p.hand = ['homestead', 'copper'];
    const asked = run(g.resolve(p, 'chamberlain'), [
      { t: 'opts', is: [1] },
      { t: 'cards', is: [0] },
      { t: 'pile', pile: 'silver' },
    ]);
    const pile = asked[2];
    expect(pile.kind === 'pile' && pile.allowed.includes('gallery') && !pile.allowed.includes('gold')).toBe(true);
    expect(g.trash).toEqual(['homestead']);
    expect(p.discard).toContain('silver');
  });
});
