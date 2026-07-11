import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startResearch } from '../../engine/actions';
import { flagship } from '../../engine/model';
import { RESEARCH, RESEARCH_BY_ID, researchBlocked, researchCost, researchWeeks, type Branch, type ResearchNode } from '../../engine/research';
import type { Lab } from '../../engine/types';
import { fmtMoney } from '../format';
import { ResearchIcon } from '../researchIcons';
import { useGame, useSt } from '../useGame';

const BRANCHES: { id: Branch; label: string }[] = [
  { id: 'capabilities', label: 'AI Capabilities' },
  { id: 'alignment', label: 'Alignment' },
  { id: 'bio', label: 'Biology' },
  { id: 'compute', label: 'Compute' },
  { id: 'warfare', label: 'Warfare' },
];

/** Row of a node = longest chain of SAME-branch prerequisites (its visual depth). */
function computeDepths(branch: Branch): Map<string, number> {
  const depth = new Map<string, number>();
  const visit = (n: ResearchNode): number => {
    if (depth.has(n.id)) return depth.get(n.id)!;
    const same = n.prereqs.map((p) => RESEARCH_BY_ID[p]).filter((p) => p && p.branch === branch);
    const d = same.length === 0 ? 0 : 1 + Math.max(...same.map((p) => visit(p)));
    depth.set(n.id, d);
    return d;
  };
  for (const n of RESEARCH) if (n.branch === branch) visit(n);
  return depth;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  done: boolean;
}

