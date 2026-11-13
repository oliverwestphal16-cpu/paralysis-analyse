import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { gameSpan } from '../domain/stats';
import type { Game } from '../domain/types';
import { fmtDate, fmtDur } from '../lib/format';
import { go } from '../lib/router';
import { Avatar } from '../ui/avatars';
import { Dialog } from '../ui/Dialog';

export function History() {
  const games = useLiveQuery(() => db.games.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const [toDelete, setToDelete] = useState<Game>();

  return (
    <div className="page">
      <div className="card">
        <h2>Partien</h2>
        {games.length === 0 && <p className="muted">Noch keine Partien gespielt.</p>}
        {games.map((g) => {
          const span = gameSpan(g, g.endedAt ?? Date.now());
          return (
            <div key={g.id} className="row" style={{ flexWrap: 'nowrap' }}>
              <button
                className="list-item"
                onClick={() => go(g.status === 'running' ? `play/${g.id}` : g.status === 'scoring' ? `score/${g.id}` : `result/${g.id}`)}
              >
                <div className="avatars-inline">
                  {g.players.map((p) => <Avatar key={p.id} {...p} size={32} />)}
                </div>
                <span className="spacer" style={{ marginLeft: 12 }}>
                  <strong>{g.title || 'Partie'}</strong>
                  {g.status === 'running' && <> <span className="badge live">läuft</span></>}
                  {g.status === 'scoring' && <> <span className="badge">Punkte fehlen</span></>}
                  <br />
                  <span className="muted" style={{ fontSize: 14 }}>{fmtDate(g.createdAt)} · {fmtDur(span.end - span.start)} · {g.players.map((p) => p.name).join(', ')}</span>
                </span>
              </button>
              <button className="ghost icon" aria-label="Partie löschen" onClick={() => setToDelete(g)}>🗑</button>
            </div>
          );
        })}
      </div>

      {toDelete && (
        <Dialog title="Partie löschen?" onClose={() => setToDelete(undefined)}>
          <p>„{toDelete.title || 'Partie'}“ vom {fmtDate(toDelete.createdAt)} wird endgültig gelöscht. Das lässt sich nicht rückgängig machen (außer über einen vorher erstellten Export).</p>
          <div className="row">
            <span className="spacer" />
            <button className="ghost" onClick={() => setToDelete(undefined)}>Abbrechen</button>
            <button className="danger" onClick={async () => { await db.games.delete(toDelete.id); setToDelete(undefined); }}>Löschen</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
