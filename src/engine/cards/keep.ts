// Pakiet „The Crossroads Keep” / „Twierdza na Rozstajach” – podstawowe mechaniki.
import type { CardDef } from '../card';
import { isType } from '../card';
import { card } from './index';

const t = (en: string, pl: string) => ({ en, pl });

export const KEEP: CardDef[] = [
  // ---------- koszt 2 ----------
  {
    id: 'ward',
    set: 'keep',
    name: t('Warding Rune', 'Runa Ochronna'),
    text: t(
      'When another player plays an Attack while this is in your hand, you are unaffected by it.',
      'Gdy inny gracz zagrywa Atak, a masz tę kartę na ręce, atak cię nie dotyczy.',
    ),
    types: ['action', 'reaction'],
    cost: 2,
    plus: { cards: 1, actions: 1 },
    blocksAttacks: true,
    ai: { value: 3, role: 'cantrip' },
  },
  {
    id: 'hedgewitch',
    set: 'keep',
    name: t('Hedge Witch', 'Zielarka'),
    text: t('Trash up to 2 cards from your hand.', 'Spal do 2 kart z ręki.'),
    types: ['action'],
    cost: 2,
    plus: { actions: 1 },
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashUpTo', p: { n: 2 } },
        min: 0,
        max: 2,
        purpose: 'trash',
        source: 'hedgewitch',
      });
      g.trashCards(p, g.takeFromHand(p, is));
    },
    ai: { value: 5, role: 'trash' },
  },
  {
    id: 'pilgrim',
    set: 'keep',
    name: t('Pilgrim', 'Pielgrzym'),
    text: t('You may discard a card for +1 coin.', 'Możesz odrzucić kartę, by otrzymać +1 monetę.'),
    types: ['action'],
    cost: 2,
    plus: { buys: 1, coins: 1 },
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.discardForCoin' },
        min: 0,
        max: 1,
        purpose: 'discardFor',
        source: 'pilgrim',
      });
      if (is.length) {
        g.discardCards(p, g.takeFromHand(p, is));
        g.turn.coins += 1;
      }
    },
    ai: { value: 2, role: 'money' },
  },
  {
    id: 'gnome',
    set: 'keep',
    name: t('Rummaging Gnome', 'Grzebiący Gnom'),
    text: t('Discard any number of cards, then draw that many.', 'Odrzuć dowolną liczbę kart, potem dobierz tyle samo.'),
    types: ['action'],
    cost: 2,
    plus: { actions: 1 },
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.discardToDraw' },
        min: 0,
        max: p.hand.length,
        purpose: 'discardFor',
        source: 'gnome',
      });
      if (is.length) {
        g.discardCards(p, g.takeFromHand(p, is));
        g.draw(p, is.length);
      }
    },
    ai: { value: 2, role: 'cantrip' },
  },

  // ---------- koszt 3 ----------
  {
    id: 'inn',
    set: 'keep',
    name: t('Wayside Inn', 'Przydrożna Karczma'),
    text: t('', ''),
    types: ['action'],
    cost: 3,
    plus: { cards: 1, actions: 2 },
    ai: { value: 5, role: 'village' },
  },
  {
    id: 'ranger',
    set: 'keep',
    name: t('Scout Ranger', 'Zwiadowca'),
    text: t(
      'Look at the top 2 cards of your deck. Discard any number of them and put the rest back.',
      'Obejrzyj 2 wierzchnie karty swojej talii. Odrzuć dowolne z nich, a resztę odłóż z powrotem.',
    ),
    types: ['action'],
    cost: 3,
    plus: { cards: 1, actions: 1 },
    *play(g, p) {
      const top = g.takeTop(p, 2);
      if (!top.length) return;
      const is = yield* g.chooseFromList(p, top, {
        prompt: { k: 'prompt.discardFromTop' },
        min: 0,
        max: top.length,
        purpose: 'keepOnDeck',
        source: 'ranger',
      });
      const discard = top.filter((_, i) => is.includes(i));
      const keep = top.filter((_, i) => !is.includes(i));
      g.discardCards(p, discard);
      p.deck.unshift(...keep);
    },
    ai: { value: 4, role: 'cantrip' },
  },
  {
    id: 'herald',
    set: 'keep',
    name: t('Herald', 'Herold'),
    text: t(
      'You may put a card from your discard pile onto your deck.',
      'Możesz położyć kartę ze swoich odrzuconych na wierzch talii.',
    ),
    types: ['action'],
    cost: 3,
    plus: { cards: 1, actions: 1 },
    *play(g, p) {
      if (!p.discard.length) return;
      const is = yield* g.chooseFromList(p, p.discard, {
        prompt: { k: 'prompt.topdeckFromDiscard' },
        min: 0,
        max: 1,
        purpose: 'take',
        source: 'herald',
      });
      if (is.length) {
        const [id] = p.discard.splice(is[0], 1);
        p.deck.unshift(id);
        g.logMsg(p.id, 'log.topdeck', { card: '@' + id });
      }
    },
    ai: { value: 4, role: 'cantrip' },
  },
  {
    id: 'tinker',
    set: 'keep',
    name: t('Tinker', 'Druciarz'),
    text: t('Gain a card costing up to 4 coins.', 'Zdobądź kartę kosztującą do 4 monet.'),
    types: ['action'],
    cost: 3,
    *play(g, p) {
      const id = yield* g.choosePile(p, { prompt: { k: 'prompt.gainUpTo', p: { n: 4 } }, maxCost: 4, source: 'tinker' });
      if (id) g.gain(p, id);
    },
    ai: { value: 3, role: 'gain' },
  },
  {
    id: 'guard',
    set: 'keep',
    name: t('Hired Guard', 'Najemny Strażnik'),
    text: t(
      'Each other player with 5 or more cards in hand discards a card.',
      'Każdy inny gracz mający na ręce 5 lub więcej kart odrzuca 1 kartę.',
    ),
    types: ['action', 'attack'],
    cost: 3,
    plus: { coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        if (v.hand.length < 5) return;
        const is = yield* g.chooseFromHand(v, {
          prompt: { k: 'prompt.discardN', p: { n: 1 } },
          min: 1,
          max: 1,
          purpose: 'discard',
          source: 'guard',
        });
        g.discardCards(v, g.takeFromHand(v, is));
      });
    },
    ai: { value: 4, role: 'attack' },
  },
  {
    id: 'lantern',
    set: 'keep',
    name: t('Lantern Bearer', 'Latarnik'),
    text: t('Draw until you have 5 cards in hand.', 'Dobieraj, aż będziesz mieć 5 kart na ręce.'),
    types: ['action'],
    cost: 3,
    plus: { actions: 1 },
    *play(g, p) {
      while (p.hand.length < 5) {
        if (!g.draw(p, 1).length) break;
      }
    },
    ai: { value: 3, role: 'cantrip' },
  },
  {
    id: 'tithe',
    set: 'keep',
    name: t('Tithe Collector', 'Poborca Dziesięciny'),
    text: t(
      'If you have a Penny in hand, trash it for +2 coins. Otherwise you may trash another card from your hand.',
      'Jeśli masz na ręce Grosz, spal go i weź +2 monety. W przeciwnym razie możesz spalić inną kartę z ręki.',
    ),
    types: ['action'],
    cost: 3,
    plus: { coins: 1 },
    *play(g, p) {
      const penny = p.hand.indexOf('copper');
      if (penny >= 0) {
        g.trashCards(p, g.takeFromHand(p, [penny]));
        g.turn.coins += 2;
        return;
      }
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashUpTo', p: { n: 1 } },
        min: 0,
        max: 1,
        purpose: 'trash',
        source: 'tithe',
      });
      g.trashCards(p, g.takeFromHand(p, is));
    },
    ai: { value: 4, role: 'trash' },
  },

  // ---------- koszt 4 ----------
  {
    id: 'forgemaster',
    set: 'keep',
    name: t('Forgemaster', 'Mistrz Kuźni'),
    text: t('', ''),
    types: ['action'],
    cost: 4,
    plus: { cards: 3 },
    ai: { value: 6, role: 'draw' },
  },
  {
    id: 'siren',
    set: 'keep',
    name: t('Siren', 'Syrena'),
    text: t('Each other player discards down to 3 cards in hand.', 'Każdy inny gracz odrzuca karty, aż zostaną mu 3 na ręce.'),
    types: ['action', 'attack'],
    cost: 4,
    plus: { coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        const n = v.hand.length - 3;
        if (n <= 0) return;
        const is = yield* g.chooseFromHand(v, {
          prompt: { k: 'prompt.discardN', p: { n } },
          min: n,
          max: n,
          purpose: 'discard',
          source: 'siren',
        });
        g.discardCards(v, g.takeFromHand(v, is));
      });
    },
    ai: { value: 6, role: 'attack' },
  },
  {
    id: 'orchard',
    set: 'keep',
    name: t('Wild Orchard', 'Dziki Sad'),
    text: t(
      'Worth 1 VP for every 4 Action cards you have (round down).',
      'Wart 1 PZ za każde 4 karty Akcji w twojej talii (zaokrąglając w dół).',
    ),
    types: ['victory'],
    cost: 4,
    vpFn: (cards) => Math.floor(cards.filter((id) => isType(card(id), 'action')).length / 4),
    ai: { value: 0, role: 'victory' },
  },
  {
    id: 'minstrel',
    set: 'keep',
    name: t('Minstrel', 'Trubadur'),
    text: t('', ''),
    types: ['action'],
    cost: 4,
    plus: { actions: 2, buys: 1, coins: 1 },
    ai: { value: 4, role: 'village' },
  },
  {
    id: 'horn',
    set: 'keep',
    name: t('Echoing Horn', 'Róg Echa'),
    text: t('You may play an Action card from your hand twice.', 'Możesz zagrać kartę Akcji z ręki dwukrotnie.'),
    types: ['action'],
    cost: 4,
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.replay' },
        min: 0,
        max: 1,
        filter: (id) => isType(card(id), 'action'),
        purpose: 'replay',
        source: 'horn',
      });
      if (!is.length) return;
      const [id] = g.takeFromHand(p, is);
      p.play.push(id);
      g.logMsg(p.id, 'log.playTwice', { card: '@' + id });
      yield* g.resolve(p, id);
      yield* g.resolve(p, id);
    },
    ai: { value: 5, role: 'other' },
  },
  {
    id: 'footpad',
    set: 'keep',
    name: t('Footpad', 'Rzezimieszek'),
    text: t(
      'Each other player reveals the top 2 cards of their deck, discards the Actions and Treasures among them and puts the rest back.',
      'Każdy inny gracz odkrywa 2 wierzchnie karty talii, odrzuca spośród nich Akcje i Skarby, a resztę odkłada z powrotem.',
    ),
    types: ['action', 'attack'],
    cost: 4,
    plus: { coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        const top = g.takeTop(v, 2);
        for (const id of top) g.logMsg(v.id, 'log.reveal', { card: '@' + id });
        const isGood = (id: string) => isType(card(id), 'action') || isType(card(id), 'treasure');
        g.discardCards(v, top.filter(isGood));
        v.deck.unshift(...top.filter((id) => !isGood(id)));
        g.revealFx(p, v, 'footpad', top, top.map((id) => (isGood(id) ? 'discard' : 'deck')));
      });
    },
    ai: { value: 4, role: 'attack' },
  },

  // ---------- koszt 5 ----------
  {
    id: 'scriptorium',
    set: 'keep',
    name: t('Scriptorium', 'Skryptorium'),
    text: t('', ''),
    types: ['action'],
    cost: 5,
    plus: { cards: 2, actions: 1 },
    ai: { value: 7, role: 'cantrip' },
  },
  {
    id: 'bazaar',
    set: 'keep',
    name: t('Grand Bazaar', 'Wielki Bazar'),
    text: t('', ''),
    types: ['action'],
    cost: 5,
    plus: { cards: 1, actions: 1, buys: 1, coins: 1 },
    ai: { value: 6, role: 'cantrip' },
  },
  {
    id: 'weaver',
    set: 'keep',
    name: t('Curse Weaver', 'Tkaczka Uroków'),
    text: t('Each other player gains a Hex.', 'Każdy inny gracz zdobywa Urok.'),
    types: ['action', 'attack'],
    cost: 5,
    plus: { cards: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        g.gain(v, 'hex');
      });
    },
    ai: { value: 8, role: 'attack' },
  },
  {
    id: 'banditchief',
    set: 'keep',
    name: t('Bandit Chief', 'Herszt Bandytów'),
    text: t(
      'Each other player reveals the top 2 cards of their deck, trashes a revealed Treasure other than Penny (their choice) and discards the rest.',
      'Każdy inny gracz odkrywa 2 wierzchnie karty talii, pali odkryty Skarb inny niż Grosz (sam wybiera), a resztę odrzuca.',
    ),
    types: ['action', 'attack'],
    cost: 5,
    plus: { coins: 2 },
    *play(g, p) {
      yield* g.attack(p, function* (v) {
        const top = g.takeTop(v, 2);
        for (const id of top) g.logMsg(v.id, 'log.reveal', { card: '@' + id });
        const is = yield* g.chooseFromList(v, top, {
          prompt: { k: 'prompt.loseTreasure' },
          min: 1,
          max: 1,
          filter: (id) => isType(card(id), 'treasure') && id !== 'copper',
          purpose: 'loseTreasure',
          source: 'banditchief',
        });
        g.trashCards(v, top.filter((_, i) => is.includes(i)));
        g.discardCards(v, top.filter((_, i) => !is.includes(i)), false);
        // ofiara sama wybierała (i widzi spalenie) – okienko tylko dla grającego
        g.revealFx(p, v, 'banditchief', top, top.map((_, i) => (is.includes(i) ? 'trash' : 'discard')), [p.id]);
      });
    },
    ai: { value: 5, role: 'attack' },
  },
  {
    id: 'smelter',
    set: 'keep',
    name: t('Smelter', 'Huta'),
    text: t(
      'You may trash a Treasure from your hand. Gain a Treasure costing up to 3 coins more than it, into your hand.',
      'Możesz spalić Skarb z ręki. Zdobądź na rękę Skarb kosztujący do 3 monet więcej.',
    ),
    types: ['action'],
    cost: 5,
    *play(g, p) {
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.trashTreasure' },
        min: 0,
        max: 1,
        filter: (id) => isType(card(id), 'treasure'),
        purpose: 'trash',
        source: 'smelter',
        hint: (() => {
          const i = p.hand.indexOf('silver');
          const j = p.hand.indexOf('copper');
          return { t: 'cards', is: i >= 0 ? [i] : j >= 0 ? [j] : [] };
        })(),
      });
      if (!is.length) return;
      const [id] = g.takeFromHand(p, is);
      g.trashCards(p, [id]);
      const pile = yield* g.choosePile(p, {
        prompt: { k: 'prompt.gainTreasureUpTo', p: { n: card(id).cost + 3 } },
        maxCost: card(id).cost + 3,
        filter: (x) => isType(card(x), 'treasure'),
        source: 'smelter',
      });
      if (pile) g.gain(p, pile, 'hand');
    },
    ai: { value: 5, role: 'trash' },
  },
  {
    id: 'council',
    set: 'keep',
    name: t('Council Hall', 'Sala Rady'),
    text: t('Each other player draws a card.', 'Każdy inny gracz dobiera 1 kartę.'),
    types: ['action'],
    cost: 5,
    plus: { cards: 4, buys: 1 },
    *play(g, p) {
      for (const o of g.others(p)) g.draw(o, 1);
    },
    ai: { value: 7, role: 'draw' },
  },
  {
    id: 'sage',
    set: 'keep',
    name: t("Sage's Tower", 'Wieża Mędrca'),
    text: t(
      'Draw until you have 7 cards in hand. You may set aside Action cards drawn this way; discard them afterwards.',
      'Dobieraj, aż będziesz mieć 7 kart na ręce. Dobrane w ten sposób karty Akcji możesz odłożyć na bok; potem je odrzuć.',
    ),
    types: ['action'],
    cost: 5,
    *play(g, p) {
      const aside: string[] = [];
      while (p.hand.length < 7) {
        const [id] = g.takeTop(p, 1);
        if (!id) break;
        if (isType(card(id), 'action')) {
          const skip = yield* g.yesNo(p, { k: 'prompt.setAside', p: { card: '@' + id } }, 'sage', g.turn.actions === 0);
          if (skip) {
            aside.push(id);
            continue;
          }
        }
        g.addToHand(p, [id]);
      }
      g.discardCards(p, aside);
    },
    ai: { value: 7, role: 'draw' },
  },

  // ---------- koszt 6 ----------
  {
    id: 'artisan',
    set: 'keep',
    name: t('Master Artisan', 'Mistrz Rzemiosła'),
    text: t(
      'Gain a card costing up to 5 coins into your hand. Put a card from your hand onto your deck.',
      'Zdobądź na rękę kartę kosztującą do 5 monet. Połóż kartę z ręki na wierzch talii.',
    ),
    types: ['action'],
    cost: 6,
    *play(g, p) {
      const id = yield* g.choosePile(p, { prompt: { k: 'prompt.gainToHandUpTo', p: { n: 5 } }, maxCost: 5, source: 'artisan' });
      if (id) g.gain(p, id, 'hand');
      const is = yield* g.chooseFromHand(p, {
        prompt: { k: 'prompt.topdeck' },
        min: 1,
        max: 1,
        purpose: 'topdeck',
        source: 'artisan',
      });
      const ids = g.takeFromHand(p, is);
      p.deck.unshift(...ids);
      if (ids.length) g.logMsg(p.id, 'log.topdeckHidden');
    },
    ai: { value: 7, role: 'gain' },
  },
];
