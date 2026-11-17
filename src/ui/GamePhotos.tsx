import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { newId } from '../domain/game';
import type { GamePhoto } from '../domain/types';
import { resizeImage, shareOrDownload } from '../lib/photo';
import { Dialog } from './Dialog';

/** Photo list of a game with "take photo", "pick from gallery", save-to-gallery and delete. */
export function GamePhotos({ gameId, title }: { gameId: string; title?: string }) {
  const photos = useLiveQuery(() => db.photos.where('gameId').equals(gameId).sortBy('createdAt'), [gameId]) ?? [];
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [view, setView] = useState<GamePhoto>();
  const [toDelete, setToDelete] = useState<GamePhoto>();

  const urls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = async (files: FileList | null, fromCamera: boolean) => {
    if (!files?.length) return;
    setBusy(true);
    setMsg(undefined);
    try {
      for (const f of Array.from(files)) {
        const blob = await resizeImage(f, 1600);
        await db.photos.put({ id: newId(), gameId, createdAt: Date.now(), blob, fromCamera });
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fileName = (p: GamePhoto) =>
    `${(title || 'partie').replace(/[^\wäöüÄÖÜß-]+/g, '-')}-${new Date(p.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;

  const saveToGallery = async (p: GamePhoto) => {
    const r = await shareOrDownload(p.blob, fileName(p), title);
    if (r === 'shared' || r === 'downloaded') {
      await db.photos.update(p.id, { fromCamera: false });
      setMsg(r === 'shared' ? 'Im Teilen-Menü „Bild sichern“ wählen, dann liegt es in der Galerie.' : 'Heruntergeladen – in der Galerie unter „Downloads“ zu finden.');
    }
  };

  return (
    <div>
      <div className="row">
        <button onClick={() => camera.current?.click()} disabled={busy}>📷 Foto aufnehmen</button>
        <button onClick={() => gallery.current?.click()} disabled={busy}>🖼 Aus Galerie wählen</button>
        {busy && <span className="muted">Speichere …</span>}
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files, true); e.target.value = ''; }} />
        <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files, false); e.target.value = ''; }} />
      </div>
      {msg && <p className="muted">{msg}</p>}
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p.id} className="photo-cell">
              <button className="photo-thumb" onClick={() => setView(p)} aria-label="Foto vergrößern">
                <img src={urls[p.id]} alt="" />
              </button>
              <div className="row" style={{ gap: 4 }}>
                {p.fromCamera && <button className="ghost icon" style={{ fontSize: 13 }} onClick={() => saveToGallery(p)}>In Galerie sichern</button>}
                <span className="spacer" />
                <button className="ghost icon" aria-label="Foto löschen" onClick={() => setToDelete(p)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view && (
        <Dialog title="Foto" onClose={() => setView(undefined)}>
          <img src={urls[view.id]} alt="" style={{ width: '100%', borderRadius: 10 }} />
        </Dialog>
      )}
      {toDelete && (
        <Dialog title="Foto löschen?" onClose={() => setToDelete(undefined)}>
          <p>Das Foto wird aus der App gelöscht.{toDelete.fromCamera ? ' Es wurde noch nicht in der Galerie gesichert und ist danach weg.' : ' Ein Original in der Galerie bleibt erhalten.'}</p>
          <div className="row">
            <span className="spacer" />
            <button className="ghost" onClick={() => setToDelete(undefined)}>Abbrechen</button>
            <button className="danger" onClick={async () => { await db.photos.delete(toDelete.id); setToDelete(undefined); }}>Löschen</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
