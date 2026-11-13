import type { Game, PauseCategory } from './types';

/** Length of the overlap of [a0,a1) and [b0,b1) in ms. */
export function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/** Pause time inside [from, to). Running items count up to `now`. */
export function pauseMsIn(game: Game, from: number, to: number, now: number): number {
  let sum = 0;
  for (const p of game.pauses) sum += overlap(from, to, p.start, p.end ?? now);
  return sum;
}

export interface TurnRecord {
  index: number;
  playerId: string;
  start: number;
  end: number;
  /** Thinking time without pauses. */
  net: number;
  /** Net time of the turn directly before, if it was another player's; else 0. */
  foresight: number;
  /** Number of this turn for its player (1-based). */
  playerTurnNo: number;
}

export function turnRecords(game: Game, now: number): TurnRecord[] {
  const perPlayer: Record<string, number> = {};
  const out: TurnRecord[] = [];
  game.turns.forEach((t, i) => {
    const end = t.end ?? now;
    const net = Math.max(0, end - t.start - pauseMsIn(game, t.start, end, now));
    const prev = out[i - 1];
    perPlayer[t.playerId] = (perPlayer[t.playerId] ?? 0) + 1;
    out.push({
      index: i,
      playerId: t.playerId,
      start: t.start,
      end,
      net,
      // Only the turn actually played directly before counts, and only if it was someone else's.
      foresight: prev && prev.playerId !== t.playerId ? prev.net : 0,
      playerTurnNo: perPlayer[t.playerId],
    });
  });
  return out;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Population standard deviation. */
export function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface PlayerStats {
  id: string;
  turns: number;
  durations: number[];
  raw: number;
  foresight: number;
  /** raw + factor * foresight */
  adjusted: number;
  mean: number;
  adjustedMean: number;
  median: number;
  min: number;
  max: number;
  std: number;
  /** Coefficient of variation (std / mean); lower = steadier. */
  cv: number;
}

export function playerStats(game: Game, now: number, factor: number): PlayerStats[] {
  const recs = turnRecords(game, now);
  return game.players.map((p) => {
    const mine = recs.filter((r) => r.playerId === p.id);
    const durations = mine.map((r) => r.net);
    const raw = durations.reduce((a, b) => a + b, 0);
    const foresight = mine.reduce((a, r) => a + r.foresight, 0);
    const adjusted = raw + factor * foresight;
    const m = mean(durations);
    const sd = stdDev(durations);
    return {
      id: p.id,
      turns: mine.length,
      durations,
      raw,
      foresight,
      adjusted,
      mean: m,
      adjustedMean: mine.length ? adjusted / mine.length : 0,
      median: median(durations),
      min: durations.length ? Math.min(...durations) : 0,
      max: durations.length ? Math.max(...durations) : 0,
      std: sd,
      cv: m > 0 ? sd / m : 0,
    };
  });
}

/** Players sorted by adjusted total time, fastest first; players without a single turn go last. */
export function ranking(stats: PlayerStats[]): PlayerStats[] {
  return [...stats].sort((a, b) => Number(a.turns === 0) - Number(b.turns === 0) || a.adjusted - b.adjusted);
}

export interface Efficiency {
  id: string;
  score?: number;
  /** Points per minute of (adjusted) own time; null if not computable. */
  pointsPerMinute: number | null;
  /** (share of points) / (share of time); > 1 = more efficient than the table. */
  relativeIndex: number | null;
}

export function efficiency(game: Game, stats: PlayerStats[]): Efficiency[] {
  const scores = game.scores;
  const sumScore = scores ? stats.reduce((a, s) => a + (scores[s.id] ?? 0), 0) : 0;
  const sumTime = stats.reduce((a, s) => a + s.adjusted, 0);
  return stats.map((s) => {
    const score = scores?.[s.id];
    if (score === undefined) return { id: s.id, pointsPerMinute: null, relativeIndex: null };
    const minutes = s.adjusted / 60000;
    return {
      id: s.id,
      score,
      pointsPerMinute: minutes > 0 ? score / minutes : null,
      // Shares are meaningless when the table total is zero or negative.
      relativeIndex:
        sumScore > 0 && sumTime > 0 && s.adjusted > 0
          ? score / sumScore / (s.adjusted / sumTime)
          : null,
    };
  });
}

export interface RadarAxis {
  key: string;
  label: string;
  /** Raw value per player id (for tooltips). */
  raw: Record<string, number>;
  /** Normalized 0.2..1 per player id, 1 = best at the table. */
  norm: Record<string, number>;
  format: 'time' | 'percent' | 'number' | 'index';
}

/** Min-max normalisation to [0.2, 1] so that the worst player still has a visible area. */
export function normalize(values: Record<string, number>, higherIsBetter: boolean): Record<string, number> {
  const vs = Object.values(values);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(values)) {
    if (hi === lo) out[id] = 1;
    else {
      const t = (v - lo) / (hi - lo);
      out[id] = 0.2 + 0.8 * (higherIsBetter ? t : 1 - t);
    }
  }
  return out;
}

