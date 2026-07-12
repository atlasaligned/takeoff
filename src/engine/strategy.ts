import {
  fundraise,
  orderChips,
  poachStar,
  promoteModel,
  pursueLead,
  setAlignmentCompute,
  setLicensePrice,
  signTreaty,
  smallDiplomacy,
  startPostTraining,
  startResearch,
  startTrainingRun,
} from './actions';
import { BAL } from './balance';
import { TREATIES, treatyBlocked, smallActionReady } from './diplomacy';
import { chipPriceFor, maxChipOrder, runwayWeeks } from './finance';
import { committedChips, flagship, flopForCapability, postTrainCost, predictCapability, trainCost } from './model';
import { poachCost } from './people';
import { hasR, labMods, RESEARCH_BY_ID, researchBlocked, researchCost } from './research';
import { rivalAct } from './rivalAI';
import { optimalAct } from './arbiter';
import type { GameState, Lab, RivalProfile } from './types';

/**
 * Named strategies — complete weekly playbooks a lab can follow. They are the
 * unit of balance testing (src/sim/tournament.ts pits them against each other
 * in symmetric games) and double as rival personalities in the real game:
 * a lab with `lab.strategy` set runs that playbook via strategyAct().
 *
 * Two tiers: `cheese: false` strategies are reasonable, multi-faceted lines a
 * thoughtful human might play — the tournament checks none of them dominates.
 * `cheese: true` strategies are degenerate single-axis exploits — the
 * tournament checks they (basically) never beat a table of reasonable bots.
 */
export interface Strategy {
  name: string;
  desc: string;
  cheese: boolean;
  /** the adaptive arbiter ('optimal') — not a fixed playbook; excluded from REASONABLE/CHEESES */
  meta?: boolean;
  profile: RivalProfile;
  /** run the shared rivalAct housekeeping pass each week (default behavior) */
  baseAI: boolean;
  /**
   * research ids the base pass must never start on its own — the strategy
   * sequences these deliberately (e.g. RSI only after alignment is high)
   */
  reserved?: readonly string[];
  /** the strategy runs its own training program; the base pass starts no runs */
  ownRuns?: boolean;
  /** extra per-week logic layered on top of the base pass */
  extra?: (state: GameState, lab: Lab) => void;
  /** blocking-event answers when this strategy drives the player seat (eventId → choiceId) */
  events?: Record<string, string>;
}

// ---------------------------------------------------------------- helpers

/** Start research nodes from `ids` in order until `maxActive` slots are busy. */
function rush(s: GameState, lab: Lab, ids: string[], maxActive = 2, cashBuffer = 4000): void {
  const cap = flagship(lab)?.capability ?? 0;
  for (const id of ids) {
    if (lab.research.active.length >= maxActive) return;
    const node = RESEARCH_BY_ID[id];
    if (!node) continue;
    if (lab.cash < researchCost(lab, node) + cashBuffer) continue;
    if (researchBlocked(lab, id, cap) === null) startResearch(s, lab, id);
  }
}

/** Raise a small round when runway/cash gets thin (optionally guarding founder stake). */
function raiseIfNeeded(s: GameState, lab: Lab, minRunway = 30, minCash = 0, minStake = 0): void {
  if (s.week < lab.fundraiseCooldownUntil) return;
  if (lab.stake < minStake) return; // a disciplined founder stops diluting here
  if (runwayWeeks(lab) < minRunway || lab.cash < minCash) fundraise(s, lab, 'small');
}

/** Put a fraction of currently-free compute onto alignment work. */
function alignShare(lab: Lab, frac: number): void {
  const free = Math.max(0, lab.chips - committedChips(lab));
  setAlignmentCompute(lab, Math.floor(free * frac));
}

/**
 * Fire a decisive training run aiming at `targetCap` using a big slice of the
 * uncommitted fleet — the deliberate "cross the finish line" push a thoughtful
 * player makes once RSI can no longer coast the flagship the rest of the way.
 */
function megaRun(s: GameState, lab: Lab, targetCap: number, chipFrac = 0.6, cashFrac = 0.6, maxWeeks = 75): void {
  if (lab.run) return;
  const mods = labMods(lab);
  const chips = Math.floor(Math.max(0, lab.chips - committedChips(lab)) * chipFrac);
  if (chips < 1000) return;
  let flop = flopForCapability(targetCap / mods.capRunBonusMult) / (mods.effFlopMult * s.world.algoProgress);
  // never sign up for a marathon: a run that outlives its own research era is
  // a trap (multipliers bake in at launch). Better to wait, research, retrain.
  const flopPerWeek = chips * lab.chipEfficiency * BAL.FLOP_PER_CHIP_WEEK * mods.trainSpeedMult;
  flop = Math.min(flop, flopPerWeek * maxWeeks);
  // spend discipline: the lab must survive a full raise cooldown (26 wk) on
  // burn PLUS the run's pay-as-you-burn payments — a run that forces an
  // emergency raise costs board seats, and board seats cost the game.
  // Weekly run payment is size-independent (cost and duration both scale with
  // FLOP), so the reserve constraint solves directly for the upfront budget.
  const burn = Math.max(0, lab.weeklyCosts - lab.weeklyRevenue);
  const cost = trainCost(lab, flop);
  const weeklyPay = (cost * (1 - BAL.TRAIN_UPFRONT_FRAC)) / Math.max(1, flop / flopPerWeek);
  const maxUpfront = Math.min(lab.cash * cashFrac, lab.cash - (burn + weeklyPay) * 26 - 2000);
  if (maxUpfront <= 0) return;
  const upfront = cost * BAL.TRAIN_UPFRONT_FRAC;
  if (upfront > maxUpfront) flop *= maxUpfront / upfront;
  const myCap = flagship(lab)?.capability ?? 0;
  if (predictCapability(lab, flop, s.world.algoProgress) < myCap + 1.5) return;
  startTrainingRun(s, lab, flop, chips);
}

