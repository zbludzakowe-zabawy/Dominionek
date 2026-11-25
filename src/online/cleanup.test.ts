import { describe, expect, it } from 'vitest';
import { DB, OLD_TTL_MS as S_OLD, ROOM_TTL_MS as S_TTL, deleteReason } from '../../scripts/cleanup-rooms.mjs';
import rules from '../../firebase/database.rules.json';
import { ONLINE_DB } from './config';
import { OLD_TTL_MS, ROOM_TTL_MS } from './room';

const day = 24 * 3600 * 1000;
const now = Date.UTC(2026, 10, 25);

describe('cotygodniowe sprzątanie pokoi (scripts/cleanup-rooms.mjs)', () => {
  it('te same czasy i ta sama baza co w aplikacji i regułach', () => {
    expect(S_TTL).toBe(ROOM_TTL_MS);
    expect(S_OLD).toBe(OLD_TTL_MS);
    expect(DB).toBe(ONLINE_DB.replace(/\/+$/, ''));
    const write = (rules as { rules: { rooms: { $room: { '.write': string } } } }).rules.rooms.$room['.write'];
    expect(write).toContain(`now - ${ROOM_TTL_MS}`);
    expect(write).toContain(`now - ${OLD_TTL_MS}`);
    expect(write).toContain(`data.child('end').exists()`);
  });

  it('usuwa pokoje bez gry przez 14 dni, po rewanżu i po poddaniu po 2 dniach, puste', () => {
    expect(deleteReason({ cfg: '{}', at: now - 20 * day, act: now - 15 * day }, now)).toMatch(/15 dni/);
    expect(deleteReason({ cfg: '{}', at: now - 20 * day, act: now - 3 * day }, now)).toBeNull(); // gra trwa
    expect(deleteReason({ cfg: '{}', at: now - 15 * day }, now)).toMatch(/bez gry/); // stary pokój bez act
    expect(deleteReason({ cfg: '{}', at: now - day, act: now - 3 * day, next: 'X' }, now)).toMatch(/rewanż/);
    expect(deleteReason({ cfg: '{}', act: now - day, next: 'X' }, now)).toBeNull();
    expect(deleteReason({ cfg: '{}', at: now - 5 * day, act: now - 3 * day, end: 0 }, now)).toMatch(/poddana/);
    expect(deleteReason({ cfg: '{}', act: now - day, end: 1 }, now)).toBeNull();
    expect(deleteReason({}, now)).toBe('pusty');
    expect(deleteReason({ cfg: '{}' }, now)).toBeNull(); // nie wiadomo, ile ma lat – zostaje
  });
});
