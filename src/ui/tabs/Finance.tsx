import { setLicensePrice } from '../../engine/actions';
import { chipPriceFor, licenseDemand, serveCapacity, weeklyPnl } from '../../engine/finance';
import { fmtCompact, fmtMoney } from '../format';
import { FundraisingPanel, PnlPanel } from '../FinancePanels';
import { Icon } from '../icons';
import { useGame, useSt } from '../useGame';

export function FinanceTab() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];

  const demand = licenseDemand(st);
  const pnl = weeklyPnl(st, player, demand);
  const chipPrice = chipPriceFor(st, player);

  const capacity = serveCapacity(player);
  const myDemand = demand[player.id] ?? 0;

  return (
    <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr 380px' }}>
      <div className="col">
        <PnlPanel />

        <div className="panel" data-tut="panel-pricing">
          <div className="hd">
            <h2>
              <Icon id="i-tag" />
              Market & pricing
            </h2>
            <span className="tag" style={{ color: 'var(--faint)' }}>
              adoption {st.world.adoption.toFixed(0)}/100
            </span>
          </div>
          <div className="bd">
            <div className="slider">
              <div className="row">
                <span className="k">License price / seat / mo</span>
                <span className="v">${player.licensePrice}</span>
              </div>
              <input
                type="range"
                min={4}
                max={120}
                value={player.licensePrice}
                onChange={(e) => game.act((s) => setLicensePrice(s.labs[s.playerLab], Number(e.target.value)))}
              />
            </div>
            <div style={{ display: 'flex', gap: 26, marginTop: 10 }}>
              <div className="hm">
                <div className="k">Demand</div>
                <div className="v" style={{ fontSize: 15 }}>
                  {fmtCompact(myDemand)} seats
                </div>
              </div>
              <div className="hm">
                <div className="k">Capacity</div>
                <div className="v" style={{ fontSize: 15, color: capacity < myDemand ? 'var(--warn-text)' : undefined }}>
                  {fmtCompact(capacity)} seats
                </div>
              </div>
              <div className="hm">
                <div className="k">License rev / wk</div>
                <div className="v" style={{ fontSize: 15 }}>
                  {fmtMoney(pnl.licenseRevenue)}
                </div>
              </div>
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              Demand follows capability gap vs. rivals × adoption × price. {capacity < myDemand ? 'You are capacity-limited — free up inference chips or buy compute.' : 'Raising the price trades seats for margin.'}
            </div>
          </div>
        </div>
      </div>

      <div className="col">
        <FundraisingPanel />
      </div>

      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-chart" />
            Valuation
          </h2>
        </div>
        <div className="bd">
          <Sparkline values={st.history.slice(-104).map((h) => h.valuation)} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="axis-x">
            <span>{st.history.length > 1 ? `W${st.history[Math.max(0, st.history.length - 104)].week}` : ''}</span>
            <span>now · {fmtMoney(player.valuation)}</span>
          </div>
          <hr className="hr" />
          <div className="kv">
            <span className="k">Chip price / unit (you)</span>
            <span className="v">{fmtMoney(chipPrice)}</span>
          </div>
          <div className="kv">
            <span className="k">Global order backlog</span>
            <span className="v">{fmtCompact(st.world.backlog)} units</span>
          </div>
          <div className="kv">
            <span className="k">Chips on order</span>
            <span className="v">{player.chipOrders.length > 0 ? player.chipOrders.map((o) => `${fmtCompact(o.chips)} @ W${o.arrivesWeek}`).join(' · ') : 'none'}</span>
          </div>
          <div className="kv">
            <span className="k">Fleet efficiency</span>
            <span className="v">{(player.chipEfficiency * 100).toFixed(0)}% (obsolescence — new chips refresh it)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="note">History accumulates as weeks pass.</div>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1e-6, max - min);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 300).toFixed(1)},${(52 - ((v - min) / span) * 48 + 2).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 300 56" preserveAspectRatio="none">
      <polyline fill="none" stroke="#e9e7e2" strokeWidth="1.5" points={pts} />
    </svg>
  );
}