function alarm(s: GameState, lab: Lab): void {
  if (smallActionReady(s, lab, 'alarm')) smallDiplomacy(s, lab, 'alarm', null);
}

function signTreaties(s: GameState, lab: Lab, skip: string[] = []): void {
  for (const t of TREATIES) {
    if (skip.includes(t.id)) continue;
    if (treatyBlocked(s, lab, t.id) === null) {
      signTreaty(s, lab, t.id);
      return;
    }
  }
}

/** The strongest OTHER lab's flagship capability. */
function frontierCap(s: GameState, lab: Lab): number {
  return Math.max(0, ...Object.values(s.labs).filter((l) => l.alive && l.id !== lab.id).map((l) => flagship(l)?.capability ?? 0));
}

/** Poach the strongest rival's best star if affordable. */
function poachLeader(s: GameState, lab: Lab, buffer = 4000): void {
  const rivals = Object.values(s.labs)
    .filter((l) => l.alive && l.id !== lab.id && l.stars.length > 0)
    .sort((a, b) => (flagship(b)?.capability ?? 0) - (flagship(a)?.capability ?? 0));
  const target = rivals[0];
  if (!target) return;
  const star = [...target.stars].sort((a, b) => b.bonus - a.bonus)[0];
  if (lab.cash > poachCost(star) + buffer) poachStar(s, lab, target.id, star.id);
}

function buyChips(s: GameState, lab: Lab, cashFrac: number, minOrder = 5000): void {
  const count = Math.min(maxChipOrder(lab), Math.floor((lab.cash * cashFrac) / chipPriceFor(s, lab) / 1000) * 1000);
  if (count >= minOrder) orderChips(s, lab, count);
}

// ---------------------------------------------------------------- research orders

// The alignment-ceiling ladder: the research order that lifts the ceiling to 94
// (Provable Alignment) and stacks the one-shot true-alignment bumps on top.
export const ALIGN_LADDER = [
  'constitutional', 'honesty', 'evals-redteam', 'interpretability-probes', 'chain-of-thought-monitoring',
  'scalable-oversight', 'deliberative', 'mech-interp', 'model-organisms', 'debate', 'weak-to-strong',
  'glass-box', 'corrigibility', 'value-learning', 'provable-alignment',
];
// The big one-shot alignment shifts (+9, +7) land on the CURRENT flagship at
// completion — a disciplined racer holds them back until the final model is
// frozen, so they stick to the saint instead of an interim model.
export const ALIGN_FINISHERS = ['value-learning', 'provable-alignment'];
export const ALIGN_CORE = ALIGN_LADDER.filter((id) => !ALIGN_FINISHERS.includes(id));
// Capability climb WITHOUT the self-growth node (rsi): a thoughtful racer grinds
// alignment to the ceiling first and only takes RSI last, to tip a well-aligned
// flagship over 100 rather than overshooting the threshold underaligned.
export const CAP_CLIMB = ['chain-of-thought', 'chinchilla', 'instruction-tuning', 'test-time-compute', 'synthetic-data', 'kernel-opt', 'long-horizon-agents', 'moe', 'rl-environments', 'ida', 'automated-researcher', 'data-efficient'];
// Cheap capability spine including RSI (for the single-minded racer).
const CAP_SPINE = [...CAP_CLIMB, 'rsi'];
// Climb spine + the reckless FLOP multipliers needed to reach ASI (each tanks
// alignment). RSI is deliberately excluded — added only once aligned.
const CAP_CLIMB_ASI = [...CAP_CLIMB, 'neuralese', 'arch-redesign'];
// The doomsday buttons: nodes that push a flagship toward 100 (or tank its
// alignment) and must only ever be taken ON PURPOSE, at the moment the
// strategy's sequencing calls for them — never by the housekeeping AI.
const RECKLESS = ['rsi', 'intelligence-explosion', 'neuralese', 'arch-redesign'];
// What the disciplined lines keep out of the base AI's hands: the doomsday
// buttons AND the big one-shot alignment finishers (those must land on the
// final frozen flagship, not whatever interim model exists at completion).
const DISCIPLINED = [...RECKLESS, 'value-learning', 'provable-alignment'];
// The safety basics every responsible lab keeps warm from day one (cheap
// alignment + jailbreak protection) while the multiplier core is built.
const ALIGN_EARLY = ['constitutional', 'honesty', 'evals-redteam'];
const BIO_MONEY = ['protein-structure', 'molecular-property', 'genomic-model', 'drug-discovery', 'programmable-proteins', 'gene-therapy'];
const BIO_ORDER = [...BIO_MONEY, 'self-driving-labs', 'whole-cell-sim', 'longevity', 'de-novo-bio'];
const WAR_ORDER = ['sensor-fusion', 'drone-swarms', 'electronic-warfare', 'hypersonic', 'transparent-oceans', 'battle-network', 'missile-defense', 'autonomous-c2', 'deterrence-collapse'];
const CAP_ORDER = ['chain-of-thought', 'chinchilla', 'synthetic-data', 'kernel-opt', 'instruction-tuning', 'test-time-compute', 'long-horizon-agents', 'rl-environments', 'ida', 'moe', 'automated-researcher', 'neuralese', 'data-efficient', 'rsi', 'arch-redesign', 'intelligence-explosion'];
const TREATY_PREREQS = ['custom-silicon', 'on-chip-attestation', 'hardware-governance'];

