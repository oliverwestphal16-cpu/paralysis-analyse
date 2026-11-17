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

export type PauseCategory = 'rules' | 'food' | 'other';

export type PrepKind = 'setup' | 'rules';

/** Time before the first turn (setup, rules explanation); belongs to nobody. */
export interface PrepPhase {
  kind: PrepKind;
  start: number;
  end?: number;
}

/** Manual round correction: from turn `fromTurn` on, the round number shifts by `delta`. */
export interface RoundAdjust {
  fromTurn: number;
  delta: number;
}

/** A pause belongs to nobody; its time is removed from the turn it overlaps. */
export interface Pause {
  start: number;
  end?: number;
  category: PauseCategory;
}

/** prep = setup/rules before the first turn; photos are stored in their own table. */
export type GameStatus = 'prep' | 'running' | 'scoring' | 'finished';

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
  /** Missing on games recorded before the preparation phase existed. */
  prep?: PrepPhase[];
  roundAdjust?: RoundAdjust[];
  /** Final scores by player id; undefined = not entered (yet). */
  scores?: Record<string, number>;
  rating?: GameRating;
}

/** A weighted rating criterion; the id never changes, renaming only changes `name`. */
export interface RatingCriterion {
  id: string;
  name: string;
  /** Relative weight; normalised to 100 % over all active criteria. */
  weight: number;
  archived?: boolean;
}

/** One filled-in rating: by one player, or by the whole table (`by` undefined). */
export interface RatingEntry {
  by?: string;
  /** criterion id → 1..10 (half stars); missing = not rated. */
  values: Record<string, number>;
  /** 0 = luck, 0.5 = tactics, 1 = strategy; descriptive only. */
  luck?: number;
  /** 0 = relaxed, 1 = brain-burner; descriptive only. */
  brainy?: number;
}

export interface GameRating {
  mode: 'table' | 'individual';
  entries: RatingEntry[];
  ratedAt: number;
}

/** Photo of a game, stored separately so game lists stay small. */
export interface GamePhoto {
  id: string;
  gameId: string;
  createdAt: number;
  blob: Blob;
  /** Taken from inside the app (not yet in the device gallery). */
  fromCamera: boolean;
}
