// De stafkaart: terrein, fog of war, doelen, eenheden, orders en voorstellen van de staf.
// Tekent alleen wat het spelersbeeld (PlayerView) zegt; beslist zelf niets over spelregels.
import { memo, useMemo } from 'react';
import {
  axialToOffset,
  hexDistance,
  hexKey,
  offsetToAxial,
  reachableHexes,
  terrainAt,
  unitTypeOf,
  type Hex,
  type Order,
  type PlayerView,
  type TerrainType,
} from '@wargame/engine';
import { hexCorners, hexToPixel, mapPixelSize } from './layout.ts';
import { SIDE_COLORS, UnitCounter } from './UnitCounter.tsx';

export interface ProposalOverlay {
  unitId: string;
  order: Order;
  valid: boolean;
}

interface Props {
  view: PlayerView;
  selectedUnitId: string | null;
  proposals: ProposalOverlay[];
  onHexClick: (hex: Hex) => void;
}

function allHexes(cols: number, rows: number): Hex[] {
  const hexes: Hex[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) hexes.push(offsetToAxial({ col, row }));
  return hexes;
}

const PATTERN_ID: Record<NonNullable<TerrainType['pattern']>, string> = {
  trees: 'pat-trees',
  buildings: 'pat-buildings',
  waves: 'pat-waves',
  contour: 'pat-contour',
  planks: 'pat-bridge',
  reeds: 'pat-reeds',
};

function Patterns() {
  return (
    <defs>
      <pattern id="pat-trees" width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="4" r="2.2" fill="#7f9e62" />
        <circle cx="9" cy="10" r="2.2" fill="#7f9e62" />
      </pattern>
      <pattern id="pat-buildings" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect x="1" y="1" width="4" height="4" fill="#9c8467" />
        <rect x="6" y="5" width="3" height="4" fill="#9c8467" />
      </pattern>
      <pattern id="pat-waves" width="14" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 4 Q 3.5 1 7 4 T 14 4" fill="none" stroke="#6f9bbd" strokeWidth="1" />
      </pattern>
      <pattern id="pat-contour" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 12 Q 8 2 16 12" fill="none" stroke="#a68a52" strokeWidth="0.9" />
      </pattern>
      <pattern id="pat-bridge" width="6" height="6" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#6b5435" strokeWidth="1.4" />
      </pattern>
      <pattern id="pat-reeds" width="12" height="10" patternUnits="userSpaceOnUse">
        <path d="M3 8 V3 M5 8 V4 M9 9 V5" stroke="#5f7f6a" strokeWidth="0.9" />
        <line x1="1" y1="9" x2="11" y2="9" stroke="#7d9fb0" strokeWidth="0.8" />
      </pattern>
      <marker
        id="arrow-move"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="#1d3f6e" />
      </marker>
      <marker
        id="arrow-attack"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="#b3261e" />
      </marker>
      <marker
        id="arrow-staff"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="#6a3d9a" />
      </marker>
    </defs>
  );
}

const Terrain = memo(function Terrain({ view }: { view: PlayerView }) {
  const hexes = useMemo(() => allHexes(view.map.cols, view.map.rows), [view.map]);
  return (
    <g>
      {hexes.map((hex) => {
        const terrain = terrainAt(view.map, view.catalog, hex);
        if (!terrain) return null;
        const points = hexCorners(hex);
        return (
          <g key={hexKey(hex)}>
            <polygon points={points} fill={terrain.color} />
            {terrain.pattern && (
              <polygon points={points} fill={`url(#${PATTERN_ID[terrain.pattern]})`} />
            )}
            <polygon
              points={points}
              fill="none"
              stroke="#8b8270"
              strokeOpacity={0.35}
              strokeWidth={0.8}
            />
          </g>
        );
      })}
      {view.map.placeNames.map((p) => {
        const { x, y } = hexToPixel(p.hex);
        return (
          <text key={p.name} x={x} y={y + 24} className="place-name" textAnchor="middle">
            {p.name}
          </text>
        );
      })}
    </g>
  );
});

