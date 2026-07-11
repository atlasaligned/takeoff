import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signTreaty, smallDiplomacy } from '../../engine/actions';
import { agreementProbability, SMALL_ACTIONS, smallActionReady, TREATIES, TREATY_BY_ID, treatyBlocked, treatyGatekeeper, type TreatyNode } from '../../engine/diplomacy';
import { flagship } from '../../engine/model';
import { RESEARCH_BY_ID } from '../../engine/research';
import type { GameState, GovId } from '../../engine/types';
import { fmtMoney } from '../format';
import { Icon } from '../icons';
import { ResearchIcon } from '../researchIcons';
import { useGame, useSt } from '../useGame';

/** Row of a treaty = longest chain of treaty prerequisites (its depth in the tree). */
function treatyDepths(): Map<string, number> {
  const depth = new Map<string, number>();
  const visit = (t: TreatyNode): number => {
    if (depth.has(t.id)) return depth.get(t.id)!;
    const d = t.prereqs.length === 0 ? 0 : 1 + Math.max(...t.prereqs.map((p) => visit(TREATY_BY_ID[p])));
    depth.set(t.id, d);
    return d;
  };
  for (const t of TREATIES) visit(t);
  return depth;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  done: boolean;
}

export function DiplomacyTab() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const keeper = treatyGatekeeper(st);
  const agreeP = agreementProbability(st);
  const playerCap = flagship(player)?.capability ?? 0;
  const keeperCap = keeper ? (flagship(keeper)?.capability ?? 0) : 0;
  const gap = keeperCap - playerCap;
  // deep link from other screens: land with the focused treaty selected
  const focus = game.focusId && TREATY_BY_ID[game.focusId] ? game.focusId : null;
  const [selected, setSelected] = useState<string | null>(focus);

  useEffect(() => {
    if (focus) game.clearFocus();
  }, [focus, game]);

  const rows = useMemo(() => {
    const depths = treatyDepths();
    const maxDepth = Math.max(0, ...[...depths.values()]);
    const rows: TreatyNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
    for (const t of TREATIES) rows[depths.get(t.id)!].push(t);
    for (const r of rows) r.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    return rows;
  }, []);

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
    for (const t of TREATIES) {
      const childEl = nodeEls.current.get(t.id);
      if (!childEl) continue;
      const c = childEl.getBoundingClientRect();
      for (const p of t.prereqs) {
        const pEl = nodeEls.current.get(p);
        if (!pEl) continue;
        const r = pEl.getBoundingClientRect();
        out.push({
          x1: r.left + r.width / 2 + ox,
          y1: r.bottom + oy,
          x2: c.left + c.width / 2 + ox,
          y2: c.top + oy,
          done: st.diplomacy.completed.includes(p) && st.diplomacy.completed.includes(t.id),
        });
      }
    }
    setSize({ w: tree.scrollWidth, h: tree.scrollHeight });
    setLines(out);
  }, [st.diplomacy.completed]);

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

  const sel = selected ? TREATY_BY_ID[selected] : null;

  return (
    <div className="grid2" style={{ gridTemplateColumns: '1fr 360px' }}>
      <div>
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="hd">
            <h2>
              <Icon id="i-flag" />
              Treaty track — the road to the Global Pause
            </h2>
          </div>
          <div className="bd">
            <div className="rtree dtree" ref={treeRef} onScroll={measure}>
              <svg className="rlines" width={size.w} height={size.h} aria-hidden="true">
                {lines.map((l, i) => (
                  <path key={i} className={l.done ? 'rline done' : 'rline'} d={`M${l.x1} ${l.y1} V${(l.y1 + l.y2) / 2} H${l.x2} V${l.y2}`} />
                ))}
              </svg>
              {rows.map((row, d) => (
                <div className="rrow" key={d}>
                  {row.map((t) => (
                    <TreatyTile key={t.id} node={t} state={st} agreeP={agreeP} selected={selected === t.id} onSelect={() => setSelected(t.id)} setEl={setNodeEl} />
                  ))}
                </div>
              ))}
            </div>
            {sel && <TreatyDetail node={sel} state={st} agreeP={agreeP} onClose={() => setSelected(null)} />}
          </div>
        </div>

        <div className="panel" data-tut="panel-smallactions">
          <div className="hd">
            <h2>
              <Icon id="i-zap" />
              Small actions
            </h2>
          </div>
          <div className="bd">
            <SmallActions />
            <div className="note" style={{ marginTop: 8 }}>
              Charm targets your own government; Backchannel targets the other one (and sometimes leaks). Someone has to scare the governments before any treaty gate opens.
            </div>
          </div>
        </div>
      </div>

      <div className="col">
        <div className="panel">
          <div className="hd">
            <h2>
              <Icon id="i-radar" />
              Rival agreement odds
            </h2>
          </div>
          <div className="bd">
            <div className="note" style={{ marginBottom: 8 }}>
              Treaties check the 2nd-strongest rival; the rest follow automatically.
            </div>
            <div className="kv">
              <span className="k">2nd-strongest rival</span>
              <span className="v">{keeper ? `${keeper.shortName} · cap ${keeperCap.toFixed(1)}` : '—'}</span>
            </div>
            <div className="kv">
              <span className="k">Capability gap (them − you)</span>
              <span className="v" style={{ color: gap <= 0 ? 'var(--good)' : 'var(--warn-text)' }}>
                {gap > 0 ? '+' : ''}
                {gap.toFixed(1)} {gap <= 0 ? '(you lead)' : '(they lead)'}
              </span>
            </div>
            <div className="meter">
              <div className="row">
                <span className="k">Agreement probability</span>
                <span className="v" style={{ color: agreeP > 0.5 ? 'var(--good)' : 'var(--warn-text)' }}>
                  {(agreeP * 100).toFixed(0)}%
                </span>
              </div>
              <div className="track">
                <div className={`fill ${agreeP > 0.5 ? 'good' : 'warn'}`} style={{ width: `${agreeP * 100}%` }} />
              </div>
            </div>
            <div className="note">Labs that are far ahead don't sign pauses. Failed talks lock the table for weeks — and the fee is gone.</div>
          </div>
        </div>
        <div className="panel">
          <div className="hd">
            <h2>
              <Icon id="i-gauge" />
              Fear dials
            </h2>
          </div>
          <div className="bd">
            {(['us', 'prc'] as const).map((g) => (
              <div key={g}>
                {g === 'prc' && <hr className="hr" />}
                <div className="meter">
                  <div className="row">
                    <span className="k">{g.toUpperCase()} · risk fear</span>
                    <span className="v">{st.govs[g].riskFear.toFixed(0)}</span>
                  </div>
                  <div className="track">
                    <div className="fill cap" style={{ width: `${st.govs[g].riskFear}%` }} />
                  </div>
                </div>
                <div className="meter">
                  <div className="row">
                    <span className="k">{g.toUpperCase()} · race fear</span>
                    <span className="v" style={{ color: st.govs[g].raceFear > 60 ? 'var(--danger)' : st.govs[g].raceFear > 45 ? 'var(--warn-text)' : undefined }}>
                      {st.govs[g].raceFear.toFixed(0)}
                    </span>
                  </div>
                  <div className="track">
                    <div className={`fill ${st.govs[g].raceFear > 60 ? 'bad' : 'warn'}`} style={{ width: `${st.govs[g].raceFear}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <div className="note" style={{ marginTop: 6 }}>
              Treaty gates need risk fear. High race fear + high risk fear = nationalization territory.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function treatyStatus(state: GameState, node: TreatyNode): 'done' | 'available' | 'locked' {
  if (state.diplomacy.completed.includes(node.id)) return 'done';
  return treatyBlocked(state, node.id) === null ? 'available' : 'locked';
}

function TreatyTile({
  node,
  state,
  agreeP,
  selected,
  onSelect,
  setEl,
}: {
  node: TreatyNode;
  state: GameState;
  agreeP: number;
  selected: boolean;
  onSelect: () => void;
  setEl: (id: string, el: HTMLElement | null) => void;
}) {
  const s = treatyStatus(state, node);
  const meta = s === 'done' ? 'In force' : s === 'available' ? `${fmtMoney(node.cost)}${node.needsAgreement ? ` · ${(agreeP * 100).toFixed(0)}%` : ''}` : (treatyBlocked(state, node.id) ?? '');
  const cls = `rnode ${s}${selected ? ' sel' : ''}${node.id === 'global-pause' ? ' win' : ''}`;
  return (
    <button ref={(el) => setEl(node.id, el)} className={cls} onClick={onSelect} title={`“${node.quote}”`}>
      <span className="rtier">T{node.tier}</span>
      <span className="ricon-wrap">
        <ResearchIcon id={node.id} />
      </span>
      <span className="rname">{node.name}</span>
      <span className="rmeta">{meta}</span>
    </button>
  );
}

function TreatyDetail({ node, state, agreeP, onClose }: { node: TreatyNode; state: GameState; agreeP: number; onClose: () => void }) {
  const game = useGame();
  const s = treatyStatus(state, node);
  const blocked = s === 'done' ? null : treatyBlocked(state, node.id);
  const prereqs = node.prereqs.map((p) => TREATY_BY_ID[p]);
  return (
    <aside className="rdetail dinline">
      <button className="rclose" onClick={onClose} aria-label="close">
        ×
      </button>
      <div className="rd-head">
        <span className={`ricon-wrap big${node.id === 'global-pause' ? ' win' : ''}`}>
          <ResearchIcon id={node.id} />
        </span>
        <div>
          <h3>{node.name}</h3>
          <div className="rd-tier">Diplomacy · Tier {node.tier}</div>
        </div>
      </div>
      <div className="rd-quote">“{node.quote}”</div>
      <p className="rd-desc">{node.desc}</p>
      <div className={`rd-fx${node.id === 'global-pause' ? ' win' : ''}`}>{node.effect}</div>
      <div className="rd-reqs">
        <div>
          <span className="k">Cost</span>
          <span className="v">{fmtMoney(node.cost)}</span>
        </div>
        {node.minRiskFear !== undefined && (
          <div>
            <span className="k">{state.playerLab === 'tianshu' || state.playerLab === 'qingfeng' ? 'PRC' : 'US'} risk fear</span>
            <span className="v">≥ {node.minRiskFear}</span>
          </div>
        )}
        {node.needsAgreement && (
          <div>
            <span className="k">Rival agreement</span>
            <span className={`v${agreeP <= 0.5 ? ' short' : ''}`}>{(agreeP * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>
      {(prereqs.length > 0 || node.researchReqs) && (
        <div className="rd-pre">
          <span className="k">Requires</span>
          <ul>
            {prereqs.map((p) => (
              <li key={p.id} className={state.diplomacy.completed.includes(p.id) ? 'ok' : 'no'}>
                {p.name}
              </li>
            ))}
            {(node.researchReqs ?? []).map((r) => (
              <li key={r} className={state.labs[state.playerLab].research.completed.includes(r) ? 'ok' : 'no'}>
                {RESEARCH_BY_ID[r]?.name ?? r} (research)
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rd-action">
        {s === 'done' ? (
          <div className="rd-status done">✓ In force</div>
        ) : (
          <button className="btn primary" disabled={!!blocked} onClick={() => game.act((g) => signTreaty(g, node.id))}>
            {blocked ?? (node.needsAgreement ? `Negotiate — ${fmtMoney(node.cost)}` : `Sign — ${fmtMoney(node.cost)}`)}
          </button>
        )}
      </div>
    </aside>
  );
}

function SmallActions() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  return (
    <table className="action-table">
      <tbody>
        <tr>
          <th>Action</th>
          <th>Effect</th>
          <th className="num">Cost</th>
          <th></th>
        </tr>
        {SMALL_ACTIONS.map((a) => {
          const ready = smallActionReady(st, a.id);
          const cdLeft = Math.max(0, (st.diplomacy.cooldowns[a.id] ?? 0) - st.week);
          const target: GovId | null = a.needsTarget ? (a.id === 'backchannel' ? (player.country === 'us' ? 'prc' : 'us') : player.country) : null;
          return (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td style={{ color: 'var(--dim)' }}>{a.effect}</td>
              <td className="num">{a.cost > 0 ? fmtMoney(a.cost) : '−rev'}</td>
              <td>
                {ready ? (
                  <button className="btn sm" disabled={player.cash < a.cost} onClick={() => game.act((s) => smallDiplomacy(s, a.id, target))}>
                    Use{a.needsTarget ? ` (${target?.toUpperCase()})` : ''}
                  </button>
                ) : (
                  <span className="chip">{cdLeft} wk cd</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
