import { describe, expect, it } from 'vitest';
import {
  createGame,
  currentTurn,
  endPause,
  finishGame,
  rebook,
  setOrder,
  startPause,
  switchTo,
  undoSwitch,
} from './game';
import type { GamePlayer } from './types';

const P = (id: string): GamePlayer => ({ id, name: id, avatar: 'knight', color: '#fff' });
const players = [P('a'), P('b'), P('c')];
const T0 = 1_000_000;
const s = (sec: number) => T0 + sec * 1000;

describe('game flow', () => {
  it('starts with the first player and rotates by order', () => {
    let g = createGame(players, { now: T0, id: 'g' });
    expect(currentTurn(g)?.playerId).toBe('a');
    g = switchTo(g, s(10));
    g = switchTo(g, s(20));
    g = switchTo(g, s(30));
    expect(g.turns.map((t) => t.playerId)).toEqual(['a', 'b', 'c', 'a']);
    expect(g.turns[0]).toEqual({ playerId: 'a', start: T0, end: s(10) });
  });

  it('allows choosing any next player and follows a changed order', () => {
    let g = createGame(players, { now: T0 });
    g = switchTo(g, s(5), 'c');
    expect(currentTurn(g)?.playerId).toBe('c');
    g = setOrder(g, ['c', 'b', 'a']);
    g = switchTo(g, s(10));
    expect(currentTurn(g)?.playerId).toBe('b');
  });

  it('ignores switching to the active player', () => {
    const g = createGame(players, { now: T0 });
    expect(switchTo(g, s(5), 'a')).toBe(g);
  });

  it('undo merges the current turn back into the previous one', () => {
    let g = createGame(players, { now: T0 });
    g = switchTo(g, s(10));
    g = undoSwitch(g);
    expect(g.turns).toEqual([{ playerId: 'a', start: T0 }]);
  });

  it('rebook splits the running turn', () => {
    let g = createGame(players, { now: T0 });
    g = rebook(g, s(100), 40, 'b');
    expect(g.turns).toEqual([
      { playerId: 'a', start: T0, end: s(60) },
      { playerId: 'b', start: s(60) },
    ]);
  });

  it('rebook refuses more seconds than the turn has', () => {
    const g = createGame(players, { now: T0 });
    expect(rebook(g, s(10), 10, 'b')).toBe(g);
    expect(rebook(g, s(10), 20, 'b')).toBe(g);
  });

  it('blocks switching, undo and rebook while paused', () => {
    let g = createGame(players, { now: T0 });
    g = switchTo(g, s(5));
    g = startPause(g, s(6), 'rules');
    expect(switchTo(g, s(7))).toBe(g);
    expect(undoSwitch(g)).toBe(g);
    expect(rebook(g, s(7), 1, 'c')).toBe(g);
    g = endPause(g, s(8));
    expect(g.pauses).toEqual([{ start: s(6), end: s(8), category: 'rules' }]);
  });

  it('finish closes the running turn and an open pause', () => {
    let g = createGame(players, { now: T0 });
    g = startPause(g, s(5), 'other');
    g = finishGame(g, s(9));
    expect(g.status).toBe('scoring');
    expect(g.turns[0].end).toBe(s(9));
    expect(g.pauses[0].end).toBe(s(9));
  });
});
