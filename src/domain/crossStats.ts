import { mean, playerStats, ranking, turnRecords } from './stats';
import type { Game } from './types';

export interface PlayerGameEntry {
  gameId: string;
  date: number;
  title?: string;
  /** Own mean turn / mean turn of the table in that game; 1 = table average. */
  paceRatio: number;
  meanTurn: number;
  totalTime: number;
  fastest: boolean;
  wonOnPoints: boolean;
}

export interface CrossStats {
  games: number;
  meanTurn: number;
  meanPaceRatio: number;
  fastestCount: number;
  winsOnPoints: number;
  entries: PlayerGameEntry[];
}

/** Statistics for one profile across all finished games (optionally only one board game). */
export function crossStats(games: Game[], profileId: string, title?: string): CrossStats {
  const entries: PlayerGameEntry[] = [];
  const relevant = games
    .filter((g) => g.status !== 'running' && g.players.some((p) => p.id === profileId))
    .filter((g) => !title || (g.title ?? '') === title)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const g of relevant) {
    const now = g.endedAt ?? g.createdAt;
    const stats = playerStats(g, now, 0);
    const me = stats.find((s) => s.id === profileId);
    if (!me || me.turns === 0) continue;
    const tableMean = mean(turnRecords(g, now).map((r) => r.net));
    const best = g.scores ? Math.max(...g.players.map((p) => g.scores![p.id] ?? -Infinity)) : undefined;
    entries.push({
      gameId: g.id,
      date: g.createdAt,
      title: g.title,
      paceRatio: tableMean > 0 ? me.mean / tableMean : 1,
      meanTurn: me.mean,
      totalTime: me.raw,
      fastest: ranking(stats)[0]?.id === profileId,
      wonOnPoints: best !== undefined && g.scores?.[profileId] === best,
    });
  }

  return {
    games: entries.length,
    meanTurn: mean(entries.map((e) => e.meanTurn)),
    meanPaceRatio: mean(entries.map((e) => e.paceRatio)),
    fastestCount: entries.filter((e) => e.fastest).length,
    winsOnPoints: entries.filter((e) => e.wonOnPoints).length,
    entries,
  };
}
