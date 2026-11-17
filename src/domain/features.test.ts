import { describe, expect, it } from 'vitest';
import { awards } from './awards';
import { boardGameStats, crossStats, leaderboard } from './crossStats';
import {
  adjustRound, createGame, currentPrep, discardSetup, endPause, finishGame, setPauseCategory, setScores,
  startPause, startPlay, startRules, switchTo, undoSwitch,
} from './game';
import {
  pauseSummary, phaseBounds, phaseOf, phaseWindow, playerStats, prepTimes, radarAxes, efficiency, roundDurations,
  roundNumbers, topTurns, turnRecords,
} from './stats';
import type { Game, GamePlayer, Profile } from './types';

const P = (id: string): GamePlayer => ({ id, name: id, avatar: 'knight', color: '#fff' });
const T0 = 1_000_000;
const s = (sec: number) => T0 + sec * 1000;

/** Plays turns with the given durations (seconds) in order a, b, c, a, b, c, ... */
function play(durations: number[], ids = ['a', 'b', 'c']): Game {
  let g = createGame(ids.map(P), { now: T0, id: 'x' });
  let t = 0;
  durations.forEach((d, i) => {
    t += d;
    if (i < durations.length - 1) g = switchTo(g, s(t));
  });
  return finishGame(g, s(t));
}

describe('preparation', () => {
  it('runs setup, rules, then starts with the chosen player and rotates the order', () => {
    let g = createGame([P('a'), P('b'), P('c')], { now: T0, prep: true });
    expect(g.status).toBe('prep');
    expect(currentPrep(g)?.kind).toBe('setup');
    g = startPause(g, s(60), 'food');
    g = endPause(g, s(90));
    g = startRules(g, s(300));
    g = startPlay(g, s(500), 'b');
    expect(g.status).toBe('running');
    expect(g.order).toEqual(['b', 'c', 'a']);
    expect(g.turns).toEqual([{ playerId: 'b', start: s(500) }]);
    expect(prepTimes(g, s(600))).toEqual({ setup: 270_000, rules: 200_000, start: T0 });
    // Prep is nobody's turn time.
    expect(turnRecords(g, s(510))[0].net).toBe(10_000);
  });

  it('can skip the rules and discard the setup', () => {
    let g = createGame([P('a'), P('b')], { now: T0, prep: true });
    g = startPlay(g, s(100), 'a');
    expect(prepTimes(g, s(200))).toEqual({ setup: 100_000, start: T0 });
    let h = createGame([P('a'), P('b')], { now: T0, prep: true });
    h = discardSetup(h);
    h = startPlay(h, s(5), 'a');
    expect(prepTimes(h, s(10))).toEqual({});
  });

  it('pauses default to "other" and can change their kind', () => {
    let g = createGame([P('a'), P('b')], { now: T0 });
    g = startPause(g, s(5));
    expect(g.pauses[0].category).toBe('other');
    g = setPauseCategory(g, 'food');
    g = endPause(g, s(65));
    expect(pauseSummary(g, s(70)).byCategory.food).toBe(60_000);
  });
});

describe('rounds', () => {
  it('counts a new round once everybody has moved', () => {
    let g = createGame([P('a'), P('b'), P('c')], { now: T0 });
    g = switchTo(g, s(1)); // b
    g = switchTo(g, s(2), 'a'); // extra turn for a before c
    g = switchTo(g, s(3), 'c');
    g = switchTo(g, s(4), 'a');
    g = switchTo(g, s(5), 'b');
    expect(roundNumbers(g)).toEqual([1, 1, 1, 1, 2, 2]);
  });

  it('applies manual corrections from their turn on and drops them on undo', () => {
    let g = play([1, 1, 1, 1, 1]);
    g = { ...g, status: 'running', turns: [...g.turns.slice(0, -1), { ...g.turns[4], end: undefined }] };
    g = adjustRound(g, 1);
    expect(roundNumbers(g)).toEqual([1, 1, 1, 2, 3]);
    expect(roundNumbers(undoSwitch(g))).toEqual([1, 1, 1, 2]);
  });

  it('round durations skip an incomplete last round', () => {
    expect(roundDurations(play([10, 20, 30, 1, 2, 3, 5]), s(100))).toEqual([60_000, 6_000]);
  });
});

