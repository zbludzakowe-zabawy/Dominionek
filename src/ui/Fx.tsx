// Animacje zmian, które dzieją się bez stuknięcia gracza:
// - zdobyta/kupiona karta leci ze stosu do gracza (boty, inni gracze online; moje zakupy – do talii),
// - moje karty z efektów (dobrane, włożone na rękę, zdobyte, spalone) pokazują się po kolei w okienku,
//   a potem lecą tam, gdzie trafiły (ręka, talia) albo – spalone – przechylają się i wpadają do kosza.
// Silnik zapisuje zdarzenia w `Game.fx`; tu czytamy tylko nowe (po każdej zmianie gry).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Game } from '../engine/game';
import type { Fx, Lang } from '../engine/types';
import { tr } from '../i18n';
import { CardFace } from './CardView';
import type { Speed } from './store';

type PopKind = 'draw' | 'put' | 'gain' | 'gainHand' | 'gainDeck' | 'trash';
type Dest = 'hand' | 'deck' | 'trash';
interface Pop {
  key: number;
  kind: PopKind;
  cards: string[];
  dest: Dest;
}
interface Fly {
  key: number;
  id: string;
  from: DOMRect;
  to: DOMRect;
  /** Selektor celu (do podświetlenia po locie). */
  target: string;
  delay: number;
}

const SCALE: Record<Speed, number> = { slow: 1.35, normal: 1, fast: 0.6 };
/** Odstęp między kolejnymi kartami w okienku i czas pokazania. */
const STAGGER = 220;
const HOLD = 750;
const OUT = 480;
const FLY = 1000;

const popOf = (f: Fx): Omit<Pop, 'key'> | null => {
  if (f.k === 'hand') return { kind: f.how, cards: f.cards, dest: 'hand' };
  if (f.k === 'trash') return { kind: 'trash', cards: f.cards, dest: 'trash' };
  if (f.bought) return null;
  if (f.to === 'hand') return { kind: 'gainHand', cards: [f.card], dest: 'hand' };
  return { kind: f.to === 'deck' ? 'gainDeck' : 'gain', cards: [f.card], dest: 'deck' };
};

const rectOf = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
const visible = (r: DOMRect | null): r is DOMRect => !!r && r.width > 0 && r.height > 0;

export function useCardFx(opts: { game: Game; human: number; enabled: boolean; speed: Speed; ff: boolean; lang: Lang }) {
  const { game, human, enabled, ff, lang } = opts;
  const k = SCALE[opts.speed];
  const seen = useRef({ game, n: game.fx.length });
  const [queue, setQueue] = useState<Pop[]>([]);
  const [flies, setFlies] = useState<Fly[]>([]);
  const keyGen = useRef(1);

  // nowe zdarzenia po każdym odświeżeniu planszy
  useEffect(() => {
    if (seen.current.game !== game) {
      // gra odtworzona od nowa (cofnięcie, wczytanie z bazy) – bez animacji tego, co już było
      seen.current = { game, n: game.fx.length };
      setQueue([]);
      return;
    }
    const fresh = game.fx.slice(seen.current.n);
    seen.current.n = game.fx.length;
    if (!fresh.length || !enabled) return;

    const pops: Pop[] = [];
    const newFlies: Fly[] = [];
    let flyDelay = 0;
    for (const f of fresh) {
      if (f.p === human) {
        const p = popOf(f);
        if (p) {
          const last = pops[pops.length - 1];
          if (last && last.kind === p.kind) last.cards = [...last.cards, ...p.cards];
          else pops.push({ ...p, key: keyGen.current++ });
          continue;
        }
      }
      // zdobyta karta leci ze stosu do gracza
      if (f.k !== 'gain' || ff) continue;
      const from = rectOf(`[data-pile="${f.card}"]`);
      const target = f.p === human ? '.deck-pill' : `.opp[data-p="${f.p}"]`;
      const to = rectOf(target);
      if (!visible(from) || !visible(to)) continue;
      newFlies.push({ key: keyGen.current++, id: f.card, from, to, target, delay: flyDelay });
      flyDelay += 250 * k;
    }
    if (pops.length) setQueue((q) => [...q, ...pops]);
    if (newFlies.length) setFlies((fl) => [...fl, ...newFlies]);
  });

  const done = (key: number) => setQueue((q) => q.filter((p) => p.key !== key));
  const current = queue[0] ?? null;
  /** Karty, które są już na ręce, ale jeszcze „lecą” w okienku – ręka pokaże je po animacji. */
  const hidden = queue.filter((p) => p.dest === 'hand').flatMap((p) => p.cards);

  const layer = (
    <>
      {flies.map((f) => (
        <FlyCard key={f.key} fly={f} lang={lang} dur={FLY * k} onEnd={() => setFlies((fl) => fl.filter((x) => x.key !== f.key))} />
      ))}
      {current && <PopSheet key={current.key} pop={current} lang={lang} k={k} onDone={() => done(current.key)} onSkip={() => setQueue([])} />}
    </>
  );
  return { hidden, busy: queue.length > 0, flying: flies.length > 0, layer };
}

