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
    plus: { cards: 2 },
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
    ai: { value: 5, role: 'trash' },
  },
  {
    id: 'cauldron',
    set: 'tower',
    name: t('Bubbling Cauldron', 'Kipiący Kocioł'),
    text: t('', ''),
    types: ['action'],
    cost: 5,
    plus: { actions: 2, potions: 1 },
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
    plus: { cards: 2, actions: 1 },
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
    text: t('Each other player gains a Hex.', 'Każdy inny gracz zdobywa Urok.'),
    types: ['action', 'attack'],
    cost: 3,
    potionCost: 1,
    plus: { cards: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        g.gain(v, 'hex');
      });
    },
    ai: { value: 8, role: 'attack' },
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
    text: t('Gain a Gold. +2 VP tokens.', 'Zdobądź Złoto. +2 żetony PZ.'),
    types: ['action'],
    cost: 6,
    potionCost: 1,
    *play(g, p) {
      g.gain(p, 'gold');
      g.addVp(p, 2);
    },
    ai: { value: 7, role: 'gain' },
  },
];
