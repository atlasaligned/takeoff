import { flagship } from '../../engine/model';
import { fmtCompact, fmtMoney } from '../format';
import { Icon } from '../icons';
import { RaceChart } from '../RaceChart';
import { useSt } from '../useGame';

export function RivalsTab() {
  const st = useSt();
  const rivals = Object.values(st.labs).filter((l) => l.id !== st.playerLab);
  const frontier = Math.max(...Object.values(st.labs).map((l) => (l.alive ? (flagship(l)?.capability ?? 0) : 0)));

  return (
    <>
      <div className="panel acc-cyan" style={{ maxWidth: 980, margin: '0 auto 18px' }}>
        <div className="hd">
          <h2>
            <Icon id="i-chart" />
            The race
          </h2>
        </div>
        <div className="bd">
          <RaceChart w={640} h={280} maxPoints={120} />
          <div className="legend">
            {Object.values(st.labs).map((l) => (
              <span key={l.id} style={{ textDecoration: l.alive ? undefined : 'line-through' }}>
                <i style={{ background: l.color }} />
                {l.shortName}
                {l.id === st.playerLab ? ' (you)' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid3">
      {rivals.map((r) => {
        const m = flagship(r);
        const cap = m?.capability ?? 0;
        const isLeader = r.alive && cap >= frontier - 0.01;
        return (
          <div className="panel" key={r.id}>
            <div className="hd">
              <h2>
                <Icon id="i-radar" />
                {r.name}
              </h2>
              {!r.alive ? (
                <span className="chip red">GONE</span>
              ) : isLeader ? (
                <span className="chip red">Leader</span>
              ) : cap >= frontier - 6 ? (
                <span className="chip amber">Rising</span>
              ) : (
                <span className="chip">Trailing</span>
              )}
            </div>
            <div className="bd">
              {!r.alive && <div className="note" style={{ marginBottom: 10 }}>{r.deathReason === 'bankrupt' ? 'Ran out of money. The logo is off the building.' : 'Taken over by their government.'}</div>}
              <div className="kv">
                <span className="k">HQ</span>
                <span className="v">{r.hq}</span>
              </div>
              <div className="kv">
                <span className="k">Flagship capability</span>
                <span className="v" style={{ color: isLeader ? 'var(--danger)' : undefined }}>
                  {r.alive ? cap.toFixed(1) : '—'}
                </span>
              </div>
              <div className="kv">
                <span className="k">Valuation</span>
                <span className="v">{fmtMoney(r.valuation)}</span>
              </div>
              <div className="kv">
                <span className="k">Compute</span>
                <span className="v">
                  {fmtCompact(r.chips)} chips{r.country === 'prc' ? <span style={{ color: 'var(--faint)' }}> (export-limited)</span> : null}
                </span>
              </div>
              <div className="kv">
                <span className="k">Govt / public trust</span>
                <span className="v">
                  {r.govTrust.toFixed(0)} / {r.publicTrust.toFixed(0)}
                </span>
              </div>
              <div className="kv">
                <span className="k">License price</span>
                <span className="v">${r.licensePrice}/mo</span>
              </div>
              <div className="kv">
                <span className="k">Training runs</span>
                <span className="v" style={{ color: 'var(--faint)' }}>
                  not visible
                </span>
              </div>
              <hr className="hr" />
              <div className="note" style={{ marginBottom: 6 }}>
                C-suite & stars (stars are poachable — see People):
              </div>
              <div style={{ font: '400 11px var(--mono)', color: 'var(--dim)' }}>
                {r.csuite.ceo ? `CEO ${r.csuite.ceo.name}` : 'CEO —'}
                {r.csuite.cto ? ` · CTO ${r.csuite.cto.name}` : ''}
                {r.csuite.alignment ? ` · HoA ${r.csuite.alignment.name}` : ''}
                <br />
                Stars: {r.stars.length > 0 ? r.stars.map((s) => `${s.name} ${'★'.repeat(s.tier)}`).join(' · ') : 'none'}
              </div>
              <hr className="hr" />
              <div className="kv">
                <span className="k">Known research</span>
                <span className="v" style={{ fontSize: 11 }}>
                  {r.research.completed.length} nodes{r.rsiRate > 0 ? ' · RSI ACTIVE' : ''}
                </span>
              </div>
              {r.rsiRate > 0 && (
                <div className="note" style={{ color: 'var(--danger)' }}>
                  Their model is improving itself. The clock is theirs now.
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}
