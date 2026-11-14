// Aplikacja na telefon (PWA): baner instalacji i komunikat „Dostępna nowa wersja”.

export type InstallMode = 'prompt' | 'ios' | 'none';

export function installMode(o: {
  standalone: boolean;
  dismissed: boolean;
  hasPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): InstallMode {
  if (o.standalone || o.dismissed) return 'none';
  if (o.hasPrompt) return 'prompt';
  // iPhone/iPad: Safari nie pokazuje okna instalacji. iPadOS udaje Maca – zdradza go ekran dotykowy.
  const ua = o.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && o.maxTouchPoints > 1);
  const iosSafari = ios && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return iosSafari ? 'ios' : 'none';
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

const DISMISS_KEY = 'crownforge-install-dismissed';

export function initPwa(): void {
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const installBanner = $('install-banner');
  const updateBanner = $('update-banner');
  if (!installBanner || !updateBanner) return;
  let deferred: BeforeInstallPromptEvent | null = null;

  const loadDismissed = () => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  };
  const standalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

  const refreshInstall = () => {
    const mode = installMode({
      standalone: standalone(),
      dismissed: loadDismissed(),
      hasPrompt: !!deferred,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    });
    installBanner.hidden = mode === 'none';
    installBanner.dataset.mode = mode;
  };

  // teksty banerów w języku aplikacji
  const applyLang = () => {
    const pl = document.documentElement.lang === 'pl';
    document.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => {
      el.innerHTML = (pl ? el.dataset.pl : el.dataset.en) ?? '';
    });
  };
  new MutationObserver(applyLang).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  applyLang();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    refreshInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installBanner.hidden = true;
  });
  $('btn-install').addEventListener('click', async () => {
    if (!deferred) return;
    const ev = deferred;
    deferred = null;
    installBanner.hidden = true;
    await ev.prompt();
    await ev.userChoice.catch(() => undefined);
  });
  $('btn-install-close').addEventListener('click', () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* trudno */
    }
    installBanner.hidden = true;
  });
  refreshInstall();

  // Service worker tylko w buildzie produkcyjnym (w `vite dev` psułby HMR).
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let waiting: ServiceWorker | null = null;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading && waiting) {
      reloading = true;
      location.reload();
    }
  });
  $('btn-update').addEventListener('click', () => {
    updateBanner.hidden = true;
    waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
  $('btn-update-later').addEventListener('click', () => {
    updateBanner.hidden = true;
  });
  const offerUpdate = (w: ServiceWorker) => {
    waiting = w;
    updateBanner.hidden = false;
  };

  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const hasController = () => !!navigator.serviceWorker.controller;
      if (reg.waiting && hasController()) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && hasController()) offerUpdate(w);
        });
      });
      const check = () => reg.update().catch(() => undefined);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 60 * 60 * 1000);
    })
    .catch(() => undefined);
}
