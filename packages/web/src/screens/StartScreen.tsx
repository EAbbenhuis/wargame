import { useState } from 'react';
import { POSTURES, SCENARIOS } from '@wargame/engine';
import { useGame } from '../store/gameStore.ts';
import { staffStore } from '../staff/staffStore.ts';

export function StartScreen() {
  const setup = useGame((s) => s.setup);
  const startGame = useGame((s) => s.startGame);
  const [posture, setPosture] = useState(setup.posture);
  const [scenarioId, setScenarioId] = useState(setup.scenarioId);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!;

  return (
    <main className="start">
      <div className="card">
        <p className="classification">OEFENING — FICTIEF SCENARIO</p>
        <h1>{scenario.name}</h1>
        <p className="briefing">{scenario.briefing}</p>
        <ul className="rules">
          <li>
            Klik een eigen eenheid aan en geef een order: verplaatsen, aanvallen, vuren of
            verdedigen.
          </li>
          <li>
            Druk op "Einde beurt". Rood heeft tegelijk gepland; alles wordt tegelijk uitgevoerd.
          </li>
          <li>U ziet alleen wat uw eenheden zien. Verkenning ziet het verst.</li>
          <li>
            Vraag de staf om advies. Voorstellen worden door het spel gecontroleerd voordat u ze
            overneemt.
          </li>
        </ul>
        {SCENARIOS.length > 1 && (
          <label>
            Scenario{' '}
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="postures">
          <legend>Houding van de tegenstander</legend>
          {POSTURES.map((p) => (
            <label key={p.id} className={posture === p.id ? 'active' : ''}>
              <input
                type="radio"
                name="posture"
                value={p.id}
                checked={posture === p.id}
                onChange={() => setPosture(p.id)}
              />
              <strong>{p.name}</strong> <span>{p.description}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="primary"
          data-testid="start-game"
          onClick={() => {
            staffStore.getState().reset();
            startGame({ posture, scenarioId });
          }}
        >
          Start de operatie
        </button>
      </div>
    </main>
  );
}