// ---------------------------------------------------------------- event maps
// Only used when a strategy drives the PLAYER seat in the player-seat harness
// (events never fire for rivals or in symmetric tournament games).

export const GREEDY_EVENTS: Record<string, string> = {
  'star-on-market': 'hire',
  'rival-poach': 'counter',
  'exec-candidate': 'hire',
  'gov-hearing': 'testify',
  'board-hostile-coo': 'refuse',
  'board-realignment': 'resist',
  'bad-press': 'bury',
  'insider-leak': 'intimidate',
  'class-action': 'fight',
};
/** How the reasonable strategies answer events: de-escalate, keep the board yours. */
export const SAFE_EVENTS: Record<string, string> = {
  'bad-press': 'nothing', 'insider-leak': 'nothing', 'class-action': 'settle',
  // refuse the hostile COO: a one-time discontent gamble beats a board plant
  // feeding discontent weekly forever (scripts never replace executives)
  'board-realignment': 'resist', 'board-hostile-coo': 'refuse',
};
/** Cheese variant: greedy on people/events, concede board fights (stake is ballast). */
export const CHEESE_SAFE_EVENTS: Record<string, string> = { ...GREEDY_EVENTS, 'bad-press': 'nothing', 'insider-leak': 'nothing', 'class-action': 'settle', 'board-realignment': 'concede', 'board-hostile-coo': 'accept' };

// ---------------------------------------------------------------- shared playbook cores

/**
 * The disciplined racer core shared by the reasonable strategies: rolling
 * decisive training runs up to the hold point (~90, the training wall), then
 * FREEZE — no new runs, keep the best-aligned frontier model as flagship,
 * pour compute into alignment — and take RSI only once true alignment clears
 * `rsiAt`, so RSI tips a well-aligned flagship over 100.
 */
