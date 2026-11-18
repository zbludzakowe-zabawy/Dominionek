import { useRef, useState } from 'react';
import { card } from '../engine/cards';
import type { Lang } from '../engine/types';
import { tr } from '../i18n';
import { cardArt, setSymbol, typeKey } from './art';

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
  const lines: string[] = [];
  if (plus.cards) lines.push(tr(lang, 'plus.cards', { n: plus.cards }));
  if (plus.actions) lines.push(tr(lang, 'plus.actions', { n: plus.actions }));
  if (plus.buys) lines.push(tr(lang, 'plus.buys', { n: plus.buys }));
  if (plus.coins) lines.push(tr(lang, 'plus.coins', { n: plus.coins }));
  const text = c.text[lang];
  return (
    <div className={`card t-${typeKey(c)} ${className}`} {...press} role="button" aria-label={c.name[lang]}>
      <div className="c-head">
        <span className="c-name">{c.name[lang]}</span>
        <SetIcon id={id} className="c-set" />
      </div>
      <Art id={id} className="c-art" />
      <div className="c-body">
        {lines.length > 0 && (
          <div className="c-plus">
            {lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        )}
        {c.coins !== undefined && <div className="c-big"><Coin n={c.coins} /></div>}
        {c.vp !== undefined && <div className={'c-big vp' + (c.vp < 0 ? ' neg' : '')}>{c.vp > 0 ? c.vp : c.vp}<small>{tr(lang, 'vp')}</small></div>}
        {text && <div className={'c-text' + (text.length > 90 ? ' long' : '')}>{text}</div>}
      </div>
      <div className="c-foot">
        <Coin n={c.cost} small />
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
}

export function PileTile({ id, lang, count, state = '', onTap, onLong, onDouble, style }: TileProps) {
  const c = card(id);
  const press = usePress(onTap, onLong, onDouble, !!onDouble);
  return (
    <div className={`tile t-${typeKey(c)} ${state} ${count <= 0 ? 'empty' : ''}`} style={style} {...press} role="button" aria-label={c.name[lang]}>
      <Art id={id} className="tile-art" />
      <SetIcon id={id} className="tile-set" />
      <div className="tile-name">{c.name[lang]}</div>
      <Coin n={c.cost} small />
      <span className="tile-count" title="">{count}</span>
    </div>
  );
}

/** Przycisk z potwierdzeniem w samej stronie (zamiast window.confirm). */
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
    <button className={`played t-${typeKey(c)}` + (n > 1 ? ' stacked' : '')} onClick={onTap} aria-label={`${c.name[lang]} ×${n}`}>
      <Art id={id} className="played-art" />
      <span className="played-name">{c.name[lang]}</span>
      {n > 1 && <span className="played-count">×{n}</span>}
    </button>
  );
}
