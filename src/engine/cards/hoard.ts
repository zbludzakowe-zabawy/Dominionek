// Pakiet „Dragon's Hoard” / „Skarbiec Smoka” – drogie skarby, skarby z efektami,
// żetony Punktów Zwycięstwa i smocze ataki. Do tego dwa dodatkowe stosy stałe:
// Smocze Złoto i Pałac (dokładane do gry, gdy w Królestwie są karty Skarbca).
import type { CardDef } from '../card';
import { isType, potionCost } from '../card';
import { card } from './index';

const t = (en: string, pl: string) => ({ en, pl });
const isTreasure = (id: string) => isType(card(id), 'treasure');

/** Dodatkowe stosy stałe Skarbca. */
export const HOARD_BASICS: CardDef[] = [
  {
    id: 'dragongold',
    set: 'basic',
    symbol: 'hoard',
    name: t('Dragon Gold', 'Smocze Złoto'),
    text: t('', ''),
    types: ['treasure'],
    cost: 9,
    coins: 5,
    ai: { value: 9, role: 'money' },
  },
  {
    id: 'palace',
    set: 'basic',
    symbol: 'hoard',
    name: t('Palace', 'Pałac'),
    text: t('', ''),
    types: ['victory'],
    cost: 11,
    vp: 10,
    ai: { value: 0, role: 'victory' },
  },
];

