import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportAll, importAll } from '../data/db';
import { go } from '../lib/router';
import { Meeple } from '../ui/avatars';

export function Home() {
  const running = useLiveQuery(() => db.games.where('status').equals('running').reverse().sortBy('createdAt'), []) ?? [];
  const [msg, setMsg] = useState<string>();
  const file = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `paralysis-analyse-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`Exportiert: ${data.profiles.length} Spieler, ${data.games.length} Partien.`);
  };

  return (
    <div className="page">
      <div className="hero">
        <div className="row" style={{ justifyContent: 'center', gap: 0 }}>
          <Meeple avatar="wizard" color="#8e4ec6" size={72} />
          <Meeple avatar="knight" color="#e5484d" size={90} />
          <Meeple avatar="explorer" color="#30a46c" size={72} />
        </div>
        <h2>ParalysisAnalyse</h2>
        <p className="muted">Wer grübelt am längsten?</p>
      </div>

      <div className="menu">
        {running.map((g) => (
          <button key={g.id} className="primary" onClick={() => go(`play/${g.id}`)}>
            ▶ {g.title || 'Partie'} fortsetzen
          </button>
        ))}
        <button className={running.length ? '' : 'primary'} onClick={() => go('setup')}>Neues Spiel</button>
        <button onClick={() => go('history')}>Partien</button>
        <button onClick={() => go('players')}>Spieler & Statistiken</button>
      </div>

      <div className="card" style={{ maxWidth: 420, margin: '24px auto' }}>
        <h2>Datensicherung</h2>
        <p className="muted" style={{ marginTop: 0 }}>Alle Daten liegen nur in diesem Browser. Ein Export schützt vor Verlust beim Löschen der Browserdaten.</p>
        <div className="row">
          <button onClick={doExport}>Exportieren</button>
          <button onClick={() => file.current?.click()}>Importieren</button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const r = await importAll(JSON.parse(await f.text()));
                setMsg(`Importiert: ${r.profiles} Spieler, ${r.games} Partien.`);
              } catch (err) {
                setMsg(`Import fehlgeschlagen: ${(err as Error).message}`);
              }
            }}
          />
        </div>
        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}
