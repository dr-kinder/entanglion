import React from 'react';
import { Planet, Galaxy, PLANET_GALAXY, ComponentType, GameState } from '../engine/types';
import { formatPlanet } from '../engine/game';

// ── layout constants ──────────────────────────────────────────────────────────

const W = 860;
const H = 640;

const POSITIONS: Record<Planet, [number, number]> = {
  // Centarious (left, purple)
  [Planet.ONE]:         [80,  200],
  [Planet.ZERO]:        [80,  360],
  // Superious (lower-left, green)
  [Planet.PLUS]:        [195, 490],
  [Planet.MINUS]:       [370, 560],
  // Entanglion (right, circular)
  [Planet.OMEGA_ZERO]:  [460, 105],
  [Planet.OMEGA_ONE]:   [640, 105],
  [Planet.PSI_PLUS]:    [375, 240],
  [Planet.PSI_MINUS]:   [725, 240],
  [Planet.PHI_PLUS]:    [375, 390],
  [Planet.PHI_MINUS]:   [725, 390],
  [Planet.OMEGA_TWO]:   [460, 520],
  [Planet.OMEGA_THREE]: [640, 520],
};

const GALAXY_COLORS: Record<Galaxy, string> = {
  [Galaxy.CENTARIOUS]: '#9b59b6',
  [Galaxy.SUPERIOUS]:  '#27ae60',
  [Galaxy.ENTANGLION]: '#f1c40f',
};

const PLANET_RADIUS = 28;
const SHIP_RADIUS = 10;

// ── edges ─────────────────────────────────────────────────────────────────────
// Colors: red (#ef4444) = Rubicon only, blue (#38bdf8) = Mercurial only,
//         white/gray = both players same result.

interface Edge {
  from: Planet;
  to: Planet;
  label: string;
  color: string;
  dash?: string;
  offset?: number; // perpendicular pixel offset for parallel lines
}

const RED  = '#f87171';
const BLUE = '#38bdf8';
const BOTH = '#a3e635'; // yellow-green for symmetric paths
const GRAY = '#64748b'; // CNOT entry/exit

const EDGES: Edge[] = [
  // ── Centarious internal ──────────────────────────────────────────────────
  { from: Planet.ZERO, to: Planet.ONE, label: 'X/CNOT', color: GRAY, dash: '4 4' },

  // ── Centarious ↔ Superious (H, both players same outside Entanglion) ────
  { from: Planet.ZERO, to: Planet.PLUS,  label: 'H', color: BOTH },
  { from: Planet.ONE,  to: Planet.MINUS, label: 'H', color: BOTH },

  // ── CNOT entry/exit: all 8 paths from the entry table ───────────────────
  { from: Planet.ZERO,  to: Planet.PHI_PLUS,  label: '', color: GRAY, dash: '5 5' },
  { from: Planet.ZERO,  to: Planet.PHI_MINUS, label: '', color: GRAY, dash: '5 5' },
  { from: Planet.ONE,   to: Planet.PSI_PLUS,  label: '', color: GRAY, dash: '5 5' },
  { from: Planet.ONE,   to: Planet.PSI_MINUS, label: '', color: GRAY, dash: '5 5' },
  { from: Planet.PLUS,  to: Planet.PHI_PLUS,  label: '', color: GRAY, dash: '5 5' },
  { from: Planet.PLUS,  to: Planet.PSI_PLUS,  label: '', color: GRAY, dash: '5 5' },
  { from: Planet.MINUS, to: Planet.PHI_MINUS, label: '', color: GRAY, dash: '5 5' },
  { from: Planet.MINUS, to: Planet.PSI_MINUS, label: '', color: GRAY, dash: '5 5' },

  // ── X: Bell states (same for both players) ───────────────────────────────
  { from: Planet.PHI_PLUS,  to: Planet.PSI_PLUS,  label: 'X', color: BOTH },
  { from: Planet.PHI_MINUS, to: Planet.PSI_MINUS, label: 'X', color: BOTH },

  // ── X/CNOT: Omega states — player-specific, different endpoints ──────────
  // Red (Rubicon): Ω0↔Ω1, Ω2↔Ω3
  { from: Planet.OMEGA_ZERO,  to: Planet.OMEGA_ONE,   label: 'X',      color: RED,  dash: '6 3' },
  { from: Planet.OMEGA_TWO,   to: Planet.OMEGA_THREE, label: 'X/CNOT', color: RED,  dash: '6 3' },
  // Blue (Mercurial): Ω0↔Ω2, Ω1↔Ω3
  { from: Planet.OMEGA_ZERO,  to: Planet.OMEGA_TWO,   label: 'X/CNOT', color: BLUE, dash: '6 3' },
  { from: Planet.OMEGA_ONE,   to: Planet.OMEGA_THREE, label: 'X',      color: BLUE, dash: '6 3' },

  // ── H: symmetric paths (both players) ───────────────────────────────────
  { from: Planet.PHI_PLUS,  to: Planet.OMEGA_TWO,  label: 'H', color: BOTH },
  { from: Planet.PSI_MINUS, to: Planet.OMEGA_ONE,  label: 'H', color: BOTH },

  // ── H: player-specific paths ─────────────────────────────────────────────
  // Red (Rubicon): Ψ+↔Ω0, Φ−↔Ω3
  { from: Planet.PSI_PLUS,    to: Planet.OMEGA_ZERO,  label: 'H', color: RED  },
  { from: Planet.PHI_MINUS,   to: Planet.OMEGA_THREE, label: 'H', color: RED  },
  // Blue (Mercurial): Ψ+↔Ω3, Φ−↔Ω0
  { from: Planet.PSI_PLUS,    to: Planet.OMEGA_THREE, label: 'H', color: BLUE },
  { from: Planet.PHI_MINUS,   to: Planet.OMEGA_ZERO,  label: 'H', color: BLUE },

  // ── SWAP ─────────────────────────────────────────────────────────────────
  { from: Planet.OMEGA_ZERO, to: Planet.OMEGA_THREE, label: 'SWAP', color: BOTH, dash: '8 4' },
];

