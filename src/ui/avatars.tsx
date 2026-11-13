import type { ReactNode } from 'react';

/** Distinct player colours; each colour can be used once per game. */
export const COLORS: { value: string; name: string }[] = [
  { value: '#e5484d', name: 'Rot' },
  { value: '#3e8bf5', name: 'Blau' },
  { value: '#30a46c', name: 'Grün' },
  { value: '#f5c518', name: 'Gelb' },
  { value: '#8e4ec6', name: 'Lila' },
  { value: '#f76b15', name: 'Orange' },
  { value: '#e93d82', name: 'Pink' },
  { value: '#12a594', name: 'Türkis' },
  { value: '#a07850', name: 'Braun' },
  { value: '#eeeae2', name: 'Weiß' },
  { value: '#6e747c', name: 'Grau' },
  { value: '#00b8e6', name: 'Cyan' },
];

const DARK = '#2b1f17';

/** Generic meeple silhouette (the plain shape is common property, no specific game). */
const MEEPLE =
  'M50 8 C58 8 64 14 64 22 C64 28 61 32 57 34 C70 37 86 40 90 46 C93 51 90 55 84 56 L68 58 ' +
  'C70 68 76 80 80 88 C82 92 80 95 76 95 L60 95 C57 95 55 93 54 90 L50 80 L46 90 C45 93 43 95 40 95 ' +
  'L24 95 C20 95 18 92 20 88 C24 80 30 68 32 58 L16 56 C10 55 7 51 10 46 C14 40 30 37 43 34 ' +
  'C39 32 36 28 36 22 C36 14 42 8 50 8 Z';

