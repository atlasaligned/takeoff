import { BAL, clamp, clamp100 } from './balance';
import { labMods } from './research';
import type { Lab, Model, TrainingRun } from './types';
import { randNormal, randRange, type RngState } from './rng';

/** capability from effective FLOP (log-like; harder and harder to climb) */
export function capabilityFromFlop(effFlop: number): number {
  if (effFlop <= 0) return 0;
  return Math.max(0, BAL.CAP_PER_DECADE * (Math.log10(effFlop) - BAL.CAP_LOG_BASE));
}

/** FLOP needed for a given capability (inverse of the above) */
export function flopForCapability(cap: number): number {
  return Math.pow(10, cap / BAL.CAP_PER_DECADE + BAL.CAP_LOG_BASE);
}

export function flagship(lab: Lab): Model | null {
  if (!lab.flagshipId) return null;
  return lab.models.find((m) => m.id === lab.flagshipId) ?? null;
}

export function trainCost(lab: Lab, targetFlop: number): number {
  const mods = labMods(lab);
  return (targetFlop / 1e27) * BAL.TRAIN_COST_PER_E27 * mods.trainCostMult;
}

/** Predicted capability for a run given this lab's current multipliers. */
export function predictCapability(lab: Lab, targetFlop: number, algoProgress: number): number {
  const mods = labMods(lab);
  return capabilityFromFlop(targetFlop * mods.effFlopMult * algoProgress) * mods.capRunBonusMult;
}

/** Estimated weeks left at the run's committed chips. */
export function runWeeksLeft(lab: Lab, run: TrainingRun): number {
  const mods = labMods(lab);
  const flopPerWeek = run.chips * lab.chipEfficiency * BAL.FLOP_PER_CHIP_WEEK * mods.trainSpeedMult * (1 - lab.regulationDrag);
  if (flopPerWeek <= 0) return Infinity;
  return Math.ceil((run.targetFlop - run.doneFlop) / flopPerWeek);
}

export function runProgress(run: TrainingRun): number {
  return Math.min(1, run.doneFlop / run.targetFlop);
}

/**
 * Capability retained when aborting at progress p — most gains land at the
 * end of the run, so early aborts forfeit nearly everything.
 */
export function abortCapabilityFraction(progress: number): number {
  return Math.pow(Math.min(1, progress), BAL.ABORT_EXP);
}

export function bandWidth(m: Model): number {
  return m.alignmentHi - m.alignmentLo;
}

/** Recompute band around the true value keeping it inside, given a new width. */
export function applyBandWidth(m: Model, width: number): void {
  const w = Math.max(BAL.BAND_MIN_WIDTH, width);
  let lo = m.alignment - w * m.bandSkew;
  let hi = lo + w;
  if (lo < 0) {
    hi -= lo;
    lo = 0;
  }
  if (hi > 100) {
    lo -= hi - 100;
    hi = 100;
  }
  m.alignmentLo = Math.max(0, lo);
  m.alignmentHi = Math.min(100, hi);
}

/** Shift true alignment by delta, keeping the band containing it. */
export function shiftAlignment(m: Model, delta: number): void {
  const width = bandWidth(m);
  m.alignment = clamp100(m.alignment + delta);
  applyBandWidth(m, width);
}

export function widenBand(m: Model, extra: number): void {
  applyBandWidth(m, bandWidth(m) + extra);
}

export function narrowBand(m: Model, amount: number): void {
  applyBandWidth(m, bandWidth(m) - amount);
}

