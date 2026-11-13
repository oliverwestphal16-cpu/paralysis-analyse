/** Saved player profile, reused across games. */
export interface Profile {
  id: string;
  name: string;
  /** Id of a built-in meeple avatar. */
  avatar: string;
  /** Optional photo as a small JPEG data URL; shown instead of the meeple. */
  photo?: string;
  color: string;
  createdAt: number;
}

/** Snapshot of a profile at game start, so later profile edits do not rewrite history. */
export interface GamePlayer {
  id: string; // = profile id
  name: string;
  avatar: string;
  photo?: string;
  color: string;
}

/** One turn. `end` is undefined while the turn is running. Times are epoch ms. */
export interface Turn {
  playerId: string;
  start: number;
  end?: number;
}

export type PauseCategory = 'rules' | 'other';

/** A pause belongs to nobody; its time is removed from the turn it overlaps. */
export interface Pause {
  start: number;
  end?: number;
  category: PauseCategory;
}

export type GameStatus = 'running' | 'scoring' | 'finished';

export interface Game {
  id: string;
  title?: string;
  createdAt: number;
  endedAt?: number;
  status: GameStatus;
  players: GamePlayer[];
  /** Planned order (player ids); only decides the default next player. */
  order: string[];
  /** Soft limit per turn in seconds; undefined = off. */
  softLimitSec?: number;
  turns: Turn[];
  pauses: Pause[];
  /** Final scores by player id; undefined = not entered (yet). */
  scores?: Record<string, number>;
}
