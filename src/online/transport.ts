// Magazyn pokoju gry online: proste drzewo JSON (jak Firebase Realtime Database).
// `create` zapisuje tylko, gdy w danym miejscu nic jeszcze nie ma – w Firebase pilnują tego
// reguły bazy (zapis „!data.exists()”), w pamięci (testy) – sam magazyn.

export interface Transport {
  /** Zapisuje wartość, jeśli miejsce jest puste. false = już zajęte albo reguły bazy nie pozwalają. Błąd sieci = wyjątek. */
  create(path: string, value: unknown): Promise<boolean>;
  /** Zapis bez warunku (tylko „obecność” graczy). */
  set(path: string, value: unknown): Promise<void>;
  /** Śledzi poddrzewo: cb dostaje całą jego aktualną zawartość po każdej zmianie. Zwraca funkcję kończącą. */
  listen(path: string, cb: (data: unknown) => void, onState: (s: LinkState) => void): () => void;
}

export type LinkState = 'live' | 'offline' | 'denied' | 'missing';

export class TransportError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'missing' | 'other',
  ) {
    super(message);
  }
}

type Tree = Record<string, unknown>;

const split = (path: string) => path.split('/').filter(Boolean);

export function getAt(tree: unknown, path: string): unknown {
  let cur = tree;
  for (const k of split(path)) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = (cur as Tree)[k];
  }
  return cur === undefined ? null : cur;
}

/** Wstawia wartość w drzewo (null usuwa), zwraca nowy korzeń. */
export function setAt(tree: unknown, path: string, value: unknown): unknown {
  const keys = split(path);
  if (!keys.length) return value;
  const root: Tree = tree && typeof tree === 'object' ? { ...(tree as Tree) } : {};
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i]];
    cur = cur[keys[i]] = next && typeof next === 'object' ? { ...(next as Tree) } : {};
  }
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = value;
  return root;
}

/** Magazyn w pamięci – do testów (kilku „graczy” w jednym procesie). */
export class MemoryStore {
  data: unknown = null;
  private subs = new Set<() => void>();
  /** Opóźnienie powiadomień (symulacja sieci). */
  async = true;

  transport(): Transport {
    return {
      create: async (path, value) => {
        if (getAt(this.data, path) !== null) return false;
        this.data = setAt(this.data, path, JSON.parse(JSON.stringify(value)));
        this.notify();
        return true;
      },
      set: async (path, value) => {
        this.data = setAt(this.data, path, value);
        this.notify();
      },
      listen: (path, cb, onState) => {
        const fire = () => cb(getAt(this.data, path));
        this.subs.add(fire);
        onState('live');
        fire();
        return () => this.subs.delete(fire);
      },
    };
  }

  private notify() {
    const run = () => this.subs.forEach((f) => f());
    if (this.async) queueMicrotask(run);
    else run();
  }
}
