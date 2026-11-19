import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { decide } from './bot';
import { Rng } from './rng';
import { randomKingdom, rerollOne, rollHoardExtras } from './setup';
import type { SetId } from './card';
import { kingdomCards } from './cards';
import type { BotLevel, GameSetup } from './types';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

function makeSetup(seed: number, n: number): GameSetup {
  const r = new Rng(seed ^ 0x9e3779b9);
  const sets: SetId[] = (
    [['keep'], ['hoard'], ['tower'], ['keep', 'hoard'], ['keep', 'tower'], ['hoard', 'tower', 'keep']] as SetId[][]
  )[seed % 6];
  const kingdom = randomKingdom(sets, () => r.next());
  return {
    seed,
    kingdom,
    extras: rollHoardExtras(kingdom, () => r.next()) ? ['dragongold', 'palace'] : [],
    players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot: LEVELS[(seed + i) % 3] })),
  };
}

function totalCards(g: Game): number {
  const inSupply = Object.values(g.supply).reduce((a, b) => a + b, 0);
  const owned = g.players.reduce((a, p) => a + g.allCards(p).length, 0);
  return inSupply + owned + g.trash.length;
}

function playOut(g: Game, seed: number, maxSteps = 20000): void {
  const r = new Rng(seed);
  const initial = totalCards(g);
  let steps = 0;
  while (g.pending && steps++ < maxSteps) {
    const d = g.pending;
    const level = g.players[d.player].bot ?? 'medium';
    g.submit(decide(g, d, level, () => r.next()));
    // karty odkryte w trakcie efektu są chwilowo poza strefami – sprawdzaj między efektami
    if (!g.pending || g.pending.kind === 'action' || g.pending.kind === 'buy') expect(totalCards(g)).toBe(initial);
  }
}

