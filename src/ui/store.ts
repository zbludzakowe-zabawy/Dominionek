// Zapis ustawień i bieżącej gry w localStorage (wszystko w try/catch).
import type { SetId } from '../engine/card';
import type { Plan } from '../engine/bot';
import type { Answer, BotLevel, GameSetup, Lang } from '../engine/types';

export type Speed = 'slow' | 'normal' | 'fast';

export interface Settings {
  lang: Lang;
  name: string;
  speed: Speed;
  /** Automatycznie kończ turę, gdy gracz nie może już nic sensownego zrobić. */
  autoEnd: boolean;
  /** Pasek fazy zwinięty do jednej linijki; null = automatycznie (zwinięty przy telefonie poziomo). */
  barCollapsed: boolean | null;
  /** Wygląd stosów Królestwa: obraz (domyślnie) albo symbole działania karty. */
  pileView: 'art' | 'symbols';
  bots: BotLevel[];
  sets: SetId[];
  mode: 'random' | 'manual';
}

export interface SavedGame {
  /** 2: silnik pyta o koniec tury także przy 0 zakupach (starsze zapisy nie pasują). */
  v: 2;
  setup: GameSetup;
  answers: Answer[];
  plans: Record<number, Plan>;
  /**
   * Wersja działania kart, z którą zaczęto partię. Po zmianie działania kart stare partie z nimi
   * nie odtworzą się poprawnie, więc ich nie wczytujemy. 1: przegląd Skarbca, 2: przegląd Wieży, 3: Homunkulus za 2.
   */
  hoardRev?: number;
}

export const CARDS_REV = 3;
/** Karty, które zmieniły działanie w danej wersji. */
const CHANGED_IN: Record<number, string[]> = {
  1: ['clerk', 'gildedscale', 'ancientcoin', 'altar', 'map', 'hoardkey'],
  2: ['retort', 'homunculus', 'alembic', 'magnumopus'],
  3: ['homunculus'],
};

const SETTINGS_KEY = 'crownforge-settings';
const SAVE_KEY = 'crownforge-save';

const defaultLang = (): Lang => {
  try {
    return navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  } catch {
    return 'en';
  }
};

export function loadSettings(): Settings {
  const base: Settings = { lang: defaultLang(), name: '', speed: 'normal', autoEnd: true, barCollapsed: null, pileView: 'art', bots: ['medium'], sets: ['keep'], mode: 'random' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch {
    /* brak dostępu */
  }
  return base;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* trudno */
  }
}

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedGame;
    if (s.v !== 2) return null;
    const rev = s.hoardRev ?? 0;
    for (let r = rev + 1; r <= CARDS_REV; r++) {
      if (s.setup.kingdom.some((id) => CHANGED_IN[r]?.includes(id))) return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveGame(s: SavedGame | null): void {
  try {
    if (s) localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* trudno */
  }
}
