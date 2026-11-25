import { useEffect, useMemo, useState } from 'react';
import { card, kingdomCards, SETS } from '../engine/cards';
import type { SetId } from '../engine/card';
import { randomSeed } from '../engine/rng';
import { KINGDOM_SIZE, hasHoardCards, randomKingdom, rerollOne, rollHoardExtras } from '../engine/setup';
import type { BotLevel, GameSetup, Lang } from '../engine/types';
import { tr } from '../i18n';
import { CardFace, ConfirmButton, Cost, PileTile, useEscape } from './CardView';
import { GameScreen } from './GameScreen';
import { JoinScreen, OnlineRoom, roomFor } from './Online';
import {
  BOT_NAMES,
  loadGame,
  loadSettings,
  saveGame,
  saveSettings,
  type OnlineSlot,
  type SavedGame,
  type Settings,
  CARDS_REV,
} from './store';
import { ONLINE_DB } from '../online/config';
import { firebaseTransport } from '../online/firebase';
import { ROOM_V, createRoom, forgetRoom, loadRooms, parseRoomRef, randomId, saveRoom, type MyRoom, type RoomCfg } from '../online/room';

export { BOT_NAMES };
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

type Screen = 'home' | 'setup' | 'kingdom' | 'rules' | 'game' | 'online' | 'join';

