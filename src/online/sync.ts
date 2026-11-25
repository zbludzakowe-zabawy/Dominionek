import { Game } from '../engine/game';
import type { Answer, GameSetup } from '../engine/types';

export const sameAnswer = (a: Answer, b: Answer) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Uzgadnia lokalną grę z ruchami z bazy. Lokalna gra może mieć więcej odpowiedzi (moje, jeszcze
 * niewysłane) – wtedy nic się nie zmienia. Gdy baza ma więcej – dopisujemy brakujące.
 * Gdy coś się nie zgadza (ktoś zdążył zapisać inny ruch) – gra jest odtwarzana z bazy.
 * Zwraca grę (tę samą albo nową) i czy coś się zmieniło; `broken` = ruchów z bazy nie da się odtworzyć.
 */
export function reconcile(game: Game, setup: GameSetup, remote: Answer[]): { game: Game; changed: boolean; broken: boolean } {
  const local = game.answers;
  const n = Math.min(local.length, remote.length);
  let diverged = false;
  for (let i = 0; i < n; i++) {
    if (!sameAnswer(local[i], remote[i])) {
      diverged = true;
      break;
    }
  }
  if (!diverged && remote.length <= local.length) return { game, changed: false, broken: false };
  if (!diverged) {
    try {
      for (let i = local.length; i < remote.length; i++) game.submit(remote[i]);
      return { game, changed: true, broken: false };
    } catch {
      /* odtwórz od nowa niżej */
    }
  }
  const g = new Game(setup);
  for (const a of remote) {
    if (!g.pending) return { game: g, changed: true, broken: true };
    try {
      g.submit(a);
    } catch {
      return { game: g, changed: true, broken: true };
    }
  }
  return { game: g, changed: true, broken: false };
}
