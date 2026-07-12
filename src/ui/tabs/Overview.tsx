import { abortTrainingRun, startPostTraining } from '../../engine/actions';
import { nextResearchPicks, nextTreatyPicks } from '../../engine/advisor';
import { BAL } from '../../engine/balance';
import { agreementProbability, SMALL_ACTIONS, smallActionReady, TREATY_BY_ID, treatyBlocked } from '../../engine/diplomacy';
import { bandWidth, committedChips, flagship, postTrainCost, postTrainPreview, runWeeksLeft, runProgress } from '../../engine/model';
import { RESEARCH_BY_ID, researchBlocked, researchCost, researchWeeks } from '../../engine/research';
import { fmtCompact, fmtFlop, fmtMoney, fmtWeeks } from '../format';
import { Icon } from '../icons';
import { ResearchIcon } from '../researchIcons';
import { ComputePanel } from '../ComputePanel';
import { BuyComputePanel, EnterprisePanel, FundraisingPanel, PnlPanel, PricingPanel } from '../FinancePanels';
import { useGame, useSt } from '../useGame';

export function OverviewTab() {
  return (
    <div className="hub2">
      {/* left — finance: the buttons you work every week, then the P&L they feed */}
      <div className="col">
        <EnterprisePanel compact />
        <PricingPanel compact />
        <FundraisingPanel compact />
        <PnlPanel />
      </div>

      {/* middle — the flagship, then what to do with it */}
      <div className="col">
        <FlagshipPanel />
        <NextMovesPanel />
        <CommitmentsPanel />
      </div>

      {/* right — compute */}
      <div className="col">
        <ComputePanel />
        <BuyComputePanel />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- flagship

function FlagshipPanel() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const m = flagship(player);

  const cost = postTrainCost(player);
  const preview = postTrainPreview(player);
  const freeChips = Math.max(0, player.chips - committedChips(player));
  const blocked = player.postTraining
    ? `Post-training — ${player.postTraining.weeksLeft} wk left`
    : cost > player.cash
      ? 'Not enough cash'
      : freeChips < BAL.POST_TRAIN_CHIPS
        ? `Needs ${fmtCompact(BAL.POST_TRAIN_CHIPS)} free chips`
        : null;

  return (
    <div className="panel acc-cyan">
      <div className="hd">
        <h2>
          <Icon id="i-chipset" />
          Flagship — {m ? m.name : 'none'}
        </h2>
        <button className="deeplink" onClick={() => game.goTab('models')}>
          Models →
        </button>
      </div>
      <div className="bd">
        {m ? (
          <>
            <div className="hero">
              <span className="num">{m.capability.toFixed(1)}</span>
              <span className="of">/ 100 capability</span>
            </div>
            <div className="kv">
              <span className="k">Est. alignment</span>
              <span className="v" style={{ color: 'var(--good)' }}>
                {m.alignmentLo.toFixed(0)} – {m.alignmentHi.toFixed(0)}
                <small style={{ color: 'var(--faint)' }}> (band {bandWidth(m).toFixed(0)})</small>
              </span>
            </div>
            <div className="kv">
              <span className="k">Robustness</span>
              <span className="v" style={{ color: m.robustness > 70 ? 'var(--good)' : m.robustness > 40 ? 'var(--warn-text)' : 'var(--red)' }}>
                {m.robustness.toFixed(0)}
              </span>
            </div>
            <hr className="hr" />
            <div className="kv">
              <span className="k">Post-training</span>
              <span className="v">
                {fmtMoney(cost)} · {BAL.POST_TRAIN_WEEKS} wk · +{preview.cap.toFixed(1)} cap · +{preview.align.toFixed(1)} align · +
                {preview.robust.toFixed(1)} rob
              </span>
            </div>
            <div className="btnrow" style={{ marginTop: 6 }}>
              <button className="btn primary wide" disabled={!!blocked} onClick={() => game.act((s) => startPostTraining(s.labs[s.playerLab]))}>
                {blocked ?? `Start post-training — ${fmtMoney(cost)}`}
              </button>
            </div>
            <button className="deeplink" style={{ marginTop: 8 }} onClick={() => game.goTab('models')}>
              Start a new training run →
            </button>
          </>
        ) : (
          <>
            <div className="note">No flagship — no revenue, no evals, no progress.</div>
            <div className="btnrow">
              <button className="btn primary wide" onClick={() => game.goTab('models')}>
                Promote a model from the vault →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- next moves

function NextMovesPanel() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const cap = flagship(player)?.capability ?? 0;
  const research = nextResearchPicks(st, 3);
  const treaties = nextTreatyPicks(st, 3);
  const agreeP = agreementProbability(st, player);
  const readyActions = SMALL_ACTIONS.filter((a) => smallActionReady(st, player, a.id) && player.cash >= a.cost);

  return (
    <div className="panel">
      <div className="hd">
        <h2>
          <Icon id="i-target" />
          Next moves
        </h2>
        <span className="tag" style={{ color: 'var(--faint)' }}>
          advisor picks
        </span>
      </div>
      <div className="bd">
        <div className="nxhead">
          <span>Research</span>
          <button className="deeplink" onClick={() => game.goTab('research')}>
            full tree →
          </button>
        </div>
        {research.map((id) => {
          const node = RESEARCH_BY_ID[id];
          const blocked = researchBlocked(player, id, cap);
          return (
            <button key={id} className="nxrow" onClick={() => game.goTab('research', id)}>
              <span className="ricon-wrap">
                <ResearchIcon id={id} />
              </span>
              <span className="grow">
                <span className="nm">{node.name}</span>
                <span className="meta">
                  {node.branch} T{node.tier} · {fmtMoney(researchCost(player, node))} · {researchWeeks(player, node)} wk
                </span>
              </span>
              <span className={`st ${blocked ? 'wait' : 'go'}`}>{blocked ?? 'ready'}</span>
            </button>
          );
        })}
        {research.length === 0 && <div className="note">Nothing unlocked to research right now.</div>}

        <div className="nxhead" style={{ marginTop: 14 }}>
          <span>Diplomacy</span>
          <button className="deeplink" onClick={() => game.goTab('diplomacy')}>
            treaty track →
          </button>
        </div>
        {treaties.map((id) => {
          const t = TREATY_BY_ID[id];
          const blocked = treatyBlocked(st, player, id);
          return (
            <button key={id} className="nxrow" onClick={() => game.goTab('diplomacy', id)}>
              <span className="ricon-wrap">
                <ResearchIcon id={id} />
              </span>
              <span className="grow">
                <span className="nm">{t.name}</span>
                <span className="meta">
                  treaty T{t.tier} · {fmtMoney(t.cost)}
                  {t.needsAgreement ? ` · ${(agreeP * 100).toFixed(0)}% odds` : ''}
                </span>
              </span>
              <span className={`st ${blocked ? 'wait' : 'go'}`}>{blocked ?? 'signable'}</span>
            </button>
          );
        })}
        {treaties.length === 0 && <div className="note">The treaty track is complete.</div>}

        {readyActions.length > 0 && (
          <button className="nxready" onClick={() => game.goTab('diplomacy')}>
            Off cooldown: {readyActions.map((a) => a.name).join(' · ')} →
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- commitments

function CommitmentsPanel() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];

  return (
    <div className="panel">
      <div className="hd">
        <h2>
          <Icon id="i-clock" />
          Commitments
        </h2>
      </div>
      <div className="bd">
        {player.run && (
          <div className="commit">
            <div className="t">
              <span className="nm">
                <Icon id="i-flame" />
                Training — {player.run.codename}
              </span>
              <span className="st">ETA {fmtWeeks(runWeeksLeft(player, player.run))}</span>
            </div>
            <div className="prog">
              <i style={{ width: `${(runProgress(player.run) * 100).toFixed(1)}%`, background: 'var(--cap)' }} />
            </div>
            <div className="sub">
              {player.run.modelName} · {fmtFlop(player.run.targetFlop)} FLOP · {fmtCompact(player.run.chips)} chips
            </div>
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => game.goTab('models')}>
                Details →
              </button>
              <button className="btn sm danger" onClick={() => game.act((s) => abortTrainingRun(s, s.labs[s.playerLab]))}>
                Abort
              </button>
            </div>
          </div>
        )}
        {player.postTraining && (
          <div className="commit">
            <div className="t">
              <span className="nm">
                <Icon id="i-zap" />
                Post-training
              </span>
              <span className="st">{player.postTraining.weeksLeft} wk left</span>
            </div>
            <div className="prog">
              <i
                style={{
                  width: `${(100 * (player.postTraining.totalWeeks - player.postTraining.weeksLeft)) / player.postTraining.totalWeeks}%`,
                  background: 'var(--cap)',
                }}
              />
            </div>
          </div>
        )}
        {player.research.active.map((a) => (
          <div className="commit" key={a.nodeId}>
            <div className="t">
              <span className="nm">
                <Icon id="i-flask" />
                {RESEARCH_BY_ID[a.nodeId].name}
              </span>
              <span className="st">{Math.max(0, a.totalWeeks - a.weeksDone)} wk left</span>
            </div>
            <div className="prog">
              <i style={{ width: `${(100 * a.weeksDone) / a.totalWeeks}%`, background: RESEARCH_BY_ID[a.nodeId].branch === 'alignment' ? 'var(--align)' : 'var(--cap)' }} />
            </div>
            <div className="sub">
              research · {RESEARCH_BY_ID[a.nodeId].branch} T{RESEARCH_BY_ID[a.nodeId].tier}
            </div>
          </div>
        ))}
        {player.contracts.map((c) => (
          <div className="commit" key={c.id}>
            <div className="t">
              <span className="nm">
                <Icon id="i-doc" />
                {c.name}
              </span>
              <span className="st">permanent</span>
            </div>
            <div className="sub">
              {fmtMoney(c.weeklyPay)}/wk · {fmtCompact(c.chips)} chips locked
            </div>
          </div>
        ))}
        {player.chipOrders.map((o, i) => (
          <div className="commit" key={i}>
            <div className="t">
              <span className="nm">
                <Icon id="i-package" />
                Chip order
              </span>
              <span className="st">arrives W{o.arrivesWeek}</span>
            </div>
            <div className="prog">
              <i
                style={{
                  width: `${Math.min(100, (100 * (st.week - o.orderedWeek)) / Math.max(1, o.arrivesWeek - o.orderedWeek))}%`,
                  background: 'var(--warn)',
                }}
              />
            </div>
            <div className="sub">{fmtCompact(o.chips)} chips</div>
          </div>
        ))}
        {!player.run && (
          <button className="nxready" style={{ marginTop: 0 }} onClick={() => game.goTab('models')}>
            No training run active — plan one →
          </button>
        )}
      </div>
    </div>
  );
}
