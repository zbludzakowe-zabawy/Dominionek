import { LogIcon } from './Icons';
import { useEffect, useRef, useState } from 'react';
import { decide, type Plan } from '../engine/bot';
import { isType } from '../engine/card';
import { card } from '../engine/cards';
import { Game } from '../engine/game';
import { makePlan } from '../engine/plan';
import type { Answer, Decision, Lang } from '../engine/types';
import { msg, tr } from '../i18n';
import { CardFace, Coin, ConfirmButton, Flask, PileTile, PlayedCard, useEscape } from './CardView';
import { typeKey } from './art';
import { saveGame, type SavedGame, type Settings, CARDS_REV } from './store';
import type { LinkState } from '../online/transport';
import { reconcile } from '../online/sync';

/** Gra online: moje miejsce przy stole i ruchy z bazy (src/online). */
export interface OnlinePlay {
  seat: number;
  /** Gospodarz wykonuje ruchy botów. */
  host: boolean;
  moves: Answer[];
  /** Zmienia się przy każdej zmianie danych pokoju. */
  version: number;
  link: LinkState;
  unsent: number;
  /** Kiedy gracze ostatnio mieli otwartą grę (nr miejsca → czas). */
  ping: Record<number, number>;
  push: (answers: Answer[]) => void;
}

/** Gracz „obecny”, jeśli jego aplikacja odezwała się w ciągu tylu ms. */
const PRESENT_MS = 75000;
/** Telefon trzymany poziomo – osobny, niski układ. */
const LANDSCAPE_PHONE = '(orientation: landscape) and (max-height: 520px)';

