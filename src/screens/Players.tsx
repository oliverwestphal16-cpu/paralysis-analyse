import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { crossStats } from '../domain/crossStats';
import type { Profile } from '../domain/types';
import { fmtClock, fmtDate, fmtNum } from '../lib/format';
import { Avatar } from '../ui/avatars';
import { Dialog } from '../ui/Dialog';
import { EChart, chartTheme } from '../ui/EChart';
import { ProfileEditor } from './ProfileEditor';

/** Profiles and their statistics across all games. */
export function Players() {
  const profiles = useLiveQuery(() => db.profiles.orderBy('name').toArray(), []) ?? [];
  const games = useLiveQuery(() => db.games.toArray(), []) ?? [];
  const [selected, setSelected] = useState<string>();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<Profile | 'new'>();
  const [toDelete, setToDelete] = useState<Profile>();

  const titles = useMemo(() => [...new Set(games.map((g) => g.title).filter((t): t is string => !!t))].sort(), [games]);
  const current = profiles.find((p) => p.id === selected) ?? profiles[0];
  const cs = current ? crossStats(games, current.id, title || undefined) : undefined;
  const recent = cs?.entries.slice(-10) ?? [];
  const t = chartTheme();

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <h2 className="spacer" style={{ margin: 0 }}>Spieler</h2>
          <button onClick={() => setEditing('new')}>+ Neuer Spieler</button>
        </div>
        <div className="profile-grid" style={{ marginTop: 12 }}>
          {profiles.map((p) => (
            <button key={p.id} className={`profile-tile ${p.id === current?.id ? 'selected' : ''}`} onClick={() => setSelected(p.id)}>
              <Avatar {...p} size={56} />
              <span className="name">{p.name}</span>
            </button>
          ))}
        </div>
        {profiles.length === 0 && <p className="muted">Noch keine Spieler angelegt.</p>}
      </div>

      {current && cs && (
        <div className="card">
          <div className="row">
            <Avatar {...current} size={64} />
            <h2 className="spacer" style={{ margin: 0 }}>{current.name}</h2>
            <button onClick={() => setEditing(current)}>Bearbeiten</button>
          </div>
          <div className="row" style={{ margin: '12px 0' }}>
            <label htmlFor="flt" className="muted">Spiel:</label>
            <select id="flt" value={title} onChange={(e) => setTitle(e.target.value)} style={{ maxWidth: 320 }}>
              <option value="">Alle Spiele</option>
              {titles.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          {cs.games === 0 ? (
            <p className="muted">Noch keine abgeschlossene Partie{title ? ` in „${title}“` : ''}.</p>
          ) : (
            <>
              <table className="stats" style={{ maxWidth: 520 }}>
                <tbody>
                  <tr><td>Partien</td><td>{cs.games}</td></tr>
                  <tr><td>Ø Zugdauer</td><td>{fmtClock(cs.meanTurn)}</td></tr>
                  <tr><td>Tempo im Vergleich zum Tisch</td><td>{fmtNum(cs.meanPaceRatio * 100, 0)} %</td></tr>
                  <tr><td>Am schnellsten gespielt</td><td>{cs.fastestCount}×</td></tr>
                  <tr><td>Nach Punkten gewonnen</td><td>{cs.winsOnPoints}×</td></tr>
                </tbody>
              </table>
              <p className="muted">100 % = durchschnittliche Zugdauer am Tisch der jeweiligen Partie; darunter ist schneller.</p>
              <h3>Letzte {recent.length} Partien</h3>
              <EChart
                height={260}
                option={{
                  grid: { left: 50, right: 16, top: 16, bottom: 30 },
                  tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${fmtNum(v, 0)} %` },
                  xAxis: {
                    type: 'category',
                    data: recent.map((e) => `${new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}${e.title ? ` ${e.title}` : ''}`),
                    axisLabel: { color: t.muted, hideOverlap: true },
                    axisLine: { lineStyle: { color: t.border } },
                  },
                  yAxis: { type: 'value', axisLabel: { color: t.muted, formatter: '{value} %' }, splitLine: { lineStyle: { color: t.border, opacity: 0.5 } } },
                  series: [{
                    type: 'line', color: current.color, symbolSize: 8, data: recent.map((e) => Math.round(e.paceRatio * 100)),
                    markLine: { silent: true, symbol: 'none', data: [{ yAxis: 100 }], lineStyle: { color: t.muted, type: 'dashed' }, label: { show: false } },
                  }],
                }}
              />
              <div className="table-wrap">
                <table className="stats">
                  <thead><tr><th>Datum</th><th>Spiel</th><th>Ø Zug</th><th>Gesamt</th><th>Tempo</th><th></th></tr></thead>
                  <tbody>
                    {[...cs.entries].reverse().map((e) => (
                      <tr key={e.gameId} style={{ cursor: 'pointer' }} onClick={() => { window.location.hash = `#/result/${e.gameId}`; }}>
                        <td>{fmtDate(e.date)}</td>
                        <td>{e.title ?? '–'}</td>
                        <td>{fmtClock(e.meanTurn)}</td>
                        <td>{fmtClock(e.totalTime)}</td>
                        <td>{fmtNum(e.paceRatio * 100, 0)} %</td>
                        <td>{e.fastest ? '⏱' : ''}{e.wonOnPoints ? '🏆' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {editing && (
        <ProfileEditor
          profile={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSave={async (p) => { await db.profiles.put(p); setEditing(undefined); setSelected(p.id); }}
          onDelete={editing === 'new' ? undefined : () => { setToDelete(editing); setEditing(undefined); }}
        />
      )}

      {toDelete && (
        <Dialog title="Spieler löschen?" onClose={() => setToDelete(undefined)}>
          <p>Das Profil „{toDelete.name}“ wird gelöscht. Bereits gespielte Partien bleiben mit Name und Avatar erhalten.</p>
          <div className="row">
            <span className="spacer" />
            <button className="ghost" onClick={() => setToDelete(undefined)}>Abbrechen</button>
            <button className="danger" onClick={async () => { await db.profiles.delete(toDelete.id); setToDelete(undefined); setSelected(undefined); }}>Löschen</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
