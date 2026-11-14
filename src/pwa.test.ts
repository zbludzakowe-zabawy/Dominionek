import { describe, expect, it } from 'vitest';
import { installMode } from './pwa';

const base = { standalone: false, dismissed: false, hasPrompt: false, maxTouchPoints: 0 };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

describe('installMode', () => {
  it('Android/komputer z oknem instalacji', () => expect(installMode({ ...base, hasPrompt: true, userAgent: 'Android' })).toBe('prompt'));
  it('iPhone Safari', () => expect(installMode({ ...base, userAgent: IPHONE })).toBe('ios'));
  it('iPadOS udający Maca', () =>
    expect(installMode({ ...base, maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605' })).toBe('ios'));
  it('Chrome na iOS', () => expect(installMode({ ...base, userAgent: IPHONE.replace('Version', 'CriOS/120 Version') })).toBe('none'));
  it('już zainstalowana', () => expect(installMode({ ...base, standalone: true, hasPrompt: true, userAgent: IPHONE })).toBe('none'));
  it('zamknięty baner', () => expect(installMode({ ...base, dismissed: true, userAgent: IPHONE })).toBe('none'));
});