/** Create the model resulting from a (possibly aborted) training run. */
export function finishTrainingRun(lab: Lab, run: TrainingRun, week: number, algoProgress: number, rng: RngState, aborted: boolean): Model {
  const mods = labMods(lab);
  const progress = runProgress(run);
  const fullCap = capabilityFromFlop(run.doneFlop * mods.effFlopMult * algoProgress) * mods.capRunBonusMult;
  const cap = aborted ? fullCap * abortCapabilityFraction(progress) : fullCap;

  const prev = flagship(lab);
  const prevAlign = prev ? prev.alignment : 20;
  const prevRobust = prev ? prev.robustness : 20;
  let align = clamp100(BAL.INHERIT_ALIGN * prevAlign + randNormal(rng, BAL.NEW_MODEL_ALIGN_MEAN, BAL.NEW_MODEL_ALIGN_SD));
  const robust = clamp100(BAL.INHERIT_ROBUST * prevRobust + randNormal(rng, BAL.NEW_MODEL_ROBUST_MEAN, BAL.NEW_MODEL_ROBUST_SD) + mods.newModelRobustBonus);
  // one-time research alignment effects bake into every new model
  if (lab.research.completed.includes('constitutional')) align = clamp100(align + 5);
  if (lab.research.completed.includes('honesty')) align = clamp100(align + 4);
  if (lab.research.completed.includes('instruction-tuning')) align = clamp100(align + 2);
  if (lab.research.completed.includes('neuralese')) align = clamp100(align - 8);
  if (lab.research.completed.includes('arch-redesign')) align = clamp100(align - 8);
  // weak-to-strong: the bigger the capability jump over the last flagship, the more alignment carries across
  if (lab.research.completed.includes('weak-to-strong')) {
    const jump = Math.max(0, cap - (prev ? prev.capability : 0));
    align = clamp100(align + Math.min(BAL.WEAK_TO_STRONG_MAX, jump * BAL.WEAK_TO_STRONG_PER_JUMP));
  }

  const m: Model = {
    // modelCounter models exist already (the starting model is -m1)
    id: `${lab.id}-m${lab.modelCounter + 1}`,
    name: run.modelName,
    createdWeek: week,
    capability: cap,
    alignment: align,
    alignmentLo: 0,
    alignmentHi: 100,
    bandSkew: randRange(rng, 0.15, 0.85),
    robustness: robust,
    postTrainCount: 0,
  };
  let width: number = BAL.BAND_START_WIDTH;
  const done = lab.research.completed;
  if (done.includes('evals-redteam')) width -= 10;
  if (done.includes('chain-of-thought-monitoring') && !done.includes('neuralese')) width -= 4;
  if (done.includes('interpretability-probes')) width -= 4;
  if (done.includes('mech-interp')) width -= 12;
  if (done.includes('model-organisms')) width -= 8;
  if (done.includes('debate')) width -= 8;
  if (done.includes('glass-box')) width -= 20;
  if (done.includes('automated-researcher')) width += 6;
  if (done.includes('neuralese')) width += 15;
  if (done.includes('rsi')) width += 8;
  if (done.includes('arch-redesign')) width += 15;
  if (done.includes('provable-alignment')) width = 0;
  applyBandWidth(m, width);
  lab.modelCounter += 1;
  return m;
}

/** Alignment the flagship would gain this week at the current allocation (pure, for previews). */
export function alignmentGainPreview(lab: Lab): number {
  const m = flagship(lab);
  if (!m || lab.alloc.alignment <= 0) return 0;
  const mods = labMods(lab);
  const chips = Math.min(lab.alloc.alignment, BAL.ALIGN_CHIPS_CAP) * lab.chipEfficiency;
  const power = Math.cbrt(chips / 1000) * mods.alignWorkMult;
  // scalable oversight helps most while the model is weak, and fades as it pulls ahead of the overseer
  const so = lab.research.completed.includes('scalable-oversight')
    ? 1 + BAL.SCALABLE_OVERSIGHT_MAX_BONUS * Math.max(0, 1 - m.capability / BAL.SCALABLE_OVERSIGHT_FADE_CAP)
    : 1;
  // deliberative alignment is the rare tool that grows stronger as capability climbs
  const delib = lab.research.completed.includes('deliberative') ? 1 + m.capability / BAL.DELIBERATIVE_CAP_SCALE : 1;
  return BAL.ALIGN_RATE * power * so * delib * Math.max(0, 1 - m.alignment / mods.alignCeiling);
}