describe('silnik', () => {
  it('stan początkowy', () => {
    const g = new Game({ ...makeSetup(1, 2), extras: [] });
    for (const p of g.players) {
      expect(p.hand.length).toBe(5);
      expect(g.allCards(p).length).toBe(10);
    }
    expect(g.supply.citadel).toBe(8);
    expect(g.supply.hex).toBe(10);
    expect(g.pileOrder.length).toBe(17);
  });

  it('boty kończą gry (2–4 graczy, różne Królestwa)', () => {
    let turns = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const n = 2 + (seed % 3);
      const g = new Game(makeSetup(seed, n));
      playOut(g, seed);
      expect(g.over).toBe(true);
      expect(g.isGameOver()).toBe(true);
      turns += g.turn.number;
      const scores = g.scores();
      expect(scores.length).toBe(n);
      expect(scores.some((s) => s.rank === 1)).toBe(true);
    }
    // średnio gra nie powinna trwać absurdalnie długo
    expect(turns / 150).toBeLessThan(120);
  });

  it('odtworzenie z zapisu daje ten sam stan', () => {
    const setup = makeSetup(42, 3);
    const g = new Game(setup);
    const r = new Rng(7);
    for (let k = 0; k < 300 && g.pending; k++) {
      g.submit(decide(g, g.pending, 'hard', () => r.next()));
    }
    const copy = Game.replay(setup, JSON.parse(JSON.stringify(g.answers)));
    expect(copy.players).toEqual(g.players);
    expect(copy.supply).toEqual(g.supply);
    expect(copy.pending).toEqual(g.pending);
    expect(copy.turn).toEqual(g.turn);
  });

  it('odrzuca nieprawidłowe odpowiedzi', () => {
    const g = new Game(makeSetup(3, 2));
    expect(() => g.submit({ t: 'buy', pile: 'citadel' })).toThrow();
  });

  it('trudny bot zwykle wygrywa z łatwym', () => {
    let hardWins = 0;
    const games = 60;
    for (let seed = 1000; seed < 1000 + games; seed++) {
      const setup = makeSetup(seed, 2);
      setup.players = [
        { name: 'E', bot: 'easy' },
        { name: 'H', bot: 'hard' },
      ];
      const g = new Game(setup);
      playOut(g, seed);
      const s = g.scores().find((x) => x.rank === 1)!;
      if (s.player === 1) hardWins++;
    }
    expect(hardWins / games).toBeGreaterThan(0.75);
  });

  it('Poborca Dziesięciny sam pali Grosz i daje +3 monety', () => {
    const g = new Game(makeSetup(5, 2));
    const p = g.players[g.turn.player];
    p.hand = ['copper', 'homestead', 'silver'];
    const coins = g.turn.coins;
    const r = g.resolve(p, 'tithe').next();
    expect(r.done).toBe(true); // bez pytania gracza
    expect(g.trash).toEqual(['copper']);
    expect(p.hand).toEqual(['homestead', 'silver']);
    expect(g.turn.coins).toBe(coins + 3);
  });

  it('Poborca Dziesięciny bez Grosza pyta o inną kartę', () => {
    const g = new Game(makeSetup(6, 2));
    const p = g.players[g.turn.player];
    p.hand = ['homestead', 'silver'];
    const r = g.resolve(p, 'tithe').next();
    expect(r.done).toBe(false);
    expect(r.value && r.value.kind).toBe('cards');
  });

  it('Skarbiec: Smocze Złoto i Pałac w zasobach, wyczerpanie Pałaców kończy grę', () => {
    const g = new Game({ ...makeSetup(7, 2), extras: ['dragongold', 'palace'] });
    expect(g.basics).toEqual(['copper', 'silver', 'gold', 'dragongold', 'homestead', 'manor', 'citadel', 'palace', 'hex']);
    expect(g.supply.palace).toBe(8);
    expect(g.supply.dragongold).toBe(12);
    expect(g.isGameOver()).toBe(false);
    g.supply.palace = 0;
    expect(g.isGameOver()).toBe(true);
  });

  it('Klucz do Skarbca liczy różne rodzaje Skarbów w grze', () => {
    const g = new Game(makeSetup(8, 2));
    const p = g.players[g.turn.player];
    p.play = ['copper', 'copper', 'silver', 'hoardkey'];
    const coins = g.turn.coins;
    g.resolve(p, 'hoardkey').next();
    expect(g.turn.coins).toBe(coins + 3);
  });

  it('Mapa Skarbu zagrywa pierwszy odkryty Skarb', () => {
    const g = new Game(makeSetup(9, 2));
    const p = g.players[g.turn.player];
    p.deck = ['homestead', 'inn', 'gold', 'copper'];
    p.discard = [];
    p.play = ['map'];
    const coins = g.turn.coins;
    g.resolve(p, 'map').next();
    expect(g.turn.coins).toBe(coins + 1 + 3);
    expect(p.play).toEqual(['map', 'gold']);
    expect(p.discard).toEqual(['homestead', 'inn']);
    expect(p.deck).toEqual(['copper']);
  });

  it('żetony PZ liczą się do wyniku', () => {
    const g = new Game(makeSetup(10, 2));
    const p = g.players[0];
    const before = g.scoreOf(p).vp;
    g.resolve(p, 'ancientcoin').next();
    g.resolve(p, 'altar').next();
    expect(p.vpTokens).toBe(2);
    expect(g.scoreOf(p).vp).toBe(before + 2);
  });

  it('Wieża Alchemika: stos Eliksiru, koszt w Eliksirach', () => {
    const g = new Game({ ...makeSetup(11, 2), kingdom: ['retort', 'golem', 'inn', 'ranger', 'tinker', 'guard', 'lantern', 'forgemaster', 'siren', 'bazaar'], extras: [] });
    expect(g.basics).toContain('elixir');
    expect(g.supply.elixir).toBe(16);
    g.turn.coins = 5;
    g.turn.potions = 0;
    expect(g.canAfford('golem')).toBe(false);
    g.turn.potions = 1;
    expect(g.canAfford('golem')).toBe(true);
    expect(g.canAfford('retort', 1)).toBe(false);
    const p = g.players[g.turn.player];
    g.resolve(p, 'elixir').next();
    expect(g.turn.potions).toBe(2);
  });

  it('bez kart z Eliksirem nie ma stosu Eliksiru', () => {
    const g = new Game({ ...makeSetup(12, 2), kingdom: ['inn', 'ranger', 'tinker', 'guard', 'lantern', 'forgemaster', 'siren', 'bazaar', 'council', 'sage'], extras: [] });
    expect(g.basics).not.toContain('elixir');
  });

  it('Rtęć daje +2 tylko z Eliksirem w grze', () => {
    const g = new Game(makeSetup(13, 2));
    const p = g.players[g.turn.player];
    p.play = ['quicksilver'];
    let coins = g.turn.coins;
    g.resolve(p, 'quicksilver').next();
    expect(g.turn.coins).toBe(coins + 1);
    p.play = ['elixir', 'quicksilver'];
    coins = g.turn.coins;
    g.resolve(p, 'quicksilver').next();
    expect(g.turn.coins).toBe(coins + 3);
  });

  it('Kipiący Kocioł: +2 akcje, +1 moneta, +1 zakup; z Eliksirem w grze +1 karta', () => {
    const g = new Game(makeSetup(14, 2));
    const p = g.players[g.turn.player];
    const t0 = { ...g.turn };
    let hand = p.hand.length;
    g.resolve(p, 'cauldron').next();
    expect([g.turn.actions - t0.actions, g.turn.coins - t0.coins, g.turn.buys - t0.buys]).toEqual([2, 1, 1]);
    expect(p.hand.length).toBe(hand);
    p.play = ['elixir'];
    hand = p.hand.length;
    g.resolve(p, 'cauldron').next();
    expect(p.hand.length).toBe(hand + 1);
  });

  it('losowanie Królestwa', () => {
    const k = randomKingdom(['keep']);
    expect(new Set(k).size).toBe(10);
    const k2 = rerollOne(k, 3, ['keep']);
    expect(new Set(k2).size).toBe(10);
    expect(k2[3]).not.toBe(k[3]);
    expect(kingdomCards(['keep']).length).toBeGreaterThanOrEqual(25);
  });
});
