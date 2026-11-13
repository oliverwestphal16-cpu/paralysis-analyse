import { useEffect, useState } from 'react';
import { db, saveGame } from '../data/db';
import { setScores } from '../domain/game';
import type { Game } from '../domain/types';
import { go } from '../lib/router';
import { Avatar } from '../ui/avatars';

/** Score entry after the game; can be skipped and reopened later from the result. */
export function Score({ id }: { id: string }) {
  const [game, setGame] = useState<Game | null>();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    db.games.get(id).then((g) => {
      setGame(g ?? null);
      if (g?.scores) setValues(Object.fromEntries(Object.entries(g.scores).map(([k, v]) => [k, String(v)])));
    });
  }, [id]);

  if (game === undefined) return <div className="page">Lade …</div>;
  if (game === null) return <div className="page">Spiel nicht gefunden.</div>;

  const parsed = game.players.map((p) => {
    const raw = (values[p.id] ?? '').trim().replace(',', '.');
    return { id: p.id, raw, n: raw === '' ? NaN : Number(raw) };
  });
  const complete = parsed.every((x) => Number.isFinite(x.n));
  const invalid = parsed.some((x) => x.raw !== '' && !Number.isFinite(x.n));

  const finish = async (scores: Record<string, number> | undefined) => {
    await saveGame(setScores(game, scores));
    go(`result/${game.id}`, true);
  };

  return (
    <div className="page">
      <div className="card">
        <h2>Endpunktzahl</h2>
        <p className="muted" style={{ marginTop: 0 }}>Negative Werte sind erlaubt. Du kannst die Eingabe überspringen und später in der Auswertung nachtragen.</p>
        {game.players.map((p) => (
          <div className="row" key={p.id} style={{ marginBottom: 10 }}>
            <Avatar avatar={p.avatar} color={p.color} photo={p.photo} size={40} />
            <label htmlFor={`s-${p.id}`} className="spacer">{p.name}</label>
            <input
              id={`s-${p.id}`}
              type="text"
              inputMode="decimal"
              style={{ width: 120, textAlign: 'right' }}
              value={values[p.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
            />
          </div>
        ))}
        {invalid && <p style={{ color: 'var(--danger)' }}>Bitte nur Zahlen eingeben.</p>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="ghost" onClick={() => finish(game.scores)}>{game.scores ? 'Abbrechen' : 'Überspringen'}</button>
          <span className="spacer" />
          <button
            className="primary"
            disabled={!complete}
            onClick={() => finish(Object.fromEntries(parsed.map((x) => [x.id, x.n])))}
          >
            Zur Auswertung
          </button>
        </div>
      </div>
    </div>
  );
}
