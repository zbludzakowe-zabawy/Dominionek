// Pakiet „Court Whispers” / „Szepty Dworu” – dwór książęcy, bale, damy i służba.
// Mechaniki: karty wielotypowe (Akcja–Zwycięstwo, Skarb–Reakcja, Skarb–Zwycięstwo)
// i karty „wybierz jedno” (opcje).
import type { CardDef } from '../card';
import { isType } from '../card';
import type { Game } from '../game';
import type { Answer, Msg, PlayerState } from '../types';
import { card } from './index';

const t = (en: string, pl: string) => ({ en, pl });
const isAction = (id: string) => isType(card(id), 'action');
const isTreasure = (id: string) => isType(card(id), 'treasure');

/** Karta „do pozbycia się” – dla podpowiedzi botów. */
function junkInHand(p: PlayerState): boolean {
  return p.hand.some((id) => id === 'hex' || (id === 'homestead' && p.turns <= 12) || (id === 'copper' && p.turns <= 6));
}
/** Czy na ręce są jeszcze inne karty akcji. */
const actionsInHand = (p: PlayerState) => p.hand.filter(isAction).length;
const coinsInHand = (p: PlayerState) => p.hand.reduce((s, id) => s + (card(id).coins ?? 0), 0);

const opts = (is: number[]): Answer => ({ t: 'opts', is });
const o = (k: string, p?: Msg['p']): Msg => ({ k, p });

/** „Wybierz jedno” – zwraca indeks opcji. */
function* chooseOne(g: Game, p: PlayerState, source: string, options: Msg[], hint: number) {
  const [i] = yield* g.chooseOptions(p, options, 1, { k: 'prompt.chooseOne' }, source, opts([hint]));
  return i ?? hint;
}

/** Spal kartę z ręki (do 1). */
function* trashOne(g: Game, p: PlayerState, source: string) {
  const is = yield* g.chooseFromHand(p, {
    prompt: { k: 'prompt.trashUpTo', p: { n: 1 } },
    min: 0,
    max: 1,
    purpose: 'trash',
    source,
  });
  const ids = g.takeFromHand(p, is);
  g.trashCards(p, ids);
  return ids[0];
}

