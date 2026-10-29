// NAVO-achtig eenheidssymbool: blauwe rechthoek voor eigen eenheden, rode ruit voor de vijand.
// Het symbool binnenin komt uit de data van het eenheidstype (icon), zodat een nieuw type
// zonder code-wijziging een eigen symbool kan hebben.
import type { IconShape, Side } from '@wargame/engine';

const W = 34;
const H = 22;

export const SIDE_COLORS: Record<Side, { fill: string; stroke: string }> = {
  blue: { fill: '#a9cbe9', stroke: '#1d3f6e' },
  red: { fill: '#efa9a2', stroke: '#8a1c1c' },
};

function Shape({ shape, stroke }: { shape: IconShape; stroke: string }) {
  // Vormen zijn getekend in een kader van 100 x 60; schalen naar W x H.
  const sx = (x: number) => (x / 100) * W - W / 2;
  const sy = (y: number) => (y / 60) * H - H / 2;
  const common = { stroke, strokeWidth: 1.4, vectorEffect: 'non-scaling-stroke' as const };
  switch (shape.kind) {
    case 'line':
      return <line x1={sx(shape.x1)} y1={sy(shape.y1)} x2={sx(shape.x2)} y2={sy(shape.y2)} {...common} />;
    case 'ellipse':
      return (
        <ellipse
          cx={sx(shape.cx)}
          cy={sy(shape.cy)}
          rx={(shape.rx / 100) * W}
          ry={(shape.ry / 60) * H}
          fill={shape.filled ? stroke : 'none'}
          {...common}
        />
      );
    case 'circle':
      return (
        <circle cx={sx(shape.cx)} cy={sy(shape.cy)} r={(shape.r / 100) * W} fill={shape.filled ? stroke : 'none'} {...common} />
      );
    case 'polyline': {
      const points = shape.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ');
      return shape.closed ? (
        <polygon points={points} fill={shape.filled ? stroke : 'none'} {...common} />
      ) : (
        <polyline points={points} fill="none" {...common} />
      );
    }
    case 'text':
      return (
        <text
          x={sx(shape.x)}
          y={sy(shape.y)}
          fontSize={shape.size ?? 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill={stroke}
          fontWeight={700}
        >
          {shape.text}
        </text>
      );
  }
}

export interface UnitCounterProps {
  side: Side;
  icon: IconShape[];
  strength: number;
  maxStrength: number;
  label?: string;
  ghost?: boolean;
}

export function UnitCounter({ side, icon, strength, maxStrength, label, ghost }: UnitCounterProps) {
  const { fill, stroke } = SIDE_COLORS[side];
  const clipId = `clip-${side}`;
  const frame =
    side === 'blue' ? (
      <rect x={-W / 2} y={-H / 2} width={W} height={H} />
    ) : (
      <polygon points={`0,${-H / 2 - 7} ${W / 2 + 4},0 0,${H / 2 + 7} ${-W / 2 - 4},0`} />
    );
  const ratio = Math.max(0, Math.min(1, strength / maxStrength));
  return (
    <g opacity={ghost ? 0.55 : 1}>
      <defs>
        <clipPath id={clipId}>{frame}</clipPath>
      </defs>
      <g fill={ghost ? 'none' : fill} stroke={stroke} strokeWidth={1.6} strokeDasharray={ghost ? '3 2' : undefined}>
        {frame}
      </g>
      <g clipPath={`url(#${clipId})`}>
        {icon.map((shape, i) => (
          <Shape key={i} shape={shape} stroke={stroke} />
        ))}
      </g>
      {ghost ? (
        <text y={1} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={stroke}>
          ?
        </text>
      ) : (
        <g transform={`translate(${-W / 2}, ${H / 2 + (side === 'red' ? 8 : 3)})`}>
          <rect width={W} height={3.5} fill="#ffffffaa" stroke={stroke} strokeWidth={0.5} />
          <rect width={W * ratio} height={3.5} fill={ratio > 0.5 ? '#3f6b35' : ratio > 0.25 ? '#b8860b' : '#9b2c2c'} />
        </g>
      )}
      {label && (
        <text y={-H / 2 - (side === 'red' ? 9 : 3)} textAnchor="middle" fontSize={7.5} fill={stroke} fontWeight={600}>
          {label}
        </text>
      )}
    </g>
  );
}