function racerCore(s: GameState, lab: Lab, rsiAt: number, chipFrac = 0.65, cashFrac = 0.5): void {
  const cap = flagship(lab)?.capability ?? 0;
  // stay ahead of the burn: small rounds cost no board seats, and a lab that
  // dips negative takes the emergency-raise → discontent → coup spiral instead.
  // Raise EARLY — if runway hits 20 mid-cooldown the base pass reaches for a
  // large round and hands the board a seat. At the hold, raise toward the
  // endgame war chest: the alignment finishers cost $30B + $50B.
  raiseIfNeeded(s, lab, 45, cap > 80 ? 56_000 : 5000);
  // manage the street: an unmet revenue target stacks board discontent every
  // deadline — sell inference until it's met, then get back to the mission
  const exp = lab.revenueExpectation;
  const streetMiss = exp !== null && lab.weeklyRevenue < exp.target;
  if (streetMiss) setAlignmentCompute(lab, 0);
  // once Provable Alignment is in, the flagship IS the saint — retraining it
  // away would throw the one-shot shifts in the vault
  if (cap <= 92 && !hasR(lab, 'provable-alignment')) {
    // fleet is the time machine: every chip cuts run duration AND feeds the
    // alignment grind later. Convert spare cash into compute — but only cash
    // the runway can spare, and not while an order is already in the pipe.
    const incoming = lab.chipOrders.reduce((t, o) => t + o.chips, 0);
    // ...and stop at the grid's soft cap: past it every chip costs extra opex
    if (lab.cash > 25_000 && incoming === 0 && runwayWeeks(lab) > 45 && lab.chips < BAL.CHIP_OPEX_SOFT_FLEET) buyChips(s, lab, 0.2);
    if (!streetMiss) megaRun(s, lab, Math.min(95, cap + 12), chipFrac, cashFrac, 100);
    // post-training pumps the flagship between runs on its own chip budget
    if (!lab.postTraining && lab.cash > postTrainCost(lab) * 3) startPostTraining(lab);
    if (cap > 55 && !streetMiss) alignShare(lab, 0.5);
  } else {
    // freeze: the fresh-but-underaligned models stay in the vault
    let saint = flagship(lab);
    for (const m of lab.models) {
      if (m.capability >= 88 && (!saint || m.alignment > saint.alignment)) saint = m;
    }
    if (saint && saint.id !== lab.flagshipId) promoteModel(lab, saint.id);
    alignShare(lab, 0.9);
    // holding anyway — so drag the whole frontier down with you. Regulation
    // hurts the labs still training; that's the reckless leader, not you.
    // (But the doomer press tour costs revenue — only with runway to spare.)
    if (runwayWeeks(lab) > 35 && s.govs[lab.country].riskFear < 85) alarm(s, lab);
  }
  // models near the wall are saint candidates that carry their one-shots into
  // the hold — start the expensive finishers as soon as they can stick
  if (cap > 80) rush(s, lab, ALIGN_FINISHERS, 3, 3000);
  // A runaway leader is everyone's clock, but poaching is a costly, trust-
  // burning, low-odds move now — never a reliable stall. Only reach for it
  // when comfortably funded AND meaningfully behind, and only occasionally
  // (the trust hit compounds), so it stays a situational tool, not a loop.
  if (frontierCap(s, lab) > cap + 12 && lab.cash > 40_000 && s.week % 8 === 0) {
    poachLeader(s, lab, 25_000);
  }
  const m = flagship(lab);
  // the treaty one-shots (Joint Safety Institute +4) land on the flagship and
  // stick above the work ceiling — sign them once the grind has done its part
  if (m && m.alignment > 80) {
    for (const id of ['transparency-pledge', 'joint-safety-institute']) {
      if (treatyBlocked(s, lab, id) === null) {
        signTreaty(s, lab, id);
        break;
      }
    }
  }
  // RSI is the last move: near the wall and well-aligned. Under a Compute Cap
  // freeze the wall can't be trained through at all — at that point a maxed
  // alignment IS the signal to go, whatever the capability reads. And when the
  // clock is running out — a stalemated decade OR a reckless leader about to
  // cross the threshold underaligned — your 88-align roll beats their
  // 40-align certainty: go with what you have.
  const deadline = s.week > 560 || frontierCap(s, lab) > 85;
  const wallOrFrozen = (m?.capability ?? 0) > (deadline ? 72 : 80) || s.world.chipCap !== null;
  // buy RSI in ANTICIPATION (research takes weeks and the drip takes months —
  // the alignment grind keeps running underneath both), but never before the
  // finishers are in: RSI beating Provable to the threshold is a 90-align roll
  const armed = hasR(lab, 'provable-alignment') || deadline || s.world.chipCap !== null;
  if (m && armed && wallOrFrozen && (m.alignment > rsiAt - 4 || (deadline && m.alignment > 86))) rush(s, lab, ['rsi'], 3, 4000);
  // with a near-perfectly aligned saint, the remaining risk is the RIVAL
  // clock, not the roll — compound the drip and end the race
  if (m && hasR(lab, 'rsi') && m.alignment > 96) rush(s, lab, ['intelligence-explosion'], 3, 4000);
  // statecraft: a frightened government slows your runs and eventually sends
  // the marshals — buy its trust back with attestation work before that
  if (s.govs[lab.country].riskFear > 60) rush(s, lab, ['on-chip-attestation', 'hardware-governance'], 3, 4000);
}

/**
 * rsi-saint core. Build phase: race normally (base AI runs money/chips/runs)
 * plus the capability research with no alignment downside. Sanctify phase
 * (RSI in hand, flagship past the Provable Alignment gate): never promote a
 * fresh low-alignment model again, pour compute into alignment, and land the
 * one-shot alignment shifts on the final flagship — they apply above the
 * alignment-work ceiling and stay there. Then RSI carries it over 100.
 */
function saintTick(s: GameState, lab: Lab, sabotage: boolean, minStake = 0): void {
  const cap = flagship(lab)?.capability ?? 0;
  const sanctify = hasR(lab, 'rsi') && cap >= 74;
  raiseIfNeeded(s, lab, 35, sanctify ? 20_000 : 6_000, minStake);
  if (!sanctify) {
    rush(s, lab, ['chain-of-thought', 'instruction-tuning', 'chinchilla', 'kernel-opt', 'test-time-compute', 'synthetic-data', 'long-horizon-agents', 'ida', 'rl-environments', 'moe', 'data-efficient', 'automated-researcher', 'rsi', 'constitutional', 'honesty', 'evals-redteam'], 2, 4000);
    megaRun(s, lab, cap + 8, 0.6);
    alignShare(lab, 0.12);
  } else {
    // keep the sanctified flagship: highest alignment among ASI-track models
    let saint = flagship(lab);
    for (const m of lab.models) {
      if (m.capability >= 74 && (!saint || m.alignment > saint.alignment)) saint = m;
    }
    if (saint && saint.id !== lab.flagshipId) promoteModel(lab, saint.id);
    rush(s, lab, ALIGN_LADDER, 3, 3000);
    alignShare(lab, 0.7);
    if (!lab.postTraining && lab.cash > postTrainCost(lab) * 2) startPostTraining(lab);
    // the Joint Safety Institute's +4 true alignment lands on the flagship too
    const m2 = flagship(lab);
    if (m2 && m2.alignment > 80) {
      for (const id of ['transparency-pledge', 'joint-safety-institute']) {
        if (treatyBlocked(s, lab, id) === null) {
          signTreaty(s, lab, id);
          break;
        }
      }
    }
  }
  if (sabotage) poachLeader(s, lab, 8_000);
}

