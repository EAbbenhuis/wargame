// Debugmenu: alleen in development (npm run dev), nooit in de gebouwde site.
// Snel testen zonder het spel te spelen: scenario laden, seed zetten, naar een beurt springen,
// fog of war uit.
import { useState } from 'react';
import { SCENARIOS } from '@wargame/engine';
import { useGame } from '../store/gameStore.ts';

export function DebugMenu() {
  const [open, setOpen] = useState(false);
  const setup = useGame((s) => s.setup);
  const game = useGame((s) => s.game);
  const fogOff = useGame((s) => s.fogOff);
  const setFogOff = useGame((s) => s.setFogOff);
  const startGame = useGame((s) => s.startGame);
  const jumpToTurn = useGame((s) => s.jumpToTurn);
  const actions = useGame((s) => s.actions);
  const [seed, setSeed] = useState(String(setup.seed));
  const [scenarioId, setScenarioId] = useState(setup.scenarioId);
  const [turn, setTurn] = useState('6');

  if (!open) {
    return (
      <button
        type="button"
        className="debug-toggle"
        onClick={() => setOpen(true)}
        data-testid="debug-open"
      >
        debug
      </button>
    );
  }
  return (
    <div className="debug" data-testid="debug-menu">
      <header>
        <strong>Debugmenu</strong> <span className="small">(alleen in development)</span>
        <button type="button" onClick={() => setOpen(false)}>
          ×
        </button>
      </header>
      <label>
        Scenario
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Seed
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          inputMode="numeric"
          data-testid="debug-seed"
        />
      </label>
      <button
        type="button"
        onClick={() => startGame({ seed: Number(seed) || 1, scenarioId })}
        data-testid="debug-load"
      >
        Laad scenario
      </button>
      <label>
        Spring naar beurt
        <input value={turn} onChange={(e) => setTurn(e.target.value)} inputMode="numeric" />
      </label>
      <button type="button" disabled={!game} onClick={() => jumpToTurn(Number(turn) || 1)}>
        Spring (computer speelt blauw)
      </button>
      <label className="check">
        <input
          type="checkbox"
          checked={fogOff}
          onChange={(e) => setFogOff(e.target.checked)}
          data-testid="debug-fog"
        />{' '}
        Fog of war uit
      </label>
      <button
        type="button"
        disabled={!game}
        onClick={() =>
          void navigator.clipboard?.writeText(JSON.stringify({ setup, actions }, null, 1))
        }
      >
        Kopieer acties (om na te spelen)
      </button>
      {game && (
        <p className="small">
          seed {game.seed} · beurt {game.turn} · {actions.length} acties
        </p>
      )}
    </div>
  );
}