function pathPoints(start: Hex, path: Hex[]): string {
  return [start, ...path]
    .map((h) => {
      const { x, y } = hexToPixel(h);
      return `${x},${y}`;
    })
    .join(' ');
}

function OrderArrow({ start, order, staff }: { start: Hex; order: Order; staff?: boolean }) {
  const color = staff ? '#6a3d9a' : order.kind === 'move' ? '#1d3f6e' : '#b3261e';
  const marker = staff ? 'arrow-staff' : order.kind === 'move' ? 'arrow-move' : 'arrow-attack';
  const dash = staff ? '5 4' : undefined;
  if (order.kind === 'defend') {
    const { x, y } = hexToPixel(start);
    return (
      <path
        d={`M${x - 14},${y + 16} Q${x},${y + 24} ${x + 14},${y + 16}`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeDasharray={dash}
      />
    );
  }
  if (order.kind === 'fire') {
    const a = hexToPixel(start);
    const b = hexToPixel(order.target);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 30;
    return (
      <g
        stroke={staff ? color : '#b3261e'}
        fill="none"
        strokeWidth={1.8}
        strokeDasharray={staff ? dash : '4 3'}
      >
        <path d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} />
        <circle cx={b.x} cy={b.y} r={12} />
        <line x1={b.x - 16} y1={b.y} x2={b.x + 16} y2={b.y} />
        <line x1={b.x} y1={b.y - 16} x2={b.x} y2={b.y + 16} />
      </g>
    );
  }
  const points = pathPoints(start, order.path);
  return (
    <polyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeDasharray={dash}
      strokeLinecap="round"
      strokeLinejoin="round"
      markerEnd={order.kind === 'move' || staff ? `url(#${marker})` : undefined}
      opacity={0.85}
    />
  );
}

