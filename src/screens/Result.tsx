import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import {
  efficiency, gameSpan, pauseSummary, playerStats, radarAxes, ranking, topTurns, type PlayerStats,
} from '../domain/stats';
import type { Game } from '../domain/types';
import { fmtClock, fmtDate, fmtDur, fmtNum } from '../lib/format';
import { go } from '../lib/router';
import { Avatar } from '../ui/avatars';
import { EChart } from '../ui/EChart';
import {
  barsOption, boxplotOption, lineOption, pieOption, raceOption, radarOption, scatterOption, timelineOption,
} from './charts';

const FACTOR_KEY = 'pa.factor';

function readFactor(): number {
  try {
    const v = Number(localStorage.getItem(FACTOR_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0;
  } catch { return 0; }
}

type Dist = 'timeline' | 'line' | 'bars';

export function Result({ id }: { id: string }) {
  const game = useLiveQuery(() => db.games.get(id), [id], null);
  const [factor, setFactorState] = useState(readFactor);
  const [tab, setTab] = useState<'overview' | 'more'>('overview');
  const [dist, setDist] = useState<Dist>('timeline');

  const setFactor = (f: number) => {
    setFactorState(f);
    try { localStorage.setItem(FACTOR_KEY, String(f)); } catch { /* ignore */ }
  };

  const data = useMemo(() => {
    if (!game) return undefined;
    const now = game.endedAt ?? Date.now();
    const stats = playerStats(game, now, factor);
    const eff = efficiency(game, stats);
    return { now, stats, eff, rank: ranking(stats), axes: radarAxes(game, stats, eff) };
  }, [game, factor]);

  if (game === null) return <div className="page">Lade …</div>;
  if (!game || !data) return <div className="page">Spiel nicht gefunden. <a href="#/">Zur Startseite</a></div>;

  const { now, stats, eff, rank, axes } = data;
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const span = gameSpan(game, now);
  const pauses = pauseSummary(game, now);

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <div className="spacer">
            <h2 style={{ margin: 0 }}>{game.title || 'Partie'}</h2>
            <div className="muted">
              {fmtDate(game.createdAt)} · Dauer {fmtDur(span.end - span.start)} · {game.turns.length} Züge
              {pauses.total > 0 && ` · Pausen ${fmtDur(pauses.total)}`}
            </div>
          </div>
          {game.status === 'running' && <button className="primary" onClick={() => go(`play/${game.id}`)}>Weiterspielen</button>}
          {game.status !== 'running' && <button onClick={() => go(`score/${game.id}`)}>{game.scores ? 'Punkte ändern' : 'Punkte eintragen'}</button>}
        </div>
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
      </div>

      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Übersicht</button>
        <button className={tab === 'more' ? 'active' : ''} onClick={() => setTab('more')}>Weitere Statistiken</button>
      </div>

      {tab === 'overview' ? (
        <>
          <div className="card">
            <h2>Wer war am schnellsten?</h2>
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

          <div className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <h2 className="spacer" style={{ margin: 0 }}>Verteilung über das Spiel</h2>
              <div className="seg">
                {([['timeline', 'Zeitleiste'], ['line', 'Verlauf'], ['bars', 'Züge']] as [Dist, string][]).map(([k, l]) => (
                  <button key={k} className={dist === k ? 'active' : ''} onClick={() => setDist(k)}>{l}</button>
                ))}
              </div>
            </div>
            {dist === 'timeline' && <EChart option={timelineOption(game, now)} height={150} />}
            {dist === 'line' && <EChart option={lineOption(game, now)} height={320} />}
            {dist === 'bars' && <EChart option={barsOption(game, now)} height={320} />}
            <Legend game={game} />
          </div>

          <div className="card">
            <h2>Punkte im Verhältnis zur Zeit</h2>
            {!game.scores ? (
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
        </>
      ) : (
        <MoreStats game={game} now={now} stats={stats} axesOption={radarOption(game, axes)} />
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

function Legend({ game }: { game: Game }) {
  return (
    <div className="row" style={{ marginTop: 6, fontSize: 14 }}>
      {game.players.map((p) => (
        <span key={p.id} className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color, display: 'inline-block' }} />{p.name}
        </span>
      ))}
      {game.pauses.length > 0 && (
        <span className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--pause)', display: 'inline-block' }} />Pause
        </span>
      )}
    </div>
  );
}

function MoreStats({
  game, now, stats, axesOption,
}: { game: Game; now: number; stats: PlayerStats[]; axesOption: ReturnType<typeof radarOption> }) {
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const pauses = pauseSummary(game, now);
  const top = topTurns(game, now, 5);
  const start = gameSpan(game, now).start;
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>Spielerprofil</h2>
          <EChart option={axesOption} height={360} />
          <p className="muted">Außen = Bestwert am Tisch. Konstanz misst die relative Streuung der Zugdauern.</p>
        </div>
        <div className="card">
          <h2>Anteil an der Spielzeit</h2>
          <EChart option={pieOption(game, stats, now)} height={360} />
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
                <tr><td>Regelklärung</td><td>{fmtClock(pauses.byCategory.rules)}</td></tr>
                <tr><td>Sonstiges</td><td>{fmtClock(pauses.byCategory.other)}</td></tr>
                <tr><td><strong>Gesamt ({pauses.count}×)</strong></td><td><strong>{fmtClock(pauses.total)}</strong></td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
