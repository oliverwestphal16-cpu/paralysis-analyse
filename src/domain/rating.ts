import { mean } from './stats';
import type { Game, GameRating, RatingCriterion, RatingEntry } from './types';

/** Default criteria. The ids are permanent; names and weights can be changed in the settings. */
export const DEFAULT_CRITERIA: RatingCriterion[] = [
  { id: 'fun', name: 'Spaß', weight: 20 },
  { id: 'again', name: 'Direkt nochmal spielen?', weight: 20 },
  { id: 'theme', name: 'Thema', weight: 20 },
  { id: 'arc', name: 'Spannungsbogen', weight: 15 },
  { id: 'flow', name: 'Spielflow', weight: 15 },
  { id: 'design', name: 'Design', weight: 10 },
];

export function activeCriteria(criteria: RatingCriterion[]): RatingCriterion[] {
  return criteria.filter((c) => !c.archived && c.weight > 0);
}

/** Share of each active criterion in percent (sums to 100). */
export function weightShares(criteria: RatingCriterion[]): Record<string, number> {
  const act = activeCriteria(criteria);
  const sum = act.reduce((a, c) => a + c.weight, 0);
  return Object.fromEntries(act.map((c) => [c.id, sum > 0 ? (c.weight / sum) * 100 : 0]));
}

/**
 * Weighted mean over the active criteria that have a value; criteria without a value
 * are left out and the remaining weights are rescaled. Undefined if nothing applies.
 */
export function weightedScore(values: Record<string, number | undefined>, criteria: RatingCriterion[]): number | undefined {
  let sum = 0;
  let w = 0;
  for (const c of activeCriteria(criteria)) {
    const v = values[c.id];
    if (v === undefined) continue;
    sum += v * c.weight;
    w += c.weight;
  }
  return w > 0 ? sum / w : undefined;
}

export function entryScore(entry: RatingEntry, criteria: RatingCriterion[]): number | undefined {
  return weightedScore(entry.values, criteria);
}

const meanOf = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? mean(v) : undefined;
};

export interface RatingSummary {
  overall?: number;
  /** Mean per criterion id (all criteria that have values, also archived ones). */
  perCriterion: Record<string, number>;
  luck?: number;
  brainy?: number;
  /** Individual mode: overall score per player id. */
  perPlayer: Record<string, number>;
  raters: number;
}

/** Means per criterion over all entries; the overall score is weighted from these means. */
export function summarize(rating: GameRating | undefined, criteria: RatingCriterion[]): RatingSummary | undefined {
  if (!rating || !rating.entries.length) return undefined;
  const ids = new Set(rating.entries.flatMap((e) => Object.keys(e.values)));
  const perCriterion: Record<string, number> = {};
  for (const id of ids) {
    const m = meanOf(rating.entries.map((e) => e.values[id]));
    if (m !== undefined) perCriterion[id] = m;
  }
  const perPlayer: Record<string, number> = {};
  for (const e of rating.entries) {
    const s = entryScore(e, criteria);
    if (e.by && s !== undefined) perPlayer[e.by] = s;
  }
  return {
    overall: weightedScore(perCriterion, criteria),
    perCriterion,
    luck: meanOf(rating.entries.map((e) => e.luck)),
    brainy: meanOf(rating.entries.map((e) => e.brainy)),
    perPlayer,
    raters: rating.entries.length,
  };
}

export interface BoardGameRating {
  title: string;
  ratedGames: number;
  overall?: number;
  perCriterion: Record<string, number>;
  luck?: number;
  brainy?: number;
}

/** Average rating per board game over all rated games (each game counts once). */
export function boardGameRatings(games: Game[], criteria: RatingCriterion[]): Record<string, BoardGameRating> {
  const out: Record<string, BoardGameRating> = {};
  const by = new Map<string, NonNullable<ReturnType<typeof summarize>>[]>();
  for (const g of games) {
    const s = summarize(g.rating, criteria);
    if (!s) continue;
    const t = g.title ?? 'Ohne Namen';
    by.set(t, [...(by.get(t) ?? []), s]);
  }
  for (const [title, list] of by) {
    const ids = new Set(list.flatMap((s) => Object.keys(s.perCriterion)));
    const perCriterion: Record<string, number> = {};
    for (const id of ids) {
      const m = meanOf(list.map((s) => s.perCriterion[id]));
      if (m !== undefined) perCriterion[id] = m;
    }
    out[title] = {
      title,
      ratedGames: list.length,
      overall: meanOf(list.map((s) => s.overall)),
      perCriterion,
      luck: meanOf(list.map((s) => s.luck)),
      brainy: meanOf(list.map((s) => s.brainy)),
    };
  }
  return out;
}

/** A player's favourite board games from their own (individual) ratings. */
export function favoriteGames(games: Game[], criteria: RatingCriterion[], profileId: string, n = 3): { title: string; score: number; games: number }[] {
  const by = new Map<string, number[]>();
  for (const g of games) {
    if (g.rating?.mode !== 'individual') continue;
    const e = g.rating.entries.find((x) => x.by === profileId);
    const s = e && entryScore(e, criteria);
    if (s === undefined) continue;
    const t = g.title ?? 'Ohne Namen';
    by.set(t, [...(by.get(t) ?? []), s]);
  }
  return [...by.entries()]
    .map(([title, xs]) => ({ title, score: mean(xs), games: xs.length }))
    .sort((a, b) => b.score - a.score || b.games - a.games)
    .slice(0, n);
}

/** "7,8" */
export function fmtScore(n: number | undefined): string {
  return n === undefined ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
