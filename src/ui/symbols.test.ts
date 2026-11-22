import { describe, expect, it } from 'vitest';
import { CARDS } from '../engine/cards';
import { EXTRA, cardSymbols } from './symbols';

describe('symbole kart', () => {
  it('każda karta Królestwa ma opisane symbole', () => {
    const missing = Object.values(CARDS)
      .filter((c) => c.set !== 'basic' && !(c.id in EXTRA))
      .map((c) => c.id);
    expect(missing).toEqual([]);
  });
  it('przykłady', () => {
    expect(cardSymbols('inn')).toEqual([
      { k: 'card', n: 1, plus: true },
      { k: 'act', n: 2, plus: true },
    ]);
    expect(cardSymbols('hedgewitch').map((s) => s.k)).toEqual(['act', 'trash']);
    expect(cardSymbols('magnumopus')).toEqual([{ k: 'vp', n: 2, plus: true }, { k: 'more' }]);
  });
});
