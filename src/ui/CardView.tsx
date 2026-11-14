import { useRef } from 'react';
import { card } from '../engine/cards';
import type { Lang } from '../engine/types';
import { tr } from '../i18n';
import { cardArt, typeKey } from './art';

/** Stuknięcie i przytrzymanie (podgląd karty). */
export function usePress(onTap?: () => void, onLong?: () => void) {
  const timer = useRef<number | null>(null);
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
      onTap?.();
    },
  };
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
  badge?: React.ReactNode;
}

export function CardFace({ id, lang, className = '', onTap, onLong, badge }: FaceProps) {
  const c = card(id);
  const press = usePress(onTap, onLong);
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
      </div>
      <div className="c-art" dangerouslySetInnerHTML={{ __html: cardArt(c) }} />
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
}

export function PileTile({ id, lang, count, state = '', onTap, onLong }: TileProps) {
  const c = card(id);
  const press = usePress(onTap, onLong);
  return (
    <div className={`tile t-${typeKey(c)} ${state} ${count <= 0 ? 'empty' : ''}`} {...press} role="button" aria-label={c.name[lang]}>
      <div className="tile-art" dangerouslySetInnerHTML={{ __html: cardArt(c) }} />
      <div className="tile-name">{c.name[lang]}</div>
      <Coin n={c.cost} small />
      <span className="tile-count">{count}</span>
    </div>
  );
}
