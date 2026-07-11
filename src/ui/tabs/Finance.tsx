import { chipPriceFor } from '../../engine/finance';
import { fmtCompact, fmtMoney } from '../format';
import { EnterprisePanel, FundraisingPanel, PnlPanel, PricingPanel } from '../FinancePanels';
import { Icon } from '../icons';
import { useSt } from '../useGame';

export function FinanceTab() {
  const st = useSt();
  const player = st.labs[st.playerLab];

  const chipPrice = chipPriceFor(st, player);

  return (
    <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr 380px' }}>
      <div className="col">
        <PnlPanel />
        <PricingPanel />
      </div>

      <div className="col">
        <EnterprisePanel />
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
