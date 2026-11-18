import { card } from './engine/cards';
import type { Lang, Msg } from './engine/types';

type Dict = Record<string, string>;

const en: Dict = {
  appName: 'Crownforge',
  tagline: 'A fantasy deck-building game',
  continue: 'Continue game',
  newGame: 'New game',
  rules: 'How to play',
  language: 'Language',
  back: 'Back',
  start: 'Start game',
  opponents: 'Opponents',
  opponent: 'Opponent {n}',
  addBot: 'Add opponent',
  remove: 'Remove',
  'level.easy': 'Easy',
  'level.medium': 'Medium',
  'level.hard': 'Hard',
  packs: 'Card packs',
  soon: 'coming soon',
  kingdomMode: 'Kingdom',
  'mode.random': 'Random',
  'mode.manual': 'Choose cards',
  kingdom: 'Kingdom',
  rerollAll: 'Draw all again',
  reroll: 'Draw again',
  chooseCards: 'Choose 10 cards ({n}/10)',
  yourName: 'Your name',
  defaultName: 'Player',
  speed: 'Opponent speed',
  autoEnd: 'End my turn automatically when I have no buys left',
  'speed.slow': 'Slow',
  'speed.normal': 'Normal',
  'speed.fast': 'Fast',
  preparing: 'Opponents are studying the Kingdom…',
  turnOf: 'Turn {n} · {who}',
  yourTurn: 'Your turn',
  you: 'You',
  actions: 'Actions',
  buys: 'Buys',
  coins: 'Coins',
  deck: 'Deck',
  discardPile: 'Discard',
  hand: 'Hand',
  inPlay: 'In play',
  'phase.action': 'Action phase',
  'phase.buy': 'Buy phase',
  'phase.cleanup': 'Clean-up',
  endActions: 'End actions',
  playAll: 'Play treasures',
  endTurn: 'End turn',
  confirm: 'Confirm',
  skip: 'Skip',
  yes: 'Yes',
  no: 'No',
  close: 'Close',
  buyFor: 'Buy · {n}',
  gainThis: 'Gain this',
  play: 'Play',
  selected: 'Selected {n}',
  thinking: '{who} is thinking…',
  skipToMe: 'Skip to my turn',
  log: 'Log',
  menu: 'Menu',
  leaveGame: 'Main menu',
  restart: 'New game',
  confirmNew: 'Abandon the current game?',
  gameOver: 'Game over',
  winner: '{who} wins!',
  youWin: 'You win!',
  tie: 'Tie!',
  vp: 'VP',
  turns: 'turns',
  sameKingdom: 'Rematch (same Kingdom)',
  left: '{n} left',
  cost: 'Cost',
  myDeck: 'Your cards',
  supply: 'Supply',
  noCards: 'No cards',
  'type.action': 'Action',
  'type.treasure': 'Treasure',
  'type.victory': 'Victory',
  'type.curse': 'Curse',
  'type.attack': 'Attack',
  'type.reaction': 'Reaction',
  'plus.cards': '+{n} Card|+{n} Cards',
  'plus.actions': '+{n} Action|+{n} Actions',
  'plus.buys': '+{n} Buy|+{n} Buys',
  'plus.coins': '+{n} Coin|+{n} Coins',
  piles: 'Empty piles: {n}/3',
  citadelsLeft: 'Citadels left: {n}',
  waitingFor: 'Waiting for {who}',
  attackedBy: 'Attack!',

  'prompt.action': 'Tap an Action card to play it, or tap a Supply pile to buy.',
  'prompt.buy': 'Play Treasures, then tap a Supply pile to buy.',
  'prompt.noBuys': '',
  'prompt.trashUpTo': 'Trash cards from your hand (up to {n}).',
  'prompt.discardForCoin': 'You may discard a card for +1 coin.',
  'prompt.discardToDraw': 'Discard any number of cards – you will draw that many.',
  'prompt.discardFromTop': 'Top of your deck: choose cards to discard, the rest go back.',
  'prompt.topdeckFromDiscard': 'You may put a card from your discard pile onto your deck.',
  'prompt.gainUpTo': 'Gain a card costing up to {n}.',
  'prompt.discardN': 'Discard cards from your hand ({n}).',
  'prompt.replay': 'Choose an Action card to play twice.',
  'prompt.loseTreasure': 'Choose a revealed Treasure to trash.',
  'prompt.trashTreasure': 'You may trash a Treasure from your hand.',
  'prompt.gainTreasureUpTo': 'Gain a Treasure costing up to {n} into your hand.',
  'prompt.setAside': 'Set aside {card}? Otherwise it goes to your hand.',
  'prompt.gainToHandUpTo': 'Gain a card costing up to {n} into your hand.',
  'prompt.topdeck': 'Put a card from your hand onto your deck.',

  'log.turn': '{who} — turn {n}',
  'log.play': '{who} plays {card}',
  'log.playTwice': '{who} plays {card} twice',
  'log.buy': '{who} buys {card}',
  'log.gain': '{who} gains {card}',
  'log.gainHand': '{who} gains {card} into hand',
  'log.gainDeck': '{who} gains {card} onto deck',
  'log.trash': '{who} trashes {card}',
  'log.discard': '{who} discards {card}',
  'log.shuffle': '{who} shuffles',
  'log.reveal': '{who} reveals {card}',
  'log.blocked': '{who} is protected by {card}',
  'log.topdeck': '{who} puts {card} onto deck',
  'log.topdeckHidden': '{who} puts a card onto deck',
  'log.gameOver': 'Game over',

  rulesText: `
## Goal
Have the most Victory Points (VP) when the game ends. VP come from Victory cards in your deck: Homestead 1, Manor 3, Citadel 6. Each Hex is −1.

## Your deck
Everyone starts with 7 Pennies and 3 Homesteads and draws 5 cards. When your deck runs out, your discard pile is shuffled to form a new deck.

## A turn
**Action phase.** You have 1 Action. Play an Action card from your hand; it may give more Actions, cards, Buys or coins.
**Buy phase.** Play Treasures for coins. With 1 Buy you may buy one card costing up to your coins; it goes to your discard pile.
**Clean-up.** All cards in play and in hand are discarded, and you draw 5 new cards.

## End of the game
The game ends after a turn in which the Citadel pile is empty, or any 3 Supply piles are empty. Ties go to the player with fewer turns.

## Tips
Buy good cards early, Victory cards late — they do nothing in your hand. Trashing weak cards makes your deck stronger. Long-press any card to read it. Double-tap a Supply pile to buy it straight away, or a card to choose it and confirm.`,
};