/** Weekly alignment-compute work on the flagship. Returns alignment gained. */
export function alignmentWorkTick(lab: Lab): number {
  const m = flagship(lab);
  if (!m || lab.alloc.alignment <= 0) return 0;
  const mods = labMods(lab);
  const chips = Math.min(lab.alloc.alignment, BAL.ALIGN_CHIPS_CAP) * lab.chipEfficiency;
  const power = Math.cbrt(chips / 1000) * mods.alignWorkMult;
  const gain = alignmentGainPreview(lab);
  shiftAlignment(m, gain);
  narrowBand(m, BAL.BAND_NARROW_RATE * power * mods.bandNarrowMult);
  if (lab.research.completed.includes('provable-alignment')) applyBandWidth(m, 0);
  return gain;
}

/** P(win) for the ASI roll given true alignment — piecewise linear, brutal below 90. */
export function winProbability(alignment: number): number {
  const pts = BAL.WIN_ROLL_POINTS;
  if (alignment <= pts[0][0]) return 0;
  for (let i = 1; i < pts.length; i++) {
    if (alignment <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((alignment - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Post-training cost scales with flagship capability — bigger models cost more to tune. */
export function postTrainCost(lab: Lab): number {
  const cap = flagship(lab)?.capability ?? 20;
  return Math.round(BAL.POST_TRAIN_COST * Math.pow(Math.max(1, cap / 20), BAL.POST_TRAIN_COST_CAP_EXP));
}

/** Predicted gains of the next post-training pass (pure, for previews). */
export function postTrainPreview(lab: Lab): { cap: number; align: number; robust: number } {
  const m = flagship(lab);
  if (!m) return { cap: 0, align: 0, robust: 0 };
  const mods = labMods(lab);
  const decay = Math.pow(BAL.POST_TRAIN_DECAY, m.postTrainCount);
  return {
    cap: BAL.POST_TRAIN_CAP_GAIN * decay * mods.postTrainMult,
    align: Math.min(BAL.POST_TRAIN_ALIGN_GAIN * decay * mods.postTrainMult, Math.max(0, mods.alignCeiling - m.alignment)),
    robust: BAL.POST_TRAIN_ROBUST_GAIN * decay * mods.postTrainMult,
  };
}

/** Post-training completion: small bumps, diminishing per pass. */
export function applyPostTraining(lab: Lab): void {
  const m = flagship(lab);
  if (!m) return;
  const g = postTrainPreview(lab);
  m.capability += g.cap;
  shiftAlignment(m, g.align);
  m.robustness = clamp100(m.robustness + g.robust);
  m.postTrainCount += 1;
}

/** Weekly RSI growth on the flagship (Takeoff / Intelligence Explosion). */
export function rsiTick(lab: Lab): void {
  const m = flagship(lab);
  if (!m || lab.rsiRate <= 0) return;
  // self-growth decelerates toward the ceiling — RSI lifts a flagship through
  // the mid-climb but crawls above ~90, so the final push to 100 needs real
  // training runs rather than passive autopilot.
  const decel = Math.max(0, 1 - m.capability / BAL.RSI_DECEL_CAP);
  m.capability += m.capability * lab.rsiRate * decel;
  if (lab.research.completed.includes('intelligence-explosion')) {
    lab.rsiRate *= BAL.RSI_ACCEL;
  }
}

/** Chips committed to contracts, the active run and post-training — not splittable. */
export function committedChips(lab: Lab): number {
  return lab.contracts.reduce((s, c) => s + c.chips, 0) + (lab.run?.chips ?? 0) + (lab.postTraining?.chips ?? 0);
}

/**
 * Enforce the allocation invariant: alignment is clamped to what commitments
 * leave over, and inference absorbs the rest. There is never idle compute.
 */
export function rebalanceAllocations(lab: Lab): void {
  const free = Math.max(0, lab.chips - committedChips(lab));
  lab.alloc.alignment = clamp(Math.floor(lab.alloc.alignment), 0, free);
  lab.alloc.inference = free - lab.alloc.alignment;
}
