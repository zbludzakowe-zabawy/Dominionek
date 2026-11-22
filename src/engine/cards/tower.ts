// Pakiet „Alchemist's Tower” / „Wieża Alchemika” – druga waluta: Eliksir.
// Część kart kosztuje monety i Eliksir; stos Eliksiru dochodzi do gry sam, gdy w Królestwie
// jest karta z Eliksirem w koszcie.
import type { CardDef } from '../card';
import { isType, potionCost } from '../card';
import { card } from './index';

const t = (en: string, pl: string) => ({ en, pl });
const isTreasure = (id: string) => isType(card(id), 'treasure');

/** Eliksir – stały stos, gdy w Królestwie są karty z Eliksirem w koszcie. */
export const TOWER_BASICS: CardDef[] = [
  {
    id: 'elixir',
    set: 'basic',
    symbol: 'tower',
    name: t('Elixir', 'Eliksir'),
    text: t('', ''),
    types: ['treasure'],
    cost: 4,
    potions: 1,
    ai: { value: 4, role: 'money' },
  },
];

export const TOWER: CardDef[] = [
  // ---------- bez Eliksiru w koszcie ----------
  {
    id: 'apprentice',
    set: 'tower',
    name: t('Lab Apprentice', 'Czeladnik'),
    text: t(
      'Reveal the top 2 cards of your deck. Put the Treasures into your hand and discard the rest.',
      'Odkryj 2 wierzchnie karty talii. Skarby weź na rękę, resztę odrzuć.',
    ),
    types: ['action'],
    cost: 2,
    plus: { actions: 1 },
    *play(g, p) {
      const top = g.takeTop(p, 2);
      for (const id of top) g.logMsg(p.id, 'log.reveal', { card: '@' + id });
      g.addToHand(p, top.filter(isTreasure));
      g.discardCards(p, top.filter((id) => !isTreasure(id)), false);
    },
    ai: { value: 3, role: 'cantrip' },
  },
  {
    id: 'mortar',
    set: 'tower',
    name: t('Mortar and Pestle', 'Moździerz'),
    text: t('You may trash a Penny or a Hex from your hand.', 'Możesz spalić z ręki Grosz albo Urok.'),
    types: ['action'],
    cost: 3,
    plus: { cards: 1, actions: 1 },
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashUpTo', p: { n: 1 } },
        min: 0,
        max: 1,
        filter: (id) => id === 'copper' || id === 'hex',
        purpose: 'trash',
        source: 'mortar',
      });
      g.trashCards(p, g.takeFromHand(p, is));
    },
    ai: { value: 4, role: 'trash' },
  },
  {
    id: 'crystal',
    set: 'tower',
    name: t('Crystal Ball', 'Kryształowa Kula'),
    text: t(
      'Look at the top 3 cards of your deck. Put one into your hand and the rest back.',
      'Obejrzyj 3 wierzchnie karty talii. Jedną weź na rękę, resztę odłóż z powrotem.',
    ),
    types: ['action'],
    cost: 3,
    plus: { actions: 1 },
    *play(g, p) {
      const top = g.takeTop(p, 3);
      if (!top.length) return;
      const is = yield* g.chooseFromList(p, top, {
        prompt: { k: 'prompt.takeOne' },
        min: 1,
        max: 1,
        purpose: 'take',
        source: 'crystal',
      });
      g.addToHand(p, top.filter((_, i) => is.includes(i)));
      p.deck.unshift(...top.filter((_, i) => !is.includes(i)));
    },
    ai: { value: 4, role: 'cantrip' },
  },
  {
    id: 'quicksilver',
    set: 'tower',
    name: t('Quicksilver', 'Rtęć'),
    text: t('If you have an Elixir in play, +2 coins.', 'Jeśli masz w grze Eliksir: +2 monety.'),
    types: ['treasure'],
    cost: 3,
    coins: 1,
    *play(g, p) {
      if (p.play.includes('elixir')) g.turn.coins += 2;
    },
    ai: { value: 3, role: 'money' },
  },
  {
    id: 'vapors',
    set: 'tower',
    name: t('Noxious Vapors', 'Trujące Opary'),
    text: t(
      'Each other player chooses: discard a Treasure, or gain a Hex.',
      'Każdy inny gracz wybiera: odrzuca Skarb albo zdobywa Urok.',
    ),
    types: ['action', 'attack'],
    cost: 4,
    plus: { coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        const hasTreasure = v.hand.some(isTreasure);
        let discard = false;
        if (hasTreasure) {
          const [o] = yield* g.chooseOptions(
            v,
            [{ k: 'opt.discardTreasure' }, { k: 'opt.gainHex' }],
            1,
            { k: 'prompt.vapors' },
            'vapors',
            { t: 'opts', is: [0] },
          );
          discard = o === 0;
        }
        if (discard) {
          const is = yield* g.chooseFromHand(v, {
            prompt: { k: 'prompt.discardN', p: { n: 1 } },
            min: 1,
            max: 1,
            filter: isTreasure,
            purpose: 'discard',
            source: 'vapors',
          });
          g.discardCards(v, g.takeFromHand(v, is));
        } else {
          g.gain(v, 'hex');
        }
      });
    },
    ai: { value: 5, role: 'attack' },
  },
  {
    id: 'alembic',
    set: 'tower',
    name: t('Alembic', 'Alembik'),
    text: t(
      'You may trash a card from your hand. If you do, +{P}.',
      'Możesz spalić kartę z ręki. Jeśli to zrobisz: +{P}.',
    ),
    types: ['action'],
    cost: 5,
    plus: { cards: 2, actions: 1 },
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashUpTo', p: { n: 1 } },
        min: 0,
        max: 1,
        purpose: 'trash',
        source: 'alembic',
      });
      if (!is.length) return;
      g.trashCards(p, g.takeFromHand(p, is));
      g.turn.potions += 1;
    },
    ai: { value: 6, role: 'trash' },
  },
  {
    id: 'cauldron',
    set: 'tower',
    name: t('Bubbling Cauldron', 'Kipiący Kocioł'),
    text: t('If you have an Elixir in play, +1 Card.', 'Jeśli masz w grze Eliksir: +1 karta.'),
    types: ['action'],
    cost: 5,
    plus: { actions: 2, coins: 1, buys: 1 },
    *play(g, p) {
      if (p.play.includes('elixir')) g.draw(p, 1);
    },
    ai: { value: 5, role: 'village' },
  },

  // ---------- z Eliksirem w koszcie ----------
  {
    id: 'transmute',
    set: 'tower',
    name: t('Transmutation Circle', 'Krąg Transmutacji'),
    text: t(
      'Trash a card from your hand. Gain a card costing exactly 2 coins more than it.',
      'Spal kartę z ręki. Zdobądź kartę kosztującą dokładnie 2 monety więcej.',
    ),
    types: ['action'],
    cost: 0,
    potionCost: 1,
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashN', p: { n: 1 } },
        min: 1,
        max: 1,
        purpose: 'trash',
        source: 'transmute',
      });
      if (!is.length) return;
      const [id] = g.takeFromHand(p, is);
      g.trashCards(p, [id]);
      const target = card(id).cost + 2;
      const pile = yield* g.choosePile(p, {
        prompt: { k: 'prompt.gainExactly', p: { n: target } },
        maxCost: target,
        maxPotion: potionCost(card(id)),
        filter: (x) => card(x).cost === target,
        source: 'transmute',
      });
      if (pile) g.gain(p, pile);
    },
    ai: { value: 4, role: 'trash' },
  },
  {
    id: 'retort',
    set: 'tower',
    name: t('Bubbling Retort', 'Retorta'),
    text: t('', ''),
    types: ['action'],
    cost: 2,
    potionCost: 1,
    plus: { cards: 2, actions: 1, buys: 1 },
    ai: { value: 7, role: 'cantrip' },
  },
  {
    id: 'herbgarden',
    set: 'tower',
    name: t('Herb Garden', 'Ogród Ziół'),
    text: t(
      'Worth 1 VP for every 2 cards with an Elixir in their cost you have (round down).',
      'Wart 1 PZ za każde 2 karty z Eliksirem w koszcie w twojej talii (zaokrąglając w dół).',
    ),
    types: ['victory'],
    cost: 2,
    potionCost: 1,
    vpFn: (cards) => Math.floor(cards.filter((id) => potionCost(card(id)) > 0).length / 2),
    ai: { value: 0, role: 'victory' },
  },
  {
    id: 'homunculus',
    set: 'tower',
    name: t('Homunculus', 'Homunkulus'),
    text: t(
      'You may return a card from your hand to the Supply and gain a card costing up to the same into your hand. When another player plays an Attack, you may reveal this from your hand and discard a card to be unaffected.',
      'Możesz oddać kartę z ręki do zasobów i zdobyć na rękę kartę o tym samym lub niższym koszcie. Gdy inny gracz zagrywa Atak, możesz pokazać tę kartę z ręki i odrzucić 1 kartę – atak cię nie dotyczy.',
    ),
    types: ['action', 'reaction'],
    cost: 3,
    potionCost: 1,
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.exchange' },
        min: 0,
        max: 1,
        purpose: 'trash',
        source: 'homunculus',
      });
      if (!is.length) return;
      const [id] = g.takeFromHand(p, is);
      g.supply[id] = (g.supply[id] ?? 0) + 1;
      g.logMsg(p.id, 'log.returnToSupply', { card: '@' + id });
      const c = card(id);
      const pick = yield* g.choosePile(p, {
        prompt: { k: 'prompt.gainToHandUpTo', p: { n: c.cost } },
        maxCost: c.cost,
        maxPotion: potionCost(c),
        source: 'homunculus',
      });
      if (pick) g.gain(p, pick, 'hand');
    },
    *onAttack(g, v) {
      if (!(yield* g.yesNo(v, { k: 'prompt.homunculusReact' }, 'homunculus', true))) return false;
      g.logMsg(v.id, 'log.reveal', { card: '@homunculus' });
      const is = yield* g.chooseFromHand(v, {
        prompt: { k: 'prompt.discardN', p: { n: 1 } },
        min: 1,
        max: 1,
        purpose: 'discard',
        source: 'homunculus',
      });
      g.discardCards(v, g.takeFromHand(v, is));
      return true;
    },
    ai: { value: 5, role: 'trash' },
  },
  {
    id: 'brewer',
    set: 'tower',
    name: t('Brewer', 'Warzelnik'),
    text: t(
      'At the end of your turn, if you have an Elixir in play, you may put this card on top of your deck.',
      'Na koniec tury, jeśli masz w grze Eliksir, możesz odłożyć tę kartę na wierzch swojej talii.',
    ),
    types: ['action'],
    cost: 3,
    potionCost: 1,
    plus: { cards: 2, actions: 1, coins: 1 },
    *onCleanup(g, p) {
      if (!p.play.includes('elixir')) return;
      if (!(yield* g.yesNo(p, { k: 'prompt.brewerTop' }, 'brewer', true))) return;
      const i = p.play.indexOf('brewer');
      if (i < 0) return;
      p.play.splice(i, 1);
      p.deck.unshift('brewer');
      g.logMsg(p.id, 'log.topdeck', { card: '@brewer' });
    },
    ai: { value: 7, role: 'cantrip' },
  },
  {
    id: 'golem',
    set: 'tower',
    name: t('Clay Golem', 'Gliniany Golem'),
    text: t('', ''),
    types: ['action'],
    cost: 4,
    potionCost: 1,
    plus: { cards: 3, actions: 1 },
    ai: { value: 8, role: 'cantrip' },
  },
  {
    id: 'magnumopus',
    set: 'tower',
    name: t('Magnum Opus', 'Wielkie Dzieło'),
    text: t('Gain a Gold and a Homestead.', 'Zdobądź Złoto i Zagrodę.'),
    types: ['treasure'],
    cost: 6,
    potionCost: 1,
    coins: 3,
    *play(g, p) {
      g.gain(p, 'gold');
      g.gain(p, 'homestead');
    },
    ai: { value: 7, role: 'money' },
  },
];
