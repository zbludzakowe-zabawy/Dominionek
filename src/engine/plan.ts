// Planowanie trudnego bota: na starcie gry rozgrywa w pamięci szybkie partie
// próbne różnych planów zakupów przeciwko średniemu botowi i wybiera najlepszy.
import { isType } from './card';
import { card } from './cards';
import { decide, type Plan } from './bot';
import { Game } from './game';
import { Rng } from './rng';

const isTerminal = (id: string) => isType(card(id), 'action') && !((card(id).plus?.actions ?? 0) > 0);

function candidates(kingdom: string[]): Plan[] {
  const acts = kingdom.filter((id) => isType(card(id), 'action'));
  const out: Plan[] = [{ want: [] }];
  for (const id of acts) {
    out.push({ want: [[id, 1]] });
    out.push({ want: [[id, isTerminal(id) ? 2 : 4]] });
  }
  return out;
}

function combos(best: Plan[], kingdom: string[]): Plan[] {
  const out: Plan[] = [];
  const singles = best.filter((p) => p.want.length === 1).map((p) => p.want[0]);
  for (let i = 0; i < singles.length; i++) {
    for (let j = 0; j < singles.length; j++) {
      const [a, na] = singles[i];
      const [b, nb] = singles[j];
      if (a === b) continue;
      if (isTerminal(a) && isTerminal(b)) {
        if (i < j) out.push({ want: [[a, 1], [b, 1]] });
        continue;
      }
      out.push({ want: [[a, na], [b, nb]] });
    }
  }
  // wioska + karta dobierania
  const villages = kingdom.filter((id) => (card(id).plus?.actions ?? 0) >= 2);
  const draws = kingdom.filter((id) => isTerminal(id) && (card(id).plus?.cards ?? 0) >= 2 || card(id).ai.role === 'draw');
  for (const v of villages) for (const d of draws) out.push({ want: [[d, 2], [v, 2], [d, 3], [v, 3]] });
  return out;
}

function evaluate(kingdom: string[], plan: Plan, games: number, rng: Rng): number {
  let score = 0;
  for (let k = 0; k < games; k++) {
    const seed = rng.int(2 ** 31);
    const me = k % 2;
    const g = new Game({
      seed,
      kingdom,
      players: [0, 1].map((i) => ({ name: `S${i}`, bot: i === me ? 'hard' : 'medium' })),
    });
    let steps = 0;
    while (g.pending && steps++ < 6000) {
      const d = g.pending;
      const mine = d.player === me;
      g.submit(decide(g, d, mine ? 'hard' : 'medium', () => rng.next(), mine ? plan : undefined));
    }
    const s = g.scores();
    const a = s.find((x) => x.player === me)!;
    const b = s.find((x) => x.player !== me)!;
    // wygrana + premia za różnicę punktów (rozstrzyga remisy w ocenie)
    score += (a.rank < b.rank ? 1 : a.rank === b.rank ? 0.5 : 0) + (a.vp - b.vp) / 200;
  }
  return score / games;
}

const cache = new Map<string, Plan>();

/** Najlepszy plan dla danego Królestwa. Deterministyczny dla tego samego ziarna. */
export function makePlan(kingdom: string[], seed: number): Plan {
  const key = `${seed}:${[...kingdom].sort().join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = new Rng(seed ^ 0x51ed27);
  const first = candidates(kingdom)
    .map((plan) => ({ plan, v: evaluate(kingdom, plan, 8, rng) }))
    .sort((a, b) => b.v - a.v);
  const top = first.slice(0, 4).map((x) => x.plan);
  const second = [...top, ...combos(top, kingdom)]
    .map((plan) => ({ plan, v: evaluate(kingdom, plan, 16, rng) }))
    .sort((a, b) => b.v - a.v);
  const finalists = second.slice(0, 3).map((x) => x.plan);
  const best = finalists
    .map((plan) => ({ plan, v: evaluate(kingdom, plan, 30, rng) }))
    .sort((a, b) => b.v - a.v)[0].plan;
  cache.set(key, best);
  return best;
}