// ── component abbreviations ───────────────────────────────────────────────────

const COMPONENT_ABBREV: Record<ComponentType, string> = {
  [ComponentType.PHYSICAL_QUBITS]: 'PQ',
  [ComponentType.QUBIT_INTERCONNECT]: 'QI',
  [ComponentType.DILUTION_REFRIGERATOR]: 'DR',
  [ComponentType.QUANTUM_GATES]: 'QG',
  [ComponentType.QUANTUM_PROGRAMMING]: 'QP',
  [ComponentType.QUANTUM_ERROR_CORRECTION]: 'QEC',
  [ComponentType.CONTROL_INFRASTRUCTURE]: 'CI',
  [ComponentType.MAGNETIC_SHIELDING]: 'MS',
};

// ── component ─────────────────────────────────────────────────────────────────

interface BoardProps {
  state: GameState;
}

export default function Board({ state }: BoardProps) {
  const highlightedPlanets: Planet[] = [];
  const [s0, s1] = state.shipPositions;

  function midpoint(a: Planet, b: Planet): [number, number] {
    const [ax, ay] = POSITIONS[a];
    const [bx, by] = POSITIONS[b];
    return [(ax + bx) / 2, (ay + by) / 2];
  }

  function edgePath(from: Planet, to: Planet): string {
    const [x1, y1] = POSITIONS[from];
    const [x2, y2] = POSITIONS[to];
    return `M${x1},${y1} L${x2},${y2}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }}>
      {/* Background */}
      <rect width={W} height={H} fill="#0f172a" rx={12} />

      {/* Galaxy regions */}
      <ellipse cx={80} cy={280} rx={75} ry={200} fill="#3b0764" opacity={0.3} />
      <text x={80} y={492} textAnchor="middle" fill="#a78bfa" fontSize={13} fontWeight="bold">CENTARIOUS</text>

      <ellipse cx={270} cy={530} rx={140} ry={70} fill="#14532d" opacity={0.3} />
      <text x={185} y={570} textAnchor="middle" fill="#86efac" fontSize={13} fontWeight="bold">SUPERIOUS</text>

      <circle cx={550} cy={315} r={240} fill="#451a03" opacity={0.2} />
      <text x={550} y={45} textAnchor="middle" fill="#fcd34d" fontSize={13} fontWeight="bold">ENTANGLION</text>

      {/* Edges */}
      {EDGES.map((e, i) => {
        const [x1, y1] = POSITIONS[e.from];
        const [x2, y2] = POSITIONS[e.to];
        const [mx, my] = midpoint(e.from, e.to);
        return (
          <g key={i}>
            <path
              d={edgePath(e.from, e.to)}
              stroke={e.color}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={e.dash}
              opacity={0.7}
            />
            {e.label && (
              <text
                x={mx} y={my - 6}
                textAnchor="middle"
                fill={e.color}
                fontSize={9}
                fontWeight="bold"
                opacity={0.9}
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Planets */}
      {(Object.keys(POSITIONS) as Planet[]).map(planet => {
        const [cx, cy] = POSITIONS[planet];
        const galaxy = PLANET_GALAXY[planet];
        const color = GALAXY_COLORS[galaxy];
        const isHighlighted = highlightedPlanets.includes(planet);
        const component = state.componentLocations[planet];

        return (
          <g key={planet}>
            {isHighlighted && (
              <circle cx={cx} cy={cy} r={PLANET_RADIUS + 8} fill={color} opacity={0.3} />
            )}
            <circle
              cx={cx} cy={cy} r={PLANET_RADIUS}
              fill={color}
              fillOpacity={0.2}
              stroke={isHighlighted ? '#fff' : color}
              strokeWidth={isHighlighted ? 2.5 : 1.5}
            />
            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
              fill={color} fontSize={11} fontWeight="bold">
              {formatPlanet(planet)}
            </text>
            {/* Component token */}
            {component && (
              <g>
                <rect
                  x={cx - 14} y={cy + 16} width={28} height={12} rx={3}
                  fill="#1e293b" stroke={color} strokeWidth={1}
                />
                <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="middle"
                  fill={color} fontSize={8}>
                  {COMPONENT_ABBREV[component]}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Ship tokens */}
      {/* Ship 0 (Rubicon, red) */}
      <g>
        <circle
          cx={POSITIONS[s0][0] + (s0 === s1 ? -12 : 0)}
          cy={POSITIONS[s0][1] - PLANET_RADIUS - 4}
          r={SHIP_RADIUS}
          fill="#ef4444"
          stroke="#fff"
          strokeWidth={1.5}
        />
        <text
          x={POSITIONS[s0][0] + (s0 === s1 ? -12 : 0)}
          y={POSITIONS[s0][1] - PLANET_RADIUS - 4}
          textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={8} fontWeight="bold"
        >R</text>
      </g>
      {/* Ship 1 (Mercurial, blue) */}
      <g>
        <circle
          cx={POSITIONS[s1][0] + (s0 === s1 ? 12 : 0)}
          cy={POSITIONS[s1][1] - PLANET_RADIUS - 4}
          r={SHIP_RADIUS}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth={1.5}
        />
        <text
          x={POSITIONS[s1][0] + (s0 === s1 ? 12 : 0)}
          y={POSITIONS[s1][1] - PLANET_RADIUS - 4}
          textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={8} fontWeight="bold"
        >M</text>
      </g>

      {/* Legend */}
      <g transform="translate(10,10)">
        {[
          { color: '#f87171', label: 'Rubicon (R) only',   dash: '' },
          { color: '#38bdf8', label: 'Mercurial (M) only', dash: '' },
          { color: '#a3e635', label: 'Both same result',   dash: '' },
          { color: '#64748b', label: 'CNOT entry/exit',    dash: '5 5' },
        ].map((item, i) => (
          <g key={i} transform={`translate(0,${i * 15})`}>
            <line x1={0} y1={6} x2={20} y2={6} stroke={item.color} strokeWidth={1.5} strokeDasharray={item.dash} />
            <text x={24} y={10} fill="#94a3b8" fontSize={9}>{item.label}</text>
          </g>
        ))}
        <g transform="translate(0,78)">
          <circle cx={8} cy={8} r={7} fill="#ef4444" stroke="#fff" strokeWidth={1} />
          <text x={8} y={8} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={6}>R</text>
          <text x={18} y={12} fill="#94a3b8" fontSize={9}>Rubicon</text>
        </g>
        <g transform="translate(0,96)">
          <circle cx={8} cy={8} r={7} fill="#3b82f6" stroke="#fff" strokeWidth={1} />
          <text x={8} y={8} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={6}>M</text>
          <text x={18} y={12} fill="#94a3b8" fontSize={9}>Mercurial</text>
        </g>
      </g>
    </svg>
  );
}
