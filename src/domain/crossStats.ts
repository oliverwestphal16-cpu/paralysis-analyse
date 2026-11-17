import { efficiency, mean, playerStats, prepTimes, ranking, turnRecords, gameSpan } from './stats';
import type { Game, Profile } from './types';

export interface PlayerGameEntry {
  gameId: string;
  date: number;
  title?: string;
  /** Own mean turn / mean turn of the table in that game; 1 = table average. */
  paceRatio: number;
  meanTurn: number;
  totalTime: number;
  /** Relative efficiency index; undefined without (usable) scores. */
  efficiency?: number;
  fastest: boolean;
  wonOnPoints: boolean;
}

export interface CrossStats {
  games: number;
  meanTurn: number;
  meanPaceRatio: number;
  /** Mean efficiency over games with scores; undefined if there are none. */
  meanEfficiency?: number;
  fastestCount: number;
  winsOnPoints: number;
  entries: PlayerGameEntry[];
}

/** Games that are over (scores entered or pending). */
export function closedGames(games: Game[], title?: string): Game[] {
  return games
    .filter((g) => g.status === 'scoring' || g.status === 'finished')
    .filter((g) => !title || (g.title ?? '') === title)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Statistics for one profile across all finished games (optionally only one board game). */
export function crossStats(games: Game[], profileId: string, title?: string): CrossStats {
  const entries: PlayerGameEntry[] = [];
  for (const g of closedGames(games, title).filter((x) => x.players.some((p) => p.id === profileId))) {
    const now = g.endedAt ?? g.createdAt;
    const stats = playerStats(g, now, 0);
    const me = stats.find((s) => s.id === profileId);
    if (!me || me.turns === 0) continue;
    const tableMean = mean(turnRecords(g, now).map((r) => r.net));
    const best = g.scores ? Math.max(...g.players.map((p) => g.scores![p.id] ?? -Infinity)) : undefined;
    const eff = efficiency(g, stats).find((e) => e.id === profileId)?.relativeIndex;
    entries.push({
      gameId: g.id,
      date: g.createdAt,
      title: g.title,
      paceRatio: tableMean > 0 ? me.mean / tableMean : 1,
      meanTurn: me.mean,
      totalTime: me.raw,
      efficiency: eff ?? undefined,
      fastest: ranking(stats)[0]?.id === profileId,
      wonOnPoints: best !== undefined && g.scores?.[profileId] === best,
    });
  }
  const effs = entries.map((e) => e.efficiency).filter((e): e is number => e !== undefined);
  return {
    games: entries.length,
    meanTurn: mean(entries.map((e) => e.meanTurn)),
    meanPaceRatio: mean(entries.map((e) => e.paceRatio)),
    meanEfficiency: effs.length ? mean(effs) : undefined,
    fastestCount: entries.filter((e) => e.fastest).length,
    winsOnPoints: entries.filter((e) => e.wonOnPoints).length,
    entries,
  };
}

export type LeaderboardSort = 'pace' | 'meanTurn' | 'efficiency';

export const MIN_GAMES_FOR_RANK = 3;

export interface LeaderboardRow {
  profile: Profile;
  stats: CrossStats;
  /** Below the line: fewer than MIN_GAMES_FOR_RANK games. */
  provisional: boolean;
}

/** All profiles with at least one game, ranked; provisional players come after the line. */
export function leaderboard(games: Game[], profiles: Profile[], sort: LeaderboardSort, title?: string): LeaderboardRow[] {
  const key = (r: LeaderboardRow) =>
    sort === 'pace' ? r.stats.meanPaceRatio
      : sort === 'meanTurn' ? r.stats.meanTurn
        // Higher efficiency is better; players without scores go last.
        : -(r.stats.meanEfficiency ?? -Infinity);
  return profiles
    .map((profile) => {
      const stats = crossStats(games, profile.id, title);
      return { profile, stats, provisional: stats.games < MIN_GAMES_FOR_RANK };
    })
    .filter((r) => r.stats.games > 0)
    .sort((a, b) => Number(a.provisional) - Number(b.provisional) || key(a) - key(b));
}

export interface BoardGameStats {
  title: string;
  games: number;
  meanSetup?: number;
  meanRules?: number;
  meanPlay: number;
}

/** Per board game: average preparation and play duration. */
export function boardGameStats(games: Game[]): BoardGameStats[] {
  const byTitle = new Map<string, Game[]>();
  for (const g of closedGames(games)) {
    const t = g.title ?? 'Ohne Namen';
    byTitle.set(t, [...(byTitle.get(t) ?? []), g]);
  }
  return [...byTitle.entries()]
    .map(([title, gs]) => {
      const preps = gs.map((g) => prepTimes(g, g.endedAt ?? g.createdAt));
      const setups = preps.map((p) => p.setup).filter((x): x is number => x !== undefined);
      const rules = preps.map((p) => p.rules).filter((x): x is number => x !== undefined);
      return {
        title,
        games: gs.length,
        meanSetup: setups.length ? mean(setups) : undefined,
        meanRules: rules.length ? mean(rules) : undefined,
        meanPlay: mean(gs.map((g) => { const s = gameSpan(g, g.endedAt ?? g.createdAt); return s.end - s.start; })),
      };
    })
    .sort((a, b) => b.games - a.games || a.title.localeCompare(b.title));
}
