import type { Game, GamePlayer, PauseCategory, Turn } from './types';

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createGame(
  players: GamePlayer[],
  opts: { title?: string; softLimitSec?: number; now: number; id?: string },
): Game {
  if (players.length < 2) throw new Error('Mindestens zwei Spieler');
  return {
    id: opts.id ?? newId(),
    title: opts.title?.trim() || undefined,
    createdAt: opts.now,
    status: 'running',
    players,
    order: players.map((p) => p.id),
    softLimitSec: opts.softLimitSec,
    // The first player in the order starts right away.
    turns: [{ playerId: players[0].id, start: opts.now }],
    pauses: [],
  };
}

export function currentTurn(game: Game): Turn | undefined {
  const last = game.turns[game.turns.length - 1];
  return last && last.end === undefined ? last : undefined;
}

export function activePause(game: Game) {
  const last = game.pauses[game.pauses.length - 1];
  return last && last.end === undefined ? last : undefined;
}

export function isPaused(game: Game): boolean {
  return activePause(game) !== undefined;
}

/** Player who follows `playerId` in the planned order. */
export function nextInOrder(game: Game, playerId: string): string {
  const i = game.order.indexOf(playerId);
  return game.order[(i + 1) % game.order.length];
}

/** Ends the running turn and starts one for `playerId` (default: next in order). */
export function switchTo(game: Game, now: number, playerId?: string): Game {
  const cur = currentTurn(game);
  if (!cur || isPaused(game) || game.status !== 'running') return game;
  const next = playerId ?? nextInOrder(game, cur.playerId);
  if (next === cur.playerId) return game;
  const turns = game.turns.slice(0, -1);
  turns.push({ ...cur, end: now }, { playerId: next, start: now });
  return { ...game, turns };
}

/** Takes back the last switch: the previous turn continues and absorbs the current one. */
export function undoSwitch(game: Game): Game {
  if (game.turns.length < 2 || !currentTurn(game) || isPaused(game)) return game;
  const turns = game.turns.slice(0, -2);
  const prev = game.turns[game.turns.length - 2];
  turns.push({ playerId: prev.playerId, start: prev.start });
  return { ...game, turns };
}

/**
 * Moves the last `seconds` of the running turn to `playerId`, who becomes active.
 * Covers the forgotten tap: "Anna has actually been on since 1:40".
 */
export function rebook(game: Game, now: number, seconds: number, playerId: string): Game {
  const cur = currentTurn(game);
  if (!cur || isPaused(game) || playerId === cur.playerId) return game;
  const splitAt = now - seconds * 1000;
  if (seconds <= 0 || splitAt <= cur.start) return game;
  const turns = game.turns.slice(0, -1);
  turns.push({ ...cur, end: splitAt }, { playerId, start: splitAt });
  return { ...game, turns };
}

export function startPause(game: Game, now: number, category: PauseCategory): Game {
  if (isPaused(game) || !currentTurn(game)) return game;
  return { ...game, pauses: [...game.pauses, { start: now, category }] };
}

export function endPause(game: Game, now: number): Game {
  const p = activePause(game);
  if (!p) return game;
  return { ...game, pauses: [...game.pauses.slice(0, -1), { ...p, end: now }] };
}

export function setOrder(game: Game, order: string[]): Game {
  return { ...game, order };
}

/** Stops the clock and moves on to score entry. */
export function finishGame(game: Game, now: number): Game {
  let g = endPause(game, now);
  const cur = currentTurn(g);
  if (cur) g = { ...g, turns: [...g.turns.slice(0, -1), { ...cur, end: now }] };
  return { ...g, status: 'scoring', endedAt: now };
}

export function setScores(game: Game, scores: Record<string, number> | undefined): Game {
  return { ...game, scores, status: 'finished' };
}