/** Link do pokoju w adresie (#room=…): zapamiętany pokój albo nowy, do którego dopiero dołączymy. */
function roomFromHash(): MyRoom | null {
  const ref = typeof location !== 'undefined' ? parseRoomRef(location.hash) : null;
  if (!ref) return null;
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* trudno */
  }
  return roomFor(loadRooms(), ref.id, randomId(16));
}

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [room, setRoom] = useState<MyRoom | null>(roomFromHash);
  const [screen, setScreen] = useState<Screen>(() => (room ? 'online' : loadGame() ? 'game' : 'home'));
  /** Ustawienia i Królestwo dla gry online (zamiast gry z botami). */
  const [online, setOnline] = useState(false);
  const [creating, setCreating] = useState('');
  const [rooms, setRooms] = useState<MyRoom[]>(loadRooms);
  const [saved, setSaved] = useState<SavedGame | null>(loadGame);
  const [kingdom, setKingdom] = useState<string[]>([]);
  const [rulesBack, setRulesBack] = useState<Screen>('home');
  const lang = settings.lang;
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const startGame = (k: string[], withExtras: boolean) => {
    const setup: GameSetup = {
      seed: randomSeed(),
      kingdom: k,
      extras: withExtras ? ['dragongold', 'palace'] : [],
      players: [
        { name: settings.name.trim() || t('defaultName'), bot: null },
        ...settings.bots.map((bot, i) => ({ name: BOT_NAMES[i], bot })),
      ],
    };
    const s: SavedGame = { v: 2, hoardRev: CARDS_REV, setup, answers: [], plans: {} };
    saveGame(s);
    setSaved(s);
    setScreen('game');
  };

  const openRoom = (r: MyRoom) => {
    setRoom(r);
    setScreen('online');
  };

  /** Zakłada pokój gry online i przechodzi do poczekalni. */
  const createOnline = async (k: string[], withExtras: boolean) => {
    setCreating('…');
    const cfg: RoomCfg = {
      v: ROOM_V,
      rev: CARDS_REV,
      seed: randomSeed(),
      kingdom: k,
      extras: withExtras ? ['dragongold', 'palace'] : [],
      slots: [{ k: 'h' }, ...settings.onlineSlots.map((s): RoomCfg['slots'][number] => (s === 'human' ? { k: 'h' } : { k: 'b', level: s }))],
    };
    const cid = randomId(16);
    try {
      const id = await createRoom(firebaseTransport(ONLINE_DB), cfg, { name: settings.name.trim() || t('defaultName'), cid });
      const r: MyRoom = { id, cid, seat: 0, host: true, at: Date.now() };
      saveRoom(r);
      setCreating('');
      openRoom(r);
    } catch (e) {
      setCreating(t('online.createFailed', { err: String((e as Error).message ?? e) }));
    }
  };

  const openRules = (from: Screen) => {
    setRulesBack(from);
    setScreen('rules');
  };

  const langToggle = (
    <button className="lang-toggle" onClick={() => update({ lang: lang === 'en' ? 'pl' : 'en' })} aria-label={t('language')}>
      <span className={lang === 'en' ? 'on' : ''}>EN</span>
      <span className={lang === 'pl' ? 'on' : ''}>PL</span>
    </button>
  );

  if (screen === 'game' && saved) {
    return (
      <GameScreen
        key={saved.setup.seed}
        saved={saved}
        settings={settings}
        onSettings={update}
        onRules={() => openRules('game')}
        onExit={() => {
          setSaved(loadGame());
          setScreen('home');
        }}
        onNewGame={() => {
          saveGame(null);
          setSaved(null);
          setScreen('setup');
        }}
        onRematch={(k, ex) => startGame(k, ex)}
      />
    );
  }

  if (screen === 'online' && room) {
    return (
      <OnlineRoom
        key={room.id}
        room={room}
        settings={settings}
        onSettings={update}
        onRules={() => openRules('online')}
        langToggle={langToggle}
        onExit={() => {
          setRooms(loadRooms());
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        lang={lang}
        langToggle={langToggle}
        onBack={() => setScreen('home')}
        onJoin={(id) => openRoom(roomFor(loadRooms(), id, randomId(16)))}
      />
    );
  }

  if (screen === 'rules') {
    return (
      <div className="screen">
        <header className="bar">
          <button
            className="btn ghost"
            onClick={() => setScreen(rulesBack === 'game' && saved ? 'game' : rulesBack === 'online' && room ? 'online' : rulesBack === 'online' ? 'home' : rulesBack)}
          >
            ← {t('back')}
          </button>
          <h1>{t('rules')}</h1>
          {langToggle}
        </header>
        <main className="page rules">
          <Markdown text={t('rulesText')} />
        </main>
      </div>
    );
  }

  if (screen === 'setup') {
    return (
      <SetupScreen
        lang={lang}
        settings={settings}
        update={update}
        online={online}
        langToggle={langToggle}
        onBack={() => setScreen('home')}
        onNext={() => {
          setKingdom(settings.mode === 'random' ? randomKingdom(settings.sets) : []);
          setScreen('kingdom');
        }}
      />
    );
  }

  if (screen === 'kingdom') {
    return (
      <KingdomScreen
        lang={lang}
        sets={settings.sets}
        mode={settings.mode}
        kingdom={kingdom}
        setKingdom={setKingdom}
        pileView={settings.pileView}
        onPileView={(v) => update({ pileView: v })}
        langToggle={langToggle}
        onBack={() => setScreen('setup')}
        onStart={(ex) => (online ? createOnline(kingdom, ex) : startGame(kingdom, ex))}
        startLabel={online ? t('online.create') : undefined}
        busy={creating === '…'}
        error={creating !== '…' ? creating : ''}
      />
    );
  }

  // ekran startowy
  return (
    <div className="screen home">
      <header className="bar">
        <span />
        <span />
        {langToggle}
      </header>
      <main className="page home-main">
        <div className="crest" aria-hidden="true">
          <img src="./icons/icon-192.png" alt="" width="96" height="96" />
        </div>
        <h1 className="title">{t('appName')}</h1>
        <p className="tagline">{t('tagline')}</p>
        <div className="home-buttons">
          {saved && (
            <button className="btn primary big" onClick={() => setScreen('game')}>
              {t('continue')}
            </button>
          )}
          <ConfirmButton
            className={'btn big' + (saved ? '' : ' primary')}
            label={t('newGame')}
            question={t('confirmNew')}
            yes={t('yes')}
            no={t('no')}
            needConfirm={!!saved}
            onConfirm={() => {
              saveGame(null);
              setSaved(null);
              setOnline(false);
              setScreen('setup');
            }}
          />
          <button
            className="btn big"
            onClick={() => {
              setOnline(true);
              setCreating('');
              setScreen('setup');
            }}
          >
            {t('online.new')}
          </button>
          <button className="btn big" onClick={() => setScreen('join')}>
            {t('online.join')}
          </button>
          <button className="btn big ghost" onClick={() => openRules('home')}>
            {t('rules')}
          </button>
        </div>
        {rooms.length > 0 && (
          <section className="my-rooms">
            <h2>{t('online.myGames')}</h2>
            {rooms.map((r) => (
              <div key={r.id} className="room-row">
                <button className="btn" onClick={() => openRoom(r)}>
                  <span>{r.names?.length ? r.names.join(', ') : t('online.title')}</span>
                  <span className="muted small">{new Date(r.at).toLocaleDateString(lang)}</span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={t('online.forget')}
                  title={t('online.forget')}
                  onClick={() => {
                    forgetRoom(r.id);
                    setRooms(loadRooms());
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

// ---------- ustawienia nowej gry ----------

function SetupScreen(props: {
  lang: Lang;
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  online: boolean;
  langToggle: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
}) {
  const { lang, settings, update, online } = props;
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const setBot = (i: number, level: BotLevel) => update({ bots: settings.bots.map((b, j) => (j === i ? level : b)) });
  const toggleSet = (id: SetId) => {
    const has = settings.sets.includes(id);
    const next = has ? settings.sets.filter((s) => s !== id) : [...settings.sets, id];
    if (next.length) update({ sets: next });
  };
  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={props.onBack}>
          ← {t('back')}
        </button>
        <h1>{online ? t('online.title') : t('newGame')}</h1>
        {props.langToggle}
      </header>
      <main className="page setup">
        <section>
          <label className="field">
            <span>{t('yourName')}</span>
            <input
              value={settings.name}
              maxLength={16}
              placeholder={t('defaultName')}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
        </section>

        {online && <OnlineSlots lang={lang} slots={settings.onlineSlots} onChange={(onlineSlots) => update({ onlineSlots })} />}
        {!online && <section>
          <h2>{t('opponents')}</h2>
          {settings.bots.map((b, i) => (
            <div className="bot-row" key={i}>
              <span className="bot-name">{BOT_NAMES[i]}</span>
              <div className="seg">
                {LEVELS.map((l) => (
                  <button key={l} className={b === l ? 'on' : ''} onClick={() => setBot(i, l)}>
                    {t(`level.${l}`)}
                  </button>
                ))}
              </div>
              {settings.bots.length > 1 && (
                <button className="icon-btn" aria-label={t('remove')} onClick={() => update({ bots: settings.bots.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {settings.bots.length < 3 && (
            <button className="btn ghost" onClick={() => update({ bots: [...settings.bots, 'medium'] })}>
              + {t('addBot')}
            </button>
          )}
        </section>}

        <section>
          <h2>{t('packs')}</h2>
          {SETS.map((s) => (
            <label key={s.id} className={'check' + (s.available ? '' : ' disabled')}>
              <input
                type="checkbox"
                disabled={!s.available}
                checked={s.available && settings.sets.includes(s.id)}
                onChange={() => toggleSet(s.id)}
              />
              <span>{s.name[lang]}</span>
              {!s.available && <em>{t('soon')}</em>}
            </label>
          ))}
        </section>

        <section>
          <h2>{t('kingdomMode')}</h2>
          <div className="seg wide">
            {(['random', 'manual'] as const).map((m) => (
              <button key={m} className={settings.mode === m ? 'on' : ''} onClick={() => update({ mode: m })}>
                {t(`mode.${m}`)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>{t('speed')}</h2>
          <div className="seg wide">
            {(['slow', 'normal', 'fast'] as const).map((m) => (
              <button key={m} className={settings.speed === m ? 'on' : ''} onClick={() => update({ speed: m })}>
                {t(`speed.${m}`)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>{t('pileView')}</h2>
          <div className="seg wide">
            {(['art', 'symbols'] as const).map((v) => (
              <button key={v} className={settings.pileView === v ? 'on' : ''} onClick={() => update({ pileView: v })}>
                {t(`pileView.${v}`)}
              </button>
            ))}
          </div>
        </section>

        <button
          className="btn primary big sticky"
          onClick={props.onNext}
          disabled={online && !settings.onlineSlots.includes('human')}
        >
          {t('kingdom')} →
        </button>
      </main>
    </div>
  );
}

/** Gra online: pozostałe miejsca przy stole – gracz (człowiek) albo bot. */
function OnlineSlots({ lang, slots, onChange }: { lang: Lang; slots: OnlineSlot[]; onChange: (s: OnlineSlot[]) => void }) {
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const kinds: OnlineSlot[] = ['human', ...LEVELS];
  let b = 0;
  return (
    <section>
      <h2>{t('online.players')}</h2>
      <p className="muted small">{t('online.youHost')}</p>
      {slots.map((s, i) => (
        <div className="bot-row online-row" key={i}>
          <span className="bot-name">{s === 'human' ? t('online.playerN', { n: i + 2 }) : BOT_NAMES[b++]}</span>
          <div className="seg">
            {kinds.map((k) => (
              <button key={k} className={s === k ? 'on' : ''} onClick={() => onChange(slots.map((x, j) => (j === i ? k : x)))}>
                {k === 'human' ? t('online.human') : t(`level.${k}`)}
              </button>
            ))}
          </div>
          {slots.length > 1 && (
            <button className="icon-btn" aria-label={t('remove')} onClick={() => onChange(slots.filter((_, j) => j !== i))}>
              ✕
            </button>
          )}
        </div>
      ))}
      {slots.length < 3 && (
        <button className="btn ghost" onClick={() => onChange([...slots, 'human'])}>
          + {t('online.addPlayer')}
        </button>
      )}
      {!slots.includes('human') && <p className="muted small warn">{t('online.needHuman')}</p>}
    </section>
  );
}

// ---------- Królestwo: losowanie / wybór ----------

function KingdomScreen(props: {
  lang: Lang;
  sets: SetId[];
  mode: 'random' | 'manual';
  kingdom: string[];
  pileView: Settings['pileView'];
  onPileView: (v: Settings['pileView']) => void;
  setKingdom: (k: string[]) => void;
  langToggle: React.ReactNode;
  onBack: () => void;
  onStart: (extras: boolean) => void;
  startLabel?: string;
  busy?: boolean;
  error?: string;
}) {
  const { lang, sets, kingdom, setKingdom } = props;
  const symbols = props.pileView === 'symbols';
  // Smocze Złoto i Pałac – losowane, gdy w Królestwie są karty Skarbca; można zmienić ręcznie
  const hoardIn = hasHoardCards(kingdom);
  const [extras, setExtras] = useState(false);
  const kingdomKey = [...kingdom].sort().join(',');
  useEffect(() => {
    setExtras(kingdom.length === KINGDOM_SIZE && rollHoardExtras(kingdom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingdomKey]);
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const [detail, setDetail] = useState<string | null>(null);
  useEscape(!!detail && (() => setDetail(null)));
  const [manual, setManual] = useState(props.mode === 'manual');
  const pool = useMemo(
    () => kingdomCards(sets).sort((a, b) => card(a).cost - card(b).cost || card(a).name[lang].localeCompare(card(b).name[lang])),
    [sets, lang],
  );
  const sorted = [...kingdom].sort((a, b) => card(a).cost - card(b).cost || card(a).name[lang].localeCompare(card(b).name[lang]));
  const toggle = (id: string) => {
    if (kingdom.includes(id)) setKingdom(kingdom.filter((k) => k !== id));
    else if (kingdom.length < KINGDOM_SIZE) setKingdom([...kingdom, id]);
  };

  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={props.onBack}>
          ← {t('back')}
        </button>
        <h1>{t('kingdom')}</h1>
        {props.langToggle}
      </header>
      <main className="page kingdom">
        <div className="seg wide">
          <button className={!manual ? 'on' : ''} onClick={() => { setManual(false); if (kingdom.length < KINGDOM_SIZE) setKingdom(randomKingdom(sets)); }}>
            {t('mode.random')}
          </button>
          <button className={manual ? 'on' : ''} onClick={() => setManual(true)}>
            {t('mode.manual')}
          </button>
        </div>

        <div className="view-row">
          <span className="muted small">{t('pileView')}</span>
          <div className="seg">
            {(['art', 'symbols'] as const).map((v) => (
              <button key={v} className={props.pileView === v ? 'on' : ''} onClick={() => props.onPileView(v)}>
                {t(`pileView.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {!manual && (
          <>
            <div className="kingdom-list">
              {sorted.map((id) => (
                <div className="k-row" key={id}>
                  <PileTile id={id} lang={lang} count={10} symbols={symbols} onTap={() => setDetail(id)} onLong={() => setDetail(id)} />
                  <button
                    className="icon-btn"
                    aria-label={t('reroll')}
                    title={t('reroll')}
                    onClick={() => setKingdom(rerollOne(kingdom, kingdom.indexOf(id), sets))}
                  >
                    ↻
                  </button>
                </div>
              ))}
            </div>
            <button className="btn ghost" onClick={() => setKingdom(randomKingdom(sets))}>
              ↻ {t('rerollAll')}
            </button>
          </>
        )}

        {manual && (
          <>
            <h2>{t('chooseCards', { n: kingdom.length })}</h2>
            <div className="pick-grid">
              {pool.map((id) => (
                <PileTile
                  key={id}
                  id={id}
                  lang={lang}
                  count={kingdom.includes(id) ? 1 : 0}
                  state={kingdom.includes(id) ? 'pickable' : kingdom.length >= KINGDOM_SIZE ? 'dim' : ''}
                  symbols={symbols}
                  onTap={() => toggle(id)}
                  onLong={() => setDetail(id)}
                />
              ))}
            </div>
          </>
        )}

        {hoardIn && (
          <section className="extras">
            <label className="check">
              <input type="checkbox" checked={extras} onChange={(e) => setExtras(e.target.checked)} />
              <span>{t('hoardExtras')}</span>
            </label>
            {extras && (
              <div className="extras-tiles">
                {['dragongold', 'palace'].map((id) => (
                  <PileTile key={id} id={id} lang={lang} count={id === 'palace' ? 8 : 12} onTap={() => setDetail(id)} onLong={() => setDetail(id)} />
                ))}
              </div>
            )}
            <p className="muted small">{t('hoardExtrasInfo')}</p>
          </section>
        )}

        {props.error && <p className="lobby-status warn">{props.error}</p>}
        <button
          className="btn primary big sticky"
          disabled={kingdom.length !== KINGDOM_SIZE || props.busy}
          onClick={() => props.onStart(hoardIn && extras)}
        >
          {props.busy ? t('online.creating') : props.startLabel ?? t('start')}
        </button>
      </main>
      {detail && (
        <div className="sheet-backdrop" onClick={() => setDetail(null)}>
          <div className="sheet center" onClick={(e) => e.stopPropagation()}>
            <CardFace id={detail} lang={lang} className="large" />
            <div className="sheet-actions">
              <span className="muted">
                {t('cost')} <Cost id={detail} small />
              </span>
              <button className="btn" onClick={() => setDetail(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- prosty Markdown dla zasad ----------

export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n|\n(?=## )/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    );
  return (
    <>
      {blocks.flatMap((b, i) => {
        const lines = b.split('\n');
        return lines.map((l, j) =>
          l.startsWith('## ') ? <h2 key={`${i}-${j}`}>{l.slice(3)}</h2> : l.trim() ? <p key={`${i}-${j}`}>{inline(l)}</p> : null,
        );
      })}
    </>
  );
}