const pl: Dict = {
  appName: 'Crownforge',
  tagline: 'Karciana gra fantasy o budowaniu talii',
  continue: 'Kontynuuj grę',
  newGame: 'Nowa gra',
  rules: 'Zasady',
  language: 'Język',
  back: 'Wstecz',
  start: 'Rozpocznij grę',
  opponents: 'Przeciwnicy',
  opponent: 'Przeciwnik {n}',
  addBot: 'Dodaj przeciwnika',
  remove: 'Usuń',
  'level.easy': 'Łatwy',
  'level.medium': 'Średni',
  'level.hard': 'Trudny',
  packs: 'Pakiety kart',
  soon: 'wkrótce',
  kingdomMode: 'Królestwo',
  'mode.random': 'Losowe',
  'mode.manual': 'Wybór kart',
  kingdom: 'Królestwo',
  rerollAll: 'Losuj wszystkie',
  reroll: 'Losuj ponownie',
  chooseCards: 'Wybierz 10 kart ({n}/10)',
  yourName: 'Twoje imię',
  defaultName: 'Gracz',
  speed: 'Tempo przeciwników',
  autoEnd: 'Automatycznie kończ moją turę, gdy nie mam już zakupów',
  'speed.slow': 'Wolne',
  'speed.normal': 'Normalne',
  'speed.fast': 'Szybkie',
  preparing: 'Przeciwnicy studiują Królestwo…',
  turnOf: 'Tura {n} · {who}',
  yourTurn: 'Twoja tura',
  you: 'Ty',
  actions: 'Akcje',
  buys: 'Zakupy',
  coins: 'Monety',
  deck: 'Talia',
  discardPile: 'Odrzucone',
  hand: 'Ręka',
  inPlay: 'Zagrane',
  'phase.action': 'Faza akcji',
  'phase.buy': 'Faza zakupów',
  'phase.cleanup': 'Porządki',
  endActions: 'Koniec akcji',
  playAll: 'Zagraj skarby',
  endTurn: 'Koniec tury',
  confirm: 'Zatwierdź',
  skip: 'Pomiń',
  yes: 'Tak',
  no: 'Nie',
  close: 'Zamknij',
  buyFor: 'Kup · {n}',
  gainThis: 'Zdobądź',
  play: 'Zagraj',
  selected: 'Wybrano: {n}',
  thinking: '{who} się zastanawia…',
  skipToMe: 'Przewiń do mojej tury',
  log: 'Dziennik',
  menu: 'Menu',
  leaveGame: 'Menu główne',
  restart: 'Nowa gra',
  confirmNew: 'Porzucić bieżącą grę?',
  gameOver: 'Koniec gry',
  winner: 'Wygrywa {who}!',
  youWin: 'Wygrywasz!',
  tie: 'Remis!',
  vp: 'PZ',
  turns: 'tur',
  sameKingdom: 'Rewanż (to samo Królestwo)',
  left: 'zostało {n}',
  cost: 'Koszt',
  myDeck: 'Twoje karty',
  supply: 'Zasoby',
  noCards: 'Brak kart',
  'type.action': 'Akcja',
  'type.treasure': 'Skarb',
  'type.victory': 'Zwycięstwo',
  'type.curse': 'Klątwa',
  'type.attack': 'Atak',
  'type.reaction': 'Reakcja',
  'plus.cards': '+{n} karta|+{n} karty|+{n} kart',
  'plus.actions': '+{n} akcja|+{n} akcje|+{n} akcji',
  'plus.buys': '+{n} zakup|+{n} zakupy|+{n} zakupów',
  'plus.coins': '+{n} moneta|+{n} monety|+{n} monet',
  piles: 'Puste stosy: {n}/3',
  citadelsLeft: 'Cytadele: zostało {n}',
  waitingFor: 'Czekamy na: {who}',
  attackedBy: 'Atak!',

  'prompt.action': 'Stuknij kartę Akcji, by ją zagrać, albo stos w Zasobach, by kupić.',
  'prompt.buy': 'Zagraj Skarby, potem stuknij stos w Zasobach, by kupić.',
  'prompt.noBuys': '',
  'prompt.trashUpTo': 'Spal karty z ręki (maks. {n}).',
  'prompt.discardForCoin': 'Możesz odrzucić kartę za +1 monetę.',
  'prompt.discardToDraw': 'Odrzuć dowolną liczbę kart – dobierzesz tyle samo.',
  'prompt.discardFromTop': 'Wierzch talii: wybierz karty do odrzucenia, reszta wraca.',
  'prompt.topdeckFromDiscard': 'Możesz położyć kartę z odrzuconych na wierzch talii.',
  'prompt.gainUpTo': 'Zdobądź kartę kosztującą do {n}.',
  'prompt.discardN': 'Odrzuć karty z ręki (liczba: {n}).',
  'prompt.replay': 'Wybierz kartę Akcji do zagrania dwukrotnie.',
  'prompt.loseTreasure': 'Wybierz odkryty Skarb do spalenia.',
  'prompt.trashTreasure': 'Możesz spalić Skarb z ręki.',
  'prompt.gainTreasureUpTo': 'Zdobądź na rękę Skarb kosztujący do {n}.',
  'prompt.setAside': 'Odłożyć na bok: {card}? W przeciwnym razie trafi na rękę.',
  'prompt.gainToHandUpTo': 'Zdobądź na rękę kartę kosztującą do {n}.',
  'prompt.topdeck': 'Połóż kartę z ręki na wierzch talii.',

  'log.turn': '{who} — tura {n}',
  'log.play': '{who}: zagrywa {card}',
  'log.playTwice': '{who}: zagrywa dwukrotnie {card}',
  'log.buy': '{who}: kupuje {card}',
  'log.gain': '{who}: zdobywa {card}',
  'log.gainHand': '{who}: zdobywa na rękę {card}',
  'log.gainDeck': '{who}: zdobywa na talię {card}',
  'log.trash': '{who}: pali {card}',
  'log.discard': '{who}: odrzuca {card}',
  'log.shuffle': '{who}: tasuje talię',
  'log.reveal': '{who}: odkrywa {card}',
  'log.blocked': '{who}: chroni się kartą {card}',
  'log.topdeck': '{who}: kładzie na talię {card}',
  'log.topdeckHidden': '{who}: kładzie kartę na talię',
  'log.gameOver': 'Koniec gry',

  rulesText: `
## Cel
Zdobądź najwięcej Punktów Zwycięstwa (PZ) do końca gry. PZ dają karty Zwycięstwa w twojej talii: Zagroda 1, Dwór 3, Cytadela 6. Każdy Urok to −1.

## Twoja talia
Każdy zaczyna z 7 Groszami i 3 Zagrodami i dobiera 5 kart. Gdy talia się skończy, przetasuj odrzucone karty – to twoja nowa talia.

## Tura
**Faza akcji.** Masz 1 Akcję. Zagraj kartę Akcji z ręki; może dać więcej akcji, kart, zakupów lub monet.
**Faza zakupów.** Zagraj Skarby, by mieć monety. Mając 1 Zakup, kupujesz jedną kartę kosztującą nie więcej, niż masz monet; trafia ona na twoje odrzucone.
**Porządki.** Wszystkie zagrane karty i karty z ręki idą na odrzucone, a ty dobierasz 5 nowych.

## Koniec gry
Gra kończy się po turze, w której wyczerpał się stos Cytadeli albo dowolne 3 stosy w Zasobach. Przy remisie wygrywa gracz z mniejszą liczbą tur.

## Wskazówki
Na początku kupuj dobre karty, punkty pod koniec – na ręce nic nie robią. Palenie słabych kart wzmacnia talię. Przytrzymaj palec na dowolnej karcie, by ją przeczytać. Stuknij dwukrotnie stos w Zasobach, by od razu go kupić, albo kartę, by ją wybrać i od razu zatwierdzić.`,
};

const DICTS: Record<Lang, Dict> = { en, pl };

/** Liczba mnoga: EN „one|many”, PL „1|2–4|5+”. */
function plural(lang: Lang, forms: string[], n: number): string {
  if (forms.length === 1) return forms[0];
  if (lang === 'en') return n === 1 ? forms[0] : forms[1];
  if (n === 1) return forms[0];
  const d = n % 10;
  const dd = n % 100;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
  return forms[2] ?? forms[1];
}

export function tr(lang: Lang, key: string, params?: Record<string, string | number>, names?: string[]): string {
  let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (s.includes('|')) s = plural(lang, s.split('|'), Number(params?.n ?? 0));
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined) return '';
    if (typeof v === 'string' && v.startsWith('@')) return card(v.slice(1)).name[lang];
    if (k === 'who' && typeof v === 'number' && names) return names[v] ?? '';
    return String(v);
  });
}

export function msg(lang: Lang, m: Msg): string {
  return tr(lang, m.k, m.p);
}
