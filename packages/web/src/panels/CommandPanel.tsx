// Zijpaneel: beurt, doelen, geselecteerde eenheid en orders, en "Einde beurt".
import { terrainAt, unitTypeOf, type Order, type PlayerView } from '@wargame/engine';
import { useGame } from '../store/gameStore.ts';

function orderText(order: Order | undefined): string {
  if (!order) return 'geen order (blijft staan)';
  switch (order.kind) {
    case 'move':
      return `verplaatsen (${order.path.length} hex)`;
    case 'attack':
      return order.path.length > 0 ? `oprukken en aanvallen` : 'aanvallen';
    case 'fire':
      return 'vuren';
    case 'defend':
      return 'verdedigen (ingegraven)';
  }
}

export function CommandPanel({ view }: { view: PlayerView }) {
  const selectedUnitId = useGame((s) => s.selectedUnitId);
  const selectUnit = useGame((s) => s.selectUnit);
  const setOrder = useGame((s) => s.setOrder);
  const clearOrder = useGame((s) => s.clearOrder);
  const endTurn = useGame((s) => s.endTurn);
  const notice = useGame((s) => s.notice);
  const selected = view.ownUnits.find((u) => u.id === selectedUnitId);
  const type = selected ? unitTypeOf(view.catalog, selected) : null;
  const terrain = selected ? terrainAt(view.map, view.catalog, selected.hex) : null;
  const ordersGiven = Object.keys(view.orders).length;

  return (
    <section className="panel command" aria-label="Commando">
      <header className="panel-header">
        <h2>
          Beurt <span data-testid="turn">{view.turn}</span> van {view.maxTurns}
        </h2>
        <span className="strength">
          Sterkte {Math.round((100 * view.strength.own) / view.strength.ownStart)}%
        </span>
      </header>

      <ul className="objectives">
        {view.objectives.map((o) => (
          <li key={o.id} className={`objective ${o.controller ?? 'none'}`}>
            <span className="badge">{o.id}</span> {o.name}
            <span className="owner">
              {o.controller === 'blue' ? 'eigen' : o.controller === 'red' ? 'vijand' : 'vrij'}
            </span>
          </li>
        ))}
      </ul>

      {notice && (
        <p className={`notice ${notice.kind}`} role="alert" data-testid="notice">
          {notice.text}
        </p>
      )}

      {selected && type ? (
        <div className="selected" data-testid="selected-unit">
          <h3>{selected.name}</h3>
          <p className="small">
            {type.name} · sterkte {selected.strength}/{type.maxStrength} · {type.movement}{' '}
            bewegingspunten · zicht {type.vision}
            {type.fireRange > 0 && ` · vuurbereik ${type.fireRange}`} · staat in{' '}
            {terrain?.name.toLowerCase()}
          </p>
          <p className="small">{type.description}</p>
          <p>
            Order: <strong>{orderText(view.orders[selected.id])}</strong>
          </p>
          <div className="buttons">
            <button type="button" onClick={() => setOrder(selected.id, { kind: 'defend' })}>
              Verdedigen
            </button>
            <button
              type="button"
              onClick={() => clearOrder(selected.id)}
              disabled={!view.orders[selected.id]}
            >
              Order wissen
            </button>
            <button type="button" onClick={() => selectUnit(null)}>
              Klaar
            </button>
          </div>
          <p className="hint">
            Klik op een gele hex om te verplaatsen, of op een vijand om aan te vallen
            {type.fireRange > 0 ? ' (artillerie vuurt op vijanden binnen de rode stippellijn)' : ''}
            .
          </p>
        </div>
      ) : (
        <p className="hint">Klik op een eigen eenheid (blauw) om haar een order te geven.</p>
      )}

      <ul className="unit-list">
        {view.ownUnits.map((u) => {
          const t = unitTypeOf(view.catalog, u);
          return (
            <li key={u.id}>
              <button
                type="button"
                className={u.id === selectedUnitId ? 'active' : ''}
                onClick={() => selectUnit(u.id)}
                data-testid={`unit-${u.id}`}
              >
                <span className="unit-name">{u.name}</span>
                <span className="unit-meta">
                  {t.short} {u.strength}/{t.maxStrength} · {orderText(view.orders[u.id])}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="end-turn" onClick={endTurn} data-testid="end-turn">
        Einde beurt ({ordersGiven} {ordersGiven === 1 ? 'order' : 'orders'})
      </button>
      <p className="hint small">
        Rood plant tegelijk met u. Alles wordt daarna tegelijk uitgevoerd.
      </p>
    </section>
  );
}
