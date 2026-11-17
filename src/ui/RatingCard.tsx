import { useState } from 'react';
import { useCriteria } from '../data/db';
import { activeCriteria, fmtScore, summarize } from '../domain/rating';
import type { Game, GameRating } from '../domain/types';
import { go } from '../lib/router';
import { Avatar } from './avatars';
import { Dialog } from './Dialog';
import { BRAINY_LABELS, LUCK_LABELS, ScaleBar, StarDisplay } from './Stars';

/** "Wie war die Partie?" – start a rating or show the result. */
export function RatingCard({ game }: { game: Game }) {
  const criteria = useCriteria();
  const [switchTo, setSwitchTo] = useState<GameRating['mode']>();
  const s = summarize(game.rating, criteria);
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const start = (mode: GameRating['mode']) => {
    if (game.rating && game.rating.mode !== mode) setSwitchTo(mode);
    else go(`rate/${game.id}/${mode}`);
  };
  const otherMode: GameRating['mode'] = game.rating?.mode === 'individual' ? 'table' : 'individual';
  // Criteria that are active, plus archived ones that still have values in this game.
  const shown = [
    ...activeCriteria(criteria),
    ...criteria.filter((c) => c.archived && s?.perCriterion[c.id] !== undefined),
  ];

  return (
    <div className="card">
      <h2>Wie war die Partie?</h2>
      {!s ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>Bewerte Spaß, Thema, Spannungsbogen & Co. – gemeinsam oder reihum jeder für sich.</p>
          <div className="row">
            <button className="primary" onClick={() => start('table')}>Gemeinsam bewerten</button>
            <button className="primary" onClick={() => start('individual')}>Jeder einzeln</button>
          </div>
        </>
      ) : (
        <>
          <div className="row" style={{ alignItems: 'center', gap: 16 }}>
            <div className="score-big">{fmtScore(s.overall)}</div>
            <div className="spacer">
              <StarDisplay value={s.overall} size={26} />
              <div className="muted" style={{ fontSize: 14 }}>
                {game.rating!.mode === 'table' ? 'gemeinsame Bewertung' : `Ø aus ${s.raters} Einzelbewertung${s.raters === 1 ? '' : 'en'}`}
              </div>
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div>
              {shown.map((c) => (
                <div key={c.id} className="rate-row" style={{ opacity: c.archived ? 0.5 : 1 }}>
                  <span>{c.name}{c.archived && ' (archiviert)'}</span>
                  <span className="row" style={{ gap: 8 }}>
                    <StarDisplay value={s.perCriterion[c.id]} size={18} />
                    <span style={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtScore(s.perCriterion[c.id])}</span>
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 14 }}>Glück ↔ Strategie</div>
              <ScaleBar value={s.luck} labels={LUCK_LABELS} />
              <div className="muted" style={{ fontSize: 14, marginTop: 12 }}>Brainy</div>
              <ScaleBar value={s.brainy} labels={BRAINY_LABELS} />
              {game.rating!.mode === 'individual' && (
                <div style={{ marginTop: 16 }}>
                  {game.rating!.entries.filter((e) => e.by && by[e.by]).map((e) => (
                    <div key={e.by} className="row" style={{ marginBottom: 6 }}>
                      <Avatar {...by[e.by!]} size={28} />
                      <span className="spacer">{by[e.by!].name}</span>
                      <StarDisplay value={s.perPlayer[e.by!]} size={14} />
                      <strong style={{ width: 32, textAlign: 'right' }}>{fmtScore(s.perPlayer[e.by!])}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={() => go(`rate/${game.id}/${game.rating!.mode}`)}>Bewertung ändern</button>
            <button className="ghost" onClick={() => start(otherMode)}>
              Stattdessen {otherMode === 'table' ? 'gemeinsam' : 'jeder einzeln'}
            </button>
          </div>
        </>
      )}

      {switchTo && (
        <Dialog title="Bewertung ersetzen?" onClose={() => setSwitchTo(undefined)}>
          <p>
            Die bisherige {game.rating?.mode === 'table' ? 'gemeinsame Bewertung' : 'Einzelbewertung'} wird durch eine neue
            {switchTo === 'table' ? ' gemeinsame Bewertung' : ' Einzelbewertung'} ersetzt, sobald du sie abschließt.
          </p>
          <div className="row">
            <span className="spacer" />
            <button className="ghost" onClick={() => setSwitchTo(undefined)}>Abbrechen</button>
            <button className="primary" onClick={() => go(`rate/${game.id}/${switchTo}`)}>Neu bewerten</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