function FlyCard({ fly, lang, dur, onEnd }: { fly: Fly; lang: Lang; dur: number; onEnd: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = Math.max(54, Math.min(90, fly.from.width));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.animate) return onEnd();
    const x0 = fly.from.left + fly.from.width / 2 - w / 2;
    const y0 = fly.from.top + fly.from.height / 2 - (w * 1.48) / 2;
    const dx = fly.to.left + fly.to.width / 2 - (x0 + w / 2);
    const dy = fly.to.top + fly.to.height / 2 - (y0 + (w * 1.48) / 2);
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    const a = el.animate(
      [
        { transform: 'translate(0,0) scale(.8)', opacity: 0, easing: 'ease-out' },
        { transform: 'translate(0,-10px) scale(1.1)', opacity: 1, offset: 0.18 },
        { transform: 'translate(0,-10px) scale(1.1)', opacity: 1, offset: 0.35, easing: 'cubic-bezier(.5,0,.4,1)' },
        { transform: `translate(${dx}px,${dy}px) scale(.45)`, opacity: 1, offset: 0.9 },
        { transform: `translate(${dx}px,${dy}px) scale(.35)`, opacity: 0 },
      ],
      { duration: dur, delay: fly.delay, fill: 'both' },
    );
    a.onfinish = () => {
      // gracz, do którego trafiła karta, na chwilę się podświetla
      document.querySelector(fly.target)?.animate?.(
        [{ boxShadow: '0 0 0 0 rgba(216,185,104,0)' }, { boxShadow: '0 0 0 3px rgba(216,185,104,.9)' }, { boxShadow: '0 0 0 0 rgba(216,185,104,0)' }],
        { duration: 500 },
      );
      onEnd();
    };
    a.oncancel = onEnd;
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="fx-fly" style={{ width: w }} aria-hidden="true">
      <CardFace id={fly.id} lang={lang} />
    </div>
  );
}

function PopSheet({ pop, lang, k, onDone, onSkip }: { pop: Pop; lang: Lang; k: number; onDone: () => void; onSkip: () => void }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const bin = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);
  const n = pop.cards.length;

  useEffect(() => {
    const id = window.setTimeout(() => setOut(true), (n * STAGGER + HOLD) * k);
    return () => window.clearTimeout(id);
  }, [n, k]);

  useEffect(() => {
    if (!out) return;
    const target =
      pop.dest === 'trash' ? bin.current?.getBoundingClientRect() ?? null : pop.dest === 'hand' ? rectOf('.hand-area .hand') : rectOf('.deck-pill');
    const anims: Animation[] = [];
    refs.current.forEach((el, i) => {
      if (!el || !el.animate) return;
      const r = el.getBoundingClientRect();
      const tx = target ? target.left + target.width / 2 - (r.left + r.width / 2) : 0;
      const ty = target ? target.top + target.height / 2 - (r.top + r.height / 2) : 200;
      const frames =
        pop.dest === 'trash'
          ? [
              { transform: 'none', opacity: 1 },
              { transform: `translate(${tx * 0.15}px, -14px) rotate(${i % 2 ? 14 : -14}deg)`, opacity: 1, offset: 0.3 },
              { transform: `translate(${tx}px, ${ty}px) rotate(${i % 2 ? 40 : -40}deg) scale(.25)`, opacity: 0 },
            ]
          : [
              { transform: 'none', opacity: 1 },
              { transform: `translate(${tx}px, ${ty}px) scale(.45)`, opacity: 0.2 },
            ];
      anims.push(el.animate(frames, { duration: OUT * k * (pop.dest === 'trash' ? 1.4 : 1), delay: i * 60 * k, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }));
    });
    if (pop.dest === 'trash' && bin.current?.animate)
      anims.push(bin.current.animate([{ transform: 'none' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(6deg)' }, { transform: 'none' }], { duration: 300, delay: OUT * k * 1.1 }));
    const total = (pop.dest === 'trash' ? OUT * 1.4 + 200 : OUT) * k + n * 60 * k;
    const id = window.setTimeout(onDone, total);
    return () => {
      window.clearTimeout(id);
      anims.forEach((a) => a.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out]);

  return (
    <div className={'fx-backdrop' + (out ? ' out' : '')} onClick={onSkip} role="presentation">
      <div className="fx-pop" style={{ ['--fx-k' as string]: k }}>
        <div className="fx-title">{tr(lang, `fx.${pop.kind}`, { n })}</div>
        <div className={'fx-cards n' + Math.min(n, 6)}>
          {pop.cards.map((id, i) => (
            <div
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="fx-card"
              style={{ animationDelay: `${i * STAGGER * k}ms` }}
            >
              <CardFace id={id} lang={lang} />
            </div>
          ))}
        </div>
        {pop.dest === 'trash' && (
          <div ref={bin} className="fx-bin" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 14h28M19 14v-4h10v4M13 14l2 26h18l2-26M20 20v14M28 20v14" />
            </svg>
          </div>
        )}
        <div className="fx-skip muted small">{tr(lang, 'fx.tapToSkip')}</div>
      </div>
    </div>
  );
}
