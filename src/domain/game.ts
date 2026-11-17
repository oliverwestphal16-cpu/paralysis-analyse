import type { Game, GamePlayer, PauseCategory, Turn } from './types';

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Creates a game. With `prep` the clock starts with the setup phase and the first turn
 * begins via `startPlay`; without it the first player in the order starts right away.
 */
export function createGame(
  players: GamePlayer[],
  opts: { title?: string; softLimitSec?: number; now: number; id?: string; prep?: boolean },
): Game {
  if (players.length < 2) throw new Error('Mindestens zwei Spieler');
  const base = {
    id: opts.id ?? newId(),
    title: opts.title?.trim() || undefined,
    createdAt: opts.now,
    players,
    order: players.map((p) => p.id),
    softLimitSec: opts.softLimitSec,
    pauses: [],
  };
  return opts.prep
    ? { ...base, status: 'prep', turns: [], prep: [{ kind: 'setup', start: opts.now }] }
    : { ...base, status: 'running', turns: [{ playerId: players[0].id, start: opts.now }] };
}

export function currentTurn(game: Game): Turn | undefined {
  const last = game.turns[game.turns.length - 1];
  return last && last.end === undefined ? last : undefined;
}

export function currentPrep(game: Game) {
  const last = game.prep?.[game.prep.length - 1];
  return game.status === 'prep' && last && last.end === undefined ? last : undefined;
}

export function activePause(game: Game) {
  const last = game.pauses[game.pauses.length - 1];
  return last && last.end === undefined ? last : undefined;
}

export function isPaused(game: Game): boolean {
  return activePause(game) !== undefined;
}

/** Ends the setup phase and starts the rules explanation. */
export function startRules(game: Game, now: number): Game {
  const cur = currentPrep(game);
  if (!cur || cur.kind !== 'setup' || isPaused(game)) return game;
  return { ...game, prep: [...game.prep!.slice(0, -1), { ...cur, end: now }, { kind: 'rules', start: now }] };
}

/** Drops the running setup measurement (game was already set up). */
export function discardSetup(game: Game): Game {
  const cur = currentPrep(game);
  if (!cur || cur.kind !== 'setup' || game.prep!.length !== 1) return game;
  return { ...game, prep: [], pauses: [] };
}

/** Ends the preparation; `startPlayerId` begins and the order rotates to start with them. */
export function startPlay(game: Game, now: number, startPlayerId: string): Game {
  if (game.status !== 'prep' || isPaused(game)) return game;
  const cur = currentPrep(game);
  const prep = cur ? [...game.prep!.slice(0, -1), { ...cur, end: now }] : game.prep;
  const i = game.order.indexOf(startPlayerId);
  const order = i < 0 ? game.order : [...game.order.slice(i), ...game.order.slice(0, i)];
  return { ...game, status: 'running', prep, order, turns: [{ playerId: order[0], start: now }] };
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
  // Round corrections made on the removed turn are dropped with it.
  const roundAdjust = game.roundAdjust?.filter((a) => a.fromTurn < turns.length);
  return { ...game, turns, roundAdjust };
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

/** Stops the clock immediately; the kind of pause can be changed while it runs. */
export function startPause(game: Game, now: number, category: PauseCategory = 'other'): Game {
  if (isPaused(game)) return game;
  if (!currentTurn(game) && !currentPrep(game)) return game;
  return { ...game, pauses: [...game.pauses, { start: now, category }] };
}

export function setPauseCategory(game: Game, category: PauseCategory): Game {
  const p = activePause(game);
  if (!p || p.category === category) return game;
  return { ...game, pauses: [...game.pauses.slice(0, -1), { ...p, category }] };
}

export function endPause(game: Game, now: number): Game {
  const p = activePause(game);
  if (!p) return game;
  return { ...game, pauses: [...game.pauses.slice(0, -1), { ...p, end: now }] };
}

/** Manual round correction (+1 / -1) from the running turn on. */
export function adjustRound(game: Game, delta: number): Game {
  if (!currentTurn(game)) return game;
  return { ...game, roundAdjust: [...(game.roundAdjust ?? []), { fromTurn: game.turns.length - 1, delta }] };
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
