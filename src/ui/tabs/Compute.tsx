import { ComputePanel } from '../ComputePanel';
import { BuyComputePanel } from '../FinancePanels';
import { fmtCompact } from '../format';
import { Icon } from '../icons';
import { useSt } from '../useGame';

export function ComputeTab() {
  const st = useSt();
  const player = st.labs[st.playerLab];

  return (
    <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 1100 }}>
      <div className="col">
        <ComputePanel />
      </div>
      <div className="col">
        <BuyComputePanel />

        <div className="panel">
          <div className="hd">
            <h2>
              <Icon id="i-chipset" />
              Fleet
            </h2>
          </div>
          <div className="bd">
            <div className="kv">
              <span className="k">Chips</span>
              <span className="v">{fmtCompact(player.chips)}</span>
            </div>
            <div className="kv">
              <span className="k">Fleet efficiency</span>
              <span className="v">{(player.chipEfficiency * 100).toFixed(0)}%</span>
            </div>
            <div className="kv">
              <span className="k">Effective chips</span>
              <span className="v">{fmtCompact(player.chips * player.chipEfficiency)}</span>
            </div>
            <div className="kv">
              <span className="k">On order</span>
              <span className="v">{player.chipOrders.length > 0 ? player.chipOrders.map((o) => `${fmtCompact(o.chips)} @ W${o.arrivesWeek}`).join(' · ') : 'none'}</span>
            </div>
            <div className="note">Efficiency decays as the fleet ages; new chips refresh the average.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