export function ResearchTab() {
  const game = useGame();
  // deep link from other screens: land on the focused node, right branch selected
  const focus = game.focusId && RESEARCH_BY_ID[game.focusId] ? game.focusId : null;
  const [branch, setBranch] = useState<Branch>(focus ? RESEARCH_BY_ID[focus].branch : 'capabilities');
  const [selected, setSelected] = useState<string | null>(focus);
  const st = useSt();
  const player = st.labs[st.playerLab];

  useEffect(() => {
    if (focus) game.clearFocus();
  }, [focus, game]);

  const rows = useMemo(() => {
    const depths = computeDepths(branch);
    const maxDepth = Math.max(0, ...[...depths.values()]);
    const rows: ResearchNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
    for (const n of RESEARCH) if (n.branch === branch) rows[depths.get(n.id)!].push(n);
    // stable, readable column order within a row
    for (const r of rows) r.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    return rows;
  }, [branch]);

  // ---- connector lines, measured from the laid-out DOM
  const treeRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const setNodeEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodeEls.current.set(id, el);
    else nodeEls.current.delete(id);
  }, []);

  const measure = useCallback(() => {
    const tree = treeRef.current;
    if (!tree) return;
    const base = tree.getBoundingClientRect();
    const ox = tree.scrollLeft - base.left;
    const oy = tree.scrollTop - base.top;
    const out: Line[] = [];
    for (const n of RESEARCH) {
      if (n.branch !== branch) continue;
      const childEl = nodeEls.current.get(n.id);
      if (!childEl) continue;
      const c = childEl.getBoundingClientRect();
      for (const p of n.prereqs) {
        const pre = RESEARCH_BY_ID[p];
        if (!pre || pre.branch !== branch) continue; // cross-branch shown as text, not a line
        const pEl = nodeEls.current.get(p);
        if (!pEl) continue;
        const r = pEl.getBoundingClientRect();
        out.push({
          x1: r.left + r.width / 2 + ox,
          y1: r.bottom + oy,
          x2: c.left + c.width / 2 + ox,
          y2: c.top + oy,
          done: player.research.completed.includes(p) && player.research.completed.includes(n.id),
        });
      }
    }
    setSize({ w: tree.scrollWidth, h: tree.scrollHeight });
    setLines(out);
  }, [branch, player.research.completed]);

  useEffect(() => {
    measure();
    const tree = treeRef.current;
    if (!tree) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(tree);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const sel = selected ? RESEARCH_BY_ID[selected] : null;

  return (
    <div className="rlayout">
      <div className="rmain">
        <div className="pills">
          {BRANCHES.map((b) => (
            <button
              key={b.id}
              className={branch === b.id ? 'on' : ''}
              onClick={() => {
                setBranch(b.id);
                setSelected(null);
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="rtree" ref={treeRef} onScroll={measure}>
          <svg className="rlines" width={size.w} height={size.h} aria-hidden="true">
            {lines.map((l, i) => (
              <path key={i} className={l.done ? 'rline done' : 'rline'} d={`M${l.x1} ${l.y1} V${(l.y1 + l.y2) / 2} H${l.x2} V${l.y2}`} />
            ))}
          </svg>
          {rows.map((row, d) => (
            <div className="rrow" key={d}>
              {row.map((n) => (
                <NodeTile key={n.id} node={n} player={player} selected={selected === n.id} onSelect={() => setSelected(n.id)} setEl={setNodeEl} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <Detail node={sel} player={player} onClose={() => setSelected(null)} />
    </div>
  );
}

function status(player: Lab, node: ResearchNode): 'done' | 'active' | 'available' | 'locked' {
  if (player.research.completed.includes(node.id)) return 'done';
  if (player.research.active.some((a) => a.nodeId === node.id)) return 'active';
  const cap = flagship(player)?.capability ?? 0;
  return researchBlocked(player, node.id, cap) === null ? 'available' : 'locked';
}

function NodeTile({
  node,
  player,
  selected,
  onSelect,
  setEl,
}: {
  node: ResearchNode;
  player: Lab;
  selected: boolean;
  onSelect: () => void;
  setEl: (id: string, el: HTMLElement | null) => void;
}) {
  const s = status(player, node);
  const active = player.research.active.find((a) => a.nodeId === node.id);
  const cls = `rnode ${s}${selected ? ' sel' : ''}${node.negEffect ? ' danger' : ''}`;
  return (
    <button ref={(el) => setEl(node.id, el)} className={cls} onClick={onSelect} title={`“${node.quote}”`}>
      <span className="rtier">T{node.tier}</span>
      <span className="ricon-wrap">
        <ResearchIcon id={node.id} />
      </span>
      <span className="rname">{node.name}</span>
      <span className="rmeta">{s === 'done' ? 'Researched' : s === 'active' ? `${active!.totalWeeks - active!.weeksDone} wk left` : `${fmtMoney(researchCost(player, node))} · ${researchWeeks(player, node)} wk`}</span>
      {active && (
        <span className="rprog">
          <i style={{ width: `${(100 * active.weeksDone) / active.totalWeeks}%` }} />
        </span>
      )}
    </button>
  );
}

function Detail({ node, player, onClose }: { node: ResearchNode | null; player: Lab; onClose: () => void }) {
  const game = useGame();
  if (!node) {
    return (
      <aside className="rdetail empty">
        <p>Select a node to see its details. The tree grows downward — a node unlocks once every node wired into it above is researched and your flagship is capable enough.</p>
      </aside>
    );
  }
  const s = status(player, node);
  const cap = flagship(player)?.capability ?? 0;
  const blocked = s === 'done' || s === 'active' ? null : researchBlocked(player, node.id, cap);
  const cost = researchCost(player, node);
  const weeks = researchWeeks(player, node);
  const prereqs = node.prereqs.map((p) => RESEARCH_BY_ID[p]);
  return (
    <aside className="rdetail">
      <button className="rclose" onClick={onClose} aria-label="close">
        ×
      </button>
      <div className="rd-head">
        <span className={`ricon-wrap big ${node.negEffect ? 'danger' : ''}`}>
          <ResearchIcon id={node.id} />
        </span>
        <div>
          <h3>{node.name}</h3>
          <div className="rd-tier">
            {BRANCHES.find((b) => b.id === node.branch)?.label} · Tier {node.tier}
          </div>
        </div>
      </div>
      <div className="rd-quote">“{node.quote}”</div>
      <p className="rd-desc">{node.desc}</p>
      <div className="rd-fx">{node.effect}</div>
      {node.negEffect && <div className="rd-fx neg">{node.negEffect}</div>}
      <div className="rd-reqs">
        <div>
          <span className="k">Cost</span>
          <span className="v">{fmtMoney(cost)}</span>
        </div>
        <div>
          <span className="k">Time</span>
          <span className="v">{weeks} wk</span>
        </div>
        {node.capReq > 0 && (
          <div>
            <span className="k">Capability</span>
            <span className={`v${cap < node.capReq ? ' short' : ''}`}>≥ {node.capReq}</span>
          </div>
        )}
      </div>
      {prereqs.length > 0 && (
        <div className="rd-pre">
          <span className="k">Requires</span>
          <ul>
            {prereqs.map((p) => (
              <li key={p.id} className={player.research.completed.includes(p.id) ? 'ok' : 'no'}>
                {p.name}
                {p.branch !== node.branch ? ` (${BRANCHES.find((b) => b.id === p.branch)?.label})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rd-action">
        {s === 'done' && <div className="rd-status done">✓ Researched</div>}
        {s === 'active' && <div className="rd-status active">In progress…</div>}
        {(s === 'available' || s === 'locked') && (
          <button className="btn primary" disabled={!!blocked} onClick={() => game.act((state) => startResearch(state, state.labs[state.playerLab], node.id))}>
            {blocked ?? 'Begin research'}
          </button>
        )}
      </div>
    </aside>
  );
}
