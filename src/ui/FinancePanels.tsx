import { useState } from 'react';
import { fundraise, orderChips, pursueLead } from '../engine/actions';
import { BAL } from '../engine/balance';
import { chipDeliveryFor, chipPriceFor, dilutionOf, investorPressure, licenseDemand, maxChipOrder, raiseTerms, runwayWeeks, weeklyPnl } from '../engine/finance';
import { committedChips, nextRunPayment } from '../engine/model';
import { fmtCompact, fmtDate, fmtMoney, fmtWeeks } from './format';
import { Icon } from './icons';
import { useGame, useSt } from './useGame';

/** Weekly P&L table — shared by Overview and Finance. */
export function PnlPanel() {
  const st = useSt();
  const player = st.labs[st.playerLab];
  const pnl = weeklyPnl(st, player, licenseDemand(st));
  const trainPay = player.run ? nextRunPayment(player, player.run) : 0;
  const net = pnl.net - trainPay;

  return (
    <div className="panel">
      <div className="hd">
        <h2>
          <Icon id="i-doc" />
          Weekly P&L
        </h2>
        <span className="tag" style={{ color: net < 0 ? 'var(--danger)' : 'var(--good)' }}>
          net {fmtMoney(net)}
        </span>
      </div>
      <div className="bd">
        <table>
          <tbody>
            <tr>
              <th>Revenue</th>
              <th className="num">$/wk</th>
            </tr>
            <tr>
              <td>
                Licenses — {fmtCompact(pnl.licensesServed)} seats @ ${player.licensePrice}/mo
              </td>
              <td className="num">{fmtMoney(pnl.licenseRevenue)}</td>
            </tr>
            {player.contracts.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name} <span style={{ color: 'var(--faint)' }}>(locked, permanent)</span>
                </td>
                <td className="num">{fmtMoney(c.weeklyPay)}</td>
              </tr>
            ))}
            {player.enterprise.length > 0 && (
              <tr>
                <td>
                  Enterprise — {player.enterprise.length} contract{player.enterprise.length > 1 ? 's' : ''}{' '}
                  <span style={{ color: 'var(--faint)' }}>({fmtCompact(player.enterprise.reduce((s, c) => s + c.chips, 0))} chips locked)</span>
                </td>
                <td className="num">{fmtMoney(pnl.enterpriseRevenue)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <hr className="hr" />
        <table>
          <tbody>
            <tr>
              <th>Costs</th>
              <th className="num">$/wk</th>
            </tr>
            <tr>
              <td>Payroll — staff, C-suite & stars</td>
              <td className="num">−{fmtMoney(pnl.payroll)}</td>
            </tr>
            <tr>
              <td>Compute operations</td>
              <td className="num">−{fmtMoney(pnl.computeOpex)}</td>
            </tr>
            {player.run && (
              <tr>
                <td>
                  Training run {player.run.codename} <span style={{ color: 'var(--faint)' }}>(pay-as-you-burn)</span>
                </td>
                <td className="num">−{fmtMoney(trainPay)}</td>
              </tr>
            )}
            {player.lawsuits.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.name} <span style={{ color: 'var(--faint)' }}>({l.weeksLeft} wk left)</span>
                </td>
                <td className="num">−{fmtMoney(l.weeklyCost)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <b>Net</b>
              </td>
              <td className="num" style={{ color: net < 0 ? 'var(--danger)' : 'var(--good)' }}>
                <b>{fmtMoney(net)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Fundraising rounds + investor expectation — shared by Overview and Finance.
 * `compact` (Overview) skips the valuation/cash/runway rows the header already shows.
 */
export function FundraisingPanel({ compact = false }: { compact?: boolean }) {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const runway = runwayWeeks(player);
  const smallT = raiseTerms(st, player, 'small');
  const largeT = raiseTerms(st, player, 'large');
  const canRaise = st.week >= player.fundraiseCooldownUntil;
  const emergency = player.cash < 0;
  const pressure = investorPressure(player);
  const dilPct = (amount: number) => `−${(dilutionOf(player, amount) * player.stake * 100).toFixed(1)}% stake`;

  return (
    <div className="panel">
      <div className="hd">
        <h2>
          <Icon id="i-dollar" />
          Fundraising
        </h2>
      </div>
      <div className="bd">
        {!compact && (
          <>
            <div className="kv">
              <span className="k">Valuation</span>
              <span className="v">{fmtMoney(player.valuation)}</span>
            </div>
            <div className="kv">
              <span className="k">Cash</span>
              <span className="v" style={player.cash < 0 ? { color: 'var(--danger)' } : undefined}>
                {fmtMoney(player.cash)}
              </span>
            </div>
            <div className="kv">
              <span className="k">Runway</span>
              <span className="v" style={{ color: runway < 20 ? 'var(--warn-text)' : undefined }}>
                {Number.isFinite(runway) ? fmtWeeks(runway) : '∞ (profitable)'}
              </span>
            </div>
          </>
        )}
        <div className="kv">
          <span className="k">Your stake</span>
          <span className="v" style={{ color: pressure > 0.5 ? 'var(--danger)' : pressure > 0 ? 'var(--warn-text)' : undefined }}>
            {(player.stake * 100).toFixed(1)}%{pressure > 0 ? ' · investors are pushing' : ''}
          </span>
        </div>
        <hr className="hr" />
        <div className="fcard info" style={{ marginBottom: 8, cursor: 'default' }}>
          <div className="when">LARGE ROUND</div>
          <div className="what">{fmtMoney(largeT.amount)} at current valuation</div>
          <div className="fx">
            Costs <b>1 board seat</b> (you'd hold {player.boardYours - 1} of 9{player.boardYours - 1 <= 4 ? ' — vote-out territory' : ''}) · {dilPct(largeT.amount)}.
          </div>
          <div className="btnrow">
            <button className="btn sm primary" disabled={!canRaise || player.boardYours <= 1} onClick={() => game.act((s) => fundraise(s, s.labs[s.playerLab], 'large'))}>
              {canRaise ? 'Take the round' : `cooldown ${player.fundraiseCooldownUntil - st.week} wk`}
            </button>
          </div>
        </div>
        <div className="fcard info" style={{ cursor: 'default' }}>
          <div className="when">SMALL ROUND</div>
          <div className="what">{fmtMoney(smallT.amount)} at current valuation</div>
          <div className="fx">
            No seat, but investors set a <b>{fmtMoney(smallT.expectation!.target)}/wk revenue target</b> due W{smallT.expectation!.deadlineWeek} ·{' '}
            {dilPct(smallT.amount)}. Missing the target costs valuation and board goodwill — more the less of the company you own.
          </div>
          <div className="btnrow">
            <button className="btn sm" disabled={!canRaise} onClick={() => game.act((s) => fundraise(s, s.labs[s.playerLab], 'small'))}>
              {canRaise ? 'Take the round' : `cooldown ${player.fundraiseCooldownUntil - st.week} wk`}
            </button>
          </div>
        </div>
        {emergency && (
          <div className="fcard warning" style={{ marginTop: 8, cursor: 'default' }}>
            <div className="when">EMERGENCY ROUND — BANKRUPTCY IN {Math.max(0, BAL.BANKRUPTCY_GRACE_WEEKS - player.brokeWeeks)} WK</div>
            <div className="what">{fmtMoney(player.valuation * BAL.EMERGENCY_RAISE_FRAC)} at brutal terms</div>
            <div className="fx">
              Valuation −{BAL.EMERGENCY_VALUATION_HIT * 100}% · discontent +{BAL.EMERGENCY_DISCONTENT} · 1 board seat · heavy dilution at the crushed
              price.
            </div>
            <div className="btnrow">
              <button className="btn sm danger" onClick={() => game.act((s) => fundraise(s, s.labs[s.playerLab], 'emergency'))}>
                Take it — survive
              </button>
            </div>
          </div>
        )}
        {player.revenueExpectation && (
          <div className="meter" style={{ marginTop: 10 }}>
            <div className="row">
              <span className="k">
                Investor target — {fmtMoney(player.revenueExpectation.target)}/wk by W{player.revenueExpectation.deadlineWeek}
              </span>
              <span className="v" style={{ color: player.weeklyRevenue >= player.revenueExpectation.target ? 'var(--good)' : 'var(--danger)' }}>
                {fmtMoney(player.weeklyRevenue)} · {player.weeklyRevenue >= player.revenueExpectation.target ? 'on track' : 'behind'}
              </span>
            </div>
            <div className="track">
              <div
                className={`fill ${player.weeklyRevenue >= player.revenueExpectation.target ? 'good' : 'bad'}`}
                style={{ width: `${Math.min(100, (100 * player.weeklyRevenue) / player.revenueExpectation.target)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Enterprise leads to pursue + running contracts and the fine-tune deployment
 * portfolio — shared by Overview and Finance. `compact` (Overview) adds a
 * deeplink to the Finance tab.
 */
export function EnterprisePanel({ compact = false }: { compact?: boolean }) {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const free = player.chips - committedChips(player);
  const deployments = player.enterprise.filter((c) => c.fineTune);

  return (
    <div className="panel" data-tut="panel-enterprise">
      <div className="hd">
        <h2>
          <Icon id="i-target" />
          Enterprise sales
        </h2>
        {compact ? (
          <button className="deeplink" onClick={() => game.goTab('finance')}>
            Finance →
          </button>
        ) : (
          <span className="tag" style={{ color: 'var(--faint)' }}>
            {player.enterprise.length} active · {fmtMoney(player.enterprise.reduce((s, c) => s + c.weeklyPay, 0))}/wk
          </span>
        )}
      </div>
      <div className="bd">
        {player.leads.length === 0 && <div className="note">No open leads. Enterprise customers come knocking every week or two — pursue them here before they walk.</div>}
        {player.leads.map((lead) => {
          const cantCash = player.cash < lead.cashCost;
          const cantChips = free < lead.chips;
          return (
            <div key={lead.id} className="fcard info" style={{ marginBottom: 8, cursor: 'default' }}>
              <div className="when">
                LEAD · {lead.fineTune ? 'FINE-TUNE · ' : ''}walks W{lead.expiresWeek}
              </div>
              <div className="what">
                {lead.name} — {fmtMoney(lead.weeklyPay)}/wk for {lead.durationWeeks} wk
              </div>
              <div className="fx">
                <b>{(lead.odds * 100).toFixed(0)}% to convert</b> · costs {fmtMoney(lead.cashCost)} up front (win or lose)
                {lead.fineTune ? ' — they want a model fine-tuned on their data' : ''} · locks {fmtCompact(lead.chips)} chips for the duration.
              </div>
              <div className="btnrow">
                <button className="btn sm primary" disabled={cantCash || cantChips} onClick={() => game.act((s) => pursueLead(s, s.labs[s.playerLab], lead.id))}>
                  {cantCash ? 'not enough cash' : cantChips ? `needs ${fmtCompact(lead.chips)} free chips` : 'Pursue the deal'}
                </button>
              </div>
            </div>
          );
        })}
        {player.enterprise.length > 0 && (
          <>
            <hr className="hr" />
            {player.enterprise.map((c) => (
              <div className="kv" key={c.id}>
                <span className="k">
                  {c.name}
                  {c.fineTune ? ' · FT' : ''}
                </span>
                <span className="v">
                  {fmtMoney(c.weeklyPay)}/wk · {c.endsWeek - st.week} wk left · {fmtCompact(c.chips)} chips
                </span>
              </div>
            ))}
          </>
        )}
        {deployments.length > 0 && (
          <div className="note" style={{ marginTop: 8 }}>
            Fine-tuned deployments: {deployments.map((c) => `${c.modelName ?? 'custom model'} @ ${c.name}`).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

/** Chip ordering — shared by Overview and the Compute tab. */
export function BuyComputePanel() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const [orderSize, setOrderSize] = useState(10_000);

  const chipPrice = chipPriceFor(st, player);
  const delivery = chipDeliveryFor(st, player);
  const maxOrder = maxChipOrder(player);
  const size = Math.min(orderSize, maxOrder);
  const cost = size * chipPrice;

  return (
    <div className="panel" data-tut="panel-buychips">
      <div className="hd">
        <h2>
          <Icon id="i-package" />
          Buy compute
        </h2>
        <span className="tag" style={{ color: 'var(--faint)' }}>
          {fmtMoney(chipPrice)} / chip · {delivery} wk delivery
        </span>
      </div>
      <div className="bd">
        <div className="slider">
          <div className="row">
            <span className="k">Order size</span>
            <span className="v">{fmtCompact(size)} chips</span>
          </div>
          <input type="range" min={1000} max={maxOrder} step={1000} value={size} onChange={(e) => setOrderSize(Number(e.target.value))} />
        </div>
        <div className="kv">
          <span className="k">Up-front cost</span>
          <span className="v" style={cost > player.cash ? { color: 'var(--danger)' } : undefined}>
            {fmtMoney(cost)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Delivery</span>
          <span className="v">
            week {st.week + delivery} · {fmtDate(st.week + delivery)}
          </span>
        </div>
        <div className="note">
          Paid immediately from cash. Your order joins the global backlog — big orders push prices and delivery times up for everyone.
          {player.country === 'prc' ? ' Export controls: PRC labs pay +40% and wait longer.' : ''}
        </div>
        <div className="btnrow">
          <button className="btn primary" disabled={cost > player.cash} onClick={() => game.act((s) => orderChips(s, s.labs[s.playerLab], size))}>
            Place order
          </button>
        </div>
      </div>
    </div>
  );
}
