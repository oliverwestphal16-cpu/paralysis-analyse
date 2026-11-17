import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, useCriteria } from '../data/db';
import { summarize } from '../domain/rating';
import { awards as computeAwards, type Award } from '../domain/awards';
import {
  PAUSE_LABELS, PHASES, efficiency, gameSpan, mean, pauseSummary, phaseOf, phaseWindow, playerStats, prepTimes,
  radarAxes, ranking, roundDurations, roundNumbers, topTurns, turnRecords, type Phase, type PlayerStats,
} from '../domain/stats';
import type { Game, PauseCategory } from '../domain/types';
import { fmtClock, fmtDate, fmtDur, fmtNum } from '../lib/format';
import { shareOrDownload } from '../lib/photo';
import { go } from '../lib/router';
import { renderShareCard } from '../lib/shareCard';
import { Avatar } from '../ui/avatars';
import { EChart } from '../ui/EChart';
import { GamePhotos } from '../ui/GamePhotos';
import { RatingCard } from '../ui/RatingCard';
import {
  PREP_COLORS, barsOption, boxplotOption, lineOption, phaseBarsOption, pieExtras, pieOption, raceOption, radarOption,
  scatterOption, timelineOption,
} from './charts';

const FACTOR_KEY = 'pa.factor';
const PREP_KEY = 'pa.showPrep';

