import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveGame } from '../data/db';
import { createGame } from '../domain/game';
import type { GamePlayer, Profile } from '../domain/types';
import { go } from '../lib/router';
import { Avatar, COLORS } from '../ui/avatars';
import { Dialog } from '../ui/Dialog';
import { SortableList } from '../ui/SortableList';
import { ProfileEditor } from './ProfileEditor';

const MAX_PLAYERS = 8;
const LIMITS = [0, 30, 60, 90, 120, 180, 300];

export function Setup() {
  const profiles = useLiveQuery(() => db.profiles.orderBy('name').toArray(), []) ?? [];
  const titles = useLiveQuery(async () => {
    const games = await db.games.toArray();
    return [...new Set(games.map((g) => g.title).filter((t): t is string => !!t))].sort();
  }, []) ?? [];

  const [selected, setSelected] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState(0);
  const [editing, setEditing] = useState<Profile | 'new'>();
  const [colorFor, setColorFor] = useState<string>();

  const byId = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const colorOf = (id: string) => colors[id] ?? byId[id]?.color;
  const chosen = selected.filter((id) => byId[id]);
  const usedColors = chosen.map(colorOf);
  const duplicate = usedColors.some((c, i) => usedColors.indexOf(c) !== i);

  const toggle = (id: string) => {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_PLAYERS) return s;
      // Pick a free colour automatically if the profile colour is taken.
      const taken = s.map(colorOf);
      if (taken.includes(byId[id].color)) {
        const free = COLORS.find((c) => !taken.includes(c.value));
        if (free) setColors((c) => ({ ...c, [id]: free.value }));
      }
      return [...s, id];
    });
  };

  const start = async () => {
    const players: GamePlayer[] = chosen.map((id) => {
      const p = byId[id];
      return { id, name: p.name, avatar: p.avatar, photo: p.photo, color: colorOf(id) };
    });
    const game = createGame(players, { title, softLimitSec: limit || undefined, now: Date.now() });
    await saveGame(game);
    go(`play/${game.id}`, true);
  };

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <h2 className="spacer" style={{ margin: 0 }}>Wer spielt mit?</h2>
          <button onClick={() => setEditing('new')}>+ Neuer Spieler</button>
        </div>
        <p className="muted">Antippen zum Auswählen ({chosen.length}/{MAX_PLAYERS}).</p>
        {profiles.length === 0 && <p>Noch keine Spieler angelegt.</p>}
        <div className="profile-grid">
          {profiles.map((p) => (
            <button
              key={p.id}
              className={`profile-tile ${selected.includes(p.id) ? 'selected' : ''}`}
              onClick={() => toggle(p.id)}
            >
              <Avatar avatar={p.avatar} color={colorOf(p.id)} photo={p.photo} size={56} />
              <span className="name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Zugreihenfolge</h2>
        <p className="muted" style={{ marginTop: 0 }}>Ziehen zum Umsortieren. Die erste Person beginnt.</p>
        {chosen.length === 0 && <p className="muted">Noch niemand ausgewählt.</p>}
        <SortableList
          ids={chosen}
          onChange={setSelected}
          render={(id, i) => {
            const p = byId[id];
            const dup = usedColors.filter((c) => c === colorOf(id)).length > 1;
            return (
              <>
                <span className="pos">{i + 1}.</span>
                <Avatar avatar={p.avatar} color={colorOf(id)} photo={p.photo} size={40} />
                <span className="spacer">{p.name}</span>
                <button
                  className={`swatch ${dup ? '' : 'selected'}`}
                  style={{ background: colorOf(id), outline: dup ? '3px solid var(--danger)' : undefined }}
                  aria-label="Farbe ändern"
                  onClick={() => setColorFor(id)}
                />
                <button className="ghost icon" aria-label="Entfernen" onClick={() => toggle(id)}>✕</button>
              </>
            );
          }}
        />
        {duplicate && <p style={{ color: 'var(--danger)' }}>Jede Farbe darf nur einmal vorkommen.</p>}
      </div>

      <div className="card">
        <h2>Spiel</h2>
        <label className="muted" htmlFor="title">Welches Brettspiel? (optional)</label>
        <input id="title" type="text" list="titles" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name des Spiels" />
        <datalist id="titles">{titles.map((t) => <option key={t} value={t} />)}</datalist>
        <div style={{ marginTop: 12 }}>
          <label className="muted" htmlFor="limit">Weiches Zeitlimit pro Zug</label>
          <select id="limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMITS.map((l) => (
              <option key={l} value={l}>{l === 0 ? 'Aus' : l < 60 ? `${l} Sekunden` : `${l / 60} Minute${l === 60 ? '' : 'n'}`.replace('.5', ',5')}</option>
            ))}
          </select>
          <p className="muted" style={{ marginBottom: 0 }}>Nach Ablauf wird die Uhr rot, das Gerät vibriert bzw. piept einmal. Sonst passiert nichts.</p>
        </div>
      </div>

      <div className="row">
        <span className="spacer" />
        <button className="primary" style={{ minHeight: 56, fontSize: 18 }} disabled={chosen.length < 2 || duplicate} onClick={start}>
          Spiel starten
        </button>
      </div>

      {editing && (
        <ProfileEditor
          profile={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSave={async (p) => {
            await db.profiles.put(p);
            setEditing(undefined);
            if (editing === 'new' && selected.length < MAX_PLAYERS) setSelected((s) => [...s, p.id]);
          }}
        />
      )}

      {colorFor && (
        <Dialog title={`Farbe für ${byId[colorFor]?.name}`} onClose={() => setColorFor(undefined)}>
          <div className="swatches">
            {COLORS.map((c) => {
              const taken = chosen.some((id) => id !== colorFor && colorOf(id) === c.value);
              return (
                <button
                  key={c.value}
                  className={`swatch ${taken ? 'taken' : ''} ${colorOf(colorFor) === c.value ? 'selected' : ''}`}
                  style={{ background: c.value }}
                  disabled={taken}
                  aria-label={c.name}
                  onClick={() => { setColors((x) => ({ ...x, [colorFor]: c.value })); setColorFor(undefined); }}
                />
              );
            })}
          </div>
        </Dialog>
      )}
    </div>
  );
}
