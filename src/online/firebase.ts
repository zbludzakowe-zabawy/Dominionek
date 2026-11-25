// Firebase Realtime Database przez REST, bez SDK:
// zapis = PUT `<baza>/<ścieżka>.json`, śledzenie zmian = strumień zdarzeń (EventSource).
// Reguły bazy (firebase/database.rules.json) pozwalają zapisać ruch tylko w puste miejsce,
// więc odmowa zapisu (401/403) oznacza „miejsce zajęte”.
import { TransportError, setAt, type Transport } from './transport';

export function normalizeDb(url: string): string {
  let u = url.trim();
  if (!u) return '';
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '').replace(/\.json$/, '');
}

export function firebaseTransport(db: string): Transport {
  const base = normalizeDb(db);
  const url = (path: string) => `${base}/${path.replace(/^\/+/, '')}.json`;

  const put = async (path: string, value: unknown): Promise<Response> => {
    try {
      return await fetch(url(path) + '?print=silent', { method: 'PUT', body: JSON.stringify(value) });
    } catch (e) {
      throw new TransportError(String(e), 'network');
    }
  };

  const check = (r: Response) => {
    if (r.status === 404) throw new TransportError('Brak bazy pod tym adresem', 'missing');
    if (!r.ok && r.status !== 204) throw new TransportError(`HTTP ${r.status}`, r.status >= 500 ? 'network' : 'other');
  };

  return {
    async create(path, value) {
      const r = await put(path, value);
      if (r.status === 401 || r.status === 403) return false;
      check(r);
      return true;
    },
    async remove(path) {
      const r = await put(path, null);
      if (r.status === 401 || r.status === 403) return false;
      check(r);
      return true;
    },
    async set(path, value) {
      check(await put(path, value));
    },
    listen(path, cb, onState) {
      let tree: unknown = null;
      let closed = false;
      if (typeof EventSource === 'undefined') {
        // awaryjnie: odpytywanie co 3 s
        const poll = async () => {
          if (closed) return;
          try {
            const r = await fetch(url(path));
            if (r.status === 401 || r.status === 403) onState('denied');
            else if (r.status === 404) onState('missing');
            else if (r.ok) {
              onState('live');
              cb(await r.json());
            }
          } catch {
            onState('offline');
          }
          if (!closed) setTimeout(poll, 3000);
        };
        poll();
        return () => {
          closed = true;
        };
      }
      let es: EventSource | null = null;
      const onData = (patch: boolean) => (ev: MessageEvent) => {
        try {
          const { path: p, data } = JSON.parse(ev.data) as { path: string; data: unknown };
          if (patch && data && typeof data === 'object') {
            for (const [k, v] of Object.entries(data)) tree = setAt(tree, `${p}/${k}`, v);
          } else tree = setAt(tree, p, data);
          onState('live');
          cb(tree);
        } catch {
          /* uszkodzone zdarzenie – pomijamy */
        }
      };
      const open = () => {
        if (closed) return;
        const src = (es = new EventSource(url(path)));
        src.addEventListener('put', onData(false) as EventListener);
        src.addEventListener('patch', onData(true) as EventListener);
        src.addEventListener('keep-alive', () => onState('live'));
        src.addEventListener('cancel', () => onState('denied'));
        src.onopen = () => onState('live');
        src.onerror = async () => {
          if (closed) return;
          if (src.readyState !== EventSource.CLOSED) return onState('offline'); // połączy się samo
          // serwer odmówił (np. 404 – zły adres bazy, 401 – reguły) albo zerwał – sprawdzamy i próbujemy znowu
          try {
            const r = await fetch(url(path) + '?shallow=true');
            onState(r.status === 404 ? 'missing' : r.status === 401 || r.status === 403 ? 'denied' : 'offline');
          } catch {
            onState('offline');
          }
          setTimeout(open, 4000);
        };
      };
      open();
      return () => {
        closed = true;
        es?.close();
      };
    },
  };
}
