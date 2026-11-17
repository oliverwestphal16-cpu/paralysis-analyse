/** One star, filled to `fill` (0..1). */
function Star({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="star" style={{ fontSize: size, width: size, height: size }} aria-hidden="true">
      <span className="star-bg">★</span>
      <span className="star-fg" style={{ width: `${Math.round(fill * 100)}%` }}>★</span>
    </span>
  );
}

/** Read-only stars for a 1..10 value (0.5 star per point). */
export function StarDisplay({ value, size = 20 }: { value: number | undefined; size?: number }) {
  const v = value ?? 0;
  return (
    <span className="stars" role="img" aria-label={value === undefined ? 'nicht bewertet' : `${(v / 2).toLocaleString('de-DE')} von 5 Sternen`}>
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} fill={Math.min(1, Math.max(0, v / 2 - i))} />)}
    </span>
  );
}

/**
 * 5 stars with half steps → 1..10. Left half of star i = 2i+1, right half = 2i+2.
 * Tapping the current value again clears it ("nicht bewertet").
 */
export function StarInput({
  value, onChange, size = 36, label,
}: { value: number | undefined; onChange: (v: number | undefined) => void; size?: number; label: string }) {
  const v = value ?? 0;
  return (
    <span className="stars stars-input" role="group" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="star-wrap" style={{ width: size, height: size }}>
          <Star size={size} fill={Math.min(1, Math.max(0, v / 2 - i))} />
          {[1, 2].map((h) => {
            const n = 2 * i + h;
            return (
              <button
                key={h}
                type="button"
                className={`star-hit ${h === 1 ? 'left' : 'right'}`}
                aria-label={`${label}: ${(n / 2).toLocaleString('de-DE')} Sterne`}
                aria-pressed={value === n}
                onClick={() => onChange(value === n ? undefined : n)}
              />
            );
          })}
        </span>
      ))}
    </span>
  );
}

/**
 * Continuous descriptive slider (0..1). Counts as "not rated" until touched; the × resets it.
 */
export function ScaleSlider({
  value, onChange, labels, label,
}: { value: number | undefined; onChange: (v: number | undefined) => void; labels: string[]; label: string }) {
  return (
    <div className={`scale ${value === undefined ? 'unset' : ''}`}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label={label}
          value={value === undefined ? 50 : Math.round(value * 100)}
          onPointerDown={(e) => value === undefined && onChange(Number((e.target as HTMLInputElement).value) / 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <button type="button" className="ghost icon" aria-label={`${label} zurücksetzen`} disabled={value === undefined} onClick={() => onChange(undefined)}>×</button>
      </div>
      <div className="scale-labels">
        {labels.map((l) => <span key={l}>{l}</span>)}
      </div>
      {value === undefined && <div className="muted" style={{ fontSize: 13, textAlign: 'center' }}>noch nicht eingeordnet – Regler antippen</div>}
    </div>
  );
}

/** Read-only position on a descriptive scale. */
export function ScaleBar({ value, labels }: { value: number | undefined; labels: string[] }) {
  if (value === undefined) return <span className="muted">–</span>;
  return (
    <div className="scalebar">
      <div className="scalebar-track"><div className="scalebar-dot" style={{ left: `${value * 100}%` }} /></div>
      <div className="scale-labels">{labels.map((l) => <span key={l}>{l}</span>)}</div>
    </div>
  );
}

export const LUCK_LABELS = ['Glück', 'Taktik', 'Strategie'];
export const BRAINY_LABELS = ['locker', 'Kopfrauchen'];
