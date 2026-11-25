// Gra online: poczekalnia pokoju (link, gracze, start) i gra przez pokój w Firebase.
import { useEffect, useMemo, useRef, useState } from 'react';
import { card } from '../engine/cards';
import type { Lang } from '../engine/types';
import { tr } from '../i18n';
import { ONLINE_DB } from '../online/config';
import { firebaseTransport } from '../online/firebase';
import {
  ROOM_V,
  RoomConn,
  allSeated,
  humanSlots,
  parseRoomRef,
  roomLink,
  rulesMissing,
  saveRoom,
  seatOf,
  setupOf,
  type MyRoom,
} from '../online/room';
import { GameScreen } from './GameScreen';
import { BOT_NAMES, CARDS_REV, type SavedGame, type Settings } from './store';
import type { Rematch, RematchSlot } from './App';
import { TeaCup } from './Icons';
import { useEscape } from './CardView';

type T = (k: string, p?: Record<string, string | number>) => string;

const pageBase = () => location.origin + location.pathname;

export function OnlineRoom(props: {
  room: MyRoom;
  settings: Settings;
  onSettings: (p: Partial<Settings>) => void;
  onRules: () => void;
  onExit: () => void;
  /** Rewanż (tylko gospodarz): ustawienia nowej gry, zaczynając od tej. */
  onRematch: (r: Rematch) => void;
  /** Gospodarz założył rewanż – przejdź do nowego pokoju. */
  onFollow: (from: MyRoom, next: string) => void;
  langToggle: React.ReactNode;
}) {
  const { room, settings } = props;
  const lang = settings.lang;
  const t: T = (k, p) => tr(lang, k, p);
  const [conn, setConn] = useState<RoomConn | null>(null);
  const [, setVer] = useState(0);
  const [noRules, setNoRules] = useState(false);

  useEffect(() => {
    const c = new RoomConn(firebaseTransport(ONLINE_DB), room.id);
    const off = c.on(() => setVer((v) => v + 1));
    c.open();
    setConn(c);
    return () => {
      off();
      c.close();
    };
  }, [room.id]);

  const st = conn?.state;
  const seat = st ? seatOf(st, room.cid) : null;

  // gospodarz: czy reguły bazy chronią dane (raz, po założeniu pokoju)
  useEffect(() => {
    if (!conn || seat !== 0 || !conn.loaded || !st?.seats[0]) return;
    let alive = true;
    rulesMissing(conn.t, room.id, st.seats[0]).then((m) => alive && setNoRules(m));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, seat, conn?.loaded ? 1 : 0]);

  // obecność i zapamiętanie pokoju na urządzeniu
  useEffect(() => {
    if (!conn || seat === null) return;
    conn.startPing(seat);
  }, [conn, seat]);
  const setup = useMemo(
    () => (st?.cfg ? setupOf(st, BOT_NAMES, (i) => t('online.playerN', { n: i + 1 })) : null),
    // nazwy graczy są stałe od startu gry
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st?.cfg, st?.start, Object.keys(st?.seats ?? {}).length],
  );
  const names = setup?.players.map((p) => p.name).join(',');
  useEffect(() => {
    if (seat === null || !setup) return;
    saveRoom({ ...room, seat, host: seat === 0, names: setup.players.map((p) => p.name) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seat, names]);

  const started = !!st?.start;
  const saved: SavedGame | null = useMemo(
    () => (started && setup && conn ? { v: 2, hoardRev: CARDS_REV, setup, answers: conn.state.moves, plans: {} } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [started, !!setup],
  );

  const exit = () => props.onExit();

  // gospodarz założył rewanż – wszyscy przechodzą do nowego pokoju
  const next = st?.next ?? null;
  useEffect(() => {
    if (!next) return;
    props.onFollow({ ...room, seat }, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next]);

  // rewanż ustawia tylko gospodarz; reszta graczy przechodzi z poprzedniej gry z imionami
  const rematch = async () => {
    const cfg = st?.cfg;
    if (!cfg || seat !== 0 || !conn) return;
    await conn.setPrep(true);
    const slots = cfg.slots.slice(1).map((s, k): RematchSlot => {
      if (s.k === 'b') return { k: 'bot', level: s.level };
      const who = st.seats[k + 1];
      return who ? { k: 'keep', name: who.name, cid: who.cid } : { k: 'new' };
    });
    props.onRematch({ from: { ...room, seat }, kingdom: cfg.kingdom, extras: !!cfg.extras?.length, slots });
  };

  // pozostali gracze: „Czekaj – gospodarz przygotowuje grę” (można schować)
  const [hideWait, setHideWait] = useState(false);
  const waiting = !!conn && seat !== null && seat !== 0 && conn.preparing() && !hideWait;
  useEffect(() => {
    if (!st?.prep) setHideWait(false);
  }, [st?.prep]);

  if (conn && st && saved && seat !== null) {
    return (
      <>
      <GameScreen
        key={room.id}
        saved={saved}
        settings={settings}
        onSettings={props.onSettings}
        onRules={props.onRules}
        onExit={exit}
        onNewGame={exit}
        onRematch={exit}
        online={{
          seat,
          host: seat === 0,
          moves: st.moves,
          version: conn.loaded + conn.conflicts * 100000,
          link: conn.link,
          unsent: conn.unsent,
          ping: st.ping,
          push: (a) => conn.push(a),
          rematch: seat === 0 ? rematch : undefined,
          resigned: st.end,
          resign: () => void conn.resign(seat).catch(() => undefined),
        }}
      />
      {waiting && <RematchWait t={t} onClose={() => setHideWait(true)} />}
      </>
    );
  }

  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={exit}>
          ← {t('back')}
        </button>
        <h1>{t('online.title')}</h1>
        {props.langToggle}
      </header>
      <main className="page lobby">
        <Lobby
          lang={lang}
          t={t}
          room={room}
          conn={conn}
          seat={seat}
          noRules={noRules}
          name={settings.name}
          onName={(name) => props.onSettings({ name })}
        />
      </main>
    </div>
  );
}

function Lobby(props: {
  lang: Lang;
  t: T;
  room: MyRoom;
  conn: RoomConn | null;
  seat: number | null;
  noRules: boolean;
  name: string;
  onName: (n: string) => void;
}) {
  const { t, lang, room, conn, seat } = props;
  const [name, setName] = useState(props.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  /** Gość stuknął „Dołącz” bez imienia – pokazujemy prośbę; drugie stuknięcie dołącza jako „Gracz N”. */
  const [askName, setAskName] = useState(false);
  /** Zmiana imienia w poczekalni: null = nie edytuję, tekst = edytowane imię. */
  const [edit, setEdit] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const st = conn?.state;
  const link = roomLink(pageBase(), room.id);


  if (!conn || !st || !conn.loaded) {
    return (
      <p className="lobby-status">
        {conn && conn.link !== 'offline' && conn.link !== 'live' ? t(`online.link.${conn.link}`) : t('online.connecting')}
      </p>
    );
  }
  const cfg = st.cfg;
  if (!cfg) return <p className="lobby-status">{t('online.noRoom')}</p>;
  if (cfg.v !== ROOM_V || cfg.rev !== CARDS_REV) return <p className="lobby-status warn">{t('online.version')}</p>;

  const humans = humanSlots(cfg);
  const free = humans.filter((i) => !st.seats[i]);
  const full = allSeated(st);
  if (room.fromRematch && seat === null) return <p className="lobby-status">{t('online.notInRematch')}</p>;
  if (st.start && seat === null) return <p className="lobby-status">{t('online.startedWithoutYou')}</p>;

  const join = async () => {
    if (!name.trim() && !askName) {
      setAskName(true);
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBusy(true);
    setErr('');
    // bez imienia: „Gracz 2”, „Gracz 3”… (numer miejsca), żeby było wiadomo, kto jest kim
    const typed = name.trim().slice(0, 20);
    props.onName(name.trim());
    try {
      const s = await conn.join((i) => typed || t('online.playerN', { n: i + 1 }), room.cid);
      if (s === null) setErr(t('online.full'));
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    }
    setBusy(false);
  };
  const rename = async () => {
    const n = (edit ?? '').trim().slice(0, 20);
    if (seat === null || !n) return setEdit(null);
    setBusy(true);
    const ok = await conn.rename(seat, n);
    setBusy(false);
    if (!ok) return setErr(t('online.renameFailed'));
    setErr('');
    props.onName(n);
    setEdit(null);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* zaznaczenie pola wystarczy */
    }
  };
  const share = () => navigator.share?.({ title: t('appName'), text: t('online.shareText'), url: link }).catch(() => undefined);

  let b = 0;
  const kingdom = [...cfg.kingdom].sort((x, y) => card(x).cost - card(y).cost || card(x).name[lang].localeCompare(card(y).name[lang]));
  return (
    <>
      {conn.link !== 'live' && <p className="lobby-status warn">{t(`online.link.${conn.link}`)}</p>}
      {props.noRules && <p className="lobby-status warn">{t('online.rulesMissing')}</p>}

      {/* gość: najpierw imię – przycisk „Dołącz” jest przyklejony na dole ekranu */}
      {seat === null && free.length > 0 && (
        <section className={'name-ask' + (askName && !name.trim() ? ' warn' : '')}>
          <label className="field">
            <span className="name-ask-title">{t('online.enterName')}</span>
            <input
              ref={nameRef}
              value={name}
              maxLength={16}
              autoComplete="nickname"
              enterKeyHint="go"
              placeholder={t('online.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
          </label>
          <p className="muted small">
            {askName && !name.trim() ? t('online.noName', { name: t('online.playerN', { n: (free[0] ?? 1) + 1 }) }) : t('online.nameInfo')}
          </p>
        </section>
      )}

      <section>
        <h2>{t('online.invite')}</h2>
        <p className="muted small">{t('online.inviteInfo')}</p>
        <input className="link-box" readOnly value={link} onFocus={(e) => e.target.select()} />
        <div className="row-buttons">
          <button className="btn" onClick={copy}>
            {copied ? t('online.copied') : t('online.copy')}
          </button>
          {typeof navigator.share === 'function' && (
            <button className="btn" onClick={share}>
              {t('online.share')}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2>{t('online.players')}</h2>
        <ol className="seats">
          {cfg.slots.map((s, i) => {
            const taken = st.seats[i];
            return (
              <li key={i} className={(i === seat ? 'me' : '') + (s.k === 'h' && !taken ? ' free' : '')}>
                {s.k === 'b' ? (
                  <>
                    {BOT_NAMES[b++ % BOT_NAMES.length]} <span className="muted small">· {t('online.bot')} · {t(`level.${s.level}`)}</span>
                  </>
                ) : taken && i === seat && edit !== null ? (
                  <span className="rename">
                    <input
                      autoFocus
                      value={edit}
                      maxLength={16}
                      autoComplete="nickname"
                      enterKeyHint="done"
                      onChange={(e) => setEdit(e.target.value)}
                      onKeyDown={(e) => (e.key === 'Enter' ? rename() : e.key === 'Escape' ? setEdit(null) : undefined)}
                    />
                    <button className="btn mini primary" disabled={busy || !edit.trim()} onClick={rename}>
                      {t('online.saveName')}
                    </button>
                    <button className="btn mini ghost" onClick={() => setEdit(null)} aria-label={t('online.cancelRename')}>
                      ✕
                    </button>
                  </span>
                ) : taken ? (
                  <>
                    {taken.name}
                    {i === 0 && <span className="muted small"> · {t('online.hostTag')}</span>}
                    {i === seat && <span className="muted small"> · {t('you')}</span>}
                    {i === seat && !st.start && (
                      <button className="btn mini ghost rename-btn" onClick={() => setEdit(taken.name)}>
                        ✎ {t('online.changeName')}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="muted">{t('online.freeSeat')}</span>
                )}
              </li>
            );
          })}
        </ol>
        {cfg.slots.some((s) => s.k === 'b') && <p className="muted small">{t('online.botsHost')}</p>}
      </section>

      <section>
        <h2>{t('kingdom')}</h2>
        <div className="deck-list">
          {kingdom.map((id) => (
            <span key={id} className="chip">
              {card(id).name[lang]}
            </span>
          ))}
          {(cfg.extras ?? []).map((id) => (
            <span key={id} className="chip">
              {card(id).name[lang]}
            </span>
          ))}
        </div>
      </section>

      {seat === null && free.length > 0 && (
        <button className="btn primary big sticky" disabled={busy} onClick={join}>
          {t('online.joinBtn')}
        </button>
      )}
      {seat === null && !free.length && <p className="lobby-status">{t('online.full')}</p>}
      {err && <p className="lobby-status warn">{err}</p>}

      {seat === 0 && (
        <button className="btn primary big sticky" disabled={!full || busy} onClick={async () => {
          setBusy(true);
          try {
            await conn.begin();
          } catch (e) {
            setErr(String((e as Error).message ?? e));
          }
          setBusy(false);
        }}>
          {full ? t('start') : t('online.waitPlayers')}
        </button>
      )}
      {seat !== null && seat !== 0 && <p className="lobby-status">{full ? t('online.waitHost') : t('online.waitPlayers')}</p>}
    </>
  );
}

/** Dołączanie przez wklejony link (np. w aplikacji zainstalowanej na iPhonie, która nie otwiera linków). */
export function JoinScreen(props: { lang: Lang; langToggle: React.ReactNode; onBack: () => void; onJoin: (id: string) => void }) {
  const t: T = (k, p) => tr(props.lang, k, p);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    const ref = parseRoomRef(text);
    if (!ref) return setErr(t('online.badLink'));
    props.onJoin(ref.id);
  };
  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={props.onBack}>
          ← {t('back')}
        </button>
        <h1>{t('online.join')}</h1>
        {props.langToggle}
      </header>
      <main className="page setup">
        <section>
          <label className="field">
            <span>{t('online.pasteLink')}</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…#room=…" autoFocus />
          </label>
        </section>
        {err && <p className="lobby-status warn">{err}</p>}
        <button className="btn primary big sticky" onClick={go} disabled={!text.trim()}>
          {t('online.joinBtn')}
        </button>
      </main>
    </div>
  );
}

/** Zapamiętany pokój dla linku – albo nowy wpis z losowym identyfikatorem urządzenia. */
export function roomFor(rooms: MyRoom[], id: string, cid: string): MyRoom {
  return rooms.find((r) => r.id === id) ?? { id, cid, seat: null, host: false, at: Date.now() };
}

/** Okienko dla graczy (nie gospodarza): gospodarz ustawia rewanż. */
function RematchWait({ t, onClose }: { t: T; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div className="sheet-backdrop wait-backdrop">
      <div className="sheet center wait-sheet" role="status">
        <TeaCup />
        <h2>{t('online.waitTitle')}</h2>
        <p className="muted">{t('online.waitRematch')}</p>
        <div className="sheet-actions">
          <button className="btn ghost" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
