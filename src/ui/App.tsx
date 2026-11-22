import { useEffect, useMemo, useState } from 'react';
import { card, kingdomCards, SETS } from '../engine/cards';
import type { SetId } from '../engine/card';
import { randomSeed } from '../engine/rng';
import { KINGDOM_SIZE, hasHoardCards, randomKingdom, rerollOne, rollHoardExtras } from '../engine/setup';
import type { BotLevel, GameSetup, Lang } from '../engine/types';
import { tr } from '../i18n';
import { CardFace, ConfirmButton, Cost, PileTile } from './CardView';
import { GameScreen } from './GameScreen';
import { loadGame, loadSettings, saveGame, saveSettings, type SavedGame, type Settings } from './store';

export const BOT_NAMES = ['Aldric', 'Brenna', 'Corvin'];
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

type Screen = 'home' | 'setup' | 'kingdom' | 'rules' | 'game';

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>(() => (loadGame() ? 'game' : 'home'));
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
    const s: SavedGame = { v: 2, hoardRev: 1, setup, answers: [], plans: {} };
    saveGame(s);
    setSaved(s);
    setScreen('game');
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

  if (screen === 'rules') {
    return (
      <div className="screen">
        <header className="bar">
          <button className="btn ghost" onClick={() => setScreen(rulesBack === 'game' && saved ? 'game' : rulesBack)}>
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
        langToggle={langToggle}
        onBack={() => setScreen('setup')}
        onStart={(ex) => startGame(kingdom, ex)}
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
              setScreen('setup');
            }}
          />
          <button className="btn big ghost" onClick={() => openRules('home')}>
            {t('rules')}
          </button>
        </div>
      </main>
    </div>
  );
}

// ---------- ustawienia nowej gry ----------

function SetupScreen(props: {
  lang: Lang;
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  langToggle: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
}) {
  const { lang, settings, update } = props;
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
        <h1>{t('newGame')}</h1>
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

        <section>
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
        </section>

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

        <button className="btn primary big" onClick={props.onNext}>
          {t('kingdom')} →
        </button>
      </main>
    </div>
  );
}

// ---------- Królestwo: losowanie / wybór ----------

function KingdomScreen(props: {
  lang: Lang;
  sets: SetId[];
  mode: 'random' | 'manual';
  kingdom: string[];
  setKingdom: (k: string[]) => void;
  langToggle: React.ReactNode;
  onBack: () => void;
  onStart: (extras: boolean) => void;
}) {
  const { lang, sets, kingdom, setKingdom } = props;
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

        {!manual && (
          <>
            <div className="kingdom-list">
              {sorted.map((id) => (
                <div className="k-row" key={id}>
                  <PileTile id={id} lang={lang} count={10} onTap={() => setDetail(id)} onLong={() => setDetail(id)} />
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

        <button className="btn primary big sticky" disabled={kingdom.length !== KINGDOM_SIZE} onClick={() => props.onStart(hoardIn && extras)}>
          {t('start')}
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