describe('phases', () => {
  it('splits by turn count 25/50/25', () => {
    expect(phaseBounds(48)).toEqual({ earlyEnd: 12, lateStart: 36 });
    expect([0, 11, 12, 35, 36, 47].map((i) => phaseOf(i, 48))).toEqual(['early', 'early', 'mid', 'mid', 'late', 'late']);
  });

  it('filters player stats by phase but keeps the real predecessor for foresight', () => {
    // 8 turns: early = 0..1, mid = 2..5, late = 6..7
    const g = play([10, 20, 30, 40, 50, 60, 70, 80]);
    const mid = playerStats(g, s(1000), 1, 'mid');
    const c = mid.find((x) => x.id === 'c')!;
    expect(c.raw).toBe(30_000 + 60_000);
    // turn 2 (c) follows turn 1 (b, early, 20s); turn 5 (c) follows 50s
    expect(c.foresight).toBe(70_000);
    expect(topTurns(g, s(1000), 1, 'early')[0].net).toBe(20_000);
    expect(phaseWindow(g, s(1000), 'late')).toEqual({ start: s(210), end: s(360) });
    const eff = efficiency(setScores(g, { a: 1, b: 2, c: 3 }), mid);
    expect(radarAxes(setScores(g, { a: 1, b: 2, c: 3 }), mid, eff, false)).toHaveLength(4);
  });
});

describe('awards', () => {
  it('awards titles, shares ties and skips "Schnecke" with two players', () => {
    // a: 10, 10, 10, 10 / b: 20, 20, 20, 60
    const g = play([10, 20, 10, 20, 10, 20, 10, 60], ['a', 'b']);
    const keys = Object.fromEntries(awards(g, s(1000), 0).map((x) => [x.key, x.playerIds]));
    expect(keys.brooder).toEqual(['b']);
    expect(keys.flash).toEqual(['a']);
    expect(keys.snail).toBeUndefined();
    expect(keys.clockwork).toEqual(['a']);
    expect(keys.late).toEqual(['b']);
    expect(keys.thinker).toBeUndefined();
    const tie = play([10, 10, 10, 10], ['a', 'b']);
    expect(awards(tie, s(100), 0).find((x) => x.key === 'flash')!.playerIds).toEqual(['a', 'b']);
  });
});

describe('leaderboard and board game stats', () => {
  const profiles: Profile[] = ['a', 'b', 'c'].map((id) => ({ id, name: id, avatar: 'knight', color: '#fff', createdAt: 0 }));
  const g1 = { ...play([10, 20, 30, 10, 20, 30]), id: 'g1', title: 'X' };
  const g2 = { ...play([10, 20, 30, 10, 20, 30]), id: 'g2', title: 'X' };
  const g3 = { ...setScores(play([10, 20, 30]), { a: 1, b: 1, c: 1 }), id: 'g3', title: 'Y', prep: [{ kind: 'setup' as const, start: T0 - 600_000, end: T0 }] };

  it('ranks by pace and puts players with fewer than 3 games below the line', () => {
    const rows = leaderboard([g1, g2, g3], profiles, 'pace');
    expect(rows.map((r) => [r.profile.id, r.provisional])).toEqual([['a', false], ['b', false], ['c', false]]);
    const two = leaderboard([g1, g2], profiles, 'pace');
    expect(two.every((r) => r.provisional)).toBe(true);
    expect(crossStats([g1, g2, g3], 'a').meanEfficiency).toBeCloseTo((1 / 3) / (10 / 60));
  });

  it('averages preparation per board game', () => {
    const bg = boardGameStats([g1, g2, g3]);
    expect(bg.map((b) => [b.title, b.games, b.meanSetup])).toEqual([['X', 2, undefined], ['Y', 1, 600_000]]);
  });
});