function useMedia(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
/** Telefon: górny rząd – pieniądze rosnąco, punkty rosnąco, na końcu Urok (−1). */
const PHONE_BASIC_ORDER = ['copper', 'silver', 'gold', 'dragongold', 'elixir', 'homestead', 'manor', 'citadel', 'palace', 'hex'];

/**
 * Królestwo w rzędach po 5: od najtańszej (lewy dolny róg) do najdroższej (prawy górny).
 * Zwraca kolejność do wyświetlenia (rzędy od góry).
 */
function kingdomLayout(ids: string[], lang: Lang, perRow = 5): string[] {
  const sorted = [...ids].sort((a, b) => card(a).cost - card(b).cost || card(a).name[lang].localeCompare(card(b).name[lang]));
  const rows: string[][] = [];
  for (let i = 0; i < sorted.length; i += perRow) rows.push(sorted.slice(i, i + perRow));
  return rows.reverse().flat();
}
const DELAY = { slow: 1100, normal: 650, fast: 250 };

interface Props {
  saved: SavedGame;
  settings: Settings;
  onSettings: (p: Partial<Settings>) => void;
  onRules: () => void;
  onExit: () => void;
  onNewGame: () => void;
  onRematch: (kingdom: string[], extras: boolean) => void;
  online?: OnlinePlay;
}

/** Od tylu kart w ręce (wyłącznie) takie same karty są grupowane z licznikiem. */
const HAND_GROUP_FROM = 5;
/** Od ilu miejsc w ręce (karty i stosiki) ręka przewija się w bok: telefon pionowo 5, poziomo i komputer 8. */
const HAND_SCROLL_NARROW = 5;
const HAND_SCROLL_WIDE = 8;
const WIDE_SCREEN = '(min-width: 900px) and (min-height: 521px)';

type Detail = { id: string; from: 'supply' | 'hand' | 'other'; index?: number };

export function GameScreen({ saved, settings, onSettings, onRules, onExit, onNewGame, onRematch, online }: Props) {
  /** Moje miejsce przy stole (gra solo: zawsze 0). */
  const HUMAN = online?.seat ?? 0;
  /** Czy to urządzenie wykonuje ruchy botów (solo: tak; online: tylko gospodarz). */
  const runBots = !online || online.host;
  const lang = settings.lang;
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);

  const [game, setGame] = useState(() => {
    try {
      return Game.replay(saved.setup, saved.answers);
    } catch {
      return new Game(saved.setup);
    }
  });
  // liczba odpowiedzi przed każdym ruchem gracza (jeden ruch w UI może wysłać kilka odpowiedzi,
  // np. kupno = koniec akcji + zagranie skarbów + zakup) – „Cofnij” cofa cały ruch
  const marks = useRef<number[]>([]);
  const mark = () => {
    const n = game.answers.length;
    if (marks.current[marks.current.length - 1] !== n) marks.current.push(n);
  };
  const [plans, setPlans] = useState<Record<number, Plan> | null>(() => {
    const need = game.players.filter((p) => p.bot === 'hard' && !saved.plans[p.id]);
    return need.length && runBots ? null : saved.plans;
  });
  const [, setTick] = useState(0);
  const [sel, setSel] = useState<number[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [panel, setPanel] = useState<'log' | 'menu' | 'deck' | null>(null);
  const [ff, setFf] = useState(false); // przewijanie do tury gracza
  const [showEnd, setShowEnd] = useState(true);
  // okienko wyboru (odkryte karty / opcje) schowane na chwilę, żeby zobaczyć rękę i stół
  const [peek, setPeek] = useState(false);
  const landscape = useMedia(LANDSCAPE_PHONE);
  const wide = useMedia(WIDE_SCREEN);
  const handRef = useRef<HTMLDivElement>(null);
  const [handEdge, setHandEdge] = useState({ l: false, r: false });
  const names = game.players.map((p) => p.name);

  const persist = (pl: Record<number, Plan> | null = plans, g: Game = game) =>
    online ? online.push(g.answers) : saveGame(g.over ? null : { v: 2, hoardRev: CARDS_REV, setup: g.setup, answers: g.answers, plans: pl ?? {} });

  // online: ruchy innych graczy (i rozstrzygnięcie konfliktu) z bazy
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!online) return;
    const r = reconcile(game, saved.setup, online.moves);
    if (r.broken !== broken) setBroken(r.broken);
    if (!r.changed) return;
    marks.current = [];
    setSel([]);
    if (r.game !== game) setGame(r.game);
    else refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online?.version]);

  // online: w tytule karty przeglądarki widać, że czekamy na mój ruch
  const myMove = !!online && !!game.pending && game.pending.player === HUMAN;
  useEffect(() => {
    if (!online) return;
    const base = document.title.replace(/^● /, '');
    document.title = myMove ? '● ' + base : base;
    return () => {
      document.title = base;
    };
  }, [myMove, online]);

  const refresh = () => setTick((x) => x + 1);

  const submit = (a: Answer) => {
    mark();
    game.submit(a);
    setSel([]);
    setDetail(null);
    persist();
    refresh();
  };

  // plany trudnych botów (raz na grę)
  useEffect(() => {
    if (plans) return;
    const id = window.setTimeout(() => {
      const next: Record<number, Plan> = { ...saved.plans };
      for (const p of game.players) {
        if (p.bot === 'hard' && !next[p.id]) next[p.id] = makePlan(game.setup.kingdom, game.setup.seed + p.id * 7919, game.setup.extras);
      }
      setPlans(next);
      persist(next);
    }, 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // zapis przy chowaniu aplikacji
  useEffect(() => {
    const onHide = () => persist();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  });

  const d = game.pending;
  // chwila po rozpoczęciu mojej tury, w której „Koniec tury/akcji” nie reaguje
  // (żeby przypadkowe drugie stuknięcie przy przewijaniu nie zakończyło tury)
  const myTurnStart = useRef(0);
  useEffect(() => {
    if (game.turn.player === HUMAN) myTurnStart.current = Date.now();
  }, [game.turn, game]);
  const guardedEnd = () => {
    if (Date.now() - myTurnStart.current < 800) return;
    submit({ t: 'end' });
  };
  useEffect(() => setPeek(false), [d]);
  const canUndo = !online && !!d && d.player === HUMAN && game.turn.player === HUMAN && game.undoable() > 0;
  const undo = () => {
    if (!canUndo) return;
    const floor = game.undoFloor;
    let to = game.answers.length - 1;
    while (marks.current.length) {
      const m = marks.current.pop()!;
      if (m < game.answers.length) {
        to = m;
        break;
      }
    }
    to = Math.max(floor, to);
    marks.current = marks.current.filter((m) => m < to);
    const g = Game.replay(game.setup, game.answers.slice(0, to));
    setGame(g);
    setSel([]);
    setDetail(null);
    persist(plans, g);
  };
  /** Decyzja należy do kogoś innego (bot albo inny człowiek online). */
  const botTurn = !!d && d.player !== HUMAN;
  const isBot = (i: number) => !!game.players[i].bot;
  const botDeciding = botTurn && isBot(d!.player);

  // automatyczne kończenie tury (opcja w menu): tylko gdy nie zostały już żadne zakupy.
  // Dopóki jest zakup, czekamy na gracza – może chce kupić coś za 0.
  useEffect(() => {
    if (!settings.autoEnd || !plans || !d || d.player !== HUMAN || d.kind !== 'buy' || game.turn.buys > 0) return;
    const id = window.setTimeout(() => {
      if (game.pending === d) submit({ t: 'end' });
    }, canUndo ? 1500 : 450);
    return () => window.clearTimeout(id);
  });

  // ruchy botów
  useEffect(() => {
    if (!plans || !d || d.player === HUMAN || !runBots || !isBot(d.player)) {
      if (ff) setFf(false);
      return;
    }
    const step = () => {
      const p = game.pending;
      if (!p || p.player === HUMAN || !isBot(p.player)) return;
      const bot = game.players[p.player];
      game.submit(decide(game, p, bot.bot ?? 'medium', Math.random, plans[bot.id]));
    };
    if (ff) {
      const id = window.setTimeout(() => {
        for (let k = 0; k < 400 && game.pending && game.pending.player !== HUMAN && isBot(game.pending.player); k++) step();
        persist();
        refresh();
      }, 0);
      return () => window.clearTimeout(id);
    }
    const quick = d.kind === 'buy' && (d.treasures.length > 0 || d.buyable.length === 0);
    const id = window.setTimeout(() => {
      step();
      persist();
      refresh();
    }, quick ? 120 : DELAY[settings.speed]);
    return () => window.clearTimeout(id);
  });

  // ---------- dane do widoku ----------
  const me = game.players[HUMAN];
  const turn = game.turn;
  const current = game.players[turn.player];
  const myDecision = d && d.player === HUMAN ? d : null;

  // Esc zamyka okienka (od wierzchu): okienko wyboru chowa się jak „Pokaż rękę”
  const choiceSheet = !peek && (myDecision?.kind === 'options' || (myDecision?.kind === 'cards' && myDecision.zone === 'list'));
  useEscape(choiceSheet && (() => setPeek(true)));
  useEscape(game.over && showEnd && (() => setShowEnd(false)));
  useEscape(panel && (() => setPanel(null)));
  useEscape(detail && (() => setDetail(null)));
  // w fazie akcji też można od razu kupić: gra sama kończy akcje i zagrywa skarby
  const canBuyNow = myDecision?.kind === 'buy' || myDecision?.kind === 'action';
  const potential =
    canBuyNow && !turn.boughtSomething
      ? turn.coins + me.hand.reduce((s, id) => s + (isType(card(id), 'treasure') ? card(id).coins ?? 0 : 0), 0)
      : turn.coins;
  const potentialPotions =
    canBuyNow && !turn.boughtSomething ? turn.potions + me.hand.reduce((s, id) => s + (card(id).potions ?? 0), 0) : turn.potions;
  const hasElixir = game.basics.includes('elixir');
  const affordable = (id: string) => card(id).cost <= potential && (card(id).potionCost ?? 0) <= potentialPotions;

  const pileState = (id: string): 'buyable' | 'pickable' | 'dim' | '' => {
    if (!myDecision) return '';
    if (canBuyNow) {
      if (turn.buys > 0 && game.supply[id] > 0 && affordable(id)) return 'buyable';
      return '';
    }
    if (myDecision.kind === 'pile') return myDecision.allowed.includes(id) ? 'pickable' : 'dim';
    return '';
  };

  const tapPile = (id: string) => setDetail({ id, from: 'supply' });

  const handState = (i: number): string => {
    if (!myDecision) return '';
    if (myDecision.kind === 'action') return myDecision.playable.includes(i) ? 'playable' : 'dim';
    if (myDecision.kind === 'buy') return myDecision.treasures.includes(i) ? 'playable' : '';
    if (myDecision.kind === 'cards' && myDecision.zone === 'hand') {
      if (sel.includes(i)) return 'selected';
      return myDecision.allowed.includes(i) ? 'playable' : 'dim';
    }
    return '';
  };

  const toggleSel = (i: number, dec: Extract<Decision, { kind: 'cards' }>) => {
    if (!dec.allowed.includes(i)) return;
    if (sel.includes(i)) setSel(sel.filter((x) => x !== i));
    else if (dec.max === 1) setSel([i]);
    else if (sel.length < dec.max) setSel([...sel, i]);
  };

  /** Dwuklik na stosie: od razu kup / zdobądź; jeśli się nie da – pokaż podgląd. */
  const doublePile = (id: string) => {
    if (canBuyNow && pileState(id) === 'buyable') return buy(id);
    if (myDecision?.kind === 'pile' && myDecision.allowed.includes(id)) return submit({ t: 'pile', pile: id });
    tapPile(id);
  };

  /** Dwuklik na karcie przy wyborze (odrzucanie, palenie…): zaznacz ją i zatwierdź, jeśli wybór jest kompletny. */
  const doubleSel = (i: number) => {
    const dec = myDecision;
    if (!dec || dec.kind !== 'cards') return;
    if (!dec.allowed.includes(i)) return;
    const next = sel.includes(i) ? sel : dec.max === 1 ? [i] : [...sel, i];
    if (next.length >= dec.min && next.length <= dec.max && next.length > 0) submit({ t: 'cards', is: next });
    else setSel(next);
  };

  const tapHand = (i: number) => {
    if (!myDecision) return setDetail({ id: me.hand[i], from: 'hand', index: i });
    if (myDecision.kind === 'action' && myDecision.playable.includes(i)) return submit({ t: 'play', i });
    if (myDecision.kind === 'buy' && myDecision.treasures.includes(i)) return submit({ t: 'play', i });
    if (myDecision.kind === 'cards' && myDecision.zone === 'hand') return toggleSel(i, myDecision);
    setDetail({ id: me.hand[i], from: 'hand', index: i });
  };

  /** Powyżej 6 kart w ręce takie same karty są zgrupowane (ręka jest posortowana, więc leżą obok siebie). */
  const grouped = me.hand.length > HAND_GROUP_FROM;
  const handGroups: { id: string; is: number[] }[] = [];
  me.hand.forEach((id, i) => {
    const last = handGroups[handGroups.length - 1];
    if (grouped && last && last.id === id) last.is.push(i);
    else handGroups.push({ id, is: [i] });
  });

  const handLimit = landscape || wide ? HAND_SCROLL_WIDE : HAND_SCROLL_NARROW;
  const handScroll = handGroups.length > handLimit;
  /** Czy da się jeszcze przewinąć rękę w lewo / w prawo (strzałki i wygaszone brzegi). */
  const updHandEdge = () => {
    const el = handRef.current;
    const next = el && handScroll ? { l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 } : { l: false, r: false };
    if (next.l !== handEdge.l || next.r !== handEdge.r) setHandEdge(next);
  };
  useEffect(updHandEdge);
  useEffect(() => {
    window.addEventListener('resize', updHandEdge);
    return () => window.removeEventListener('resize', updHandEdge);
  });
  const scrollHand = (dir: number) => {
    const el = handRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  /** Stuknięcie w grupę: zagraj / zaznacz kolejną kartę z grupy; gdy więcej się nie da – odznacz jedną. */
  const tapGroup = (is: number[]) => {
    const dec = myDecision;
    if (dec?.kind === 'cards' && dec.zone === 'hand') {
      const free = is.find((i) => !sel.includes(i) && dec.allowed.includes(i));
      const picked = is.filter((i) => sel.includes(i));
      if (free !== undefined && (dec.max === 1 ? !picked.length : sel.length < dec.max)) return toggleSel(free, dec);
      if (picked.length) return setSel(sel.filter((x) => x !== picked[picked.length - 1]));
      if (free !== undefined) return toggleSel(free, dec);
      return;
    }
    tapHand(is[0]);
  };

  const buy = (id: string) => {
    if (!canBuyNow) return;
    mark();
    if (game.pending?.kind === 'action') game.submit({ t: 'end' });
    const before = game.pending;
    if (before?.kind === 'buy' && !game.canAfford(id) && before.treasures.length) {
      game.submit({ t: 'playAll' });
    }
    const dd = game.pending;
    if (dd && dd.kind === 'buy' && dd.buyable.includes(id)) submit({ t: 'buy', pile: id });
    else {
      persist();
      refresh();
      setDetail(null);
    }
  };

  // ---------- pasek podpowiedzi i przyciski ----------
  let prompt = '';
  let buttons: React.ReactNode = null;
  if (game.over) {
    prompt = t('gameOver');
  } else if (!plans) {
    prompt = t('preparing');
  } else if (broken) {
    prompt = t('online.broken');
  } else if (botTurn && d) {
    prompt = botDeciding ? t('thinking', { who: names[d.player] }) : t('waitingFor', { who: names[d.player] });
  } else if (myDecision) {
    prompt = msg(lang, myDecision.prompt);
    switch (myDecision.kind) {
      case 'action':
        buttons = (
          <button className="btn" onClick={() => guardedEnd()}>
            {t('endActions')}
          </button>
        );
        break;
      case 'buy':
        buttons = (
          <>
            {myDecision.treasures.length > 0 && (
              <button className="btn" onClick={() => submit({ t: 'playAll' })}>
                {t('playAll')}
              </button>
            )}
            <button className="btn end-turn" onClick={() => guardedEnd()}>
              {t('endTurn')}
            </button>
          </>
        );
        break;
      case 'cards': {
        const ok = sel.length >= myDecision.min && sel.length <= myDecision.max;
        buttons = (
          <>
            {myDecision.max > 1 && <span className="muted small">{t('selected', { n: sel.length })}</span>}
            <button className="btn primary" disabled={!ok} onClick={() => submit({ t: 'cards', is: sel })}>
              {myDecision.min === 0 && sel.length === 0 ? t('skip') : t('confirm')}
            </button>
          </>
        );
        break;
      }
      case 'pile':
        buttons = myDecision.optional ? (
          <button className="btn" onClick={() => submit({ t: 'pile', pile: null })}>
            {t('skip')}
          </button>
        ) : null;
        break;
      case 'yesno':
        buttons = (
          <>
            <button className="btn" onClick={() => submit({ t: 'yes', v: false })}>
              {t('no')}
            </button>
            <button className="btn primary" onClick={() => submit({ t: 'yes', v: true })}>
              {t('yes')}
            </button>
          </>
        );
        break;
      case 'options':
        break;
    }
  }

  const sheetChoice = !!myDecision && ((myDecision.kind === 'cards' && myDecision.zone === 'list') || myDecision.kind === 'options');
  if (sheetChoice && peek) {
    buttons = (
      <button className="btn primary" onClick={() => setPeek(false)}>
        {t('backToChoice')}
      </button>
    );
  }

  const attacked = myDecision && myDecision.source && turn.player !== HUMAN;
  // pasek fazy: zwinięty = jedna linijka (liczniki + przyciski), bez podpowiedzi;
  // podpowiedzi do wyborów (atak, palenie…) pokazujemy zawsze
  const barCollapsed = settings.barCollapsed ?? landscape;
  const importantPrompt = !!myDecision && myDecision.kind !== 'action' && myDecision.kind !== 'buy';
  const kingdomAscending = kingdomLayout(game.kingdom, lang, game.kingdom.length);
  const lastLog = game.log.length ? game.log[game.log.length - 1] : null;
  const scores = game.over ? game.scores() : null;

  const collapsedNow = barCollapsed && !importantPrompt;
  // przewijanie ruchów przeciwników: mała ikonka „»” zawsze po lewej stronie paska,
  // z dala od miejsca, w którym za chwilę pojawi się „Koniec tury”
  const skipBtn =
    botDeciding && runBots && plans && !game.over ? (
      <button className="icon-btn skip-btn" onClick={() => setFf(true)} disabled={ff} aria-label={t('skipToMe')} title={t('skipToMe')}>
        »
      </button>
    ) : null;

  // ---------- render ----------
  return (
    <div className="screen game">
      <header className="bar game-bar">
        <button className="icon-btn" onClick={() => setPanel('menu')} aria-label={t('menu')}>
          ☰
        </button>
        <div className="turn-info">
          {turn.player === HUMAN ? t('yourTurn') : t('turnOf', { n: current.turns, who: current.name })}
          <span className="muted small">
            {' '}
            · {t('citadelsLeft', { n: game.supply.citadel })} · {t('piles', { n: game.emptyPiles() })}
          </span>
          {online && online.link !== 'live' && <span className="net-warn small"> · {t(`online.link.${online.link}`)}</span>}
          {online && online.link === 'live' && online.unsent > 0 && <span className="muted small"> · {t('online.sending')}</span>}
        </div>
        <button className="icon-btn" onClick={() => setPanel('log')} aria-label={t('log')} title={t('log')}>
          <LogIcon />
        </button>
      </header>

      <div className="opponents">
        {[me, ...game.players.filter((p) => p.id !== HUMAN)].map((p) => (
          <div key={p.id} className={'opp' + (turn.player === p.id ? ' active' : '') + (p.id === HUMAN ? ' me' : '')}>
            <div className="opp-main">
              <div className="opp-name">
                {online && !p.bot && p.id !== HUMAN && (
                  <span
                    className={'presence' + (Date.now() - (online.ping[p.id] ?? 0) < PRESENT_MS ? ' on' : '')}
                    title={t(Date.now() - (online.ping[p.id] ?? 0) < PRESENT_MS ? 'online.present' : 'online.away')}
                  />
                )}
                {p.id === HUMAN ? t('you') : p.name}{' '}
                {p.bot && <span className="muted small opp-level">{t(`level.${p.bot}`)}</span>}
              </div>
              <div className="opp-stats">
                <span title={t('hand')}>✋ {p.hand.length}</span>
                <span className="opp-deck" title={t('deck')}>▤ {p.deck.length}</span>
              </div>
            </div>
            <span className="vp-badge" title={t('vp')}>
              <b>{game.scoreOf(p).vp}</b>
              <small>{t('vp')}</small>
            </span>
          </div>
        ))}
      </div>

      <main className="supply">
        {/* stałe stosy: pieniądze (od najwyższej wartości) i punkty z Urokiem;
            na komputerze dwie kolumny przy lewym brzegu: punkty, obok pieniądze */}
        <div className={'supply-basic n' + game.basics.length}>
          {[
            ['money', ['dragongold', 'gold', 'silver', 'copper', 'elixir']],
            ['victory', ['palace', 'citadel', 'manor', 'homestead', 'hex']],
          ].map(([col, ids]) => (
            <div key={col as string} className={`basic-col ${col}`}>
              {(ids as string[]).filter((id) => game.basics.includes(id)).map((id) => (
                <PileTile
                  key={id}
                  id={id}
                  lang={lang}
                  count={game.supply[id]}
                  state={pileState(id)}
                  onTap={() => tapPile(id)}
                  onDouble={() => doublePile(id)}
                  onLong={() => setDetail({ id, from: 'other' })}
                  style={{ ['--po' as string]: PHONE_BASIC_ORDER.indexOf(id) }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="supply-kingdom">
          {kingdomLayout(game.kingdom, lang).map((id) => (
            <PileTile
              key={id}
              id={id}
              lang={lang}
              count={game.supply[id]}
              state={pileState(id)}
              onTap={() => tapPile(id)}
              onDouble={() => doublePile(id)}
              onLong={() => setDetail({ id, from: 'other' })}
              style={{ ['--ko' as string]: kingdomAscending.indexOf(id) }}
              symbols={settings.pileView === 'symbols'}
            />
          ))}
        </div>
      </main>

      <section className="play-area">
        <div className="play-label">
          {turn.player === HUMAN ? t('inPlay') : `${current.name} · ${t('inPlay').toLowerCase()}`}
        </div>
        <div className="play-cards">
          {groupCards(current.play).map(([id, n]) => (
            <PlayedCard key={id} id={id} n={n} lang={lang} onTap={() => setDetail({ id, from: 'other' })} />
          ))}
          {!current.play.length && lastLog && <span className="muted small ticker">{logText(lang, lastLog, names)}</span>}
        </div>
      </section>

      <section className={'status' + (attacked ? ' attacked' : '') + (collapsedNow ? ' is-collapsed' : '')}>
        <button
          className="bar-toggle"
          aria-label={barCollapsed ? t('expandBar') : t('collapseBar')}
          title={barCollapsed ? t('expandBar') : t('collapseBar')}
          onClick={() => onSettings({ barCollapsed: !barCollapsed })}
        >
          {barCollapsed ? '▴' : '▾'}
        </button>
        {collapsedNow && skipBtn}
        <div className="counters">
          <span className="phase">{t(`phase.${turn.phase}`)}:</span>
          {turn.phase === 'buy' ? (
            <>
              <Coin n={turn.coins} />
              {hasElixir && <Flask n={turn.potions} />}
              <span className="counter">
                {t('buys')} <b>{turn.buys}</b>
              </span>
            </>
          ) : (
            <>
              <span className="counter">
                {t('actions')} <b>{turn.actions}</b>
              </span>
              <span className="counter">
                {t('buys')} <b>{turn.buys}</b>
              </span>
              <Coin n={turn.coins} />
              {hasElixir && <Flask n={turn.potions} />}
            </>
          )}
        </div>
        <div className="prompt-row">
          {!collapsedNow && skipBtn}
          <div className="prompt">
            {attacked && <b className="attack-tag">{t('attackedBy')} </b>}
            {myDecision?.source && (
              <button className="link" onClick={() => setDetail({ id: myDecision.source!, from: 'other' })}>
                {card(myDecision.source).name[lang]}:
              </button>
            )}{' '}
            {prompt}
          </div>
          <div className="prompt-buttons">
            {myDecision && turn.player === HUMAN && (
              <button className="btn undo" onClick={undo} disabled={!canUndo} aria-label={t('undo')} title={t('undo')}>
                ↶ {t('undo')}
              </button>
            )}
            {buttons}
          </div>
        </div>
      </section>

      <footer className="hand-area">
        <button className="deck-pill" onClick={() => setPanel('deck')}>
          {grouped && (
            <span className="pill-hand">
              {t('hand')} {me.hand.length}
            </span>
          )}
          <span>
            {t('deck')} {me.deck.length}
          </span>
          <span>
            {t('discardPile')} {me.discard.length}
          </span>
        </button>
        <div className={'hand-wrap' + (handEdge.l ? ' more-l' : '') + (handEdge.r ? ' more-r' : '')}>
        {handEdge.l && (
          <button className="hand-arrow l" aria-label="◀" onClick={() => scrollHand(-1)}>
            ‹
          </button>
        )}
        {handEdge.r && (
          <button className="hand-arrow r" aria-label="▶" onClick={() => scrollHand(1)}>
            ›
          </button>
        )}
        <div
          ref={handRef}
          onScroll={updHandEdge}
          className={'hand n' + Math.min(handGroups.length, 12) + (handScroll ? ' scroll' : '')}
          style={{ ['--n' as string]: grouped ? handGroups.length : Math.max(me.hand.length, 5), ['--lim' as string]: handLimit }}
        >
          {handGroups.map(({ id, is }) => {
            if (is.length === 1) {
              const i = is[0];
              return (
                <CardFace
                  key={i + id}
                  id={id}
                  lang={lang}
                  className={handState(i)}
                  onTap={() => tapHand(i)}
                  onDouble={() => doubleSel(i)}
                  onLong={() => setDetail({ id, from: 'hand', index: i })}
                />
              );
            }
            const picked = is.filter((i) => sel.includes(i)).length;
            return (
              <div key={is[0] + id} className={'hand-group' + (picked ? ' has-sel' : handState(is[0]) === 'dim' ? ' dim' : '')}>
                <div className="hand-stack">
                <CardFace id={id} lang={lang} className="under" />
                <CardFace
                  id={id}
                  lang={lang}
                  className={picked ? 'selected' : handState(is[0])}
                  onTap={() => tapGroup(is)}
                  onDouble={() => doubleSel(is.find((i) => !sel.includes(i)) ?? is[0])}
                  onLong={() => setDetail({ id, from: 'hand', index: is[0] })}
                />
                </div>
                <span className="hand-count">{picked ? `${picked}/${is.length}` : `×${is.length}`}</span>
              </div>
            );
          })}
          {!me.hand.length && <span className="muted">{t('noCards')}</span>}
        </div>
        </div>
      </footer>

      {/* wybór z listy (odkryte karty, odrzucone) */}
      {myDecision?.kind === 'cards' && myDecision.zone === 'list' && !peek && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <p className="sheet-prompt">
              {myDecision.source && <b>{card(myDecision.source).name[lang]}: </b>}
              {msg(lang, myDecision.prompt)}
            </p>
            <div className="list-cards">
              {myDecision.cards.map((id, i) => (
                <CardFace
                  key={i}
                  id={id}
                  lang={lang}
                  className={sel.includes(i) ? 'selected' : myDecision.allowed.includes(i) ? 'playable' : 'dim'}
                  onTap={() => toggleSel(i, myDecision)}
                  onDouble={() => doubleSel(i)}
                  onLong={() => setDetail({ id, from: 'other' })}
                />
              ))}
            </div>
            <div className="sheet-actions">
              <button className="btn ghost peek-btn" onClick={() => setPeek(true)}>
                {t('peekHand')}
              </button>
              <span className="muted small">{t('selected', { n: sel.length })}</span>
              <button
                className="btn primary"
                disabled={sel.length < myDecision.min || sel.length > myDecision.max}
                onClick={() => submit({ t: 'cards', is: sel })}
              >
                {myDecision.min === 0 && sel.length === 0 ? t('skip') : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {myDecision?.kind === 'options' && !peek && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <p className="sheet-prompt">
              {myDecision.source && <b>{card(myDecision.source).name[lang]}: </b>}
              {msg(lang, myDecision.prompt)}
            </p>
            <div className="options">
              {myDecision.options.map((o, i) => (
                <button
                  key={i}
                  className={'btn' + (sel.includes(i) ? ' picked' : '')}
                  onClick={() => {
                    // „wybierz dwa”: zaznaczanie, potem Zatwierdź; „wybierz jedno”: od razu
                    if (myDecision.count <= 1) submit({ t: 'opts', is: [i] });
                    else if (sel.includes(i)) setSel(sel.filter((j) => j !== i));
                    else if (sel.length < myDecision.count) setSel([...sel, i]);
                  }}
                >
                  {msg(lang, o)}
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button className="btn ghost peek-btn" onClick={() => setPeek(true)}>
                {t('peekHand')}
              </button>
              {myDecision.count > 1 && (
                <button
                  className="btn primary"
                  disabled={sel.length !== Math.min(myDecision.count, myDecision.options.length)}
                  onClick={() => submit({ t: 'opts', is: sel })}
                >
                  {t('confirm')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {detail && (
        <DetailSheet
          detail={detail}
          lang={lang}
          game={game}
          decision={myDecision}
          affordable={affordable}
          onClose={() => setDetail(null)}
          onBuy={buy}
          onGain={(id) => submit({ t: 'pile', pile: id })}
          onPlay={(i) => tapHand(i)}
        />
      )}

      {panel === 'log' && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet log-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{t('log')}</h2>
            <LogList lang={lang} game={game} names={names} me={HUMAN} />
            <div className="sheet-actions">
              <button className="btn" onClick={() => setPanel(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {panel === 'deck' && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>
              {t('myDeck')} · {game.allCards(me).length} · {game.scoreOf(me).vp} {t('vp')}
            </h2>
            <DeckList lang={lang} cards={game.allCards(me)} onTap={(id) => setDetail({ id, from: 'other' })} />
            <div className="sheet-actions">
              <button className="btn" onClick={() => setPanel(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {panel === 'menu' && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-row">
              <span>{t('language')}</span>
              <div className="seg">
                {(['en', 'pl'] as const).map((l) => (
                  <button key={l} className={lang === l ? 'on' : ''} onClick={() => onSettings({ lang: l })}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="menu-row">
              <span>{t('speed')}</span>
              <div className="seg">
                {(['slow', 'normal', 'fast'] as const).map((s) => (
                  <button key={s} className={settings.speed === s ? 'on' : ''} onClick={() => onSettings({ speed: s })}>
                    {t(`speed.${s}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="menu-row">
              <span>{t('pileView')}</span>
              <div className="seg">
                {(['art', 'symbols'] as const).map((v) => (
                  <button key={v} className={settings.pileView === v ? 'on' : ''} onClick={() => onSettings({ pileView: v })}>
                    {t(`pileView.${v}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="check menu-check">
              <input type="checkbox" checked={settings.autoEnd} onChange={(e) => onSettings({ autoEnd: e.target.checked })} />
              <span>{t('autoEnd')}</span>
            </label>
            <button className="btn" onClick={onRules}>
              {t('rules')}
            </button>
            <button className="btn" onClick={() => { persist(); onExit(); }}>
              {t('leaveGame')}
            </button>
            {!online && <ConfirmButton
              className="btn"
              label={t('restart')}
              question={t('confirmNew')}
              yes={t('yes')}
              no={t('no')}
              needConfirm={!game.over}
              onConfirm={onNewGame}
            />}
            <button className="btn ghost" onClick={() => setPanel(null)}>
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {scores && showEnd && (
        <div className="sheet-backdrop">
          <div className="sheet end">
            <h2>{t('gameOver')}</h2>
            <p className="winner">
              {scores.filter((s) => s.rank === 1).length > 1
                ? t('tie')
                : scores[0].player === HUMAN
                  ? t('youWin')
                  : t('winner', { who: names[scores[0].player] })}
            </p>
            <ol className="scores">
              {scores.map((s) => (
                <li key={s.player} className={s.player === HUMAN ? 'me' : ''}>
                  <div className="score-head">
                    <span>
                      {s.rank}. {names[s.player]}
                    </span>
                    <b>
                      {s.vp} {t('vp')}
                    </b>
                  </div>
                  <div className="muted small">
                    {[...s.breakdown.map((b) => `${card(b.card).name[lang]} ×${b.count} (${b.vp})`), ...(s.tokens ? [`${t('vpTokens')} (${s.tokens})`] : [])].join(' · ')} · {s.turns} {t('turns')}
                  </div>
                </li>
              ))}
            </ol>
            <div className="end-buttons">
              {!online && (
                <button className="btn primary" onClick={() => onRematch(game.setup.kingdom, !!game.setup.extras?.length)}>
                  {t('sameKingdom')}
                </button>
              )}
              <button className="btn" onClick={onNewGame}>
                {t('newGame')}
              </button>
              <button className="btn ghost" onClick={() => setShowEnd(false)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {scores && !showEnd && (
        <button className="btn primary floating" onClick={() => setShowEnd(true)}>
          {t('gameOver')}
        </button>
      )}
    </div>
  );
}

// ---------- podgląd karty ----------

function DetailSheet(props: {
  detail: Detail;
  lang: Lang;
  game: Game;
  decision: Decision | null;
  affordable: (id: string) => boolean;
  onClose: () => void;
  onBuy: (id: string) => void;
  onGain: (id: string) => void;
  onPlay: (i: number) => void;
}) {
  const { detail, lang, game, decision, affordable } = props;
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const id = detail.id;
  const c = card(id);
  let action: React.ReactNode = null;
  if (detail.from === 'supply' && decision) {
    if ((decision.kind === 'buy' || decision.kind === 'action') && game.turn.buys > 0 && game.supply[id] > 0 && affordable(id)) {
      action = (
        <button className="btn primary" onClick={() => props.onBuy(id)}>
          {t('buyFor', { n: c.cost })}
          {(c.potionCost ?? 0) > 0 && <Flask small />}
        </button>
      );
    } else if (decision.kind === 'pile' && decision.allowed.includes(id)) {
      action = (
        <button className="btn primary" onClick={() => props.onGain(id)}>
          {t('gainThis')}
        </button>
      );
    }
  }
  if (detail.from === 'hand' && decision && detail.index !== undefined) {
    const i = detail.index;
    const canPlay =
      (decision.kind === 'action' && decision.playable.includes(i)) || (decision.kind === 'buy' && decision.treasures.includes(i));
    if (canPlay)
      action = (
        <button className="btn primary" onClick={() => props.onPlay(i)}>
          {t('play')}
        </button>
      );
  }
  const inSupply = game.supply[id];
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet center" onClick={(e) => e.stopPropagation()}>
        <CardFace id={id} lang={lang} className="large" />
        {inSupply !== undefined && <div className="muted small">{t('left', { n: inSupply })}</div>}
        <div className="sheet-actions">
          <button className="btn" onClick={props.onClose}>
            {t('close')}
          </button>
          {action}
        </div>
      </div>
    </div>
  );
}

function logText(lang: Lang, e: Game['log'][number], names: string[]): string {
  return tr(lang, e.msg.k, { ...(e.msg.p ?? {}), who: e.player >= 0 ? names[e.player] : '' });
}

function LogList({ lang, game, names, me }: { lang: Lang; game: Game; names: string[]; me: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight);
  }, []);
  const entries = game.log.slice(-300);
  return (
    <div className="log" ref={ref}>
      {entries.map((e, i) => (
        <div key={i} className={'log-line' + (e.msg.k === 'log.turn' ? ' turn' : '') + (e.player === me ? ' me' : '')}>
          {logText(lang, e, names)}
        </div>
      ))}
    </div>
  );
}

function DeckList({ lang, cards, onTap }: { lang: Lang; cards: string[]; onTap: (id: string) => void }) {
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  const list = [...counts.entries()].sort((a, b) => card(b[0]).cost - card(a[0]).cost);
  return (
    <div className="deck-list">
      {list.map(([id, n]) => (
        <button key={id} className={`chip t-${typeKey(card(id))}`} onClick={() => onTap(id)}>
          {card(id).name[lang]} ×{n}
        </button>
      ))}
    </div>
  );
}

/** Grupuje takie same karty (kolejność pierwszego wystąpienia) – [id, liczba]. */
function groupCards(ids: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()];
}