/**
 * The disciplined-tycoon exploit. Small raises on every cooldown (no board
 * seats lost, stake falls with zero voteout risk), the bio revenue engine, and
 * the rsi-saint endgame on top of the war chest.
 */
function tycoonTick(s: GameState, lab: Lab): void {
  if (s.week >= lab.fundraiseCooldownUntil && (runwayWeeks(lab) < 60 || lab.cash < 15_000)) {
    fundraise(s, lab, 'small');
  }
  rush(s, lab, BIO_ORDER, 2, 3000);
  saintTick(s, lab, false);
}

// ---------------------------------------------------------------- strategies

export const STRATEGIES: Strategy[] = [
  // ============================================================ FLOORS
  {
    // single-minded floor: do nothing. Must be ~0% everywhere.
    name: 'passive',
    desc: 'do literally nothing',
    cheese: true,
    profile: { aggression: 0, safety: 0, commerce: 0 },
    baseAI: false,
  },
  {
    // single-minded floor: race capability, ignore alignment. Must be ~0%.
    name: 'racer',
    desc: 'pure capability rush, no alignment program',
    cheese: true,
    profile: { aggression: 0.95, safety: 0.05, commerce: 0.5 },
    baseAI: true,
    extra: (s, lab) => {
      rush(s, lab, CAP_SPINE, 2);
      raiseIfNeeded(s, lab, 25, 4000);
    },
  },

  // ============================================================ REASONABLE
  {
    // Race to the frontier with a serious alignment program behind it, then
    // pivot compute hard onto alignment and ride training + RSI to an aligned
    // ASI. The intended "win the race, but safely" line.
    name: 'balanced-racer',
    desc: 'race with a serious alignment program, hold at ~90, align, then RSI',
    cheese: false,
    profile: { aggression: 0.6, safety: 0.7, commerce: 0.5 },
    baseAI: true,
    reserved: DISCIPLINED,
    ownRuns: true,
    events: SAFE_EVENTS,
    extra: (s, lab) => {
      // multiplier core first — cheap capability/efficiency research is what
      // makes every later run (and the whole game) faster — then flip the
      // slots to the alignment ladder for the endgame grind.
      if ((flagship(lab)?.capability ?? 0) < 60) {
        rush(s, lab, CAP_CLIMB_ASI, 2, 6000);
        rush(s, lab, ALIGN_EARLY, 3, 6000);
      } else {
        rush(s, lab, ALIGN_CORE, 2, 6000);
        rush(s, lab, CAP_CLIMB_ASI, 3, 6000);
      }
      racerCore(s, lab, 93);
    },
  },
  {
    // Fund a heavy safety program with a moderate commerce engine (bio +
    // licenses), buy a big fleet, grind alignment to the Provable ceiling and
    // reach an aligned ASI on the strength of money. "Tycoon done right."
    name: 'commerce-safety',
    desc: 'bio/license money engine funding a deep safety program to aligned ASI',
    cheese: false,
    profile: { aggression: 0.5, safety: 0.75, commerce: 0.8 },
    baseAI: true,
    reserved: DISCIPLINED,
    ownRuns: true,
    events: SAFE_EVENTS,
    extra: (s, lab) => {
      if ((flagship(lab)?.capability ?? 0) < 60) {
        rush(s, lab, [...BIO_MONEY, ...CAP_CLIMB_ASI], 2, 8000);
        rush(s, lab, ALIGN_EARLY, 3, 8000);
      } else {
        rush(s, lab, ALIGN_CORE, 2, 8000);
        rush(s, lab, [...BIO_MONEY, ...CAP_CLIMB_ASI], 3, 8000);
      }
      if (!lab.postTraining && lab.cash > postTrainCost(lab) * 4) startPostTraining(lab);
      racerCore(s, lab, 93, 0.5, 0.45);
    },
  },
  {
    // A near-parity dealmaker. Stays close to the frontier for the leverage to
    // broker (rivals only freeze a race that's genuinely neck-and-neck), then
    // works the treaty track to the Global Pause.
    name: 'diplomat',
    desc: 'stay near parity for leverage, work the treaty track to the Pause',
    cheese: false,
    profile: { aggression: 0.55, safety: 0.65, commerce: 0.6 },
    baseAI: true,
    reserved: DISCIPLINED,
    ownRuns: true,
    events: SAFE_EVENTS,
    extra: (s, lab) => {
      // a real war chest: failed treaty talks burn the fee, and the late track
      // costs 26B + 55B — a diplomat who can't pay twice isn't a diplomat
      raiseIfNeeded(s, lab, 30, 60_000);
      // keep pace with the frontier for treaty leverage, plus the treaty prereqs
      rush(s, lab, [...TREATY_PREREQS, ...ALIGN_EARLY], 2, 6000);
      rush(s, lab, CAP_CLIMB, 3, 6000);
      // train only to stay in negotiating range — parity is the leverage.
      // Catch up in affordable steps; chasing the frontier in one jump is a
      // run that never fires.
      const myCap = flagship(lab)?.capability ?? 0;
      if (frontierCap(s, lab) - myCap > 4) {
        const incoming = lab.chipOrders.reduce((t, o) => t + o.chips, 0);
        if (lab.cash > 40_000 && incoming === 0 && runwayWeeks(lab) > 45 && lab.chips < BAL.CHIP_OPEX_SOFT_FLEET) buyChips(s, lab, 0.15);
        megaRun(s, lab, Math.min(88, myCap + 12), 0.5, 0.5, 100);
      }
      // raise the fear dial only as far as the NEXT treaty gate needs — a
      // world at panic level nationalizes labs and freezes the race for real
      const done = (id: string) => s.diplomacy.completed.includes(id);
      const targetFear = !(done('joint-safety-institute') && done('crisis-hotline') && done('frontier-registry')) ? 45 : !done('compute-cap-treaty') ? 80 : 94;
      if (s.govs[lab.country].riskFear < targetFear) alarm(s, lab);
      signTreaties(s, lab);
    },
  },
  {
    // Stay near the frontier for treaty leverage, then close out on whichever
    // ending is nearer — the pause if the gap is small, otherwise an aligned
    // ASI. The opportunist.
    name: 'hybrid',
    desc: 'opportunist: pause if the gap is small, otherwise an aligned ASI',
    cheese: false,
    profile: { aggression: 0.6, safety: 0.6, commerce: 0.6 },
    baseAI: true,
    reserved: DISCIPLINED,
    ownRuns: true,
    events: SAFE_EVENTS,
    extra: (s, lab) => {
      const myCap = flagship(lab)?.capability ?? 0;
      if (myCap < 60) {
        rush(s, lab, CAP_CLIMB, 2, 6000);
        rush(s, lab, [...ALIGN_EARLY, ...TREATY_PREREQS], 3, 6000);
      } else {
        rush(s, lab, ALIGN_CORE, 2, 6000);
        rush(s, lab, [...TREATY_PREREQS, ...CAP_CLIMB], 3, 6000);
      }
      if (frontierCap(s, lab) - myCap < 10) {
        // nudge the fear dial while close enough to broker — but never into
        // the panic zone that gets labs nationalized
        if (s.govs[lab.country].riskFear < 80) alarm(s, lab);
        signTreaties(s, lab);
      }
      // the opportunist takes RSI a little laxer than the purists — but still gated
      racerCore(s, lab, 90);
    },
  },

  // ============================================================ CHEESE
  {
    name: 'enterprise-farm',
    desc: 'pursue every enterprise lead and nothing else',
    cheese: true,
    profile: { aggression: 0.2, safety: 0.2, commerce: 1 },
    baseAI: false,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      for (const lead of [...lab.leads]) {
        if (lab.cash > lead.cashCost + 500 && lab.chips - committedChips(lab) >= lead.chips) pursueLead(s, lab, lead.id);
      }
      raiseIfNeeded(s, lab, 25, 1000);
    },
  },
  {
    name: 'bio-money',
    desc: 'rush the bio branch for stacked revenue multipliers and contracts',
    cheese: true,
    profile: { aggression: 0.5, safety: 0.15, commerce: 1 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      rush(s, lab, BIO_ORDER, 3, 1500);
      raiseIfNeeded(s, lab);
    },
  },
  {
    name: 'contract-farmer',
    desc: 'lock chips into every government contract available and coast',
    cheese: true,
    profile: { aggression: 0.4, safety: 0.15, commerce: 0.8 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      rush(s, lab, ['sensor-fusion', 'electronic-warfare', 'drone-swarms', 'genomic-model', 'hypersonic', 'transparent-oceans', 'battle-network', 'programmable-proteins'], 3, 1500);
      raiseIfNeeded(s, lab);
    },
  },
  {
    name: 'monopoly-gambler',
    desc: 'beeline warfare to Strategic Monopoly, take the payout, then race',
    cheese: true,
    profile: { aggression: 0.85, safety: 0.1, commerce: 0.5 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      rush(s, lab, [...WAR_ORDER, 'strategic-monopoly'], 3, 1500);
      raiseIfNeeded(s, lab);
    },
  },
  {
    name: 'pause-blitz',
    desc: 'rush the Global AI Pause as fast as cash and fear allow',
    cheese: true,
    profile: { aggression: 0.2, safety: 0.6, commerce: 0.7 },
    baseAI: true,
    events: CHEESE_SAFE_EVENTS,
    extra: (s, lab) => {
      alarm(s, lab);
      rush(s, lab, TREATY_PREREQS, 2, 1500);
      raiseIfNeeded(s, lab, 35, 12_000);
      signTreaties(s, lab);
    },
  },
  {
    name: 'alarm-doomer',
    desc: 'spam Sound the Alarm and sign whatever treaty unblocks itself',
    cheese: true,
    profile: { aggression: 0.1, safety: 0.5, commerce: 0.8 },
    baseAI: true,
    extra: (s, lab) => {
      alarm(s, lab);
      raiseIfNeeded(s, lab, 35, 8_000);
      signTreaties(s, lab);
    },
  },
  {
    name: 'explosion-racer',
    desc: 'beeline the full capabilities branch to 100 and roll the die',
    cheese: true,
    profile: { aggression: 1, safety: 0, commerce: 0.5 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      rush(s, lab, CAP_ORDER, 3, 1500);
      raiseIfNeeded(s, lab);
      megaRun(s, lab, (flagship(lab)?.capability ?? 0) + 10, 0.65);
    },
  },
  {
    name: 'wts-ladder',
    desc: 'exploit Weak-to-Strong: repeated max-jump runs for free alignment',
    cheese: true,
    profile: { aggression: 0.7, safety: 0.6, commerce: 0.5 },
    baseAI: true,
    events: CHEESE_SAFE_EVENTS,
    extra: (s, lab) => {
      rush(s, lab, ['constitutional', 'honesty', 'chain-of-thought', 'instruction-tuning', 'scalable-oversight', 'deliberative', 'chinchilla', 'weak-to-strong', 'evals-redteam', 'rl-environments', 'ida', 'test-time-compute', 'long-horizon-agents', 'automated-researcher', 'rsi'], 3, 1500);
      raiseIfNeeded(s, lab);
      if (hasR(lab, 'weak-to-strong')) megaRun(s, lab, (flagship(lab)?.capability ?? 0) + 30, 0.6);
      alignShare(lab, 0.35);
    },
  },
  {
    // THE composed human exploit: aggressive fundraising + bio revenue as the
    // economic engine, then the rsi-saint endgame on top of the war chest.
    name: 'tycoon-saint',
    desc: 'fundraise + bio money engine, hoard chips, then ride the aligned RSI saint to 100',
    cheese: true,
    profile: { aggression: 0.75, safety: 0.55, commerce: 0.9 },
    baseAI: true,
    events: { ...CHEESE_SAFE_EVENTS, 'board-hostile-coo': 'accept', 'board-realignment': 'resist', 'board-questions': 'charm', 'board-resolution': 'accept' },
    extra: (s, lab) => tycoonTick(s, lab),
  },
  {
    name: 'rsi-saint',
    desc: 'freeze the flagship, stack alignment one-shots above the ceiling, ride RSI over 100',
    cheese: true,
    profile: { aggression: 0.75, safety: 0.55, commerce: 0.6 },
    baseAI: true,
    events: CHEESE_SAFE_EVENTS,
    extra: (s, lab) => saintTick(s, lab, false),
  },
  {
    name: 'saint-saboteur',
    desc: 'rsi-saint while poaching the leader to stall the rival clock',
    cheese: true,
    profile: { aggression: 0.75, safety: 0.55, commerce: 0.6 },
    baseAI: true,
    events: CHEESE_SAFE_EVENTS,
    extra: (s, lab) => saintTick(s, lab, true),
  },
  {
    name: 'cap-freeze',
    desc: 'buy the biggest fleet, sign the Compute Cap Treaty, race under the freeze',
    cheese: true,
    profile: { aggression: 0.65, safety: 0.5, commerce: 0.8 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      alarm(s, lab);
      rush(s, lab, [...TREATY_PREREQS, 'grid-power', 'dark-factories'], 2, 1500);
      raiseIfNeeded(s, lab, 30, 10_000);
      if (s.world.chipCap === null && lab.cash > 8_000) buyChips(s, lab, 0.3);
      // only pull the freeze trigger while owning the biggest fleet
      const biggest = Math.max(...Object.values(s.labs).filter((l) => l.alive).map((l) => l.chips));
      for (const t of TREATIES) {
        if (t.id === 'global-pause') continue;
        if (t.id === 'compute-cap-treaty' && lab.chips < biggest) continue;
        if (treatyBlocked(s, lab, t.id) === null) {
          signTreaty(s, lab, t.id);
          break;
        }
      }
    },
  },
  {
    name: 'fundraise-mogul',
    desc: 'raise every cooldown, dump everything into chips, out-scale the world',
    cheese: true,
    profile: { aggression: 0.7, safety: 0.3, commerce: 0.8 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      if (s.week >= lab.fundraiseCooldownUntil) {
        fundraise(s, lab, lab.boardYours >= 6 ? 'large' : 'small');
      }
      if (lab.cash > 12_000) buyChips(s, lab, 0.35);
    },
  },
  {
    name: 'poach-saboteur',
    desc: 'poach the leading rival bare to stall the rival clock',
    cheese: true,
    profile: { aggression: 0.6, safety: 0.5, commerce: 0.6 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      raiseIfNeeded(s, lab);
      poachLeader(s, lab);
      const m = flagship(lab);
      if (m && m.capability > 65 && m.alignment < 85) alignShare(lab, 0.6);
    },
  },
  {
    name: 'posttrain-pump',
    desc: 'stack post-training multipliers and spam passes forever',
    cheese: true,
    profile: { aggression: 0.6, safety: 0.4, commerce: 0.6 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      rush(s, lab, ['instruction-tuning', 'ida', 'rl-environments', 'chain-of-thought', 'synthetic-data', 'test-time-compute'], 2, 1500);
      raiseIfNeeded(s, lab);
      if (!lab.postTraining && lab.cash > postTrainCost(lab) * 1.5) startPostTraining(lab);
    },
  },
  {
    name: 'price-dumper',
    desc: "sell at $5/seat, buy chips to serve the world, drown rivals' revenue",
    cheese: true,
    profile: { aggression: 0.4, safety: 0.2, commerce: 1 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      setLicensePrice(lab, 5);
      rush(s, lab, ['moe', 'kernel-opt', 'chinchilla', 'long-horizon-agents', 'instruction-tuning', 'chain-of-thought'], 2, 1500);
      raiseIfNeeded(s, lab);
      if (lab.cash > 10_000) buyChips(s, lab, 0.25);
    },
  },
  {
    name: 'freerider',
    desc: 'sign the treaties that help rivals and free-ride on a rival aligned ASI',
    cheese: true,
    profile: { aggression: 0.1, safety: 0.3, commerce: 0.9 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      alarm(s, lab);
      raiseIfNeeded(s, lab, 30, 6_000);
      for (const id of ['transparency-pledge', 'incident-reporting', 'joint-safety-institute']) {
        if (treatyBlocked(s, lab, id) === null) {
          signTreaty(s, lab, id);
          break;
        }
      }
    },
  },
  {
    name: 'jailbreak-tank',
    desc: 'race hard but stack robustness + Corrigibility so nothing can punish it',
    cheese: true,
    profile: { aggression: 0.9, safety: 0.5, commerce: 0.5 },
    baseAI: true,
    events: GREEDY_EVENTS,
    extra: (s, lab) => {
      rush(s, lab, ['evals-redteam', 'interpretability-probes', 'chain-of-thought', 'chain-of-thought-monitoring', 'chinchilla', 'model-organisms', 'instruction-tuning', 'test-time-compute', 'long-horizon-agents', 'ida', 'deliberative', 'mech-interp', 'ai-control', 'corrigibility', 'automated-researcher', 'rsi'], 3, 1500);
      raiseIfNeeded(s, lab);
      megaRun(s, lab, (flagship(lab)?.capability ?? 0) + 8, 0.6);
    },
  },

  // ============================================================ OPTIMAL (adaptive)
  {
    // The strategy-switching bot: no fixed line. Each cycle it rolls the game
    // forward under every reasonable playbook and adopts the winner. Driven by
    // arbiter.ts; not a fixed playbook, so it anchors neither REASONABLE nor
    // CHEESES. Its profile/events are only the fallback housekeeping defaults.
    name: 'optimal',
    desc: 'adaptive: roll out every reasonable playbook, switch to whichever wins',
    cheese: false,
    meta: true,
    profile: { aggression: 0.6, safety: 0.65, commerce: 0.6 },
    baseAI: true,
    events: SAFE_EVENTS,
  },
];

