import { describe, expect, it } from 'vitest';
import { createGame, endPause, finishGame, setScores, startPause, switchTo } from './game';
import {
  efficiency,
  median,
  normalize,
  pauseSummary,
  playerStats,
  radarAxes,
  raceSeries,
  ranking,
  stdDev,
  topTurns,
  turnRecords,
} from './stats';
import { crossStats } from './crossStats';
import type { Game, GamePlayer } from './types';

const P = (id: string): GamePlayer => ({ id, name: id, avatar: 'knight', color: '#fff' });
const T0 = 1_000_000;
const s = (sec: number) => T0 + sec * 1000;

/** a: 60s, b: 30s, a: 20s, b: 10s → a=80s, b=40s */
function sample(): Game {
  let g = createGame([P('a'), P('b')], { now: T0, id: 'g1' });
  g = switchTo(g, s(60));
  g = switchTo(g, s(90));
  g = switchTo(g, s(110));
  return finishGame(g, s(120));
}

describe('turn records', () => {
  it('subtracts pauses from the turn they fall into', () => {
    let g = createGame([P('a'), P('b')], { now: T0 });
    g = startPause(g, s(10), 'rules');
    g = endPause(g, s(25));
    g = switchTo(g, s(40));
    g = finishGame(g, s(50));
    const r = turnRecords(g, s(50));
    expect(r[0].net).toBe(25_000);
    expect(r[1].net).toBe(10_000);
    expect(pauseSummary(g, s(50))).toEqual({ total: 15_000, count: 1, byCategory: { rules: 15_000, other: 0 } });
  });

  it('counts a running turn and running pause up to now', () => {
    let g = createGame([P('a'), P('b')], { now: T0 });
    g = startPause(g, s(10), 'other');
    expect(turnRecords(g, s(30))[0].net).toBe(10_000);
  });

  it('foresight = previous turn of another player; none for first turn or repeat turns', () => {
    let g = createGame([P('a'), P('b')], { now: T0 });
    g = switchTo(g, s(60)); // a 60
    g = switchTo(g, s(90)); // b 30
    g = switchTo(g, s(100), 'b'); // a 10, then b again
    g = finishGame(g, s(105)); // b 5
    const r = turnRecords(g, s(105));
    expect(r.map((x) => x.foresight)).toEqual([0, 60_000, 30_000, 10_000]);
    let h = createGame([P('a'), P('b')], { now: T0 });
    h = switchTo(h, s(10), 'b');
    // Direct repeat is impossible via switchTo; build it by hand.
    h = { ...h, turns: [...h.turns.slice(0, -1), { playerId: 'b', start: s(10), end: s(20) }, { playerId: 'b', start: s(20), end: s(30) }] };
    expect(turnRecords(h, s(30)).map((x) => x.foresight)).toEqual([0, 10_000, 0]);
  });
});

describe('player stats', () => {
  it('sums raw and adjusted time additively', () => {
    const g = sample();
    const [a, b] = playerStats(g, s(120), 0.5);
    expect(a.raw).toBe(80_000);
    expect(b.raw).toBe(40_000);
    // a: turn 3 follows b's 30s → foresight 30s; b: follows 60s and 20s → 80s
    expect(a.foresight).toBe(30_000);
    expect(b.foresight).toBe(80_000);
    expect(a.adjusted).toBe(95_000);
    expect(b.adjusted).toBe(80_000);
    expect(ranking([a, b]).map((x) => x.id)).toEqual(['b', 'a']);
    expect(a.max).toBe(60_000);
    expect(a.min).toBe(20_000);
    expect(a.mean).toBe(40_000);
  });

  it('ranks players without turns last', () => {
    let g = createGame([P('a'), P('b'), P('c')], { now: T0 });
    g = switchTo(g, s(10));
    g = finishGame(g, s(15));
    expect(ranking(playerStats(g, s(15), 0)).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('factor 0 equals raw', () => {
    const [a] = playerStats(sample(), s(120), 0);
    expect(a.adjusted).toBe(a.raw);
  });

  it('median and std', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});

describe('efficiency', () => {
  it('computes points per minute and relative index', () => {
    const g = setScores(sample(), { a: 30, b: 10 });
    const st = playerStats(g, s(120), 0);
    const [ea, eb] = efficiency(g, st);
    expect(ea.pointsPerMinute).toBeCloseTo(30 / (80 / 60));
    // a: 75% of points, 66.7% of time → 1.125
    expect(ea.relativeIndex).toBeCloseTo(0.75 / (80 / 120));
    expect(eb.relativeIndex).toBeCloseTo(0.25 / (40 / 120));
  });

  it('relative index is null when the table total is not positive', () => {
    const g = setScores(sample(), { a: 5, b: -5 });
    const e = efficiency(g, playerStats(g, s(120), 0));
    expect(e.every((x) => x.relativeIndex === null)).toBe(true);
    expect(e[1].pointsPerMinute).toBeCloseTo(-5 / (40 / 60));
  });

  it('everything is null without scores', () => {
    const g = setScores(sample(), undefined);
    expect(efficiency(g, playerStats(g, s(120), 0))[0]).toEqual({ id: 'a', pointsPerMinute: null, relativeIndex: null });
  });
});

describe('radar', () => {
  it('normalizes so that best = 1 and worst = 0.2', () => {
    expect(normalize({ a: 10, b: 20, c: 15 }, false)).toEqual({ a: 1, b: 0.2, c: 0.6000000000000001 });
    expect(normalize({ a: 3, b: 3 }, true)).toEqual({ a: 1, b: 1 });
  });

  it('has 4 axes without scores and 6 with', () => {
    const g = sample();
    const st = playerStats(g, s(120), 0);
    expect(radarAxes(g, st, efficiency(g, st))).toHaveLength(4);
    const gs = setScores(g, { a: 3, b: 1 });
    expect(radarAxes(gs, st, efficiency(gs, st)).map((x) => x.key)).toEqual([
      'tempo', 'avg', 'steady', 'outlier', 'points', 'eff',
    ]);
  });
});

describe('lists and series', () => {
  it('top turns and race series', () => {
    const g = sample();
    expect(topTurns(g, s(120), 2).map((t) => t.net)).toEqual([60_000, 30_000]);
    expect(raceSeries(g, s(120))).toEqual({
      a: [60_000, 60_000, 80_000, 80_000],
      b: [0, 30_000, 30_000, 40_000],
    });
  });
});

describe('cross stats', () => {
  it('aggregates per profile and filters by title', () => {
    const g1 = { ...setScores(sample(), { a: 30, b: 10 }), title: 'X' };
    const g2 = { ...setScores(sample(), { a: 1, b: 2 }), id: 'g2', title: 'Y' };
    const c = crossStats([g1, g2], 'b');
    expect(c.games).toBe(2);
    expect(c.fastestCount).toBe(2);
    expect(c.winsOnPoints).toBe(1);
    // b mean 20s vs table mean 30s
    expect(c.meanPaceRatio).toBeCloseTo(20 / 30);
    expect(crossStats([g1, g2], 'b', 'Y').games).toBe(1);
  });
});
