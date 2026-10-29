import { describeEvent, namesFromView, type PlayerView } from '@wargame/engine';
import { useGame } from '../store/gameStore.ts';

export function TurnReport({ view }: { view: PlayerView }) {
  const close = useGame((s) => s.closeReport);
  const name = namesFromView(view);
  const objectiveName = (id: string) => view.objectives.find((o) => o.id === id)?.name ?? id;
  const events = view.lastTurnEvents.filter((e) => e.type !== 'move');
  const moves = view.lastTurnEvents.filter((e) => e.type === 'move').length;
  return (
    <div className="report" role="dialog" aria-label="Beurtverslag" data-testid="turn-report">
      <header className="panel-header">
        <h2>Verslag beurt {view.turn - 1}</h2>
        <button type="button" onClick={close} data-testid="close-report">
          Sluiten
        </button>
      </header>
      {events.length === 0 ? (
        <p>Geen contact met de vijand. {moves} verplaatsing(en) uitgevoerd.</p>
      ) : (
        <ul>
          {events.map((e, i) => (
            <li key={i} className={`event ${e.type}`}>
              {describeEvent(e, name, objectiveName)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
