import { useEffect, useRef, useState } from 'react';
import { card } from '../engine/cards';
import type { Lang } from '../engine/types';
import { tr } from '../i18n';
import { cardArt, setSymbol, typeClass } from './art';
import { cardSymbols, type Sym } from './symbols';

/** Stuknięcie i przytrzymanie (podgląd karty). */
/**
 * Stuknięcie, dwuklik (zatwierdzenie bez podglądu) i przytrzymanie (podgląd karty).
 * delayTap: pojedyncze stuknięcie czeka chwilę, czy nie przyjdzie drugie
 * (potrzebne, gdy pojedyncze stuknięcie otwiera okno zasłaniające kartę).
 */
export function usePress(onTap?: () => void, onLong?: () => void, onDouble?: () => void, delayTap = false) {
  const timer = useRef<number | null>(null);
  const lastTap = useRef(0);
  const pendingTap = useRef<number | null>(null);
  const longFired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      longFired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      if (onLong)
        timer.current = window.setTimeout(() => {
          longFired.current = true;
          onLong();
        }, 450);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
    onClick: () => {
      if (longFired.current) return;
      const now = Date.now();
      if (onDouble && now - lastTap.current < 330) {
        lastTap.current = 0;
        if (pendingTap.current !== null) window.clearTimeout(pendingTap.current);
        pendingTap.current = null;
        onDouble();
        return;
      }
      lastTap.current = now;
      if (onDouble && delayTap) {
        pendingTap.current = window.setTimeout(() => {
          pendingTap.current = null;
          onTap?.();
        }, 260);
      } else onTap?.();
    },
  };
}

export function Art({ id, className }: { id: string; className: string }) {
  const a = cardArt(card(id));
  return <div className={className} style={{ backgroundImage: a.bg }} dangerouslySetInnerHTML={{ __html: a.svg }} />;
}

export function SetIcon({ id, className }: { id: string; className: string }) {
  const svg = setSymbol(card(id));
  return svg ? <span className={className} dangerouslySetInnerHTML={{ __html: svg }} /> : null;
}

export function typeLine(id: string, lang: Lang): string {
  return card(id)
    .types.map((t) => tr(lang, `type.${t}`))
    .join(' – ');
}

export function Coin({ n, small }: { n: number | string; small?: boolean }) {
  return <span className={'coin' + (small ? ' small' : '')}>{n}</span>;
}

/** Eliksir – fioletowa buteleczka (druga waluta). Z liczbą, gdy podana. */
/** W tekście karty `{P}` oznacza ikonkę Eliksiru. */
function withIcons(text: string): React.ReactNode {
  if (!text.includes('{P}')) return text;
  return text.split('{P}').map((part, i) => (
    <span key={i}>
      {i > 0 && <Flask inline />}
      {part}
    </span>
  ));
}

export function Flask({ n, small, big, inline }: { n?: number; small?: boolean; big?: boolean; inline?: boolean }) {
  return (
    <span className={'flask' + (small ? ' small' : '') + (big ? ' big' : '') + (inline ? ' inline' : '')} title="Elixir">
      <svg viewBox="0 0 16 20" aria-hidden="true">
        <path d="M6 1.5h4M6.6 1.5v5L2.6 13.2a3.6 3.6 0 0 0 3.1 5.3h4.6a3.6 3.6 0 0 0 3.1-5.3L9.4 6.5v-5" />
        <path className="fill" d="M4 11.2h8l1.3 2.4a2.6 2.6 0 0 1 -2.3 3.9H5a2.6 2.6 0 0 1 -2.3 -3.9z" />
      </svg>
      {n !== undefined && <b>{n}</b>}
    </span>
  );
}

/** Koszt karty: moneta i ewentualnie Eliksir. */
export function Cost({ id, small }: { id: string; small?: boolean }) {
  const c = card(id);
  return (
    <span className="cost">
      <Coin n={c.cost} small={small} />
      {(c.potionCost ?? 0) > 0 && <Flask small={small} />}
    </span>
  );
}

interface FaceProps {
  id: string;
  lang: Lang;
  className?: string;
  onTap?: () => void;
  onLong?: () => void;
  onDouble?: () => void;
  badge?: React.ReactNode;
}