export const HOARD: CardDef[] = [
  // ---------- koszt 2 ----------
  {
    id: 'hoardrat',
    set: 'hoard',
    name: t('Hoard Rat', 'Szczur ze Skarbca'),
    text: t(
      'Reveal the top card of your deck. If it is a Treasure, put it into your hand; otherwise discard it.',
      'Odkryj wierzchnią kartę talii. Jeśli to Skarb, weź ją na rękę; w przeciwnym razie ją odrzuć.',
    ),
    types: ['action'],
    cost: 2,
    plus: { actions: 1 },
    *play(g, p) {
      const [id] = g.takeTop(p, 1);
      if (!id) return;
      g.logMsg(p.id, 'log.reveal', { card: '@' + id });
      if (isTreasure(id)) g.addToHand(p, [id]);
      else g.discardCards(p, [id], false);
    },
    ai: { value: 3, role: 'cantrip' },
  },

  // ---------- koszt 3 ----------
  {
    id: 'clerk',
    set: 'hoard',
    name: t('Tally Clerk', 'Rachmistrz'),
    text: t('+1 VP token.', '+1 żeton PZ.'),
    types: ['action'],
    cost: 3,
    plus: { buys: 1, coins: 1 },
    *play(g, p) {
      g.addVp(p, 1);
    },
    ai: { value: 4, role: 'money' },
  },
  {
    id: 'moneychanger',
    set: 'hoard',
    name: t('Moneychanger', 'Kantor'),
    text: t(
      'You may trash a Treasure from your hand for + coins equal to its value plus 1.',
      'Możesz spalić Skarb z ręki i wziąć tyle monet, ile był wart, plus 1.',
    ),
    types: ['action'],
    cost: 3,
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashTreasure' },
        min: 0,
        max: 1,
        filter: isTreasure,
        purpose: 'trash',
        source: 'moneychanger',
        hint: (() => {
          const i = p.hand.indexOf('copper');
          return { t: 'cards', is: i >= 0 ? [i] : [] };
        })(),
      });
      if (!is.length) return;
      const [id] = g.takeFromHand(p, is);
      g.trashCards(p, [id]);
      g.turn.coins += (card(id).coins ?? 0) + 1;
    },
    ai: { value: 4, role: 'trash' },
  },

  // ---------- koszt 4 ----------
  {
    id: 'gildedscale',
    set: 'hoard',
    name: t('Gilded Scale', 'Złota Łuska'),
    text: t('', ''),
    types: ['treasure'],
    cost: 4,
    coins: 1,
    plus: { buys: 1 },
    ai: { value: 4, role: 'money' },
  },
  {
    id: 'wyrmling',
    set: 'hoard',
    name: t('Wyrmling', 'Smoczątko'),
    text: t(
      'Each other player with 5 or more cards in hand puts a card from their hand onto their deck.',
      'Każdy inny gracz mający na ręce 5 lub więcej kart kładzie 1 kartę z ręki na wierzch swojej talii.',
    ),
    types: ['action', 'attack'],
    cost: 4,
    plus: { coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        if (v.hand.length < 5) return;
        const is = yield* g.chooseFromHand(v, {
          prompt: { k: 'prompt.topdeck' },
          min: 1,
          max: 1,
          purpose: 'discard',
          source: 'wyrmling',
        });
        v.deck.unshift(...g.takeFromHand(v, is));
        g.logMsg(v.id, 'log.topdeckHidden');
      });
    },
    ai: { value: 5, role: 'attack' },
  },
  {
    id: 'gemcutter',
    set: 'hoard',
    name: t('Gem Cutter', 'Szlifierz'),
    text: t(
      'Trash a card from your hand. Gain a card costing up to 2 coins more than it.',
      'Spal kartę z ręki. Zdobądź kartę kosztującą do 2 monet więcej.',
    ),
    types: ['action'],
    cost: 4,
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashN', p: { n: 1 } },
        min: 1,
        max: 1,
        purpose: 'trash',
        source: 'gemcutter',
      });
      if (!is.length) return;
      const [id] = g.takeFromHand(p, is);
      g.trashCards(p, [id]);
      const pile = yield* g.choosePile(p, {
        prompt: { k: 'prompt.gainUpTo', p: { n: card(id).cost + 2 } },
        maxCost: card(id).cost + 2,
        maxPotion: potionCost(card(id)),
        source: 'gemcutter',
      });
      if (pile) g.gain(p, pile);
    },
    ai: { value: 4, role: 'gain' },
  },
  {
    id: 'tribute',
    set: 'hoard',
    name: t("Dragon's Tribute", 'Smocza Danina'),
    text: t(
      'Each other player gains a Penny onto their deck.',
      'Każdy inny gracz zdobywa Grosz na wierzch swojej talii.',
    ),
    types: ['action', 'attack'],
    cost: 4,
    plus: { coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        g.gain(v, 'copper', 'deck');
      });
    },
    ai: { value: 4, role: 'attack' },
  },

  // ---------- koszt 5 ----------
  {
    id: 'ancientcoin',
    set: 'hoard',
    name: t('Ancient Coin', 'Pradawna Moneta'),
    text: t('+1 VP token.', '+1 żeton PZ.'),
    types: ['treasure'],
    cost: 5,
    coins: 1,
    *play(g, p) {
      g.addVp(p, 1);
    },
    ai: { value: 5, role: 'money' },
  },
  {
    id: 'strongroom',
    set: 'hoard',
    name: t('Strongroom', 'Skrytka'),
    text: t(
      'Discard any number of cards for +1 coin each.',
      'Odrzuć dowolną liczbę kart; za każdą +1 moneta.',
    ),
    types: ['action'],
    cost: 5,
    plus: { cards: 2 },
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.discardForCoins' },
        min: 0,
        max: p.hand.length,
        purpose: 'discardFor',
        source: 'strongroom',
      });
      if (!is.length) return;
      g.discardCards(p, g.takeFromHand(p, is));
      g.turn.coins += is.length;
    },
    ai: { value: 6, role: 'draw' },
  },
  {
    id: 'mint',
    set: 'hoard',
    name: t('Royal Mint', 'Mennica'),
    text: t(
      'You may reveal a Treasure from your hand. Gain a copy of it.',
      'Możesz pokazać Skarb z ręki. Zdobądź taki sam.',
    ),
    types: ['action'],
    cost: 5,
    plus: { buys: 1 },
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.copyTreasure' },
        min: 0,
        max: 1,
        filter: isTreasure,
        purpose: 'take',
        source: 'mint',
      });
      if (is.length) g.gain(p, p.hand[is[0]]);
    },
    ai: { value: 4, role: 'gain' },
  },
  {
    id: 'altar',
    set: 'hoard',
    name: t('Dragon Altar', 'Smoczy Ołtarz'),
    text: t('+1 VP token.', '+1 żeton PZ.'),
    types: ['action'],
    cost: 5,
    plus: { cards: 1, actions: 1 },
    *play(g, p) {
      g.addVp(p, 1);
    },
    ai: { value: 6, role: 'cantrip' },
  },
  {
    id: 'map',
    set: 'hoard',
    name: t('Treasure Map', 'Mapa Skarbu'),
    text: t(
      'Reveal cards from your deck until you reveal a Treasure. Discard the other cards and play that Treasure.',
      'Odkrywaj karty z talii, aż trafisz na Skarb. Pozostałe odrzuć, a ten Skarb zagraj.',
    ),
    types: ['treasure'],
    cost: 5,
    coins: 1,
    *play(g, p) {
      const other: string[] = [];
      for (;;) {
        const [id] = g.takeTop(p, 1);
        if (!id) break;
        g.logMsg(p.id, 'log.reveal', { card: '@' + id });
        if (isTreasure(id)) {
          g.discardCards(p, other, false);
          p.play.push(id);
          g.logMsg(p.id, 'log.play', { card: '@' + id });
          yield* g.resolve(p, id);
          return;
        }
        other.push(id);
      }
      g.discardCards(p, other, false);
    },
    ai: { value: 6, role: 'money' },
  },
  {
    id: 'lair',
    set: 'hoard',
    name: t("Dragon's Lair", 'Smocze Leże'),
    text: t(
      'Worth 1 VP for every 5 Treasure cards you have (round down).',
      'Warte 1 PZ za każde 5 kart Skarbów w twojej talii (zaokrąglając w dół).',
    ),
    types: ['victory'],
    cost: 5,
    vpFn: (cards) => Math.floor(cards.filter((id) => isType(card(id), 'treasure')).length / 5),
    ai: { value: 0, role: 'victory' },
  },

  // ---------- koszt 6–7 ----------
  {
    id: 'hoardkey',
    set: 'hoard',
    name: t('Hoard Key', 'Klucz do Skarbca'),
    text: t(
      'Worth 1 coin for each differently named Treasure you have in play (counting this).',
      'Wart 1 monetę za każdy inny rodzaj Skarbu, który masz w grze (licząc ten).',
    ),
    types: ['treasure'],
    cost: 6,
    *play(g, p) {
      g.turn.coins += new Set(p.play.filter(isTreasure)).size;
    },
    ai: { value: 6, role: 'money' },
  },
  {
    id: 'goldsmith',
    set: 'hoard',
    name: t('Goldsmith', 'Złotnik'),
    text: t(
      'Gain a Gold. You may trash a Treasure from your hand.',
      'Zdobądź Złoto. Możesz spalić Skarb z ręki.',
    ),
    types: ['action'],
    cost: 6,
    *play(g, p) {
      g.gain(p, 'gold');
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashTreasure' },
        min: 0,
        max: 1,
        filter: isTreasure,
        purpose: 'trash',
        source: 'goldsmith',
      });
      g.trashCards(p, g.takeFromHand(p, is));
    },
    ai: { value: 6, role: 'gain' },
  },
  {
    id: 'elderdragon',
    set: 'hoard',
    name: t('Elder Dragon', 'Prastary Smok'),
    text: t('Each other player discards down to 4 cards in hand.', 'Każdy inny gracz odrzuca karty, aż zostaną mu 4 na ręce.'),
    types: ['action', 'attack'],
    cost: 7,
    plus: { cards: 2, coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        const n = v.hand.length - 4;
        if (n <= 0) return;
        const is = yield* g.chooseFromHand(v, {
          prompt: { k: 'prompt.discardN', p: { n } },
          min: n,
          max: n,
          purpose: 'discard',
          source: 'elderdragon',
        });
        g.discardCards(v, g.takeFromHand(v, is));
      });
    },
    ai: { value: 8, role: 'attack' },
  },
];
