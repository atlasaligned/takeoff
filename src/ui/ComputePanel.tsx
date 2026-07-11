import type { ReactNode } from 'react';
import { setAlignmentCompute } from '../engine/actions';
import { licenseDemand, licenseRevenueForSeats, seatsPerChip, serveCapacity } from '../engine/finance';
import { alignmentGainPreview, flagship, runWeeksLeft } from '../engine/model';
import { fmtCompact, fmtMoney, fmtWeeks } from './format';
import { Icon } from './icons';
import { useGame, useSt } from './useGame';

/* monochrome ramp — commitment intensity reads as brightness; alignment is the one semantic color */
const COLOR = {
  training: '#e9e7e2',
  postTraining: '#b8b6b0',
  inference: '#6e6c67',
  alignment: 'var(--align)',
  contracts: '#3a3a3f',
};

/**
 * Compute allocation: contracts, training and post-training are fixed
 * commitments; the single slider splits everything else between inference
 * and alignment. There is no idle — freed chips flow to inference.
 */
export function ComputePanel() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];

  const reserved = player.contracts.reduce((s, c) => s + c.chips, 0) + player.enterprise.reduce((s, c) => s + c.chips, 0);
  const contractPay = player.contracts.reduce((s, c) => s + c.weeklyPay, 0) + player.enterprise.reduce((s, c) => s + c.weeklyPay, 0);
  const runChips = player.run?.chips ?? 0;
  const ptChips = player.postTraining?.chips ?? 0;
  const a = player.alloc;
  const free = a.inference + a.alignment;
  const chips = Math.max(1, player.chips);
  const pct = (n: number) => `${((100 * n) / chips).toFixed(2)}%`;

  const demand = licenseDemand(st)[player.id] ?? 0;
  const spc = seatsPerChip(player);
  const capacity = serveCapacity(player);
  const served = Math.min(demand, capacity);
  const shortfall = Math.max(0, demand - capacity);
  const lostRevenue = licenseRevenueForSeats(player, shortfall);
  const demandChips = spc > 0 ? demand / spc : 0;

  const flag = flagship(player);
  const alignGain = alignmentGainPreview(player);

  // ------- consequence lines -------
  let trainingText: ReactNode = 'no active run';
  if (player.run) trainingText = `${player.run.codename} · ETA ${fmtWeeks(runWeeksLeft(player, player.run))}`;

  let inferenceText: ReactNode;
  let inferenceTone: 'warn' | undefined;
  if (demand <= 0) {
    inferenceText = 'no demand';
  } else if (shortfall > 0) {
    inferenceText = `${fmtCompact(served)} of ${fmtCompact(demand)} seats · −${fmtMoney(lostRevenue)}/wk · full demand: ${fmtCompact(Math.ceil(demandChips))} chips`;
    inferenceTone = 'warn';
  } else if (a.inference > Math.ceil(demandChips) * 2 && a.inference - demandChips > 500) {
    inferenceText = `all ${fmtCompact(demand)} seats served · ~${fmtCompact(Math.ceil(demandChips))} chips enough`;
  } else {
    inferenceText = `all ${fmtCompact(demand)} seats served`;
  }

  let alignmentText: ReactNode;
  let alignmentTone: 'warn' | undefined;
  if (!flag) {
    alignmentText = 'no flagship';
  } else if (a.alignment <= 0) {
    alignmentText = 'no alignment work';
    alignmentTone = 'warn';
  } else {
    alignmentText = `+${alignGain.toFixed(2)} alignment/wk · ${flag.name}`;
  }

  const staticRow = (color: string, label: string, value: number, sub: ReactNode, tone?: 'warn') => (
    <div className="arow">
      <i className="sw" style={{ background: color }} />
      <div className="grow">
        <div className="row">
          <span className="k">{label}</span>
          <span className="v" style={{ color }}>
            {fmtCompact(value)}
          </span>
        </div>
        <div className={`sub${tone ? ` ${tone}` : ''}`}>{sub}</div>
      </div>
    </div>
  );

  return (
    <div className="panel">
      <div className="hd">
        <h2>
          <Icon id="i-sliders" />
          Compute allocation
        </h2>
        <span className="tag" style={{ color: 'var(--faint)' }}>
          {fmtCompact(player.chips)} chips · {(player.chipEfficiency * 100).toFixed(0)}% eff
        </span>
      </div>
      <div className="bd">
        <div className="abarwrap">
          <div className="abar">
            {reserved > 0 && <i className="seg" style={{ width: pct(reserved), background: COLOR.contracts }} />}
            <i className="seg" style={{ width: pct(runChips), background: COLOR.training }} />
            <i className="seg" style={{ width: pct(ptChips), background: COLOR.postTraining }} />
            <i className="seg" style={{ width: pct(a.inference), background: COLOR.inference }} />
            <i className="seg" style={{ width: pct(a.alignment), background: COLOR.alignment }} />
          </div>
          {demand > 0 && spc > 0 && (
            <i
              className="dtick"
              style={{ left: pct(Math.min(reserved + runChips + ptChips + demandChips, chips)) }}
              title={`full seat demand ≈ ${fmtCompact(Math.ceil(demandChips))} inference chips`}
            />
          )}
        </div>

        {staticRow(COLOR.training, 'Training', runChips, trainingText)}
        {staticRow(COLOR.postTraining, 'Post-training', ptChips, player.postTraining ? `${player.postTraining.weeksLeft} wk left` : 'not running')}
        {staticRow(COLOR.inference, 'Inference', a.inference, inferenceText, inferenceTone)}

        <div className="arow" data-tut="alloc-align">
          <i className="sw" style={{ background: COLOR.alignment }} />
          <div className="grow">
            <div className="row">
              <span className="k">Alignment</span>
              <span className="v" style={{ color: COLOR.alignment }}>
                {fmtCompact(a.alignment)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={free}
              step={100}
              value={a.alignment}
              disabled={free === 0}
              onChange={(e) => game.act((s) => setAlignmentCompute(s.labs[s.playerLab], Number(e.target.value)))}
            />
            <div className={`sub${alignmentTone ? ` ${alignmentTone}` : ''}`}>{alignmentText}</div>
          </div>
        </div>

        {reserved > 0 && staticRow(COLOR.contracts, 'Contracts', reserved, `locked · ${fmtMoney(contractPay)}/wk`)}

        <div className="note" style={{ marginTop: 10 }}>
          Training chips are committed until the run ends, then flow back to inference. ▲ = inference needed for full demand.
        </div>
      </div>
    </div>
  );
}
