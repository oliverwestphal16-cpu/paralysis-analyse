import { useRef, useState } from 'react';
import { newId } from '../domain/game';
import type { Profile } from '../domain/types';
import { photoToDataUrl } from '../lib/photo';
import { AVATARS, Avatar, COLORS, Meeple } from '../ui/avatars';
import { Dialog } from '../ui/Dialog';

export function ProfileEditor({
  profile, onSave, onDelete, onClose,
}: {
  profile?: Profile;
  onSave: (p: Profile) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[1 + Math.floor(Math.random() * (AVATARS.length - 1))].id);
  const [color, setColor] = useState(profile?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)].value);
  const [photo, setPhoto] = useState<string | undefined>(profile?.photo);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const save = () => {
    if (!name.trim()) return setError('Bitte einen Namen eingeben.');
    onSave({
      id: profile?.id ?? newId(),
      createdAt: profile?.createdAt ?? Date.now(),
      name: name.trim(),
      avatar,
      color,
      photo,
    });
  };

  return (
    <Dialog title={profile ? 'Spieler bearbeiten' : 'Neuer Spieler'} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Avatar avatar={avatar} color={color} photo={photo} size={72} />
        <input
          type="text"
          placeholder="Name"
          value={name}
          maxLength={24}
          autoFocus
          onChange={(e) => { setName(e.target.value); setError(undefined); }}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          style={{ flex: 1, width: 'auto' }}
        />
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <h3>Farbe</h3>
      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c.value}
            className={`swatch ${c.value === color ? 'selected' : ''}`}
            style={{ background: c.value }}
            title={c.name}
            aria-label={c.name}
            onClick={() => setColor(c.value)}
          />
        ))}
      </div>

      <h3>Avatar</h3>
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <button key={a.id} className={a.id === avatar ? 'selected' : ''} onClick={() => setAvatar(a.id)}>
            <Meeple avatar={a.id} color={color} size={52} />
            {a.name}
          </button>
        ))}
      </div>

      <h3>Foto (optional)</h3>
      <p className="muted" style={{ marginTop: 0 }}>Wird statt des Meeples angezeigt und bleibt nur auf diesem Gerät.</p>
      <div className="row">
        <button onClick={() => fileInput.current?.click()}>{photo ? 'Foto ändern' : 'Foto aufnehmen / wählen'}</button>
        {photo && <button className="ghost" onClick={() => setPhoto(undefined)}>Foto entfernen</button>}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              try { setPhoto(await photoToDataUrl(f)); } catch (err) { setError(String((err as Error).message)); }
            }
            e.target.value = '';
          }}
        />
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        {onDelete && <button className="danger" onClick={onDelete}>Löschen</button>}
        <span className="spacer" />
        <button className="ghost" onClick={onClose}>Abbrechen</button>
        <button className="primary" onClick={save}>Speichern</button>
      </div>
    </Dialog>
  );
}
