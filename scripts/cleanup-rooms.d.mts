// Typy dla testów (src/online/cleanup.test.ts) – skrypt jest zwykłym JS dla GitHub Actions.
export const DB: string;
export const ROOM_TTL_MS: number;
export const OLD_TTL_MS: number;
export function deleteReason(room: { act?: unknown; at?: unknown; next?: unknown; cfg?: unknown }, now?: number): string | null;
export function cleanup(opts: { db: string; token: string | null; dryRun: boolean; now?: number; log?: (s: string) => void }): Promise<{ total: number; removed: number }>;