export function CardFace({ id, lang, className = '', onTap, onLong, onDouble, badge }: FaceProps) {
  const c = card(id);
  const press = usePress(onTap, onLong, onDouble);
  const plus = c.plus ?? {};
  const lines: React.ReactNode[] = [];
  if (plus.cards) lines.push(tr(lang, 'plus.cards', { n: plus.cards }));
  if (plus.actions) lines.push(tr(lang, 'plus.actions', { n: plus.actions }));
  if (plus.buys) lines.push(tr(lang, 'plus.buys', { n: plus.buys }));
  if (plus.coins)
    lines.push(
      <span className="plus-coin" title={tr(lang, 'plus.coins', { n: plus.coins })}>
        +{plus.coins}
        <span className="coin" />
      </span>,
    );
  if (plus.potions)
    lines.push(
      <span className="plus-flask">
        +{plus.potions > 1 ? plus.potions : ''}
        <Flask />
      </span>,
    );
  const text = c.text[lang];
  return (
    <div className={`card ${typeClass(c)} ${className}`} {...press} role="button" aria-label={c.name[lang]}>
      <div className="c-head">
        <span className="c-name">{c.name[lang]}</span>
        <SetIcon id={id} className="c-set" />
      </div>
      <Art id={id} className="c-art" />
      <div className="c-body">
        {lines.length > 0 && (
          <div className="c-plus">
            {lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
        {(c.coins !== undefined || c.potions) && (
          <div className={'c-big' + (c.vp !== undefined ? ' dual' : '')}>
            {c.coins !== undefined && <Coin n={c.coins} />}
            {c.potions ? <Flask big /> : null}
            {/* Skarb z punktami (Pradawna Moneta): moneta i PZ w jednym rzędzie */}
            {c.vp !== undefined && (
              <span className="vp">
                {c.vp}
                <small>{tr(lang, 'vp')}</small>
              </span>
            )}
          </div>
        )}
        {c.vp !== undefined && c.coins === undefined && !c.potions && (
          <div className={'c-big vp' + (c.vp < 0 ? ' neg' : '')}>{c.vp > 0 ? c.vp : c.vp}<small>{tr(lang, 'vp')}</small></div>
        )}
        {text && (
          <div className={'c-text' + (text.length > 150 ? ' long xlong' : text.length > 90 ? ' long' : '')}>
            {/* akapity oddzielone pustą linią – np. działanie karty i jej reakcja (kreska między nimi) */}
            {text.split('\n\n').map((part, i) => (
              <div key={i} className={i > 0 ? 'c-part sep' : 'c-part'}>
                {withIcons(part)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="c-foot">
        <Cost id={id} small />
        <span className="c-type">{typeLine(id, lang)}</span>
      </div>
      {badge}
    </div>
  );
}

interface TileProps {
  id: string;
  lang: Lang;
  count: number;
  state?: 'buyable' | 'pickable' | 'dim' | '';
  onTap?: () => void;
  onLong?: () => void;
  onDouble?: () => void;
  style?: React.CSSProperties;
  /** Widok „Symbole”: mały obrazek, pod nazwą skrót działania karty. */
  symbols?: boolean;
}

export function PileTile({ id, lang, count, state = '', onTap, onLong, onDouble, style, symbols }: TileProps) {
  const c = card(id);
  const press = usePress(onTap, onLong, onDouble, !!onDouble);
  return (
    <div
      className={`tile ${typeClass(c)} ${state} ${count <= 0 ? 'empty' : ''}${symbols ? ' sym' : ''}`}
      style={style}
      {...press}
      role="button"
      aria-label={c.name[lang]}
    >
      <Art id={id} className="tile-art" />
      <SetIcon id={id} className="tile-set" />
      <div className="tile-name">{c.name[lang]}</div>
      {symbols && <Symbols id={id} lang={lang} />}
      <Cost id={id} small />
      <span className="tile-count" title="">{count}</span>
    </div>
  );
}

/** Przycisk z potwierdzeniem w samej stronie (zamiast window.confirm). */
// ---------- Esc zamyka okienka ----------

/** Otwarte okienka w kolejności otwierania – Esc zamyka to na wierzchu (ostatnie). */
const escStack: { close: () => void }[] = [];
let escBound = false;

function onEscKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !escStack.length) return;
  e.preventDefault();
  escStack[escStack.length - 1].close();
}

/** Dopóki `onClose` nie jest null, okienko jest otwarte i Esc je zamyka (wywołuje `onClose`). */
export function useEscape(onClose: (() => void) | null | false | undefined): void {
  const ref = useRef(onClose);
  ref.current = onClose;
  const open = !!onClose;
  useEffect(() => {
    if (!open) return;
    const entry = { close: () => ref.current && ref.current() };
    escStack.push(entry);
    if (!escBound && typeof window !== 'undefined') {
      window.addEventListener('keydown', onEscKey);
      escBound = true;
    }
    return () => {
      const i = escStack.indexOf(entry);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [open]);
}

export function ConfirmButton(props: {
  className?: string;
  label: string;
  question: string;
  yes: string;
  no: string;
  needConfirm: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  useEscape(asking && (() => setAsking(false)));
  if (!asking)
    return (
      <button className={props.className} onClick={() => (props.needConfirm ? setAsking(true) : props.onConfirm())}>
        {props.label}
      </button>
    );
  return (
    <div className="confirm-box" role="alertdialog">
      <span>{props.question}</span>
      <div className="confirm-actions">
        <button className="btn" onClick={() => setAsking(false)}>
          {props.no}
        </button>
        <button className="btn primary" onClick={props.onConfirm}>
          {props.yes}
        </button>
      </div>
    </div>
  );
}

/** Zagrana karta (małą); takie same karty leżą jedna na drugiej z licznikiem. */
export function PlayedCard({ id, n, lang, onTap }: { id: string; n: number; lang: Lang; onTap: () => void }) {
  const c = card(id);
  return (
    <button className={`played ${typeClass(c)}` + (n > 1 ? ' stacked' : '')} onClick={onTap} aria-label={`${c.name[lang]} ×${n}`}>
      <Art id={id} className="played-art" />
      <span className="played-name">{c.name[lang]}</span>
      {n > 1 && <span className="played-count">×{n}</span>}
    </button>
  );
}

/* ---------- symbole działania karty (zestaw „kontur”) ---------- */
const ICONS: Record<string, React.ReactNode> = {
  card: (
    <>
      <rect x="5" y="2.5" width="10" height="15" rx="1.6" />
      <path d="M7.5 6h5M7.5 8.5h5" opacity=".55" />
    </>
  ),
  buy: (
    <>
      <path d="M4 7.2h12l-1.1 10.3H5.1z" />
      <path d="M7.4 9.2V5.6a2.6 2.6 0 0 1 5.2 0v3.6" />
    </>
  ),
  trash: (
    <>
      <path d="M3.2 5.2h13.6M7.8 5.2V3.2h4.4v2" />
      <path d="M5 5.2l1 12.3h8l1-12.3" />
      <path d="M8.4 8.2v6.4M11.6 8.2v6.4" />
    </>
  ),
  discard: (
    <>
      <rect x="2.4" y="4" width="8" height="12" rx="1.4" transform="rotate(-14 7 11)" />
      <rect className="paper" x="5.2" y="4.5" width="8" height="12" rx="1.4" />
      <path d="M11 10.5h8.2M16.6 7.9l2.6 2.6-2.6 2.6" strokeWidth="1.8" />
    </>
  ),
  more: (
    <>
      <rect x="1.8" y="5.5" width="16.4" height="9" rx="2.2" />
      <circle className="dot" cx="6.3" cy="10" r="1.15" />
      <circle className="dot" cx="10" cy="10" r="1.15" />
      <circle className="dot" cx="13.7" cy="10" r="1.15" />
    </>
  ),
};

function SymIcon({ k, lang }: { k: string; lang: Lang }) {
  if (k === 'vp')
    return (
      <svg className="sym-ic" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2.4l6.3 2.2v5.2c0 4-2.8 6.6-6.3 8-3.5-1.4-6.3-4-6.3-8V4.6z" />
        <text x="10" y="12.6" textAnchor="middle">
          {tr(lang, 'vp')}
        </text>
      </svg>
    );
  return (
    <svg className={'sym-ic i-' + k} viewBox={k === 'discard' ? '0 0 21 20' : '0 0 20 20'} aria-hidden="true">
      {ICONS[k]}
    </svg>
  );
}

function SymItem({ s, lang }: { s: Sym; lang: Lang }) {
  // „spal kartę” / „odrzuć kartę” bez liczby, gdy chodzi o jedną
  const num = s.n !== undefined && !(s.n === 1 && (s.k === 'trash' || s.k === 'discard')) ? s.n : undefined;
  const label = tr(lang, `sym.${s.k}`) + (s.n !== undefined ? ` ${s.plus ? '+' : ''}${s.n}` : '');
  let icon: React.ReactNode;
  // moneta: płaska złota moneta jak w grze, bez cyfry
  if (s.k === 'coin') icon = <span className="coin sym-coin" />;
  else if (s.k === 'potion') icon = <Flask small />;
  else if (s.k === 'act') icon = <span className="sym-a">A</span>;
  else icon = <SymIcon k={s.k} lang={lang} />;
  // liczba z plusem przed symbolem (moneta bez cyfry w środku – nie myli się z kosztem)
  const prefix = s.k === 'potion' ? (s.plus ? `+${s.n && s.n > 1 ? s.n : ''}` : '') : num !== undefined ? `${s.plus ? '+' : ''}${num}` : '';
  return (
    <span className={'sym-it s-' + s.k} title={label}>
      {prefix && <b>{prefix}</b>}
      {icon}
    </span>
  );
}

export function Symbols({ id, lang }: { id: string; lang: Lang }) {
  const list = cardSymbols(id);
  if (!list.length) return null;
  return (
    <div className="tile-syms">
      {list.map((s, i) => (
        <SymItem key={i} s={s} lang={lang} />
      ))}
    </div>
  );
}