export function HexMap({ view, selectedUnitId, proposals, onHexClick }: Props) {
  const size = mapPixelSize(view.map.cols, view.map.rows);
  const hexes = useMemo(() => allHexes(view.map.cols, view.map.rows), [view.map]);
  const visible = useMemo(() => new Set(view.visible), [view.visible]);
  const selected = view.ownUnits.find((u) => u.id === selectedUnitId);
  const reach = useMemo(
    () => (selected && view.phase === 'planning' ? reachableHexes(view, selected.id) : new Map()),
    [selected, view],
  );
  const selectedType = selected ? unitTypeOf(view.catalog, selected) : null;
  const unitsById = new Map(view.ownUnits.map((u) => [u.id, u]));

  return (
    <svg
      className="hex-map"
      viewBox={`0 0 ${size.width} ${size.height}`}
      role="img"
      aria-label="Stafkaart"
      data-testid="hex-map"
    >
      <Patterns />
      <Terrain view={view} />

      {/* Fog of war: hexen die we nu niet zien. */}
      <g pointerEvents="none">
        {hexes
          .filter((h) => !visible.has(hexKey(h)))
          .map((h) => (
            <polygon key={hexKey(h)} points={hexCorners(h)} fill="#5b5a55" opacity={0.32} />
          ))}
      </g>

      {/* Bereik van de geselecteerde eenheid. */}
      <g pointerEvents="none">
        {[...reach.values()].map((info) => (
          <polygon
            key={hexKey(info.hex)}
            points={hexCorners(info.hex, 27)}
            fill="#fff3b0"
            opacity={0.55}
            stroke="#c9a227"
            strokeWidth={1}
          />
        ))}
        {selected &&
          selectedType &&
          selectedType.fireRange > 0 &&
          hexes
            .filter((h) => {
              const d = hexDistance(h, selected.hex);
              return d >= 1 && d <= selectedType.fireRange && visible.has(hexKey(h));
            })
            .map((h) => (
              <polygon
                key={`f${hexKey(h)}`}
                points={hexCorners(h, 24)}
                fill="none"
                stroke="#b3261e"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            ))}
      </g>

      {/* Doelen. */}
      <g pointerEvents="none">
        {view.objectives.map((o) => {
          const { x, y } = hexToPixel(o.hex);
          const color = o.controller ? SIDE_COLORS[o.controller].stroke : '#5b5a55';
          return (
            <g key={o.id} transform={`translate(${x}, ${y})`} data-testid={`objective-${o.id}`}>
              <circle
                r={26}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeDasharray="6 3"
                opacity={0.9}
              />
              <g transform="translate(18, -20)">
                <circle r={8} fill={color} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={10}
                  fontWeight={700}
                >
                  {o.id}
                </text>
              </g>
            </g>
          );
        })}
      </g>

      {/* Orders van de eigen eenheden. */}
      <g pointerEvents="none">
        {Object.entries(view.orders).map(([unitId, order]) => {
          const unit = unitsById.get(unitId);
          return unit ? <OrderArrow key={unitId} start={unit.hex} order={order} /> : null;
        })}
        {proposals.map((p) => {
          const unit = unitsById.get(p.unitId);
          return unit && p.valid ? (
            <OrderArrow key={`s-${p.unitId}`} start={unit.hex} order={p.order} staff />
          ) : null;
        })}
      </g>

      {/* Laatst gezien: vijanden die nu uit zicht zijn. */}
      <g pointerEvents="none">
        {view.lastSeen.map((s) => {
          const { x, y } = hexToPixel(s.hex);
          const type = view.catalog.unitTypes[s.type];
          return (
            <g key={s.unitId} transform={`translate(${x}, ${y})`}>
              <UnitCounter
                side={view.opponent}
                icon={type?.icon ?? []}
                strength={s.strength}
                maxStrength={type?.maxStrength ?? 10}
                ghost
              />
              <text y={22} textAnchor="middle" fontSize={7} fill="#8a1c1c">
                beurt {s.turn}
              </text>
            </g>
          );
        })}
      </g>

      {/* Eenheden. */}
      <g pointerEvents="none">
        {view.ownUnits.map((u) => {
          const type = unitTypeOf(view.catalog, u);
          const { x, y } = hexToPixel(u.hex);
          return (
            <g
              key={u.id}
              className="unit"
              style={{ transform: `translate(${x}px, ${y}px)` }}
              data-unit={u.id}
            >
              {u.id === selectedUnitId && (
                <circle r={23} fill="none" stroke="#c9a227" strokeWidth={3} />
              )}
              <UnitCounter
                side={u.side}
                icon={type.icon}
                strength={u.strength}
                maxStrength={type.maxStrength}
                label={type.short}
              />
              {view.orders[u.id] && (
                <circle cx={17} cy={-11} r={3.5} fill="#2e7d32" stroke="#fff" strokeWidth={1} />
              )}
            </g>
          );
        })}
        {view.enemies.map((e) => {
          const type = view.catalog.unitTypes[e.type];
          const { x, y } = hexToPixel(e.hex);
          return (
            <g
              key={e.id}
              className="unit"
              style={{ transform: `translate(${x}px, ${y}px)` }}
              data-unit={e.id}
            >
              <UnitCounter
                side={view.opponent}
                icon={type?.icon ?? []}
                strength={e.strength}
                maxStrength={type?.maxStrength ?? 10}
                label={type?.short}
              />
            </g>
          );
        })}
      </g>

      {/* Klikvlak bovenop alles. */}
      <g>
        {hexes.map((h) => {
          const { col, row } = axialToOffset(h);
          const terrain = terrainAt(view.map, view.catalog, h);
          return (
            <polygon
              key={hexKey(h)}
              points={hexCorners(h)}
              fill="transparent"
              className="hex-hit"
              data-hex={`${col},${row}`}
              onClick={() => onHexClick(h)}
            >
              <title>{`${terrain?.name ?? ''} (${col},${row})`}</title>
            </polygon>
          );
        })}
      </g>
    </svg>
  );
}
