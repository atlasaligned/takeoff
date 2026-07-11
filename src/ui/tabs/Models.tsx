import { useState } from 'react';
import { abortTrainingRun, promoteModel, startPostTraining, startTrainingRun } from '../../engine/actions';
import { BAL } from '../../engine/balance';
import { committedChips, flagship, postTrainCost, postTrainPreview, predictCapability, runProgress, runWeeksLeft, trainCost } from '../../engine/model';
import { fmtCompact, fmtFlop, fmtMoney, fmtWeeks } from '../format';
import { Icon } from '../icons';
import { useGame, useSt } from '../useGame';

export function ModelsTab() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const m = flagship(player);
  const [runWeeks, setRunWeeks] = useState(24);
  const [commit, setCommit] = useState(5000);

  const maxCommit = Math.max(0, player.chips - committedChips(player));
  const trainChips = Math.min(commit, maxCommit);
  const flop = trainChips * player.chipEfficiency * BAL.FLOP_PER_CHIP_WEEK * runWeeks;
  const cost = trainCost(player, flop);
  const estCap = predictCapability(player, flop, st.world.algoProgress);

  return (
    <div className="grid3" style={{ gridTemplateColumns: '380px 1fr 400px' }}>
      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-chipset" />
            Flagship — {m ? m.name : 'none'}
          </h2>
          <span className="chip blue">Serving</span>
        </div>
        <div className="bd">
          {m ? (
            <>
              <div className="hero">
                <span className="num">{m.capability.toFixed(1)}</span>
                <span className="of">/ 100 capability</span>
              </div>
              <div className="meter band" style={{ marginTop: 14 }}>
                <div className="row">
                  <span className="k">Est. alignment</span>
                  <span className="v" style={{ color: 'var(--good)' }}>
                    {m.alignmentLo.toFixed(0)} – {m.alignmentHi.toFixed(0)}
                  </span>
                </div>
                <div className="track">
                  <div className="range" style={{ left: `${m.alignmentLo}%`, width: `${Math.max(1, m.alignmentHi - m.alignmentLo)}%` }} />
                </div>
                <div className="ticks">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
              <div className="note" style={{ marginTop: 2 }}>
                The true value is somewhere in the band — and not necessarily in the middle. Alignment compute and interpretability research narrow it.
              </div>
              <div className="meter">
                <div className="row">
                  <span className="k">Robustness</span>
                  <span className="v">{m.robustness.toFixed(0)}</span>
                </div>
                <div className="track">
                  <div className={`fill ${m.robustness > 70 ? 'good' : m.robustness > 40 ? 'warn' : 'bad'}`} style={{ width: `${m.robustness}%` }} />
                </div>
              </div>
              <hr className="hr" />
              <div className="hd" style={{ padding: '0 0 6px' }}>
                <h2>Post-training</h2>
              </div>
              <div className="kv">
                <span className="k">Cost</span>
                <span className="v">
                  {fmtMoney(postTrainCost(player))} · commits {fmtCompact(BAL.POST_TRAIN_CHIPS)} chips · {BAL.POST_TRAIN_WEEKS} wk
                </span>
              </div>
              <div className="kv">
                <span className="k">Est. effect</span>
                <span className="v">
                  capability {m.capability.toFixed(1)} → {(m.capability + postTrainPreview(player).cap).toFixed(1)} · +{postTrainPreview(player).align.toFixed(1)} align ·
                  +{postTrainPreview(player).robust.toFixed(1)} robustness
                </span>
              </div>
              <div className="kv">
                <span className="k">Passes on this model</span>
                <span className="v">{m.postTrainCount} used · diminishing</span>
              </div>
              <div className="btnrow">
                <button
                  className="btn primary wide"
                  disabled={!!player.postTraining}
                  onClick={() => game.act((s) => startPostTraining(s.labs[s.playerLab]))}
                >
                  {player.postTraining ? `Post-training — ${player.postTraining.weeksLeft} wk left` : `Start post-training — ${BAL.POST_TRAIN_WEEKS} wk`}
                </button>
              </div>
            </>
          ) : (
            <div className="note">No flagship. Promote a model from the vault.</div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-archive" />
            Model vault
          </h2>
          <span className="tag" style={{ color: 'var(--faint)' }}>
            cold storage
          </span>
        </div>
        <div className="bd">
          <table>
            <tbody>
              <tr>
                <th>Model</th>
                <th className="mono">Trained</th>
                <th className="num">Cap.</th>
                <th className="mono">Align. est</th>
                <th className="num">Rob.</th>
                <th></th>
              </tr>
              {[...player.models]
                .sort((a, b) => b.createdWeek - a.createdWeek)
                .map((model) => (
                  <tr key={model.id} className={model.id === player.flagshipId ? 'you' : ''}>
                    <td>
                      {model.name}
                      {model.id === player.flagshipId && (
                        <span className="chip blue" style={{ marginLeft: 6 }}>
                          flagship
                        </span>
                      )}
                    </td>
                    <td className="mono">W{model.createdWeek}</td>
                    <td className="num">{model.capability.toFixed(1)}</td>
                    <td className="mono">
                      {model.alignmentLo.toFixed(0)}–{model.alignmentHi.toFixed(0)}
                    </td>
                    <td className="num">{model.robustness.toFixed(0)}</td>
                    <td>
                      {model.id !== player.flagshipId && (
                        <button className="btn sm" onClick={() => game.act((s) => promoteModel(s.labs[s.playerLab], model.id))}>
                          Promote
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="note" style={{ marginTop: 10 }}>
            Only the flagship is served — it carries the revenue, the jailbreak exposure and the win roll. Promotion is instant; demoted models keep
            their stats.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-flame" />
            Training runs
          </h2>
        </div>
        <div className="bd">
          {player.run ? (
            <div className="commit" style={{ marginBottom: 14 }}>
              <div className="t">
                <span className="nm">
                  <Icon id="i-flame" />
                  {player.run.codename} — active
                </span>
                <span className="st">
                  {(runProgress(player.run) * 100).toFixed(0)}% · ETA {fmtWeeks(runWeeksLeft(player, player.run))}
                </span>
              </div>
              <div className="prog">
                <i style={{ width: `${runProgress(player.run) * 100}%`, background: 'var(--cap)' }} />
              </div>
              <div className="sub">
                {player.run.modelName} · {fmtFlop(player.run.targetFlop)} FLOP · est. capability ~{player.run.estCapability.toFixed(0)} ·{' '}
                {fmtCompact(player.run.chips)} chips committed
              </div>
              <div className="note" style={{ marginTop: 6 }}>
                Most capability gains land in the final weeks. Aborting now keeps ~
                {(100 * Math.pow(runProgress(player.run), BAL.ABORT_EXP)).toFixed(0)}% of the est. capability.
              </div>
              <div className="btnrow">
                <button className="btn danger wide" onClick={() => game.act((s) => abortTrainingRun(s, s.labs[s.playerLab]))}>
                  Abort — free the training chips
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="hd" style={{ padding: '0 0 6px' }}>
                <h2>New run</h2>
              </div>
              <div className="slider">
                <div className="row">
                  <span className="k">Chips to commit</span>
                  <span className="v">{fmtCompact(trainChips)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxCommit}
                  step={100}
                  value={trainChips}
                  disabled={maxCommit === 0}
                  onChange={(e) => setCommit(Number(e.target.value))}
                />
              </div>
              <div className="slider">
                <div className="row">
                  <span className="k">Duration</span>
                  <span className="v">{runWeeks} wk</span>
                </div>
                <input type="range" min={6} max={60} step={1} value={runWeeks} onChange={(e) => setRunWeeks(Number(e.target.value))} />
              </div>
              <div className="kv">
                <span className="k">Total compute</span>
                <span className="v">{fmtFlop(flop)} FLOP</span>
              </div>
              <div className="kv">
                <span className="k">Up-front cost</span>
                <span className="v" style={cost > player.cash ? { color: 'var(--danger)' } : undefined}>
                  {fmtMoney(cost)}
                </span>
              </div>
              <div className="kv">
                <span className="k">Est. capability</span>
                <span className="v" style={{ color: 'var(--cap)' }}>
                  ~{estCap.toFixed(1)}
                </span>
              </div>
              <div className="note" style={{ margin: '6px 0' }}>
                Capability scales log-like with compute — each step costs ~10× more. Cost is paid up front; the chips are committed until the run ends
                (or you abort for a subpar model). New model inherits some alignment/robustness from the flagship, plus a large random component.
              </div>
              <div className="btnrow">
                <button
                  className="btn primary wide"
                  disabled={trainChips < 500 || cost > player.cash}
                  onClick={() => game.act((s) => startTrainingRun(s, s.labs[s.playerLab], flop, trainChips))}
                >
                  {trainChips < 500 ? 'Commit more chips' : cost > player.cash ? 'Not enough cash' : `Start run — ${fmtMoney(cost)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
