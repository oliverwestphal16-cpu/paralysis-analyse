import { useEffect, useState } from 'react';
import { db, saveGame, useCriteria } from '../data/db';
import { activeCriteria, entryScore, fmtScore } from '../domain/rating';
import type { Game, GameRating, RatingEntry } from '../domain/types';
import { go } from '../lib/router';
import { Avatar } from '../ui/avatars';
import { BRAINY_LABELS, LUCK_LABELS, ScaleSlider, StarDisplay, StarInput } from '../ui/Stars';

type Mode = GameRating['mode'];

/**
 * Rating flow. "table": one form for everybody. "individual": the device goes round,
 * each player rates or skips; existing entries of the same mode are pre-filled.
 */
export function Rate({ id, mode }: { id: string; mode: Mode }) {
  const criteria = useCriteria();
  const [game, setGame] = useState<Game | null>();
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState<Record<string, RatingEntry>>({});

  useEffect(() => {
    db.games.get(id).then((g) => {
      setGame(g ?? null);
      if (g?.rating?.mode === mode) {
        setEntries(Object.fromEntries(g.rating.entries.map((e) => [e.by ?? 'table', e])));
      }
    });
  }, [id, mode]);

  if (game === undefined) return <div className="page">Lade …</div>;
  if (game === null) return <div className="page">Spiel nicht gefunden.</div>;

  const raters = mode === 'table' ? ['table'] : game.order;
  const key = raters[step];
  const player = game.players.find((p) => p.id === key);
  const blank: RatingEntry = { by: mode === 'table' ? undefined : key, values: {} };
  const entry: RatingEntry = entries[key] ?? blank;
  // Always derive from the latest state, so quick consecutive taps don't overwrite each other.
  const set = (patch: (cur: RatingEntry) => Partial<RatingEntry>) =>
    setEntries((e) => {
      const cur = e[key] ?? blank;
      return { ...e, [key]: { ...cur, ...patch(cur) } };
    });
  const isEmpty = (e: RatingEntry) => !Object.keys(e.values).length && e.luck === undefined && e.brainy === undefined;
  const nextPlayer = game.players.find((p) => p.id === raters[step + 1]);

  const finish = async (all: Record<string, RatingEntry>) => {
    const list = raters.map((r) => all[r]).filter((e): e is RatingEntry => !!e && !isEmpty(e));
    const rating: GameRating | undefined = list.length ? { mode, entries: list, ratedAt: Date.now() } : undefined;
    await saveGame({ ...game, rating });
    go(`result/${game.id}`, true);
  };

  const advance = (skip: boolean) => {
    const all = skip ? Object.fromEntries(Object.entries(entries).filter(([k]) => k !== key)) : entries;
    if (skip) setEntries(all);
    if (step + 1 < raters.length) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      finish(all);
    }
  };

  const score = entryScore(entry, criteria);

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          {player ? (
            <>
              <Avatar avatar={player.avatar} color={player.color} photo={player.photo} size={64} />
              <div className="spacer">
                <h2 style={{ margin: 0 }}>{player.name}</h2>
                <div className="muted">Bewertung {step + 1} von {raters.length} · {game.title || 'Partie'}</div>
              </div>
            </>
          ) : (
            <div className="spacer">
              <h2 style={{ margin: 0 }}>Gemeinsame Bewertung</h2>
              <div className="muted">{game.title || 'Partie'}</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div className="score-big">{fmtScore(score)}</div>
            <StarDisplay value={score} size={16} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {activeCriteria(criteria).map((c) => (
            <div key={c.id} className="rate-row">
              <span>{c.name}</span>
              <StarInput
                label={c.name}
                value={entry.values[c.id]}
                onChange={(v) => set((cur) => {
                  const values = { ...cur.values };
                  if (v === undefined) delete values[c.id];
                  else values[c.id] = v;
                  return { values };
                })}
              />
            </div>
          ))}
        </div>

        <h3>Wie ist das Spiel?</h3>
        <p className="muted" style={{ marginTop: 0 }}>Beschreibung – zählt nicht zur Note.</p>
        <ScaleSlider label="Glück, Taktik oder Strategie" labels={LUCK_LABELS} value={entry.luck} onChange={(v) => set(() => ({ luck: v }))} />
        <div style={{ height: 12 }} />
        <ScaleSlider label="Brainy" labels={BRAINY_LABELS} value={entry.brainy} onChange={(v) => set(() => ({ brainy: v }))} />

        <div className="row" style={{ marginTop: 20 }}>
          <button className="ghost" onClick={() => go(`result/${game.id}`, true)}>Abbrechen</button>
          <span className="spacer" />
          {mode === 'individual' && <button onClick={() => advance(true)}>Überspringen</button>}
          <button className="primary" onClick={() => advance(false)}>
            {nextPlayer ? `Weiter an ${nextPlayer.name}` : 'Fertig'}
          </button>
        </div>
      </div>
    </div>
  );
}
