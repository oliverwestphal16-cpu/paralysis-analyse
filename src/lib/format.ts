/** 75_000 → "1:15", 3_725_000 → "1:02:05" */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Short human duration: "45 s", "2:10 min", "1:02 h". */
export function fmtDur(ms: number): string {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0).replace('.', ',')} s`;
  if (sec < 3600) return `${fmtClock(ms)} min`;
  return `${fmtClock(ms).slice(0, -3)} h`;
}

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
