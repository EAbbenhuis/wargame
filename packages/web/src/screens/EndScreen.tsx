import { buildAfterActionReport, type GameState } from '@wargame/engine';
import { useMemo } from 'react';
import { useGame } from '../store/gameStore.ts';

export function EndScreen({ game }: { game: GameState }) {
  const backToStart = useGame((s) => s.backToStart);
  const report = useMemo(() => buildAfterActionReport(game, 'blue'), [game]);
  return (
    <section className="panel end" aria-label="After-action report" data-testid="end-screen">
      <p className="classification">AFTER-ACTION REPORT</p>
      <h2 data-testid="outcome">{report.headline}</h2>
      <p>{report.summary}</p>
      <h3>Kantelpunten</h3>
      <ol className="turning-points">
        {report.turningPoints.map((p, i) => (
          <li key={i}>
            <span className="turn">Beurt {p.turn}</span> {p.text}
          </li>
        ))}
      </ol>
      <h3>Lessen</h3>
      <ul>
        {report.lessons.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <h3>Verliezen</h3>
      <p>
        Blauw: {report.losses.blue.strength} sterktepunten
        {report.losses.blue.units.length > 0 &&
          `, vernietigd: ${report.losses.blue.units.join(', ')}`}
        .<br />
        Rood: {report.losses.red.strength} sterktepunten
        {report.losses.red.units.length > 0 &&
          `, vernietigd: ${report.losses.red.units.join(', ')}`}
        .
      </p>
      <details>
        <summary>Verloop per beurt</summary>
        <ol>
          {report.timeline.map((t) => (
            <li key={t.turn}>
              <strong>Beurt {t.turn}:</strong> {t.lines.join(' ')}
            </li>
          ))}
        </ol>
      </details>
      <button type="button" className="primary" onClick={backToStart} data-testid="new-game">
        Nieuw spel
      </button>
    </section>
  );
}
