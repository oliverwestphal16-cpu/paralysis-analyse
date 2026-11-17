import { efficiency, mean, phaseOf, playerStats, turnRecords } from './stats';
import type { Game } from './types';

export interface Award {
  key: string;
  title: string;
  description: string;
  /** Several ids on a tie. */
  playerIds: string[];
  value: number;
  format: 'time' | 'percent' | 'index';
}

const EPS = 1e-9;

/** Ids with the best value; `better(a, b)` is true when a beats b. */
function best(values: Record<string, number>, higher: boolean): { ids: string[]; value: number } | undefined {
  const entries = Object.entries(values).filter(([, v]) => Number.isFinite(v));
  if (!entries.length) return undefined;
  const value = higher ? Math.max(...entries.map(([, v]) => v)) : Math.min(...entries.map(([, v]) => v));
  return { ids: entries.filter(([, v]) => Math.abs(v - value) < EPS).map(([id]) => id), value };
}

/** Fun titles for the whole game. All are awarded; ties share a title. */
export function awards(game: Game, now: number, factor: number): Award[] {
  const stats = playerStats(game, now, factor).filter((s) => s.turns > 0);
  if (stats.length < 2) return [];
  const out: Award[] = [];
  const push = (
    key: string, title: string, description: string, values: Record<string, number>, higher: boolean, format: Award['format'],
  ) => {
    const b = best(values, higher);
    if (b) out.push({ key, title, description, playerIds: b.ids, value: b.value, format });
  };
  const by = (f: (s: (typeof stats)[number]) => number) => Object.fromEntries(stats.map((s) => [s.id, f(s)]));

  push('brooder', 'Grübelkönig', 'längster Einzelzug', by((s) => s.max), true, 'time');
  push('flash', 'Blitz', 'kürzeste Ø Zugdauer', by((s) => s.mean), false, 'time');
  if (stats.length > 2) push('snail', 'Schnecke', 'längste Ø Zugdauer', by((s) => s.mean), true, 'time');
  push('clockwork', 'Uhrwerk', 'gleichmäßigste Zugdauern', by((s) => s.cv), false, 'percent');

  // Change of the mean turn from early to late game, relative to early.
  const recs = turnRecords(game, now);
  const trend: Record<string, number> = {};
  for (const s of stats) {
    const mine = recs.filter((r) => r.playerId === s.id);
    const early = mine.filter((r) => phaseOf(r.index, recs.length) === 'early').map((r) => r.net);
    const late = mine.filter((r) => phaseOf(r.index, recs.length) === 'late').map((r) => r.net);
    if (early.length && late.length && mean(early) > 0) trend[s.id] = mean(late) / mean(early) - 1;
  }
  if (Object.keys(trend).length === stats.length) {
    const slow = best(trend, true);
    if (slow && slow.value > 0) out.push({ key: 'late', title: 'Spätzünder', description: 'am stärksten verlangsamt vom Early zum Late Game', playerIds: slow.ids, value: slow.value, format: 'percent' });
    const fast = best(trend, false);
    if (fast && fast.value < 0) out.push({ key: 'turbo', title: 'Turbo-Finish', description: 'am stärksten beschleunigt vom Early zum Late Game', playerIds: fast.ids, value: -fast.value, format: 'percent' });
  }

  if (game.scores) {
    const eff = efficiency(game, stats);
    if (eff.every((e) => e.relativeIndex !== null)) {
      push('efficiency', 'Effizienzwunder', 'höchster Effizienz-Index', Object.fromEntries(eff.map((e) => [e.id, e.relativeIndex!])), true, 'index');
    }
  }
  if (factor > 0) {
    push('thinker', 'Vordenker', 'größter Anteil angerechneter Vorausdenkzeit', by((s) => (s.adjusted > 0 ? (factor * s.foresight) / s.adjusted : 0)), true, 'percent');
  }
  return out;
}