/** Costume drawn on top of the meeple. Coordinates in the 0..100 meeple box (head ≈ circle at 50,22 r14). */
export const AVATARS: { id: string; name: string; draw: () => ReactNode }[] = [
  { id: 'classic', name: 'Meeple', draw: () => null },
  {
    id: 'knight', name: 'Ritter', draw: () => (<>
      <path d="M68 6 C64 -2 54 -2 52 6 C58 4 64 4 68 6 Z" fill="#c62828" />
      <path d="M35 26 C35 8 65 8 65 26 L65 32 L35 32 Z" fill="#8a929b" />
      <rect x="39" y="20" width="22" height="3.5" rx="1.5" fill={DARK} />
      <rect x="49" y="12" width="2" height="18" fill="#c9d0d6" opacity=".6" />
    </>),
  },
  {
    id: 'farmer', name: 'Bäuerin', draw: () => (<>
      <ellipse cx="50" cy="15" rx="24" ry="4.5" fill="#d9b45a" />
      <path d="M37 15 C37 2 63 2 63 15 Z" fill="#e8c873" />
      <rect x="37" y="11" width="26" height="3" fill="#a5452f" />
    </>),
  },
  {
    id: 'viking', name: 'Wikinger', draw: () => (<>
      <path d="M37 17 C30 15 25 7 27 -1 C31 6 34 9 39 11 Z" fill="#efe6d2" />
      <path d="M63 17 C70 15 75 7 73 -1 C69 6 66 9 61 11 Z" fill="#efe6d2" />
      <path d="M36 19 C36 5 64 5 64 19 Z" fill="#8a8f96" />
      <rect x="35" y="17" width="30" height="3.5" rx="1.5" fill="#6b5a3a" />
      <path d="M40 28 C41 42 59 42 60 28 C56 31 44 31 40 28 Z" fill="#c0712c" />
    </>),
  },
  {
    id: 'explorer', name: 'Entdecker', draw: () => (<>
      <ellipse cx="50" cy="15" rx="21" ry="4" fill="#bca37a" />
      <path d="M37 15 C37 2 63 2 63 15 Z" fill="#dcc79c" />
      <rect x="37" y="12" width="26" height="2.5" fill="#6d5636" />
      <circle cx="44" cy="46" r="3.2" fill={DARK} /><circle cx="52" cy="46" r="3.2" fill={DARK} />
      <path d="M40 36 L48 46 L56 36" stroke={DARK} strokeWidth="1.5" fill="none" />
    </>),
  },
  {
    id: 'merchant', name: 'Händlerin', draw: () => (<>
      <path d="M38 16 C38 4 62 4 62 16 Z" fill="#6b3fa0" />
      <circle cx="50" cy="5" r="2.5" fill="#f5c518" />
      <path d="M80 60 C74 70 75 86 87 88 C99 86 99 70 93 60 Z" fill="#b08a5a" />
      <path d="M81 60 L92 60" stroke={DARK} strokeWidth="2.5" />
      <text x="86.5" y="79" fontSize="10" textAnchor="middle" fill={DARK} fontWeight="700">$</text>
    </>),
  },
  {
    id: 'wizard', name: 'Zauberer', draw: () => (<>
      <path d="M38 16 L52 -8 L62 16 Z" fill="#3b2a7b" />
      <ellipse cx="50" cy="16" rx="21" ry="4" fill="#2d1f63" />
      <path d="M50 4 l1.5 3 3.2 .4 -2.4 2.2 .6 3.2 -2.9-1.6 -2.9 1.6 .6-3.2 -2.4-2.2 3.2-.4 Z" fill="#f5c518" />
      <path d="M42 30 C42 44 58 44 58 30 C55 33 45 33 42 30 Z" fill="#e8e6e0" />
    </>),
  },
  {
    id: 'astronaut', name: 'Astronautin', draw: () => (<>
      <circle cx="50" cy="22" r="18" fill="rgba(190,225,255,.35)" stroke="#e8eef3" strokeWidth="3" />
      <path d="M40 14 C43 10 47 9 50 9" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="42" y="50" width="16" height="10" rx="2" fill="#e8eef3" />
      <circle cx="46" cy="55" r="1.8" fill="#e5484d" /><circle cx="54" cy="55" r="1.8" fill="#3e8bf5" />
    </>),
  },
  {
    id: 'pirate', name: 'Pirat', draw: () => (<>
      <path d="M26 16 C34 2 66 2 74 16 C62 11 38 11 26 16 Z" fill="#222" />
      <circle cx="50" cy="9" r="2.6" fill="#f4f1ea" />
      <path d="M36 17 L64 25" stroke="#222" strokeWidth="2" />
      <circle cx="56" cy="23" r="4.2" fill="#222" />
    </>),
  },
  {
    id: 'monk', name: 'Mönch', draw: () => (<>
      <path d="M33 33 C28 6 72 6 67 33 C63 22 37 22 33 33 Z" fill="#6b4a2b" />
      <path d="M33 62 L67 62" stroke="#d9b45a" strokeWidth="3" />
      <path d="M58 62 L60 74" stroke="#d9b45a" strokeWidth="2.5" />
    </>),
  },
  {
    id: 'builder', name: 'Baumeisterin', draw: () => (<>
      <path d="M36 16 C36 3 64 3 64 16 Z" fill="#f2c230" />
      <rect x="31" y="15" width="38" height="3.5" rx="1.5" fill="#d9a915" />
      <rect x="48" y="4" width="4" height="12" fill="#d9a915" />
      <path d="M84 40 L84 62" stroke="#8d6e4f" strokeWidth="3" />
      <rect x="78" y="35" width="12" height="7" rx="1" fill="#6e747c" />
    </>),
  },
  {
    id: 'dragon', name: 'Drache', draw: () => (<>
      <path d="M38 13 L41 1 L46 10 L50 -2 L54 10 L59 1 L62 13 Z" fill="#2f6b3a" />
      <path d="M16 45 C3 36 3 22 11 18 C12 28 19 35 28 39 Z" fill="#2f6b3a" />
      <path d="M84 45 C97 36 97 22 89 18 C88 28 81 35 72 39 Z" fill="#2f6b3a" />
      <circle cx="45" cy="21" r="2" fill="#f5c518" /><circle cx="55" cy="21" r="2" fill="#f5c518" />
    </>),
  },
  {
    id: 'robot', name: 'Roboter', draw: () => (<>
      <path d="M50 8 L50 0" stroke="#6e747c" strokeWidth="2.5" />
      <circle cx="50" cy="-1" r="3" fill="#e5484d" />
      <rect x="40.5" y="17" width="7" height="6" rx="1" fill="#9ff3ff" stroke={DARK} strokeWidth="1" />
      <rect x="52.5" y="17" width="7" height="6" rx="1" fill="#9ff3ff" stroke={DARK} strokeWidth="1" />
      <path d="M43 28 L57 28" stroke={DARK} strokeWidth="2" strokeDasharray="2 1.5" />
      <rect x="41" y="46" width="18" height="12" rx="2" fill="#6e747c" />
      <circle cx="46" cy="52" r="2" fill="#30a46c" /><circle cx="54" cy="52" r="2" fill="#f5c518" />
    </>),
  },
  {
    id: 'chef', name: 'Koch', draw: () => (<>
      <path d="M37 13 C29 3 39 -6 46 -1 C49 -7 58 -6 59 0 C67 -4 73 5 63 13 Z" fill="#f4f1ea" />
      <rect x="37" y="10" width="26" height="6" rx="1" fill="#e2ddd2" />
      <path d="M44 38 L56 38 L50 48 Z" fill="#e5484d" />
    </>),
  },
  {
    id: 'king', name: 'Königin', draw: () => (<>
      <path d="M36 14 L36 2 L43 8 L50 -1 L57 8 L64 2 L64 14 Z" fill="#e2b23a" />
      <circle cx="50" cy="9" r="2" fill="#e5484d" />
      <path d="M38 36 C44 40 56 40 62 36 L64 50 C56 54 44 54 36 50 Z" fill="#c62828" opacity=".85" />
    </>),
  },
  {
    id: 'ninja', name: 'Ninja', draw: () => (<>
      <rect x="35" y="16" width="30" height="9" rx="2" fill="#222" />
      <rect x="40" y="19" width="20" height="3" rx="1.5" fill="#f4f1ea" />
      <path d="M64 18 C72 16 76 22 80 20 M64 21 C71 22 74 28 78 28" stroke="#222" strokeWidth="2.5" fill="none" />
    </>),
  },
  {
    id: 'miner', name: 'Bergmann', draw: () => (<>
      <path d="M36 16 C36 3 64 3 64 16 Z" fill="#c8c8c8" />
      <rect x="33" y="15" width="34" height="3" rx="1.5" fill="#9a9a9a" />
      <circle cx="50" cy="9" r="4" fill="#f5c518" stroke="#9a9a9a" strokeWidth="1.5" />
      <path d="M78 36 L94 52 M80 46 C84 38 90 34 96 34" stroke="#6e747c" strokeWidth="3" fill="none" />
    </>),
  },
  {
    id: 'detective', name: 'Detektivin', draw: () => (<>
      <path d="M35 16 C35 4 65 4 65 16 Z" fill="#8b6b43" />
      <path d="M30 17 L70 17" stroke="#6d5233" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="87" cy="42" r="7" fill="rgba(190,225,255,.5)" stroke="#333" strokeWidth="2.5" />
      <path d="M83 48 L78 56" stroke="#333" strokeWidth="3" />
    </>),
  },
  {
    id: 'gardener', name: 'Gärtnerin', draw: () => (<>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={58 + 5 * Math.cos((a * Math.PI) / 180)} cy={8 + 5 * Math.sin((a * Math.PI) / 180)} r="3.6" fill="#e93d82" />
      ))}
      <circle cx="58" cy="8" r="3" fill="#f5c518" />
      <path d="M40 12 C42 4 50 4 52 9 C46 9 43 11 40 12 Z" fill="#30a46c" />
    </>),
  },
  {
    id: 'sailor', name: 'Matrose', draw: () => (<>
      <ellipse cx="50" cy="11" rx="15" ry="4.5" fill="#f4f1ea" />
      <rect x="38" y="11" width="24" height="4" fill="#1d3b6e" />
      <path d="M40 36 L50 46 L60 36" fill="#1d3b6e" />
      <path d="M42 36 L50 43 L58 36" stroke="#f4f1ea" strokeWidth="1.2" fill="none" />
    </>),
  },
  {
    id: 'bard', name: 'Barde', draw: () => (<>
      <ellipse cx="47" cy="12" rx="16" ry="6" fill="#a5452f" transform="rotate(-12 47 12)" />
      <path d="M58 9 C66 -2 76 -4 80 -6 C76 2 68 8 60 12 Z" fill="#30a46c" />
      <ellipse cx="22" cy="66" rx="7" ry="9" fill="#b08a5a" />
      <path d="M22 58 L30 42" stroke="#6d5233" strokeWidth="2.5" />
    </>),
  },
];

export function avatarName(id: string): string {
  return AVATARS.find((a) => a.id === id)?.name ?? 'Meeple';
}

export function Meeple({ avatar, color, size = 48 }: { avatar: string; color: string; size?: number }) {
  const a = AVATARS.find((x) => x.id === avatar) ?? AVATARS[0];
  return (
    <svg viewBox="0 -10 100 110" width={size} height={size} aria-label={a.name} role="img">
      <path d={MEEPLE} fill={color} stroke="rgba(0,0,0,.35)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M44 14 C46 11 50 10 53 11" stroke="rgba(255,255,255,.45)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {a.draw()}
    </svg>
  );
}

/** Photo if present, otherwise the meeple; always framed in the player colour. */
export function Avatar({
  avatar, color, photo, size = 48,
}: { avatar: string; color: string; photo?: string; size?: number }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', border: `${Math.max(2, size / 16)}px solid ${color}`, display: 'block' }}
      />
    );
  }
  return <Meeple avatar={avatar} color={color} size={size} />;
}