export function radarAxes(game: Game, stats: PlayerStats[], eff: Efficiency[]): RadarAxis[] {
  const by = (f: (s: PlayerStats) => number) => Object.fromEntries(stats.map((s) => [s.id, f(s)]));
  const axes: RadarAxis[] = [];
  const add = (key: string, label: string, raw: Record<string, number>, higher: boolean, format: RadarAxis['format']) =>
    axes.push({ key, label, raw, norm: normalize(raw, higher), format });

  add('tempo', 'Tempo', by((s) => s.adjusted), false, 'time');
  add('avg', 'Durchschnittszug', by((s) => s.adjustedMean), false, 'time');
  add('steady', 'Konstanz', by((s) => s.cv), false, 'percent');
  add('outlier', 'Kein Grübel-Ausreißer', by((s) => s.max), false, 'time');
  if (game.scores) {
    add('points', 'Punkte', Object.fromEntries(stats.map((s) => [s.id, game.scores![s.id] ?? 0])), true, 'number');
    const idx = eff.filter((e) => e.relativeIndex !== null);
    if (idx.length === stats.length) {
      add('eff', 'Effizienz', Object.fromEntries(idx.map((e) => [e.id, e.relativeIndex!])), true, 'index');
    }
  }
  return axes;
}

export interface PauseSummary {
  total: number;
  count: number;
  byCategory: Record<PauseCategory, number>;
}

export function pauseSummary(game: Game, now: number): PauseSummary {
  const byCategory: Record<PauseCategory, number> = { rules: 0, other: 0 };
  let total = 0;
  for (const p of game.pauses) {
    const d = (p.end ?? now) - p.start;
    byCategory[p.category] += d;
    total += d;
  }
  return { total, count: game.pauses.length, byCategory };
}

export function topTurns(game: Game, now: number, n: number): TurnRecord[] {
  return [...turnRecords(game, now)].sort((a, b) => b.net - a.net).slice(0, n);
}

/** Cumulative raw time per player after each turn of the game (x = global turn number). */
export function raceSeries(game: Game, now: number): Record<string, number[]> {
  const acc: Record<string, number> = Object.fromEntries(game.players.map((p) => [p.id, 0]));
  const out: Record<string, number[]> = Object.fromEntries(game.players.map((p) => [p.id, []]));
  for (const r of turnRecords(game, now)) {
    acc[r.playerId] += r.net;
    for (const p of game.players) out[p.id].push(acc[p.id]);
  }
  return out;
}

/** Wall-clock span of the game. */
export function gameSpan(game: Game, now: number): { start: number; end: number } {
  const start = game.turns[0]?.start ?? game.createdAt;
  return { start, end: game.endedAt ?? now };
}
