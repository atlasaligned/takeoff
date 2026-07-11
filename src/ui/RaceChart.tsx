import { useMemo, useRef, useState } from 'react';
import type { GameState, LabId } from '../engine/types';
import { useSt } from './useGame';

const L = 30;
const R = 46;
const T = 14;
const B = 22;

interface Series {
  id: LabId;
  name: string;
  color: string;
  you: boolean;
  v: number[];
}

function buildSeries(st: GameState, maxPoints = 60): { weeks: number[]; series: Series[] } {
  const hist = st.history;
  const step = Math.max(1, Math.ceil(hist.length / maxPoints));
  const pts = hist.filter((_, i) => i % step === 0 || i === hist.length - 1);
  const weeks = pts.map((p) => p.week);
  const series = Object.values(st.labs).map((lab) => ({
    id: lab.id,
    name: lab.shortName,
    color: lab.color,
    you: lab.id === st.playerLab,
    v: pts.map((p) => p.caps[lab.id] ?? 0),
  }));
  return { weeks, series };
}

export function RaceChart({ w: W = 372, h: H = 230, maxPoints = 60 }: { w?: number; h?: number; maxPoints?: number } = {}) {
  const st = useSt();
  const { weeks, series } = useMemo(() => buildSeries(st, maxPoints), [st, st.week, maxPoints]);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (weeks.length === 0) {
    return <div className="note">No history yet.</div>;
  }

  const maxCap = Math.max(105, ...series.flatMap((s) => s.v));
  const x = (i: number) => (weeks.length > 1 ? L + (i * (W - L - R)) / (weeks.length - 1) : L);
  const y = (v: number) => T + (H - T - B) * (1 - v / maxCap);

  const labels = series
    .map((s) => ({ color: s.color, val: s.v[s.v.length - 1], ly: y(s.v[s.v.length - 1]) }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].ly - labels[i - 1].ly < 12) labels[i].ly = labels[i - 1].ly + 12;
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || weeks.length < 2) return;
    const r = svg.getBoundingClientRect();
    const mx = ((e.clientX - r.left) * W) / r.width;
    const i = Math.max(0, Math.min(weeks.length - 1, Math.round(((mx - L) * (weeks.length - 1)) / (W - L - R))));
    setHover(i);
  };

  return (
    <div className="race">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} fontFamily="IBM Plex Mono,monospace" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {[0, 25, 50, 75].map((g) => (
          <g key={g}>
            <line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="#1e1e21" strokeWidth="1" />
            <text x={L - 5} y={y(g) + 3} textAnchor="end" fontSize="9.5" fill="#5b5954">
              {g}
            </text>
          </g>
        ))}
        <line x1={L} y1={y(100)} x2={W - R} y2={y(100)} stroke="#ff2a2a" strokeWidth="1" strokeDasharray="4 3" opacity=".7" />
        <text x={L} y={y(100) - 5} fontSize="9.5" fontWeight="600" fill="#ff2a2a" letterSpacing="1">
          100 — ASI · WIN ROLL
        </text>
        {weeks.length > 1 &&
          series.map((s) => (
            <polyline
              key={s.id}
              points={s.v.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.you ? 2.5 : 1.5}
            />
          ))}
        {series.map((s) => (
          <circle key={`dot-${s.id}`} cx={x(s.v.length - 1)} cy={y(s.v[s.v.length - 1])} r={s.you ? 3 : 2.2} fill={s.color} />
        ))}
        {labels.map((l, i) => (
          <text key={i} x={W - R + 4} y={l.ly + 3} fontSize="10.5" fontWeight="600" fill={l.color}>
            {l.val.toFixed(1)}
          </text>
        ))}
        {weeks.length > 1 && (
          <text x={L} y={H - 6} fontSize="9.5" fill="#5b5954">
            W{weeks[0]}
          </text>
        )}
        <text x={W - R} y={H - 6} textAnchor="end" fontSize="9.5" fill="#5b5954">
          W{weeks[weeks.length - 1]} · NOW
        </text>
        {hover !== null && <line x1={x(hover)} y1={T} x2={x(hover)} y2={H - B} stroke="#5b5954" strokeWidth="1" />}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ display: 'block', left: `${Math.min(75, (100 * x(hover)) / W).toFixed(1)}%`, top: 18 }}>
          <b>WEEK {weeks[hover]}</b>
          {series.map((s) => (
            <div key={s.id}>
              <span style={{ color: s.color }}>●</span> {s.name} {s.v[hover].toFixed(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
