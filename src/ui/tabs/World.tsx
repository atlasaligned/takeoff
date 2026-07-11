import { BAL } from '../../engine/balance';
import { jailbreakChance } from '../../engine/jailbreak';
import { flagship } from '../../engine/model';
import { quadrant } from '../../engine/world';
import { fmtCompact, fmtMoney } from '../format';
import { Icon } from '../icons';
import { useSt } from '../useGame';

export function WorldTab() {
  const st = useSt();
  const player = st.labs[st.playerLab];
  const m = flagship(player);
  const jb = jailbreakChance(st, player);
  const adoptionHist = st.history.slice(-104).map((h) => h.adoption);

  return (
    <div className="grid3">
      <div className="col">
        <div className="panel">
          <div className="hd">
            <h2>
              <Icon id="i-landmark" />
              Governments
            </h2>
          </div>
          <div className="bd">
            <div className="quad">
              <div className="vline" />
              <div className="hline" />
              <span className="qlbl" style={{ left: 0, top: 0 }}>
                Regulating
              </span>
              <span className="qlbl danger" style={{ right: 0, top: 0 }}>
                Nervous
              </span>
              <span className="qlbl" style={{ left: 0, bottom: 0 }}>
                Asleep
              </span>
              <span className="qlbl" style={{ right: 0, bottom: 0 }}>
                Accelerating
              </span>
              <div className="pt" style={{ left: `${st.govs.us.raceFear}%`, bottom: `${st.govs.us.riskFear}%`, background: 'var(--cap)' }}>
                <span style={{ color: 'var(--text)' }}>US</span>
              </div>
              <div className="pt" style={{ left: `${st.govs.prc.raceFear}%`, bottom: `${st.govs.prc.riskFear}%`, background: 'var(--danger)' }}>
                <span style={{ color: 'var(--red)' }}>PRC</span>
              </div>
            </div>
            <div className="axis-x">race fear →&nbsp;&nbsp;(↑ risk fear)</div>
            <div className="kv">
              <span className="k">Your government ({player.country.toUpperCase()})</span>
              <span className="v">{quadrant(st.govs[player.country]).toUpperCase()}</span>
            </div>
            <div className="meter">
              <div className="row">
                <span className="k">Govt trust in you</span>
                <span className="v">{player.govTrust.toFixed(0)}</span>
              </div>
              <div className="track">
                <div className={`fill ${player.govTrust > 55 ? 'good' : player.govTrust > 30 ? 'warn' : 'bad'}`} style={{ width: `${player.govTrust}%` }} />
              </div>
            </div>
            <div className="meter">
              <div className="row">
                <span className="k">Public trust</span>
                <span className="v" style={{ color: player.publicTrust < 38 ? 'var(--warn-text)' : undefined }}>
                  {player.publicTrust.toFixed(0)}
                </span>
              </div>
              <div className="track">
                <div className={`fill ${player.publicTrust > 55 ? 'good' : player.publicTrust > 30 ? 'warn' : 'bad'}`} style={{ width: `${player.publicTrust}%` }} />
              </div>
            </div>
            <div className="note">
              Below {BAL.PUBLIC_TRUST_LOW} public trust: protests, sabotage, whistleblowers. A nervous government that doesn't trust you (&lt;
              {BAL.GOV_TRUST_NATIONALIZE}) starts drafting nationalization orders.
            </div>
            {player.regulationDrag > 0.02 && (
              <div className="note" style={{ color: 'var(--warn-text)', marginTop: 6 }}>
                Regulation drag: training −{(player.regulationDrag * 100).toFixed(0)}% while your government is {quadrant(st.govs[player.country])}.
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="hd">
            <h2>
              <Icon id="i-chart" />
              Adoption
            </h2>
          </div>
          <div className="bd">
            <div className="meter">
              <div className="row">
                <span className="k">Global AI adoption</span>
                <span className="v">{st.world.adoption.toFixed(1)} / 100</span>
              </div>
              <div className="track">
                <div className="fill cap" style={{ width: `${st.world.adoption}%` }} />
              </div>
            </div>
            {adoptionHist.length > 2 && (
              <svg className="spark" viewBox="0 0 300 56" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#53c06b"
                  strokeWidth="1.5"
                  points={adoptionHist.map((v, i) => `${((i / (adoptionHist.length - 1)) * 300).toFixed(1)},${(54 - (v / 100) * 52).toFixed(1)}`).join(' ')}
                />
              </svg>
            )}
            <div className="note" style={{ marginTop: 8 }}>
              Higher adoption: more demand, higher viable prices — and more actors probing your model.
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-package" />
            Chip market
          </h2>
        </div>
        <div className="bd">
          <div className="kv">
            <span className="k">Base price / unit</span>
            <span className="v">{fmtMoney(st.world.chipPrice)}</span>
          </div>
          <div className="kv">
            <span className="k">Delivery time</span>
            <span className="v">{Math.round(st.world.chipDeliveryWeeks)} weeks</span>
          </div>
          <div className="kv">
            <span className="k">Global order backlog</span>
            <span className="v">{fmtCompact(st.world.backlog)} units</span>
          </div>
          <div className="kv">
            <span className="k">Export controls</span>
            <span className="v">PRC labs pay +{Math.round((BAL.PRC_CHIP_PRICE_MULT - 1) * 100)}%, wait +{BAL.PRC_CHIP_DELIVERY_EXTRA} wk</span>
          </div>
          {st.world.chipCap !== null && (
            <>
              <hr className="hr" />
              <div className="kv">
                <span className="k">Compute Cap Treaty</span>
                <span className="v" style={{ color: 'var(--good)' }}>
                  {fmtCompact(st.world.chipCap)} chips / lab
                </span>
              </div>
            </>
          )}
          <hr className="hr" />
          <div className="note">
            Every lab's orders join the same fab queue. Backlog decays as fabs work through it; supply shocks arrive as events.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-warn" />
            Hazard ladder
          </h2>
          <span className="tag" style={{ color: 'var(--faint)' }}>
            jailbreak severity by capability
          </span>
        </div>
        <div className="bd">
          <table>
            <tbody>
              <tr>
                <th>Cap.</th>
                <th>Class</th>
                <th>Examples</th>
              </tr>
              <tr>
                <td className="mono">&lt;{BAL.JB_MINOR_MAX}</td>
                <td>
                  <span className="chip">Minor</span>
                </td>
                <td style={{ color: 'var(--dim)' }}>Nigerian Prince 2.0 · Dead Internet · Homework Machine</td>
              </tr>
              <tr>
                <td className="mono">
                  {BAL.JB_MINOR_MAX}–{BAL.JB_BAD_MAX}
                </td>
                <td>
                  <span className="chip amber">Bad</span>
                </td>
                <td style={{ color: 'var(--dim)' }}>Glassworm · Lights Out · Flash Crash · Bank Run</td>
              </tr>
              <tr>
                <td className="mono">
                  {BAL.JB_BAD_MAX}–{BAL.JB_SEVERE_MAX}
                </td>
                <td>
                  <span className="chip red">Severe</span>
                </td>
                <td style={{ color: 'var(--dim)' }}>Digital Winter · Drone Swarms · Engineered Pathogen</td>
              </tr>
              <tr>
                <td className="mono">&gt;{BAL.JB_SEVERE_MAX}</td>
                <td>
                  <span className="chip red">Terminal</span>
                </td>
                <td style={{ color: 'var(--dim)' }}>Mirror Life · Grey Goo · The Escape · WWIII</td>
              </tr>
            </tbody>
          </table>
          <div className="meter" style={{ marginTop: 12 }}>
            <div className="row">
              <span className="k">Your weekly jailbreak risk</span>
              <span className="v" style={{ color: jb > 0.02 ? 'var(--danger)' : jb > 0.008 ? 'var(--warn-text)' : undefined }}>
                {(jb * 100).toFixed(2)}%
              </span>
            </div>
            <div className="track">
              <div className={`fill ${jb > 0.02 ? 'bad' : 'warn'}`} style={{ width: `${Math.min(100, jb * 1000)}%` }} />
            </div>
          </div>
          <div className="note">
            f(capability {m ? m.capability.toFixed(1) : '—'}, robustness {m ? m.robustness.toFixed(0) : '—'}, adoption {st.world.adoption.toFixed(0)}).
            Serving no one doesn't save you — the weights exist.
          </div>
        </div>
      </div>
    </div>
  );
}
