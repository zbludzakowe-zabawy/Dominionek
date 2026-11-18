import { useEffect, useMemo, useRef, useState } from 'react';
import { decide, type Plan } from '../engine/bot';
import { isType } from '../engine/card';
import { card } from '../engine/cards';
import { Game } from '../engine/game';
import { makePlan } from '../engine/plan';
import type { Answer, Decision, Lang } from '../engine/types';
import { msg, tr } from '../i18n';
import { CardFace, Coin, ConfirmButton, PileTile, PlayedCard } from './CardView';
import { typeKey } from './art';
import { saveGame, type SavedGame, type Settings } from './store';

const HUMAN = 0;
const DELAY = { slow: 1100, normal: 650, fast: 250 };

interface Props {
  saved: SavedGame;
  settings: Settings;
  onSettings: (p: Partial<Settings>) => void;
  onRules: () => void;
  onExit: () => void;
  onNewGame: () => void;
  onRematch: (kingdom: string[]) => void;
}

type Detail = { id: string; from: 'supply' | 'hand' | 'other'; index?: number };

export function GameScreen({ saved, settings, onSettings, onRules, onExit, onNewGame, onRematch }: Props) {
  const lang = settings.lang;
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);

  const game = useMemo(() => {
    try {
      return Game.replay(saved.setup, saved.answers);
    } catch {
      return new Game(saved.setup);
    }
  }, [saved]);
  const [plans, setPlans] = useState<Record<number, Plan> | null>(() => {
    const need = game.players.filter((p) => p.bot === 'hard' && !saved.plans[p.id]);
    return need.length ? null : saved.plans;
  });
  const [, setTick] = useState(0);
  const [sel, setSel] = useState<number[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [panel, setPanel] = useState<'log' | 'menu' | 'deck' | null>(null);
  const [ff, setFf] = useState(false); // przewijanie do tury gracza
  const [showEnd, setShowEnd] = useState(true);
  const names = game.players.map((p) => p.name);

  const persist = (pl: Record<number, Plan> | null = plans) =>
    saveGame(game.over ? null : { v: 1, setup: game.setup, answers: game.answers, plans: pl ?? {} });

  const refresh = () => setTick((x) => x + 1);

  const submit = (a: Answer) => {
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
        if (p.bot === 'hard' && !next[p.id]) next[p.id] = makePlan(game.setup.kingdom, game.setup.seed + p.id * 7919);
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
  const botTurn = !!d && d.player !== HUMAN;

  // ruchy botów
  useEffect(() => {
    if (!plans || !d || d.player === HUMAN) {
      if (ff) setFf(false);
      return;
    }
    const step = () => {
      const p = game.pending;
      if (!p || p.player === HUMAN) return;
      const bot = game.players[p.player];
      game.submit(decide(game, p, bot.bot ?? 'medium', Math.random, plans[bot.id]));
    };
    if (ff) {
      const id = window.setTimeout(() => {
        for (let k = 0; k < 400 && game.pending && game.pending.player !== HUMAN; k++) step();
        persist();
        refresh();
      }, 0);
      return () => window.clearTimeout(id);
    }
    const quick = d.kind === 'buy' && d.treasures.length > 0;
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
  // w fazie akcji też można od razu kupić: gra sama kończy akcje i zagrywa skarby
  const canBuyNow = myDecision?.kind === 'buy' || myDecision?.kind === 'action';
  const potential =
    canBuyNow && !turn.boughtSomething
      ? turn.coins + me.hand.reduce((s, id) => s + (isType(card(id), 'treasure') ? card(id).coins ?? 0 : 0), 0)
      : turn.coins;

  const pileState = (id: string): 'buyable' | 'pickable' | 'dim' | '' => {
    if (!myDecision) return '';
    if (canBuyNow) {
      if (turn.buys > 0 && game.supply[id] > 0 && card(id).cost <= potential) return 'buyable';
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

  const tapHand = (i: number) => {
    if (!myDecision) return setDetail({ id: me.hand[i], from: 'hand', index: i });
    if (myDecision.kind === 'action' && myDecision.playable.includes(i)) return submit({ t: 'play', i });
    if (myDecision.kind === 'buy' && myDecision.treasures.includes(i)) return submit({ t: 'play', i });
    if (myDecision.kind === 'cards' && myDecision.zone === 'hand') return toggleSel(i, myDecision);
    setDetail({ id: me.hand[i], from: 'hand', index: i });
  };

  const buy = (id: string) => {
    if (!canBuyNow) return;
    if (game.pending?.kind === 'action') game.submit({ t: 'end' });
    const before = game.pending;
    if (before?.kind === 'buy' && card(id).cost > game.turn.coins && before.treasures.length) {
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
  } else if (botTurn && d) {
    prompt = t('thinking', { who: names[d.player] });
    buttons = (
      <button className="btn" onClick={() => setFf(true)} disabled={ff}>
        ⏩ {t('skipToMe')}
      </button>
    );
  } else if (myDecision) {
    prompt = msg(lang, myDecision.prompt);
    switch (myDecision.kind) {
      case 'action':
        buttons = (
          <button className="btn" onClick={() => submit({ t: 'end' })}>
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
            <button className="btn primary" onClick={() => submit({ t: 'end' })}>
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

  const attacked = myDecision && myDecision.source && turn.player !== HUMAN;
  const lastLog = game.log.length ? game.log[game.log.length - 1] : null;
  const scores = game.over ? game.scores() : null;

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
        </div>
        <button className="icon-btn" onClick={() => setPanel('log')} aria-label={t('log')}>
          ≡
        </button>
      </header>

      <div className="opponents">
        {game.players
          .filter((p) => p.id !== HUMAN)
          .map((p) => (
            <div key={p.id} className={'opp' + (turn.player === p.id ? ' active' : '')}>
              <div className="opp-name">
                {p.name} <span className="muted small">{p.bot ? t(`level.${p.bot}`) : ''}</span>
              </div>
              <div className="opp-stats">
                <span title={t('hand')}>✋ {p.hand.length}</span>
                <span title={t('deck')}>▤ {p.deck.length}</span>
                <span className="vp-chip">{game.scoreOf(p).vp} {t('vp')}</span>
              </div>
            </div>
          ))}
      </div>

      <main className="supply">
        <div className="supply-basic">
          {game.pileOrder.slice(0, 7).map((id) => (
            <PileTile
              key={id}
              id={id}
              lang={lang}
              count={game.supply[id]}
              state={pileState(id)}
              onTap={() => tapPile(id)}
              onLong={() => setDetail({ id, from: 'other' })}
            />
          ))}
        </div>
        <div className="supply-kingdom">
          {game.pileOrder.slice(7).map((id) => (
            <PileTile
              key={id}
              id={id}
              lang={lang}
              count={game.supply[id]}
              state={pileState(id)}
              onTap={() => tapPile(id)}
              onLong={() => setDetail({ id, from: 'other' })}
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

      <section className={'status' + (attacked ? ' attacked' : '')}>
        <div className="counters">
          <span className="phase">{t(`phase.${turn.phase}`)}</span>
          <span>
            {t('actions')} <b>{turn.actions}</b>
          </span>
          <span>
            {t('buys')} <b>{turn.buys}</b>
          </span>
          <span className="coins-counter">
            <Coin n={turn.coins} />
            {potential > turn.coins && <span className="muted small">→{potential}</span>}
          </span>
        </div>
        <div className="prompt-row">
          <div className="prompt">
            {attacked && <b className="attack-tag">{t('attackedBy')} </b>}
            {myDecision?.source && (
              <button className="link" onClick={() => setDetail({ id: myDecision.source!, from: 'other' })}>
                {card(myDecision.source).name[lang]}:
              </button>
            )}{' '}
            {prompt}
          </div>
          <div className="prompt-buttons">{buttons}</div>
        </div>
      </section>

      <footer className="hand-area">
        <button className="deck-pill" onClick={() => setPanel('deck')}>
          <span>
            {t('deck')} {me.deck.length}
          </span>
          <span>
            {t('discardPile')} {me.discard.length}
          </span>
        </button>
        <div className={'hand n' + Math.min(me.hand.length, 12)} style={{ ['--n' as string]: Math.max(me.hand.length, 5) }}>
          {me.hand.map((id, i) => (
            <CardFace
              key={i + id}
              id={id}
              lang={lang}
              className={handState(i)}
              onTap={() => tapHand(i)}
              onLong={() => setDetail({ id, from: 'hand', index: i })}
            />
          ))}
          {!me.hand.length && <span className="muted">{t('noCards')}</span>}
        </div>
      </footer>

      {/* wybór z listy (odkryte karty, odrzucone) */}
      {myDecision?.kind === 'cards' && myDecision.zone === 'list' && (
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
                  onLong={() => setDetail({ id, from: 'other' })}
                />
              ))}
            </div>
            <div className="sheet-actions">
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

      {myDecision?.kind === 'options' && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <p className="sheet-prompt">{msg(lang, myDecision.prompt)}</p>
            <div className="options">
              {myDecision.options.map((o, i) => (
                <button key={i} className="btn" onClick={() => submit({ t: 'opts', is: [i] })}>
                  {msg(lang, o)}
                </button>
              ))}
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
          potential={potential}
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
            <LogList lang={lang} game={game} names={names} />
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
            <button className="btn" onClick={onRules}>
              {t('rules')}
            </button>
            <button className="btn" onClick={() => { persist(); onExit(); }}>
              {t('leaveGame')}
            </button>
            <ConfirmButton
              className="btn"
              label={t('restart')}
              question={t('confirmNew')}
              yes={t('yes')}
              no={t('no')}
              needConfirm={!game.over}
              onConfirm={onNewGame}
            />
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
                    {s.breakdown.map((b) => `${card(b.card).name[lang]} ×${b.count} (${b.vp})`).join(' · ')} · {s.turns} {t('turns')}
                  </div>
                </li>
              ))}
            </ol>
            <div className="end-buttons">
              <button className="btn primary" onClick={() => onRematch(game.setup.kingdom)}>
                {t('sameKingdom')}
              </button>
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
  potential: number;
  onClose: () => void;
  onBuy: (id: string) => void;
  onGain: (id: string) => void;
  onPlay: (i: number) => void;
}) {
  const { detail, lang, game, decision, potential } = props;
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const id = detail.id;
  const c = card(id);
  let action: React.ReactNode = null;
  if (detail.from === 'supply' && decision) {
    if ((decision.kind === 'buy' || decision.kind === 'action') && game.turn.buys > 0 && game.supply[id] > 0 && c.cost <= potential) {
      action = (
        <button className="btn primary" onClick={() => props.onBuy(id)}>
          {t('buyFor', { n: c.cost })}
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

function LogList({ lang, game, names }: { lang: Lang; game: Game; names: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight);
  }, []);
  const entries = game.log.slice(-300);
  return (
    <div className="log" ref={ref}>
      {entries.map((e, i) => (
        <div key={i} className={'log-line' + (e.msg.k === 'log.turn' ? ' turn' : '') + (e.player === HUMAN ? ' me' : '')}>
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
