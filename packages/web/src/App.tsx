import { useMemo } from 'react';
import { HexMap, type ProposalOverlay } from './map/HexMap.tsx';
import { CommandPanel } from './panels/CommandPanel.tsx';
import { TurnReport } from './panels/TurnReport.tsx';
import { EndScreen } from './screens/EndScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';
import { StaffPanel } from './staff/StaffPanel.tsx';
import { useStaff } from './staff/staffStore.ts';
import { currentView, useGame } from './store/gameStore.ts';
import { DebugMenu } from './debug/DebugMenu.tsx';

export function App() {
  const screen = useGame((s) => s.screen);
  const game = useGame((s) => s.game);
  const fogOff = useGame((s) => s.fogOff);
  const selectedUnitId = useGame((s) => s.selectedUnitId);
  const clickHex = useGame((s) => s.clickHex);
  const showReport = useGame((s) => s.showReport);
  const messages = useStaff((s) => s.messages);
  const highlighted = useStaff((s) => s.highlighted);
  const view = useMemo(() => currentView({ game, fogOff }), [game, fogOff]);

  const proposals: ProposalOverlay[] = useMemo(() => {
    const message = messages.find((m) => m.id === highlighted);
    if (!message || message.applied || message.turn !== view?.turn) return [];
    return message.proposals.flatMap((p) =>
      p.valid ? [{ unitId: p.intent.unitId, order: p.order, valid: true }] : [],
    );
  }, [messages, highlighted, view?.turn]);

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo" aria-hidden>
          ⌖
        </span>
        <h1>{game?.scenarioName ?? 'Wargame'}</h1>
        <span className="small">Brigade tegen AI-tegenstander · fictief scenario</span>
      </header>
      {screen === 'start' || !game || !view ? (
        <StartScreen />
      ) : (
        <main className="game">
          <div className="map-area">
            <HexMap
              view={view}
              selectedUnitId={selectedUnitId}
              proposals={proposals}
              onHexClick={clickHex}
            />
            {showReport &&
              screen === 'game' &&
              view.lastTurnEvents.length >= 0 &&
              view.turn > 1 && <TurnReport view={view} />}
            <Legend />
          </div>
          <aside className="sidebar">
            {screen === 'end' ? (
              <EndScreen game={game} />
            ) : (
              <>
                <CommandPanel view={view} />
                <StaffPanel />
              </>
            )}
          </aside>
        </main>
      )}
      {import.meta.env.DEV && <DebugMenu />}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend small" aria-label="Legenda">
      <span>
        <i className="sw blue" /> eigen
      </span>
      <span>
        <i className="sw red" /> vijand
      </span>
      <span>
        <i className="sw ghost" /> laatst gezien
      </span>
      <span>
        <i className="sw fog" /> niet in zicht
      </span>
      <span>
        <i className="sw reach" /> bereik
      </span>
      <span>
        <i className="sw staff" /> voorstel staf
      </span>
    </div>
  );
}
