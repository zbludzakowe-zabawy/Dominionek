import { useRef, useState } from 'react';
import type { Lang } from '../engine/types';
import { tr } from '../i18n';

/** Stały adres opublikowanej gry (nie location.href – podgląd działa pod innym adresem). */
export const SHARE_URL = 'https://zbludzakowe-zabawy.github.io/Dominionek/';

/** Mała otwarta książka – ikona dziennika (inna niż ☰ menu). */
export function LogIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5C17 4.6 14 5 12 6.5z" />
      <path d="M12 6.5v13" />
      <path d="M6 8.6c1.5-.1 2.9.2 4 .8M6 11.6c1.5-.1 2.9.2 4 .8M14 9.4c1.1-.6 2.5-.9 4-.8M14 12.4c1.1-.6 2.5-.9 4-.8" strokeWidth="1.2" />
    </svg>
  );
}

/** Trzy połączone kropki – ikona udostępniania. */
export function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M18 5 6 12l12 7" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="18" cy="5" r="3.2" fill="currentColor" />
      <circle cx="6" cy="12" r="3.2" fill="currentColor" />
      <circle cx="18" cy="19" r="3.2" fill="currentColor" />
    </svg>
  );
}

/** Dyskretny przycisk „Udostępnij grę”: okno systemowe → schowek → komunikat z adresem. */
export function ShareButton({ lang }: { lang: Lang }) {
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const [msg, setMsg] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const toast = (text: string, ms: number) => {
    setMsg(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), ms);
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('appName'), text: t('shareText'), url: SHARE_URL });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      toast(t('shareCopied'), 3500);
    } catch {
      toast(t('shareAddress', { url: SHARE_URL }), 6000);
    }
  };
  return (
    <>
      <button className="share-btn" onClick={share} aria-label={t('shareApp')} title={t('shareApp')}>
        <ShareIcon />
      </button>
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </>
  );
}