function readFactor(): number {
  try {
    const v = Number(localStorage.getItem(FACTOR_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0;
  } catch { return 0; }
}

function readShowPrep(): boolean {
  try { return localStorage.getItem(PREP_KEY) !== '0'; } catch { return true; }
}

function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

type Dist = 'timeline' | 'line' | 'bars';
type PhaseFilter = 'all' | Phase;

export function Result({ id }: { id: string }) {
  const game = useLiveQuery(() => db.games.get(id), [id], null);
  const criteria = useCriteria();
  const [factor, setFactorState] = useState(readFactor);
  const [showPrep, setShowPrepState] = useState(readShowPrep);
  const [tab, setTab] = useState<'overview' | 'more'>('overview');
  const [dist, setDist] = useState<Dist>('timeline');
  const [phase, setPhase] = useState<PhaseFilter>('all');
  const [sharing, setSharing] = useState<string>();

  const setFactor = (f: number) => { setFactorState(f); store(FACTOR_KEY, String(f)); };
  const setShowPrep = (v: boolean) => { setShowPrepState(v); store(PREP_KEY, v ? '1' : '0'); };

  const data = useMemo(() => {
    if (!game) return undefined;
    const now = game.endedAt ?? Date.now();
    const ph = phase === 'all' ? undefined : phase;
    const stats = playerStats(game, now, factor, ph);
    const eff = efficiency(game, stats);
    return {
      now,
      stats,
      eff,
      rank: ranking(stats),
      axes: radarAxes(game, stats, eff, !ph),
      awards: computeAwards(game, now, factor),
      prep: prepTimes(game, now),
      rounds: roundDurations(game, now),
      roundCount: Math.max(0, ...roundNumbers(game)),
    };
  }, [game, factor, phase]);

  if (game === null) return <div className="page">Lade …</div>;
  if (!game || !data) return <div className="page">Spiel nicht gefunden. <a href="#/">Zur Startseite</a></div>;

  const { now, stats, eff, rank, axes, awards, prep, rounds, roundCount } = data;
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const span = gameSpan(game, now);
  const playMs = span.end - span.start;
  const hasPrep = prep.setup !== undefined || prep.rules !== undefined;
  const prepShown = showPrep && hasPrep && phase === 'all';
  const totalMs = prepShown && prep.start !== undefined ? span.end - prep.start : playMs;
  const pauses = pauseSummary(game, now, prepShown ? undefined : span);
  const phaseLabel = phase === 'all' ? undefined : PHASES.find((p) => p.key === phase)!.label;

  const durationLine = [
    prepShown ? `Gesamt ${fmtDur(totalMs)}` : `Dauer ${fmtDur(playMs)}`,
    prepShown && prep.setup !== undefined ? `Aufbau ${fmtDur(prep.setup)}` : '',
    prepShown && prep.rules !== undefined ? `Regeln ${fmtDur(prep.rules)}` : '',
    prepShown ? `Spiel ${fmtDur(playMs)}` : '',
  ].filter(Boolean).join(' · ');

  const share = async () => {
    setSharing('Erzeuge Bild …');
    try {
      const whole = ranking(playerStats(game, now, factor));
      const blob = await renderShareCard({ game, rank: whole, awards, durationLine, rating: summarize(game.rating, criteria)?.overall });
      const r = await shareOrDownload(blob, `paralysis-analyse-${new Date(game.createdAt).toISOString().slice(0, 10)}.png`, game.title);
      setSharing(r === 'downloaded' ? 'Bild heruntergeladen.' : undefined);
    } catch (e) {
      setSharing(`Teilen fehlgeschlagen: ${(e as Error).message}`);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <div className="spacer">
            <h2 style={{ margin: 0 }}>{game.title || 'Partie'}</h2>
            <div className="muted">
              {fmtDate(game.createdAt)} · {durationLine}
              <br />
              {game.turns.length} Züge · {roundCount} Runden{rounds.length > 0 && ` · Ø Runde ${fmtDur(mean(rounds))}`}
              {pauses.total > 0 && ` · Pausen ${fmtDur(pauses.total)}`}
            </div>
          </div>
          {(game.status === 'running' || game.status === 'prep') && <button className="primary" onClick={() => go(`play/${game.id}`)}>Weiterspielen</button>}
          {game.status !== 'running' && game.status !== 'prep' && (
            <>
              <button onClick={() => go(`score/${game.id}`)}>{game.scores ? 'Punkte ändern' : 'Punkte eintragen'}</button>
              <button className="primary" onClick={share}>Teilen</button>
            </>
          )}
        </div>
        {sharing && <p className="muted" style={{ marginBottom: 0 }}>{sharing}</p>}

        <div className="factor" style={{ marginTop: 14 }}>
          <label htmlFor="factor"><strong>Vorausdenk-Faktor</strong></label>
          <input id="factor" type="range" min={0} max={1} step={0.05} value={factor} onChange={(e) => setFactor(Number(e.target.value))} />
          <strong style={{ width: 44, textAlign: 'right' }}>{fmtNum(factor)}</strong>
        </div>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {factor === 0
            ? 'Aus: Es zählt nur die eigene Zugzeit.'
            : `Jedem Spieler werden zusätzlich ${fmtNum(factor * 100, 0)} % der Dauer des direkt vorangehenden Zugs eines anderen Spielers angerechnet.`}
        </p>

        <div className="row" style={{ marginTop: 12 }}>
          <div className="seg" role="radiogroup" aria-label="Spielphase">
            {([['all', 'Insgesamt'], ...PHASES.map((p) => [p.key, p.label.replace(' Game', '')])] as [PhaseFilter, string][]).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={phase === k} className={phase === k ? 'active' : ''} onClick={() => setPhase(k)}>{l}</button>
            ))}
          </div>
          {hasPrep && (
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={showPrep} onChange={(e) => setShowPrep(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
              Aufbau & Regeln anzeigen
            </label>
          )}
        </div>
        {phaseLabel && (
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Nur {phaseLabel}: {phase === 'early' ? 'erste 25 %' : phase === 'mid' ? 'mittlere 50 %' : 'letzte 25 %'} aller Züge. Punkte gibt es nur für das gesamte Spiel.
          </p>
        )}
      </div>

      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Übersicht</button>
        <button className={tab === 'more' ? 'active' : ''} onClick={() => setTab('more')}>Weitere Statistiken</button>
      </div>

      {tab === 'overview' ? (
        <>
          <div className="card">
            <h2>Wer war am schnellsten?{phaseLabel && ` (${phaseLabel})`}</h2>
            <Podium game={game} rank={rank} factor={factor} />
            {rank.length > 3 && (
              <div className="rest-list">
                {rank.slice(3).map((s, i) => (
                  <div className="row" key={s.id}>
                    <span className="muted" style={{ width: 28 }}>{i + 4}.</span>
                    <Avatar {...by[s.id]} size={32} />
                    <span className="spacer">{by[s.id].name}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtClock(s.adjusted)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {awards.length > 0 && phase === 'all' && <AwardsCard game={game} awards={awards} />}

          <div className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <h2 className="spacer" style={{ margin: 0 }}>Verteilung über das Spiel</h2>
              <div className="seg">
                {([['timeline', 'Zeitleiste'], ['line', 'Verlauf'], ['bars', 'Züge']] as [Dist, string][]).map(([k, l]) => (
                  <button key={k} className={dist === k ? 'active' : ''} onClick={() => setDist(k)}>{l}</button>
                ))}
              </div>
            </div>
            {dist === 'timeline' && <EChart option={timelineOption(game, now, prepShown)} height={160} />}
            {dist === 'line' && <EChart option={lineOption(game, now)} height={320} />}
            {dist === 'bars' && <EChart option={barsOption(game, now)} height={320} />}
            <Legend game={game} prep={prepShown && dist === 'timeline' ? prep : undefined} />
            <p className="muted" style={{ marginBottom: 0 }}>
              Hinterlegt: Early (erste 25 % der Züge), Mid (50 %), Late (letzte 25 %).{dist === 'bars' && ' Gepunktete Linien trennen die Runden.'}
            </p>
          </div>

          {prepShown && (
            <div className="card">
              <h2>Vorbereitung</h2>
              <table className="stats" style={{ maxWidth: 420 }}>
                <tbody>
                  {prep.setup !== undefined && <tr><td>Aufbau</td><td>{fmtClock(prep.setup)}</td></tr>}
                  {prep.rules !== undefined && <tr><td>Regelerklärung</td><td>{fmtClock(prep.rules)}</td></tr>}
                  <tr><td>Spiel</td><td>{fmtClock(playMs)}</td></tr>
                  <tr><td><strong>Gesamt</strong></td><td><strong>{fmtClock(totalMs)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <h2>Punkte im Verhältnis zur Zeit</h2>
            {phase !== 'all' ? (
              <p className="muted">Punkte gibt es nur für das gesamte Spiel – Filter auf „Insgesamt“ stellen.</p>
            ) : !game.scores ? (
              <p className="muted">Noch keine Punkte eingetragen. <button onClick={() => go(`score/${game.id}`)}>Punkte eintragen</button></p>
            ) : (
              <div className="grid-2">
                <div className="table-wrap">
                  <table className="stats">
                    <thead><tr><th>Spieler</th><th>Punkte</th><th>Zeit</th><th>Punkte/min</th><th>Effizienz</th></tr></thead>
                    <tbody>
                      {eff.map((e) => (
                        <tr key={e.id}>
                          <td>{by[e.id].name}</td>
                          <td>{fmtNum(e.score ?? 0)}</td>
                          <td>{fmtClock(stats.find((s) => s.id === e.id)!.adjusted)}</td>
                          <td>{e.pointsPerMinute === null ? '–' : fmtNum(e.pointsPerMinute)}</td>
                          <td>{e.relativeIndex === null ? 'n. b.' : fmtNum(e.relativeIndex)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted">
                    Effizienz = Punkteanteil ÷ Zeitanteil. Über 1 heißt: mehr Punkte pro Minute als der Tisch im Schnitt.
                    {eff.some((e) => e.relativeIndex === null) && ' „n. b.“: nicht berechenbar, weil die Punktesumme des Tisches nicht positiv ist oder der Spieler keine Zeit verbraucht hat.'}
                  </p>
                </div>
                <EChart option={scatterOption(game, stats, eff)} height={280} />
              </div>
            )}
          </div>

          {game.status !== 'running' && game.status !== 'prep' && <RatingCard game={game} />}

          {game.status !== 'running' && game.status !== 'prep' && (
            <div className="card">
              <h2>Fotos</h2>
              <GamePhotos gameId={game.id} title={game.title} />
            </div>
          )}
        </>
      ) : (
        <MoreStats game={game} now={now} stats={stats} phase={phase} showPrep={prepShown} axesOption={radarOption(game, axes)} />
      )}
    </div>
  );
}

function Podium({ game, rank, factor }: { game: Game; rank: PlayerStats[]; factor: number }) {
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  // Display order 2 – 1 – 3, like a real podium.
  const slots = [rank[1], rank[0], rank[2]].map((s, i) => ({ s, place: [2, 1, 3][i] })).filter((x) => x.s);
  return (
    <div className="podium">
      {slots.map(({ s, place }) => (
        <div key={s.id} className={`place p${place}`}>
          <Avatar {...by[s.id]} size={place === 1 ? 84 : 64} />
          <div className="pname">{by[s.id].name}</div>
          <div className="ptime">
            {fmtClock(s.adjusted)}
            {factor > 0 && <div style={{ fontSize: 12 }}>roh {fmtClock(s.raw)}</div>}
          </div>
          <div className="block">{place}</div>
        </div>
      ))}
    </div>
  );
}

function fmtAward(a: Award): string {
  if (a.format === 'time') return fmtClock(a.value);
  if (a.format === 'percent') return `${fmtNum(a.value * 100, 0)} %`;
  return fmtNum(a.value);
}

function AwardsCard({ game, awards }: { game: Game; awards: Award[] }) {
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  return (
    <div className="card">
      <h2>Titel des Abends</h2>
      <div className="awards">
        {awards.map((a) => (
          <div key={a.key} className="award">
            <div className="avatars-inline">{a.playerIds.map((id) => <Avatar key={id} {...by[id]} size={40} />)}</div>
            <div>
              <strong>{a.title}</strong>: {a.playerIds.map((id) => by[id].name).join(', ')}
              <div className="muted" style={{ fontSize: 14 }}>{a.description} · {fmtAward(a)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ game, prep }: { game: Game; prep?: { setup?: number; rules?: number } }) {
  const item = (color: string, label: string) => (
    <span className="row" style={{ gap: 4 }} key={label}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />{label}
    </span>
  );
  return (
    <div className="row" style={{ marginTop: 6, fontSize: 14 }}>
      {prep?.setup !== undefined && item(PREP_COLORS.setup, 'Aufbau')}
      {prep?.rules !== undefined && item(PREP_COLORS.rules, 'Regelerklärung')}
      {game.players.map((p) => item(p.color, p.name))}
      {game.pauses.length > 0 && item('var(--pause)', 'Pause')}
    </div>
  );
}

function MoreStats({
  game, now, stats, phase, showPrep, axesOption,
}: {
  game: Game; now: number; stats: PlayerStats[]; phase: PhaseFilter; showPrep: boolean;
  axesOption: ReturnType<typeof radarOption>;
}) {
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const ph = phase === 'all' ? undefined : phase;
  const window = ph ? phaseWindow(game, now, ph) : showPrep ? undefined : gameSpan(game, now);
  const pauses = ph && !window ? { total: 0, count: 0, byCategory: { rules: 0, food: 0, other: 0 } } : pauseSummary(game, now, window);
  const top = topTurns(game, now, 5, ph);
  const start = gameSpan(game, now).start;
  const extras = ph ? [] : pieExtras(game, now, showPrep);
  const recs = turnRecords(game, now);

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>Spielerprofil</h2>
          <EChart option={axesOption} height={360} />
          <p className="muted">Außen = Bestwert am Tisch. Konstanz misst die relative Streuung der Zugdauern.</p>
        </div>
        <div className="card">
          <h2>Anteil an der {ph ? 'Phasenzeit' : 'Spielzeit'}</h2>
          <EChart option={pieOption(game, stats, extras)} height={360} />
        </div>
      </div>

      <div className="card">
        <h2>Kennzahlen</h2>
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr><th>Spieler</th><th>Züge</th><th>Gesamt roh</th><th>Vorausdenken</th><th>Gesamt bereinigt</th><th>Ø Zug</th><th>Median</th><th>Kürzester</th><th>Längster</th><th>Streuung σ</th></tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id}>
                  <td>{by[s.id].name}</td>
                  <td>{s.turns}</td>
                  <td>{fmtClock(s.raw)}</td>
                  <td>{fmtClock(s.foresight)}</td>
                  <td>{fmtClock(s.adjusted)}</td>
                  <td>{fmtClock(s.mean)}</td>
                  <td>{fmtClock(s.median)}</td>
                  <td>{fmtClock(s.min)}</td>
                  <td>{fmtClock(s.max)}</td>
                  <td>{fmtClock(s.std)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">„Vorausdenken“ ist die volle Dauer der direkt vorangehenden fremden Züge; angerechnet wird davon der eingestellte Faktor.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Ø Zugdauer je Phase</h2>
          <EChart option={phaseBarsOption(game, now)} height={300} />
        </div>
        <div className="card">
          <h2>Phasen im Detail</h2>
          <PhaseTable game={game} recs={recs} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Verteilung der Zugdauern</h2>
          <EChart option={boxplotOption(game, stats)} height={300} />
        </div>
        <div className="card">
          <h2>Das Rennen</h2>
          <EChart option={raceOption(game, now)} height={300} />
          <p className="muted">Aufsummierte Zeit je Spieler nach jedem Zug.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Die 5 längsten Züge</h2>
          {top.map((r, i) => (
            <div className="row" key={r.index} style={{ marginBottom: 8 }}>
              <span className="muted" style={{ width: 22 }}>{i + 1}.</span>
              <Avatar {...by[r.playerId]} size={32} />
              <span className="spacer">{by[r.playerId].name}<br /><span className="muted" style={{ fontSize: 13 }}>Zug {r.playerTurnNo} · bei {fmtClock(r.start - start)}</span></span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtClock(r.net)}</strong>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Pausen</h2>
          {pauses.count === 0 ? <p className="muted">Keine Pausen.</p> : (
            <table className="stats">
              <tbody>
                {(Object.keys(PAUSE_LABELS) as PauseCategory[]).map((c) => (
                  <tr key={c}><td>{PAUSE_LABELS[c]}</td><td>{fmtClock(pauses.byCategory[c] ?? 0)}</td></tr>
                ))}
                <tr><td><strong>Gesamt ({pauses.count}×)</strong></td><td><strong>{fmtClock(pauses.total)}</strong></td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function PhaseTable({ game, recs }: { game: Game; recs: ReturnType<typeof turnRecords> }) {
  const cell = (pid: string, ph: Phase) => {
    const inPhase = recs.filter((r) => phaseOf(r.index, recs.length) === ph);
    const mine = inPhase.filter((r) => r.playerId === pid).map((r) => r.net);
    const total = inPhase.reduce((a, r) => a + r.net, 0);
    const sum = mine.reduce((a, b) => a + b, 0);
    return { mean: mine.length ? mean(mine) : undefined, sum, share: total > 0 ? sum / total : 0 };
  };
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr><th>Spieler</th>{PHASES.map((p) => <th key={p.key} colSpan={2}>{p.label.replace(' Game', '')}</th>)}</tr>
          <tr><th></th>{PHASES.map((p) => [<th key={`${p.key}m`}>Ø</th>, <th key={`${p.key}s`}>Anteil</th>])}</tr>
        </thead>
        <tbody>
          {game.players.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              {PHASES.map(({ key }) => {
                const c = cell(p.id, key);
                return [
                  <td key={`${key}m`}>{c.mean === undefined ? '–' : fmtClock(c.mean)}</td>,
                  <td key={`${key}s`} title={fmtClock(c.sum)}>{fmtNum(c.share * 100, 0)} %</td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Anteil = Anteil an der gesamten Zugzeit dieser Phase.</p>
    </div>
  );
}
