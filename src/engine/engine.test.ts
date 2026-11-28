import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { decide } from './bot';
import { Rng } from './rng';
import { randomKingdom, rerollOne, rollHoardExtras } from './setup';
import type { SetId } from './card';
import { card, kingdomCards } from './cards';
import type { BotLevel, GameSetup } from './types';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

function makeSetup(seed: number, n: number): GameSetup {
  const r = new Rng(seed ^ 0x9e3779b9);
  const sets: SetId[] = (
    [['keep'], ['hoard'], ['tower'], ['court'], ['keep', 'hoard'], ['keep', 'tower'], ['court', 'keep'], ['hoard', 'tower', 'keep', 'court']] as SetId[][]
  )[seed % 8];
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

  it('cofanie: ruchy w turze gracza da się cofnąć, koniec tury i ruchy botów już nie', () => {
    const setup: GameSetup = {
      seed: 5,
      kingdom: makeSetup(5, 2).kingdom,
      players: [{ name: 'Ja', bot: null }, { name: 'Bot', bot: 'medium' }],
    };
    const g = new Game(setup);
    const r = new Rng(3);
    while (g.pending && g.pending.player !== 0) g.submit(decide(g, g.pending, 'medium', () => r.next()));
    expect(g.undoable()).toBe(0);
    const start = g.answers.length;
    if (g.pending?.kind === 'action') g.submit({ t: 'end' });
    g.submit({ t: 'playAll' });
    const coins = g.turn.coins;
    g.submit({ t: 'buy', pile: 'copper' });
    expect(g.undoable()).toBe(g.answers.length - start);
    // cofnięcie = odtworzenie bez ostatniej odpowiedzi
    const back = Game.replay(setup, g.answers.slice(0, -1));
    expect(back.turn.coins).toBe(coins);
    expect(back.pending?.kind).toBe('buy');
    expect(back.undoFloor).toBe(g.undoFloor);
    // koniec tury dobiera nowe karty – tego już nie cofniemy
    g.submit({ t: 'end' });
    expect(g.undoable()).toBe(0);
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
    const g = new Game({ ...makeSetup(9, 2), extras: ['dragongold', 'palace'] });
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
    g.addVp(p, 2);
    expect(g.scoreOf(p).vp).toBe(before + 2);
  });

  it('Pradawna Moneta: Skarb za 2 i 1 PZ, stos jak karty punktów', () => {
    const g = new Game({ ...makeSetup(10, 2), kingdom: ['ancientcoin', 'hoardrat', 'clerk', 'gildedscale', 'map', 'hoardkey', 'dragonpurse', 'altar', 'strongroom', 'mint'] });
    const p = g.players[0];
    expect(g.supply.ancientcoin).toBe(8);
    const before = g.scoreOf(p).vp;
    p.discard.push('ancientcoin');
    expect(g.scoreOf(p).vp).toBe(before + 1);
    g.turn.coins = 0;
    g.resolve(p, 'ancientcoin').next();
    expect(g.turn.coins).toBe(2);
  });

  it('Smocza Sakwa liczy wszystkie Skarby w grze', () => {
    const g = new Game(makeSetup(12, 2));
    const p = g.players[0];
    p.play = ['copper', 'copper', 'silver', 'dragonpurse'];
    g.turn.coins = 0;
    g.resolve(p, 'dragonpurse').next();
    expect(g.turn.coins).toBe(4);
  });

  it('Smocza Mama: +2 karty, +2 akcje, +2 zakupy, +2 monety, odrzuć 2', () => {
    const g = new Game(makeSetup(13, 2));
    const p = g.players[0];
    p.hand = ['copper', 'homestead', 'silver'];
    p.deck = ['gold', 'homestead', 'copper'];
    const t0 = { ...g.turn };
    const it = g.resolve(p, 'altar');
    const r = it.next();
    expect(p.hand.length).toBe(5);
    expect(g.turn.actions).toBe(t0.actions + 2);
    expect(g.turn.buys).toBe(t0.buys + 2);
    expect(g.turn.coins).toBe(t0.coins + 2);
    expect(r.done).toBe(false);
    const d = r.value as Extract<import('./types').Decision, { kind: 'cards' }>;
    expect(d.min).toBe(2);
    const homesteads = p.hand.flatMap((id, i) => (id === 'homestead' ? [i] : []));
    expect(it.next({ t: 'cards', is: homesteads }).done).toBe(true);
    expect(p.hand.length).toBe(3);
    expect(p.hand).not.toContain('homestead');
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

  it('Wielkie Dzieło: Skarb za 3, zdobywa Złoto i Zagrodę', () => {
    const g = new Game({ ...makeSetup(14, 2), kingdom: ['magnumopus', 'brewer', 'retort', 'alembic', 'golem', 'inn', 'ranger', 'tinker', 'guard', 'lantern'], extras: [] });
    const p = g.players[0];
    const gold = g.supply.gold;
    g.turn.coins = 0;
    g.resolve(p, 'magnumopus').next();
    expect(g.turn.coins).toBe(3);
    expect(g.supply.gold).toBe(gold - 1);
    expect(p.discard).toEqual(expect.arrayContaining(['gold', 'homestead']));
  });

  it('Homunkulus: wymiana karty z ręki na tańszą lub równą (na rękę)', () => {
    const g = new Game({ ...makeSetup(16, 2), kingdom: ['homunculus', 'brewer', 'retort', 'alembic', 'golem', 'inn', 'ranger', 'tinker', 'guard', 'lantern'], extras: [] });
    const p = g.players[0];
    p.hand = ['copper', 'silver', 'homestead'];
    const silvers = g.supply.silver;
    const it = g.resolve(p, 'homunculus');
    const d1 = it.next().value as { kind: string };
    expect(d1.kind).toBe('cards');
    const d2 = it.next({ t: 'cards', is: [p.hand.indexOf('silver')] }).value as { kind: string; allowed: string[] };
    expect(g.supply.silver).toBe(silvers + 1);
    expect(d2.kind).toBe('pile');
    expect(d2.allowed).toContain('silver');
    expect(d2.allowed).not.toContain('gold');
    expect(d2.allowed).not.toContain('retort'); // Eliksir w koszcie – poza zasięgiem
    expect(it.next({ t: 'pile', pile: 'inn' }).done).toBe(true);
    expect(p.hand).toContain('inn');
    expect(p.hand).not.toContain('silver');
  });

  it('Homunkulus: karta z Eliksirem w koszcie wymienia się też na kartę bez Eliksiru', () => {
    const g = new Game({ ...makeSetup(16, 2), kingdom: ['homunculus', 'brewer', 'retort', 'alembic', 'golem', 'inn', 'ranger', 'tinker', 'guard', 'lantern'], extras: [] });
    const p = g.players[0];
    p.hand = ['golem', 'copper']; // Golem: 4 + Eliksir
    const it = g.resolve(p, 'homunculus');
    it.next();
    const d = it.next({ t: 'cards', is: [p.hand.indexOf('golem')] }).value as { allowed: string[] };
    expect(d.allowed).toEqual(expect.arrayContaining(['silver', 'inn', 'golem', 'retort', 'brewer', 'elixir']));
    expect(d.allowed).not.toContain('alembic'); // 5 monet – za drogi
  });

  it('Homunkulus na ręce chroni przed atakiem za odrzucenie karty', () => {
    const g = new Game({ ...makeSetup(17, 2), kingdom: ['homunculus', 'brewer', 'retort', 'alembic', 'golem', 'inn', 'ranger', 'tinker', 'guard', 'lantern'], extras: [] });
    const [a, v] = g.players;
    v.hand = ['homunculus', 'copper', 'homestead'];
    let hit = false;
    const it = g.attack(a, function* () {
      hit = true;
    });
    expect(it.next().value).toMatchObject({ kind: 'yesno', player: v.id });
    expect(it.next({ t: 'yes', v: true }).value).toMatchObject({ kind: 'cards', player: v.id });
    expect(it.next({ t: 'cards', is: [v.hand.indexOf('homestead')] }).done).toBe(true);
    expect(hit).toBe(false);
    expect(v.discard).toContain('homestead');
    // bez reakcji atak działa
    v.hand = ['homunculus', 'copper'];
    const it2 = g.attack(a, function* () {
      hit = true;
    });
    it2.next();
    expect(it2.next({ t: 'yes', v: false }).done).toBe(true);
    expect(hit).toBe(true);
  });

  it('Warzelnik: +2 karty, +1 akcja, +1 moneta; na koniec tury może wrócić na talię (z Eliksirem)', () => {
    const g = new Game({ ...makeSetup(15, 2), kingdom: ['brewer', 'magnumopus', 'retort', 'alembic', 'golem', 'inn', 'ranger', 'tinker', 'guard', 'lantern'], extras: [] });
    const p = g.players[0];
    const hand = p.hand.length;
    const t0 = { ...g.turn };
    g.resolve(p, 'brewer').next();
    expect(p.hand.length).toBe(hand + 2);
    expect(g.turn.actions).toBe(t0.actions + 1);
    expect(g.turn.coins).toBe(t0.coins + 1);
    // bez Eliksiru w grze – brak pytania
    p.play = ['brewer'];
    expect(card('brewer').onCleanup!(g, p).next().done).toBe(true);
    // z Eliksirem – pytanie, po „tak” karta na wierzchu talii
    p.play = ['brewer', 'elixir'];
    const it = card('brewer').onCleanup!(g, p);
    expect(it.next().value).toMatchObject({ kind: 'yesno' });
    expect(it.next({ t: 'yes', v: true }).done).toBe(true);
    expect(p.deck[0]).toBe('brewer');
    expect(p.play).toEqual(['elixir']);
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

  it('zdarzenia do animacji: dobranie z efektu, zakup, spalenie – bez zwykłego dobierania na koniec tury', () => {
    const r = new Rng(5);
    const g = new Game({ seed: 5, kingdom: randomKingdom(['keep', 'hoard', 'tower', 'court'], () => r.next()), extras: [], players: [{ name: 'A', bot: 'medium' }, { name: 'B', bot: 'medium' }] });
    expect(g.fx).toEqual([]); // ręka startowa
    let turns = 0;
    for (let n = 0; n < 3000 && g.pending; n++) {
      const before = g.fx.length;
      const a = decide(g, g.pending, 'medium', () => r.next());
      const turn = g.turn.number;
      g.submit(a);
      if (g.turn.number !== turn) turns++;
      for (const f of g.fx.slice(before)) {
        if (f.k === 'gain' && f.bought) expect(a.t).toBe('buy');
        if (f.k === 'hand') expect(f.cards.length).toBeGreaterThan(0);
      }
    }
    expect(turns).toBeGreaterThan(10);
    expect(g.fx.filter((f) => f.k === 'gain' && f.bought).length).toBeGreaterThan(5);
    // dobranie 5 kart na koniec każdej tury nie trafia do zdarzeń
    expect(g.fx.filter((f) => f.k === 'hand' && f.cards.length === 5 && f.how === 'draw').length).toBeLessThan(3);
  });

  it('zdarzenia do animacji: karty odkryte u przeciwników (Rzezimieszek, Herszt, Plotka)', () => {
    const seen: Record<string, number> = {};
    for (let seed = 1; seed <= 12; seed++) {
      const r = new Rng(seed);
      const fixed = ['footpad', 'banditchief', 'rumor', 'siren', 'weaver'];
      const rest = randomKingdom(['keep', 'court'], () => r.next()).filter((id) => !fixed.includes(id));
      const kingdom = [...fixed, ...rest.slice(0, 5)];
      const players = [{ name: 'A', bot: 'medium' as const }, { name: 'B', bot: 'medium' as const }, { name: 'C', bot: 'easy' as const }];
      const g = new Game({ seed, kingdom, extras: [], players });
      playOut(g, seed, 4000);
      for (const f of g.fx) {
        if (f.k !== 'reveal') continue;
        seen[f.src] = (seen[f.src] ?? 0) + 1;
        expect(f.p).not.toBe(f.by);
        expect(f.cards.length).toBe(f.out.length);
        expect(f.cards.length).toBeGreaterThan(0);
        const all = g.players.map((x) => x.id);
        if (f.src === 'footpad') {
          expect(f.show).toEqual(all);
          f.cards.forEach((id, i) => {
            const good = card(id).types.includes('action') || card(id).types.includes('treasure');
            expect(f.out[i]).toBe(good ? 'discard' : 'deck');
          });
        }
        if (f.src === 'banditchief') expect(f.out.filter((o) => o === 'trash').length).toBeLessThanOrEqual(1);
        // ofiara sama wybierała, co odrzuca – skutek widzą wszyscy poza nią
        if (f.src === 'siren' || f.src === 'banditchief') expect(f.show).toEqual(all.filter((id) => id !== f.p));
        if (f.src === 'rumor') expect(f.show).toEqual(all.filter((id) => id !== f.by));
        if (f.src === 'siren') {
          expect(f.out.every((o) => o === 'discard')).toBe(true);
        }
        // Urok od Tkaczki: nikt nie wybierał – widzą wszyscy
        if (f.src === 'weaver') {
          expect(f.show).toEqual(all);
          expect(f).toMatchObject({ cards: ['hex'], out: ['gain'] });
        }
      }
    }
    expect(seen.footpad).toBeGreaterThan(0);
    expect(seen.siren).toBeGreaterThan(0);
    expect(seen.weaver).toBeGreaterThan(0);
  });
});