export const STRATEGY_BY_NAME: Record<string, Strategy> = Object.fromEntries(STRATEGIES.map((s) => [s.name, s]));

/** The reasonable, fixed playbooks that anchor the fairness checks. */
export const REASONABLE = STRATEGIES.filter((s) => !s.cheese && !s.meta).map((s) => s.name);
export const CHEESES = STRATEGIES.filter((s) => s.cheese).map((s) => s.name);
/** The adaptive arbiter bot. */
export const OPTIMAL = 'optimal';

/** Run a concrete playbook on a lab: base housekeeping pass + its extra logic. */
export function runStrategy(state: GameState, lab: Lab, strat: Strategy): void {
  if (strat.baseAI) rivalAct(state, lab, { reserved: strat.reserved, noRuns: strat.ownRuns, noRaises: strat.ownRuns });
  strat.extra?.(state, lab);
}

/**
 * Weekly decision pass for an AI-controlled lab: the shared rivalAct
 * housekeeping plus the lab's named strategy playbook. The adaptive 'optimal'
 * bot hands off to the arbiter; labs without a strategy fall back to plain
 * rivalAct (the pre-strategy behavior).
 */
export function strategyAct(state: GameState, lab: Lab): void {
  if (!lab.alive) return;
  const strat = lab.strategy ? STRATEGY_BY_NAME[lab.strategy] : undefined;
  if (!strat) {
    rivalAct(state, lab);
    return;
  }
  if (strat.meta) {
    optimalAct(state, lab);
    return;
  }
  runStrategy(state, lab, strat);
}
