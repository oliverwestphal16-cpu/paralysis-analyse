import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { go } from '../lib/router';
import { GamePhotos } from '../ui/GamePhotos';

/** Step after the score entry: optionally add photos of the game. */
export function Photos({ id }: { id: string }) {
  const game = useLiveQuery(() => db.games.get(id), [id], null);
  const count = useLiveQuery(() => db.photos.where('gameId').equals(id).count(), [id]) ?? 0;
  if (game === null) return <div className="page">Lade …</div>;
  if (!game) return <div className="page">Spiel nicht gefunden.</div>;
  return (
    <div className="page">
      <div className="card">
        <h2>Fotos von der Partie?</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Endstand, Spielbrett, Gruppenbild – die Fotos werden bei dieser Partie gespeichert. Fotos, die du hier direkt aufnimmst,
          kannst du zusätzlich „In Galerie sichern“; Fotos aus der Galerie liegen dort ohnehin schon.
        </p>
        <GamePhotos gameId={id} title={game.title} />
        <div className="row" style={{ marginTop: 20 }}>
          <span className="spacer" />
          <button className="primary" onClick={() => go(`result/${id}`, true)}>{count ? 'Zur Auswertung' : 'Überspringen'}</button>
        </div>
      </div>
    </div>
  );
}