export const COURT: CardDef[] = [
  // ---------- koszt 2 ----------
  {
    id: 'chambermaid',
    set: 'court',
    name: t('Chambermaid', 'Pokojówka'),
    text: t(
      'Choose one: +1 Card; or +1 coin; or trash a card from your hand.',
      'Wybierz jedno: +1 karta; albo +1 moneta; albo spal kartę z ręki.',
    ),
    types: ['action'],
    cost: 2,
    plus: { actions: 1 },
    *play(g, p) {
      const i = yield* chooseOne(g, p, 'chambermaid', [o('plus.cards', { n: 1 }), o('plus.coins', { n: 1 }), o('opt.trashCard')], junkInHand(p) ? 2 : 0);
      if (i === 0) g.draw(p, 1);
      else if (i === 1) g.turn.coins += 1;
      else yield* trashOne(g, p, 'chambermaid');
    },
    ai: { value: 4, role: 'trash' },
  },
  {
    id: 'lacefan',
    set: 'court',
    name: t('Fan', 'Wachlarz'),
    text: t(
      'While this is in your hand, Attacks do not affect you.',
      'Gdy masz tę kartę na ręce, Ataki cię nie dotyczą.',
    ),
    types: ['treasure', 'reaction'],
    cost: 2,
    coins: 1,
    blocksAttacks: true,
    ai: { value: 2, role: 'money' },
  },

  // ---------- koszt 3 ----------
  {
    id: 'gallery',
    set: 'court',
    name: t('Portrait Gallery', 'Galeria Portretów'),
    text: t('', ''),
    types: ['action', 'victory'],
    cost: 3,
    plus: { cards: 1, actions: 1 },
    vp: 1,
    ai: { value: 3, role: 'cantrip' },
  },
  {
    id: 'minuet',
    set: 'court',
    name: t('Minuet', 'Menuet'),
    text: t('Choose one: +1 Card; or +1 Buy and +1 coin.', 'Wybierz jedno: +1 karta; albo +1 zakup i +1 moneta.'),
    types: ['action'],
    cost: 3,
    plus: { actions: 2 },
    *play(g, p) {
      const i = yield* chooseOne(g, p, 'minuet', [o('plus.cards', { n: 1 }), o('opt.buyCoin')], 0);
      if (i === 0) g.draw(p, 1);
      else {
        g.turn.buys += 1;
        g.turn.coins += 1;
      }
    },
    ai: { value: 5, role: 'village' },
  },
  {
    id: 'rumor',
    set: 'court',
    name: t('Court Rumor', 'Plotka'),
    text: t(
      'Each other player reveals the top card of their deck. For each, you choose: they discard it or put it back.',
      'Każdy inny gracz odkrywa wierzchnią kartę talii. Ty decydujesz: odrzuca ją czy odkłada z powrotem.',
    ),
    types: ['action', 'attack'],
    cost: 3,
    plus: { cards: 1, actions: 1 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        const [id] = g.takeTop(v, 1);
        if (!id) return;
        g.logMsg(v.id, 'log.reveal', { card: '@' + id });
        const good = isAction(id) || (isTreasure(id) && id !== 'copper');
        const discard = yield* g.yesNo(p, { k: 'prompt.rumor', p: { card: '@' + id, name: v.name } }, 'rumor', good);
        if (discard) g.discardCards(v, [id]);
        else v.deck.unshift(id);
      });
    },
    ai: { value: 4, role: 'attack' },
  },
  {
    id: 'cupbearer',
    set: 'court',
    name: t('Cupbearer', 'Podczaszy'),
    text: t(
      'Choose one: +2 Cards; or +2 coins; or +1 Card and +1 Action.',
      'Wybierz jedno: +2 karty; albo +2 monety; albo +1 karta i +1 akcja.',
    ),
    types: ['action'],
    cost: 3,
    *play(g, p) {
      const money = coinsInHand(p) + g.turn.coins;
      const hint = actionsInHand(p) > 0 && g.turn.actions === 0 ? 2 : money === 3 || money === 4 ? 1 : 0;
      const i = yield* chooseOne(g, p, 'cupbearer', [o('plus.cards', { n: 2 }), o('plus.coins', { n: 2 }), o('opt.cardAction')], hint);
      if (i === 0) g.draw(p, 2);
      else if (i === 1) g.turn.coins += 2;
      else {
        g.draw(p, 1);
        g.turn.actions += 1;
      }
    },
    ai: { value: 4, role: 'draw' },
  },

  // ---------- koszt 4 ----------
  {
    id: 'seamstress',
    set: 'court',
    name: t('Seamstress', 'Krawcowa'),
    text: t(
      'Gain a card costing up to 4 coins. If it is a Treasure, put it into your hand.',
      'Zdobądź kartę kosztującą do 4 monet. Jeśli to Skarb, weź go na rękę.',
    ),
    types: ['action'],
    cost: 4,
    plus: { cards: 1 },
    *play(g, p) {
      const id = yield* g.choosePile(p, { prompt: { k: 'prompt.gainUpTo', p: { n: 4 } }, maxCost: 4, source: 'seamstress' });
      if (id) g.gain(p, id, isTreasure(id) ? 'hand' : 'discard');
    },
    ai: { value: 4, role: 'gain' },
  },
  {
    id: 'familytree',
    set: 'court',
    name: t('Family Tree', 'Drzewo Rodowe'),
    text: t(
      'Worth 1 VP for every 3 cards with two types you have (round down).',
      'Warte 1 PZ za każde 3 karty o dwóch typach w twojej talii (zaokrąglając w dół).',
    ),
    types: ['victory'],
    cost: 4,
    vpFn: (cards) => Math.floor(cards.filter((id) => card(id).types.length >= 2).length / 3),
    ai: { value: 0, role: 'victory' },
  },
  {
    id: 'letter',
    set: 'court',
    name: t('Billet-doux', 'Liścik'),
    text: t(
      'Choose one: +1 coin; or look at the top 2 cards of your deck, put one into your hand and discard the other.',
      'Wybierz jedno: +1 moneta; albo obejrzyj 2 wierzchnie karty talii, jedną weź na rękę, drugą odrzuć.',
    ),
    types: ['action'],
    cost: 4,
    plus: { cards: 1, actions: 1 },
    *play(g, p) {
      const i = yield* chooseOne(g, p, 'letter', [o('plus.coins', { n: 1 }), o('opt.lookTwo')], 1);
      if (i === 0) {
        g.turn.coins += 1;
        return;
      }
      const top = g.takeTop(p, 2);
      if (!top.length) return;
      const is = yield* g.chooseFromList(p, top, {
        prompt: { k: 'prompt.takeOneDiscard' },
        min: 1,
        max: 1,
        purpose: 'take',
        source: 'letter',
      });
      g.addToHand(p, top.filter((_, k) => is.includes(k)));
      g.discardCards(p, top.filter((_, k) => !is.includes(k)));
    },
    ai: { value: 5, role: 'cantrip' },
  },
  {
    id: 'chamberlain',
    set: 'court',
    name: t('Chamberlain', 'Szambelan'),
    text: t(
      'Choose one: +2 coins; or trash a card from your hand and gain a card costing up to 2 coins more than it.',
      'Wybierz jedno: +2 monety; albo spal kartę z ręki i zdobądź kartę kosztującą do 2 monet więcej.',
    ),
    types: ['action'],
    cost: 4,
    plus: { buys: 1 },
    *play(g, p) {
      const upgrade = p.hand.some((id) => id === 'hex' || (id === 'homestead' && p.turns <= 12));
      const i = yield* chooseOne(g, p, 'chamberlain', [o('plus.coins', { n: 2 }), o('opt.remodel')], upgrade ? 1 : 0);
      if (i === 0) {
        g.turn.coins += 2;
        return;
      }
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashN', p: { n: 1 } },
        min: 1,
        max: 1,
        purpose: 'trash',
        source: 'chamberlain',
      });
      if (!is.length) return;
      const [id] = g.takeFromHand(p, is);
      g.trashCards(p, [id]);
      const pile = yield* g.choosePile(p, {
        prompt: { k: 'prompt.gainUpTo', p: { n: card(id).cost + 2 } },
        maxCost: card(id).cost + 2,
        source: 'chamberlain',
      });
      if (pile) g.gain(p, pile);
    },
    ai: { value: 5, role: 'money' },
  },
  {
    id: 'dowry',
    set: 'court',
    name: t('Dowry', 'Posag'),
    text: t('Choose one: +1 coin; or +1 Buy.', 'Wybierz jedno: +1 moneta; albo +1 zakup.'),
    types: ['treasure', 'victory'],
    cost: 4,
    coins: 1,
    vp: 1,
    *play(g, p) {
      const i = yield* chooseOne(g, p, 'dowry', [o('plus.coins', { n: 1 }), o('plus.buys', { n: 1 })], 0);
      if (i === 0) g.turn.coins += 1;
      else g.turn.buys += 1;
    },
    ai: { value: 4, role: 'money' },
  },

  // ---------- koszt 5 ----------
  {
    id: 'majordomo',
    set: 'court',
    name: t('Majordomo', 'Majordomus'),
    text: t(
      'Choose one: +3 Cards; or +1 Card and +2 Actions; or +1 Buy and +2 coins.',
      'Wybierz jedno: +3 karty; albo +1 karta i +2 akcje; albo +1 zakup i +2 monety.',
    ),
    types: ['action'],
    cost: 5,
    *play(g, p) {
      const acts = actionsInHand(p);
      const hint = acts >= 2 || (acts === 1 && g.turn.actions === 0) ? 1 : 0;
      const i = yield* chooseOne(g, p, 'majordomo', [o('plus.cards', { n: 3 }), o('opt.cardActions'), o('opt.buyCoins')], hint);
      if (i === 0) g.draw(p, 3);
      else if (i === 1) {
        g.draw(p, 1);
        g.turn.actions += 2;
      } else {
        g.turn.buys += 1;
        g.turn.coins += 2;
      }
    },
    ai: { value: 7, role: 'draw' },
  },
  {
    id: 'scandal',
    set: 'court',
    name: t('Scandal', 'Skandal'),
    text: t(
      'Each other player chooses one: discard 2 cards; or gain a Hex.',
      'Każdy inny gracz wybiera jedno: odrzuca 2 karty; albo zdobywa Urok.',
    ),
    types: ['action', 'attack'],
    cost: 5,
    plus: { cards: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        const [i] = yield* g.chooseOptions(v, [o('opt.discardTwo'), o('opt.gainHex')], 1, { k: 'prompt.scandal' }, 'scandal', opts([0]));
        if (i === 1) {
          g.gain(v, 'hex');
          return;
        }
        const is = yield* g.chooseFromHand(v, {
          prompt: { k: 'prompt.discardN', p: { n: 2 } },
          min: 2,
          max: 2,
          purpose: 'discard',
          source: 'scandal',
        });
        g.discardCards(v, g.takeFromHand(v, is));
      });
    },
    ai: { value: 7, role: 'attack' },
  },
  {
    id: 'margravine',
    set: 'court',
    name: t('Margravine', 'Margrabina'),
    text: t(
      'Choose one: +2 Cards; or each other player discards down to 3 cards in hand.',
      'Wybierz jedno: +2 karty; albo każdy inny gracz odrzuca karty, aż zostaną mu 3 na ręce.',
    ),
    types: ['action', 'attack'],
    cost: 5,
    plus: { coins: 2 },
    *play(g, p) {
      const i = yield* chooseOne(g, p, 'margravine', [o('plus.cards', { n: 2 }), o('opt.othersDiscard')], p.turns % 2);
      if (i === 0) {
        g.draw(p, 2);
        return;
      }
      yield* g.attack(p, function* (v) {
        const n = v.hand.length - 3;
        if (n <= 0) return;
        const is = yield* g.chooseFromHand(v, {
          prompt: { k: 'prompt.discardN', p: { n } },
          min: n,
          max: n,
          purpose: 'discard',
          source: 'margravine',
        });
        g.discardCards(v, g.takeFromHand(v, is));
      });
    },
    ai: { value: 6, role: 'attack' },
  },

  // ---------- koszt 6 ----------
  {
    id: 'grandball',
    set: 'court',
    name: t('Grand Ball', 'Wielki Bal'),
    text: t(
      'Choose two different: +2 Cards; +2 Actions; +2 coins; +1 Buy.',
      'Wybierz dwa różne: +2 karty; +2 akcje; +2 monety; +1 zakup.',
    ),
    types: ['action'],
    cost: 6,
    *play(g, p) {
      const hint = actionsInHand(p) > 0 ? [0, 1] : [0, 2];
      const is = yield* g.chooseOptions(
        p,
        [o('plus.cards', { n: 2 }), o('plus.actions', { n: 2 }), o('plus.coins', { n: 2 }), o('plus.buys', { n: 1 })],
        2,
        { k: 'prompt.chooseTwo' },
        'grandball',
        opts(hint),
      );
      const picked = is.length ? is : hint;
      // akcje i zakup przed dobieraniem – kolejność nie zmienia wyniku
      if (picked.includes(1)) g.turn.actions += 2;
      if (picked.includes(2)) g.turn.coins += 2;
      if (picked.includes(3)) g.turn.buys += 1;
      if (picked.includes(0)) g.draw(p, 2);
    },
    ai: { value: 8, role: 'draw' },
  },
  {
    id: 'ballroom',
    set: 'court',
    name: t('Ballroom', 'Sala Balowa'),
    text: t('', ''),
    types: ['action', 'victory'],
    cost: 6,
    plus: { cards: 2, buys: 1 },
    vp: 2,
    ai: { value: 5, role: 'draw' },
  },
];
