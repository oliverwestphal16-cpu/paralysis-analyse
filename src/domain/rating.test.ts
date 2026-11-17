import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CRITERIA, boardGameRatings, favoriteGames, summarize, weightShares, weightedScore,
} from './rating';
import type { Game, GameRating, RatingCriterion } from './types';

const C = DEFAULT_CRITERIA;
const all = (v: number) => Object.fromEntries(C.map((c) => [c.id, v]));

function game(id: string, title: string, rating: GameRating): Game {
  return { id, title, createdAt: 0, status: 'finished', players: [], order: [], turns: [], pauses: [], rating };
}

describe('weights and scores', () => {
  it('default weights sum to 100 %', () => {
    expect(Object.values(weightShares(C)).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(weightShares(C).fun).toBe(20);
  });

  it('weights the criteria and leaves out missing ones', () => {
    // fun 10 (20), again 10 (20), theme 4 (20), rest missing → (200+200+80)/60 = 8
    expect(weightedScore({ fun: 10, again: 10, theme: 4 }, C)).toBeCloseTo(8);
    expect(weightedScore({}, C)).toBeUndefined();
  });

  it('ignores archived criteria but keeps their values', () => {
    const crit: RatingCriterion[] = C.map((c) => (c.id === 'theme' ? { ...c, archived: true } : c));
    expect(weightedScore({ fun: 10, theme: 1 }, crit)).toBe(10);
    const s = summarize({ mode: 'table', entries: [{ values: { fun: 10, theme: 1 } }], ratedAt: 0 }, crit)!;
    expect(s.perCriterion.theme).toBe(1);
    expect(s.overall).toBe(10);
  });

  it('renormalises custom weights', () => {
    const crit: RatingCriterion[] = [{ id: 'a', name: 'A', weight: 1 }, { id: 'b', name: 'B', weight: 3 }];
    expect(weightShares(crit)).toEqual({ a: 25, b: 75 });
    expect(weightedScore({ a: 2, b: 6 }, crit)).toBe(5);
  });
});

describe('summaries', () => {
  const individual: GameRating = {
    mode: 'individual',
    ratedAt: 0,
    entries: [
      { by: 'a', values: all(8), luck: 0.2, brainy: 1 },
      { by: 'b', values: { ...all(4), design: 10 }, luck: 0.6 },
    ],
  };

  it('averages per criterion and per player', () => {
    const s = summarize(individual, C)!;
    expect(s.perCriterion.fun).toBe(6);
    expect(s.perCriterion.design).toBe(9);
    expect(s.perPlayer.a).toBe(8);
    expect(s.perPlayer.b).toBeCloseTo(4 * 0.9 + 10 * 0.1);
    expect(s.luck).toBeCloseTo(0.4);
    expect(s.brainy).toBe(1);
    expect(s.raters).toBe(2);
  });

  it('per board game and favourite games', () => {
    const games = [
      game('1', 'X', individual),
      game('2', 'Y', { mode: 'individual', ratedAt: 0, entries: [{ by: 'a', values: all(10) }, { by: 'b', values: all(2) }] }),
      game('3', 'Y', { mode: 'table', ratedAt: 0, entries: [{ values: all(6) }] }),
    ];
    const bg = boardGameRatings(games, C);
    expect(bg.Y.ratedGames).toBe(2);
    expect(bg.Y.overall).toBeCloseTo(6);
    expect(favoriteGames(games, C, 'a').map((f) => f.title)).toEqual(['Y', 'X']);
    expect(favoriteGames(games, C, 'b')[0]).toMatchObject({ title: 'X', games: 1 });
  });
});
