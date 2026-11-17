import { useEffect, useRef, useState, type ReactNode } from 'react';
import { db, saveGame } from '../data/db';
import {
  activePause, adjustRound, currentPrep, currentTurn, discardSetup, endPause, finishGame, nextInOrder, rebook,
  setOrder, setPauseCategory, startPause, startPlay, startRules, switchTo, undoSwitch,
} from '../domain/game';
import { PAUSE_LABELS, pauseMsIn, playerStats, roundNumbers, turnRecords } from '../domain/stats';
import type { Game, PauseCategory } from '../domain/types';
import { signal, tick, useWakeLock } from '../lib/device';
import { fmtClock } from '../lib/format';
import { go } from '../lib/router';
import { Avatar } from '../ui/avatars';
import { Dialog } from '../ui/Dialog';
import { SortableList } from '../ui/SortableList';

const SHOW_TOTALS_KEY = 'pa.showTotals';
/** Taps on the turn area right after a switch are ignored (double-tap protection). */
const GUARD_MS = 1000;

function readShowTotals(): boolean {
  try { return localStorage.getItem(SHOW_TOTALS_KEY) === '1'; } catch { return false; }
}

export function Play({ id }: { id: string }) {
  const [game, setGame] = useState<Game | null>();
  const [now, setNow] = useState(Date.now());
  const [showTotals, setShowTotals] = useState(readShowTotals);
  const [dialog, setDialog] = useState<'rebook' | 'order' | 'finish'>();
  const alerted = useRef<number>();
  const lastSwitch = useRef(0);

  useEffect(() => {
    db.games.get(id).then((g) => setGame(g ?? null));
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (game && (game.status === 'scoring' || game.status === 'finished')) {
      go(game.status === 'scoring' ? `score/${game.id}` : `result/${game.id}`, true);
    }
  }, [game]);

  useWakeLock(!!game && (game.status === 'running' || game.status === 'prep'));

  const cur = game ? currentTurn(game) : undefined;
  const records = game ? turnRecords(game, now) : [];
  const curNet = cur ? records[records.length - 1].net : 0;
  const over = !!game?.softLimitSec && curNet > game.softLimitSec * 1000;

  // Soft limit: signal once per turn.
  useEffect(() => {
    if (over && cur && alerted.current !== cur.start) {
      alerted.current = cur.start;
      signal();
    }
  }, [over, cur]);

  if (game === undefined) return <div className="page">Lade …</div>;
  if (game === null) return <div className="page">Spiel nicht gefunden. <a href="#/">Zur Startseite</a></div>;

  const update = (g: Game) => {
    if (g === game) return;
    setGame(g);
    saveGame(g);
  };
  const t = () => Date.now();
  const pause = activePause(game);
  const pauseOverlay = pause && (
    <div className="pause-overlay">
      <div className="big">Pause</div>
      <div>zählt für niemanden</div>
      <div className="clock">{fmtClock(now - pause.start)}</div>
      <div className="seg" role="radiogroup" aria-label="Art der Pause">
        {(Object.keys(PAUSE_LABELS) as PauseCategory[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={pause.category === c}
            className={pause.category === c ? 'active' : ''}
            style={{ minHeight: 48, padding: '8px 18px', color: pause.category === c ? undefined : '#f3ece2' }}
            onClick={() => update(setPauseCategory(game, c))}
          >
            {PAUSE_LABELS[c]}
          </button>
        ))}
      </div>
      <button className="primary" style={{ minHeight: 64, fontSize: 22, padding: '0 40px' }} onClick={() => update(endPause(game, t()))}>
        Weiter
      </button>
    </div>
  );

  if (game.status === 'prep') {
    return <Prep game={game} now={now} update={update} pauseOverlay={pauseOverlay} />;
  }
  if (!cur) return null;

  const player = (pid: string) => game.players.find((p) => p.id === pid)!;
  const active = player(cur.playerId);
  const next = player(nextInOrder(game, cur.playerId));
  const totals = Object.fromEntries(playerStats(game, now, 0).map((s) => [s.id, s.raw]));
  const elapsed = now - (game.turns[0]?.start ?? game.createdAt);
  const rounds = roundNumbers(game);
  const round = rounds[rounds.length - 1] ?? 1;

  const doSwitch = (pid?: string) => {
    const at = t();
    if (at - lastSwitch.current < GUARD_MS) return;
    const g = switchTo(game, at, pid);
    if (g === game) return;
    lastSwitch.current = at;
    tick();
    update(g);
  };

  return (
    <div className="play" style={{ ['--player' as string]: active.color }}>
      <div className="play-top">
        <a href="#/" className="ghost" aria-label="Zur Startseite" style={{ color: 'inherit', textDecoration: 'none', padding: '0 6px' }}>⌂</a>
        <span className="title">{game.title || 'Partie'} · {fmtClock(elapsed)}</span>
        <span className="round">
          <button className="ghost icon" aria-label="Runde zurück" title="Rundenzahl korrigieren" onClick={() => update(adjustRound(game, -1))} disabled={round <= 1}>−</button>
          <span>Runde {round}</span>
          <button className="ghost icon" aria-label="Runde vor" title="Rundenzahl korrigieren" onClick={() => update(adjustRound(game, 1))}>+</button>
        </span>
        <button onClick={() => update(startPause(game, t()))} title="Pause" aria-label="Pause">⏸<span className="lbl"> Pause</span></button>
        <button onClick={() => update(undoSwitch(game))} disabled={game.turns.length < 2} title="Letzten Wechsel zurücknehmen" aria-label="Rückgängig">↶<span className="lbl"> Rückgängig</span></button>
        <button onClick={() => setDialog('rebook')} title="Zeit umbuchen" aria-label="Umbuchen">⇄<span className="lbl"> Umbuchen</span></button>
        <button onClick={() => setDialog('order')} title="Reihenfolge ändern" aria-label="Reihenfolge">⇅<span className="lbl"> Reihenfolge</span></button>
        <button
          className={showTotals ? 'primary' : ''}
          title="Gesamtzeiten ein-/ausblenden"
          aria-label="Gesamtzeiten"
          onClick={() => {
            const v = !showTotals;
            setShowTotals(v);
            try { localStorage.setItem(SHOW_TOTALS_KEY, v ? '1' : '0'); } catch { /* ignore */ }
          }}
        >
          Σ<span className="lbl"> Zeiten</span>
        </button>
        <button className="danger" onClick={() => setDialog('finish')} title="Spiel beenden" aria-label="Beenden">■<span className="lbl"> Beenden</span></button>
      </div>

      <div className="play-main">
        <button className="turn-button" onClick={() => doSwitch()} aria-label={`Zug beenden, weiter mit ${next.name}`}>
          <Avatar avatar={active.avatar} color={active.color} photo={active.photo} size={120} />
          <span className="who">{active.name}</span>
          <span className={`clock ${over ? 'over' : ''}`}>{fmtClock(curNet)}</span>
          <span className="hint">Tippen = Zug beenden · weiter mit {next.name}</span>
        </button>

        <div className="player-bar">
          {game.order.map((pid) => {
            const p = player(pid);
            const isActive = pid === cur.playerId;
            return (
              <button
                key={pid}
                className={isActive ? 'active' : ''}
                style={{ borderColor: isActive ? undefined : p.color }}
                onClick={() => !isActive && doSwitch(pid)}
                aria-label={isActive ? `${p.name} ist am Zug` : `${p.name} ist als Nächstes dran`}
              >
                <Avatar avatar={p.avatar} color={p.color} photo={p.photo} size={36} />
                <span>
                  {p.name}
                  {showTotals && <span className="total"><br />{fmtClock(totals[pid])}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {pauseOverlay}

      {dialog === 'rebook' && (
        <RebookDialog
          game={game}
          now={now}
          onClose={() => setDialog(undefined)}
          onApply={(sec, pid) => { update(rebook(game, t(), sec, pid)); setDialog(undefined); }}
        />
      )}

      {dialog === 'order' && (
        <Dialog title="Reihenfolge ändern" onClose={() => setDialog(undefined)}>
          <p className="muted" style={{ marginTop: 0 }}>Bestimmt, wer standardmäßig als Nächstes dran ist. Bisherige Züge bleiben unverändert.</p>
          <SortableList
            ids={game.order}
            onChange={(ids) => update(setOrder(game, ids))}
            render={(pid, i) => {
              const p = player(pid);
              return (<><span className="pos">{i + 1}.</span><Avatar avatar={p.avatar} color={p.color} photo={p.photo} size={36} /><span>{p.name}</span></>);
            }}
          />
        </Dialog>
      )}

      {dialog === 'finish' && (
        <Dialog title="Spiel beenden?" onClose={() => setDialog(undefined)}>
          <p>Der laufende Zug von {active.name} wird abgeschlossen. Danach geht es zur Punkteeingabe.</p>
          <div className="row">
            <span className="spacer" />
            <button className="ghost" onClick={() => setDialog(undefined)}>Weiterspielen</button>
            <button className="primary" onClick={() => update(finishGame(game, t()))}>Beenden</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** Setup and rules explanation before the first turn, ending with the choice of the start player. */
function Prep({
  game, now, update, pauseOverlay,
}: {
  game: Game;
  now: number;
  update: (g: Game) => void;
  pauseOverlay: ReactNode;
}) {
  const phase = currentPrep(game);
  const [choosing, setChoosing] = useState(!phase);
  const [starter, setStarter] = useState(game.order[0]);
  const [rolling, setRolling] = useState(false);
  const t = () => Date.now();
  const phaseNet = phase ? Math.max(0, now - phase.start - pauseMsIn(game, phase.start, now, now)) : 0;
  const label = phase?.kind === 'rules' ? 'Regelerklärung' : 'Aufbau';

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    const ids = game.order;
    let n = 0;
    const steps = 16 + Math.floor(Math.random() * ids.length);
    const iv = setInterval(() => {
      n++;
      setStarter(ids[n % ids.length]);
      if (n >= steps) {
        clearInterval(iv);
        setStarter(ids[Math.floor(Math.random() * ids.length)]);
        setRolling(false);
        signal();
      }
    }, 90);
  };

  const starterP = game.players.find((p) => p.id === starter)!;

  return (
    <div className="play" style={{ ['--player' as string]: choosing ? starterP.color : 'var(--accent)' }}>
      <div className="play-top">
        <a href="#/" className="ghost" aria-label="Zur Startseite" style={{ color: 'inherit', textDecoration: 'none', padding: '0 6px' }}>⌂</a>
        <span className="title">{game.title || 'Partie'} · Vorbereitung</span>
        {phase && <button onClick={() => update(startPause(game, t()))} aria-label="Pause">⏸<span className="lbl"> Pause</span></button>}
      </div>

      <div className="prep">
        {phase && (
          <div className="prep-clock">
            <div className="who">{label}</div>
            <div className="clock">{fmtClock(phaseNet)}</div>
          </div>
        )}

        {!choosing ? (
          <div className="prep-actions">
            {phase?.kind === 'setup' && (
              <button className="big" onClick={() => update(startRules(game, t()))}>Aufbau fertig → Regelerklärung</button>
            )}
            <button className="big primary" onClick={() => setChoosing(true)}>
              {phase?.kind === 'setup' ? 'Aufbau fertig → Losspielen' : 'Regeln erklärt → Losspielen'}
            </button>
            {phase?.kind === 'setup' && game.prep?.length === 1 && (
              <button className="ghost" onClick={() => { update(discardSetup(game)); setChoosing(true); }}>
                Schon aufgebaut – Aufbau nicht messen
              </button>
            )}
          </div>
        ) : (
          <div className="prep-actions">
            <h2 style={{ margin: 0 }}>Wer beginnt?</h2>
            <div className="starter-grid">
              {game.order.map((pid) => {
                const p = game.players.find((x) => x.id === pid)!;
                return (
                  <button
                    key={pid}
                    className={`profile-tile ${pid === starter ? 'selected' : ''}`}
                    style={{ borderColor: p.color }}
                    disabled={rolling}
                    onClick={() => setStarter(pid)}
                  >
                    <Avatar avatar={p.avatar} color={p.color} photo={p.photo} size={56} />
                    <span className="name">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button onClick={roll} disabled={rolling}>🎲 Auslosen</button>
              {phase && <button className="ghost" onClick={() => setChoosing(false)} disabled={rolling}>Zurück</button>}
            </div>
            <button className="big primary" disabled={rolling} onClick={() => { tick(); update(startPlay(game, t(), starter)); }}>
              Los geht's – {starterP.name} beginnt
            </button>
          </div>
        )}
      </div>

      {pauseOverlay}
    </div>
  );
}

function RebookDialog({
  game, now, onClose, onApply,
}: {
  game: Game;
  now: number;
  onClose: () => void;
  onApply: (seconds: number, playerId: string) => void;
}) {
  const cur = currentTurn(game)!;
  const maxSec = Math.max(0, Math.floor((now - cur.start) / 1000) - 1);
  const [sec, setSec] = useState(Math.min(30, maxSec));
  const others = game.order.filter((p) => p !== cur.playerId);
  const [target, setTarget] = useState(nextInOrder(game, cur.playerId));
  const name = (pid: string) => game.players.find((p) => p.id === pid)!.name;

  return (
    <Dialog title="Zeit umbuchen" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Vergessen weiterzutippen? Die letzten Sekunden von {name(cur.playerId)} werden einem anderen Spieler gutgeschrieben, der dann am Zug ist.
      </p>
      {maxSec < 1 ? (
        <p>Der laufende Zug ist noch zu kurz zum Umbuchen.</p>
      ) : (
        <>
          <div className="row">
            <strong style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums' }}>{fmtClock(sec * 1000)}</strong>
            <span className="muted">von {fmtClock(maxSec * 1000)}</span>
          </div>
          <input type="range" min={1} max={maxSec} value={sec} onChange={(e) => setSec(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          <div className="row">
            {[15, 30, 60, 120, 300].filter((q) => q <= maxSec).map((q) => (
              <button key={q} onClick={() => setSec(q)}>{q < 60 ? `${q} s` : `${q / 60} min`}</button>
            ))}
          </div>
          <h3>… gehören zu</h3>
          <div className="row">
            {others.map((pid) => {
              const p = game.players.find((x) => x.id === pid)!;
              return (
                <button key={pid} className={pid === target ? 'primary' : ''} onClick={() => setTarget(pid)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Avatar avatar={p.avatar} color={p.color} photo={p.photo} size={28} /> {p.name}
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <span className="spacer" />
            <button className="ghost" onClick={onClose}>Abbrechen</button>
            <button className="primary" onClick={() => onApply(sec, target)}>Umbuchen</button>
          </div>
        </>
      )}
    </Dialog>
  );
}
