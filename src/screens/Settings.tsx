import { useState } from 'react';
import { saveCriteria, useCriteria } from '../data/db';
import { newId } from '../domain/game';
import { DEFAULT_CRITERIA, weightShares } from '../domain/rating';
import type { RatingCriterion } from '../domain/types';
import { fmtNum } from '../lib/format';
import { Dialog } from '../ui/Dialog';

/** Edits locally and saves on blur, so typing is not slowed down by database round trips. */
function CriterionRow({
  criterion, share, onChange,
}: { criterion: RatingCriterion; share: number; onChange: (patch: Partial<RatingCriterion>) => void }) {
  const [name, setName] = useState(criterion.name);
  const [weight, setWeight] = useState(String(criterion.weight));
  const saveName = () => name.trim() && name.trim() !== criterion.name && onChange({ name: name.trim() });
  const saveWeight = () => {
    const w = Math.max(0, Number(weight.replace(',', '.')) || 0);
    setWeight(String(w));
    if (w !== criterion.weight) onChange({ weight: w });
  };
  return (
    <div className="row" style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
      <input
        type="text"
        value={name}
        aria-label="Name des Kriteriums"
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        style={{ flex: 1, minWidth: 0, width: 'auto' }}
      />
      <input
        type="text"
        inputMode="decimal"
        value={weight}
        aria-label={`Gewicht ${criterion.name}`}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={saveWeight}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        style={{ width: 84, textAlign: 'right' }}
      />
      <span className="muted" style={{ width: 64, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtNum(share, 1)} %</span>
      <button className="ghost icon" aria-label={`${criterion.name} archivieren`} title="Archivieren" onClick={() => onChange({ archived: true })}>🗃</button>
    </div>
  );
}

/** Rating criteria: rename, weight, archive/restore, add, reset. */
export function Settings() {
  const criteria = useCriteria();
  const [confirmReset, setConfirmReset] = useState(false);
  const shares = weightShares(criteria);
  const active = criteria.filter((c) => !c.archived);
  const archived = criteria.filter((c) => c.archived);

  const update = (id: string, patch: Partial<RatingCriterion>) =>
    saveCriteria(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const reset = () => {
    // Defaults come back with their weights; custom criteria are archived, so their values stay.
    const defaults = new Map(DEFAULT_CRITERIA.map((c) => [c.id, c]));
    const custom = criteria.filter((c) => !defaults.has(c.id)).map((c) => ({ ...c, archived: true }));
    saveCriteria([...DEFAULT_CRITERIA, ...custom]);
    setConfirmReset(false);
  };

  return (
    <div className="page">
      <div className="card">
        <h2>Bewertungskriterien</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Werden bei jeder Partie mit 1–5 Sternen (in halben Schritten, also 1–10 Punkte) abgefragt. Die Gewichte werden automatisch
          auf 100 % umgerechnet. Änderungen gelten auch für alte Partien, weil Noten immer neu berechnet werden.
        </p>
        <div className="row muted" style={{ fontSize: 14, marginBottom: 4 }}>
          <span className="spacer">Name</span><span style={{ width: 84 }}>Gewicht</span><span style={{ width: 64 }} /><span style={{ width: 44 }} />
        </div>
        {active.map((c) => (
          <CriterionRow key={c.id} criterion={c} share={shares[c.id] ?? 0} onChange={(patch) => update(c.id, patch)} />
        ))}
        {active.length === 0 && <p style={{ color: 'var(--danger)' }}>Kein aktives Kriterium – Bewertungen ergeben dann keine Note.</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={() => saveCriteria([...criteria, { id: newId(), name: 'Neues Kriterium', weight: 10 }])}>+ Kriterium</button>
          <span className="spacer" />
          <button className="ghost" onClick={() => setConfirmReset(true)}>Auf Standard zurücksetzen</button>
        </div>
      </div>

      {archived.length > 0 && (
        <div className="card">
          <h2>Archiviert</h2>
          <p className="muted" style={{ marginTop: 0 }}>Zählen nicht zur Note; bereits vergebene Werte bleiben gespeichert.</p>
          {archived.map((c) => (
            <div key={c.id} className="row" style={{ marginBottom: 6 }}>
              <span className="spacer">{c.name}</span>
              <button onClick={() => update(c.id, { archived: false })}>Wiederherstellen</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Beschreibung (ohne Einfluss auf die Note)</h2>
        <p className="muted" style={{ margin: 0 }}>Glück ↔ Taktik ↔ Strategie und Brainy (locker ↔ Kopfrauchen) werden immer mit abgefragt.</p>
      </div>

      {confirmReset && (
        <Dialog title="Auf Standard zurücksetzen?" onClose={() => setConfirmReset(false)}>
          <p>Die sechs Standard-Kriterien kommen mit ihren Standard-Gewichten zurück. Eigene Kriterien werden archiviert, ihre Werte bleiben erhalten.</p>
          <div className="row">
            <span className="spacer" />
            <button className="ghost" onClick={() => setConfirmReset(false)}>Abbrechen</button>
            <button className="primary" onClick={reset}>Zurücksetzen</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
