import { useState } from 'react';
import { MIN_GAMES_FOR_RANK, boardGameStats, leaderboard, type LeaderboardSort } from '../domain/crossStats';
import type { Game, Profile } from '../domain/types';
import { fmtClock, fmtNum } from '../lib/format';
import { Avatar } from '../ui/avatars';

const SORTS: [LeaderboardSort, string][] = [['pace', 'Tempo'], ['meanTurn', 'Ø Zug'], ['efficiency', 'Effizienz']];

/** All-time ranking of all players, optionally for one board game. */
export function Leaderboard({ games, profiles, title }: { games: Game[]; profiles: Profile[]; title?: string }) {
  const [sort, setSort] = useState<LeaderboardSort>('pace');
  const rows = leaderboard(games, profiles, sort, title);
  const firstProvisional = rows.findIndex((r) => r.provisional);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <h2 className="spacer" style={{ margin: 0 }}>Ewige Rangliste{title ? ` – ${title}` : ''}</h2>
        <div className="seg">
          {SORTS.map(([k, l]) => <button key={k} className={sort === k ? 'active' : ''} onClick={() => setSort(k)}>{l}</button>)}
        </div>
      </div>
      {rows.length === 0 ? <p className="muted">Noch keine abgeschlossenen Partien.</p> : (
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr><th>#</th><th style={{ textAlign: 'left' }}>Spieler</th><th>Tempo</th><th>Ø Zug</th><th>Effizienz</th><th>Partien</th><th>Siege</th><th>Schnellster</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.profile.id}
                  style={{
                    opacity: r.provisional ? 0.5 : 1,
                    borderTop: i === firstProvisional && i > 0 ? '2px solid var(--muted)' : undefined,
                  }}
                >
                  <td>{r.provisional ? '' : i + 1}</td>
                  <td style={{ textAlign: 'left' }}><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><Avatar {...r.profile} size={28} />{r.profile.name}</span></td>
                  <td>{fmtNum(r.stats.meanPaceRatio * 100, 0)} %</td>
                  <td>{fmtClock(r.stats.meanTurn)}</td>
                  <td>{r.stats.meanEfficiency === undefined ? '–' : fmtNum(r.stats.meanEfficiency)}</td>
                  <td>{r.stats.games}</td>
                  <td>{r.stats.winsOnPoints}</td>
                  <td>{r.stats.fastestCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">
        Tempo = eigene Ø Zugdauer im Verhältnis zum Tisch der jeweiligen Partie (100 % = Tischschnitt, darunter schneller).
        Grau: weniger als {MIN_GAMES_FOR_RANK} Partien, noch ohne Platz.
      </p>
    </div>
  );
}

/** Average preparation and play time per board game. */
export function BoardGames({ games }: { games: Game[] }) {
  const rows = boardGameStats(games);
  if (!rows.length) return null;
  return (
    <div className="card">
      <h2>Spiele</h2>
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th>Spiel</th><th>Partien</th><th>Ø Aufbau</th><th>Ø Regeln</th><th>Ø Spieldauer</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.title}>
                <td>{r.title}</td>
                <td>{r.games}</td>
                <td>{r.meanSetup === undefined ? '–' : fmtClock(r.meanSetup)}</td>
                <td>{r.meanRules === undefined ? '–' : fmtClock(r.meanRules)}</td>
                <td>{fmtClock(r.meanPlay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
