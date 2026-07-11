import {
  fundraise,
  respondToEvent,
  setAlignmentCompute,
  signTreaty,
  smallDiplomacy,
  startPostTraining,
  startResearch,
  startTrainingRun,
} from '../engine/actions';
import { committedChips, flagship, flopForCapability, postTrainCost, predictCapability, trainCost } from '../engine/model';
import { runwayWeeks } from '../engine/finance';
import { labMods } from '../engine/research';
import { rivalAct } from '../engine/rivalAI';
import { TREATIES, treatyBlocked, smallActionReady } from '../engine/diplomacy';
import { RESEARCH_BY_ID, researchBlocked, researchCost } from '../engine/research';
import { advanceWeek } from '../engine/tick';
import type { GameState, Lab, RivalProfile } from '../engine/types';

/**
 * Scripted "players" for balancing simulations. Two of them (passive, racer)
 * are deliberately single-minded and must always lose — they are the floor.
 * The rest are genuinely reasonable, multi-faceted strategies a thoughtful
 * human might play; the balance target is that each wins ~20-25% (a real
 * human, adapting turn to turn, does better than any fixed script).
 */
export interface Strategy {
  name: string;
  profile: RivalProfile;
  /** extra per-week logic after the base AI pass */
  extra?: (state: GameState) => void;
  /** how blocking events are answered (eventId → choiceId; default = first) */
  events?: Record<string, string>;
}

const P = (s: GameState): Lab => s.labs[s.playerLab];

/** Start research nodes from `ids` in order until `maxActive` slots are busy. */
function rush(s: GameState, ids: string[], maxActive = 2, cashBuffer = 4000): void {
  const lab = P(s);
  const cap = flagship(lab)?.capability ?? 0;
  for (const id of ids) {
    if (lab.research.active.length >= maxActive) return;
    const node = RESEARCH_BY_ID[id];
    if (!node) continue;
    if (lab.cash < researchCost(lab, node) + cashBuffer) continue;
    if (researchBlocked(lab, id, cap) === null) startResearch(s, lab, id);
  }
}

/** Raise a small round when runway/cash gets thin. */
function raiseIfNeeded(s: GameState, minRunway = 30, minCash = 0): void {
  const lab = P(s);
  if (s.week < lab.fundraiseCooldownUntil) return;
  if (runwayWeeks(lab) < minRunway || lab.cash < minCash) fundraise(s, lab, 'small');
}

/** Put a fraction of currently-free compute onto alignment work. */
function alignShare(s: GameState, frac: number): void {
  const lab = P(s);
  const free = Math.max(0, lab.chips - committedChips(lab));
  setAlignmentCompute(lab, Math.floor(free * frac));
}

/**
 * Fire a decisive training run aiming at `targetCap` using a big slice of the
 * uncommitted fleet — the deliberate "cross the finish line" push a thoughtful
 * player makes once RSI can no longer coast the flagship the rest of the way.
 */
function megaRun(s: GameState, targetCap: number, chipFrac = 0.6, cashFrac = 0.6): void {
  const lab = P(s);
  if (lab.run) return;
  const mods = labMods(lab);
  const chips = Math.floor(Math.max(0, lab.chips - committedChips(lab)) * chipFrac);
  if (chips < 1000) return;
  let flop = flopForCapability(targetCap / mods.capRunBonusMult) / (mods.effFlopMult * s.world.algoProgress);
  const budget = lab.cash * cashFrac;
  const cost = trainCost(lab, flop);
  if (cost > budget) flop *= budget / cost;
  const myCap = flagship(lab)?.capability ?? 0;
  if (predictCapability(lab, flop, s.world.algoProgress) < myCap + 1.5) return;
  startTrainingRun(s, lab, flop, chips);
}

function alarm(s: GameState): void {
  if (smallActionReady(s, 'alarm')) smallDiplomacy(s, 'alarm', null);
}

function signTreaties(s: GameState, skip: string[] = []): void {
  for (const t of TREATIES) {
    if (skip.includes(t.id)) continue;
    if (treatyBlocked(s, t.id) === null) {
      signTreaty(s, t.id);
      return;
    }
  }
}

// The alignment-ceiling ladder: the research order that lifts the ceiling to 94
// (Provable Alignment) and stacks the one-shot true-alignment bumps on top.
const ALIGN_LADDER = [
  'constitutional', 'honesty', 'evals-redteam', 'interpretability-probes', 'chain-of-thought-monitoring',
  'scalable-oversight', 'deliberative', 'mech-interp', 'model-organisms', 'debate', 'weak-to-strong',
  'glass-box', 'corrigibility', 'value-learning', 'provable-alignment',
];
// Capability climb WITHOUT the self-growth node (rsi): a thoughtful racer grinds
// alignment to the ceiling first and only takes RSI last, to tip a well-aligned
// flagship over 100 rather than overshooting the threshold underaligned.
const CAP_CLIMB = ['chain-of-thought', 'chinchilla', 'instruction-tuning', 'test-time-compute', 'synthetic-data', 'kernel-opt', 'long-horizon-agents', 'moe', 'rl-environments', 'ida', 'automated-researcher', 'data-efficient'];
// Cheap capability spine including RSI (for the single-minded racer and hybrid).
const CAP_SPINE = [...CAP_CLIMB, 'rsi'];
// Climb spine + the reckless FLOP multipliers needed to reach ASI (each tanks
// alignment). RSI is deliberately excluded — added only once aligned.
const CAP_CLIMB_ASI = [...CAP_CLIMB, 'neuralese', 'arch-redesign'];
const BIO_MONEY = ['protein-structure', 'molecular-property', 'genomic-model', 'drug-discovery', 'programmable-proteins', 'gene-therapy'];
const TREATY_PREREQS = ['custom-silicon', 'on-chip-attestation', 'hardware-governance'];

const SAFE_EVENTS: Record<string, string> = {
  'bad-press': 'nothing', 'insider-leak': 'nothing', 'class-action': 'settle',
  'board-realignment': 'resist', 'board-hostile-coo': 'accept',
};

export const STRATEGIES: Strategy[] = [
  {
    // single-minded floor: do nothing. Must be 0%.
    name: 'passive',
    profile: { aggression: 0, safety: 0, commerce: 0 },
    extra: () => {},
  },
  {
    // single-minded floor: race capability, ignore alignment. Must be ~0%.
    name: 'racer',
    profile: { aggression: 0.95, safety: 0.05, commerce: 0.5 },
    extra: (s) => {
      rush(s, CAP_SPINE, 2);
      raiseIfNeeded(s, 25, 4000);
    },
  },
  {
    // REASONABLE: race to the frontier with a serious alignment program behind
    // it, then pivot compute hard onto alignment and ride training + RSI to an
    // aligned ASI. The intended "win the race, but safely" line.
    name: 'balanced-racer',
    profile: { aggression: 0.6, safety: 0.7, commerce: 0.5 },
    events: SAFE_EVENTS,
    extra: (s) => {
      const cap = flagship(P(s))?.capability ?? 0;
      // interleave: keep one capability node and one alignment node moving.
      // The base AI runs money, chips and training — layering our own raises on
      // top only dilutes the founder into a boardroom coup. Take the reckless
      // FLOP multipliers (neuralese, arch-redesign) to reach ASI and re-grind
      // the alignment hit with the safety program.
      const align = flagship(P(s))?.alignment ?? 0;
      rush(s, ALIGN_LADDER, 2, 6000);
      rush(s, CAP_CLIMB_ASI, 3, 6000);
      // climb to the doorstep of ASI with decisive runs...
      if (cap > 78 && cap < 90) megaRun(s, 92, 0.55, 0.5);
      // ...then HOLD at the training wall (~90) and pour compute into alignment.
      if (cap > 88) alignShare(s, 0.9);
      else if (cap > 55) alignShare(s, 0.5);
      // only once alignment is genuinely high do we take RSI, to tip a
      // well-aligned flagship over 100. Hitting 100 at align 90 is a near-loss;
      // waiting for 94+ is the whole game.
      if (align > 93) rush(s, ['rsi'], 3, 4000);
    },
  },
  {
    // REASONABLE: fund a heavy safety program with a moderate commerce engine
    // (bio + licenses), buy a big fleet, grind alignment to the Provable ceiling
    // and reach an aligned ASI on the strength of money. "Tycoon done right."
    name: 'commerce-safety',
    profile: { aggression: 0.5, safety: 0.75, commerce: 0.8 },
    events: SAFE_EVENTS,
    extra: (s) => {
      const lab = P(s);
      const cap = flagship(lab)?.capability ?? 0;
      // a commerce-tilted profile makes the base AI lean into bio/licenses; we
      // steer a deep, funded safety program all the way to Provable Alignment
      // and only a recoverable capability risk (Neuralese, no arch-redesign).
      const align = flagship(lab)?.alignment ?? 0;
      rush(s, ALIGN_LADDER, 2, 8000);
      rush(s, [...BIO_MONEY, ...CAP_CLIMB_ASI], 3, 8000);
      if (!lab.postTraining && lab.cash > postTrainCost(lab) * 4) startPostTraining(lab);
      // climb capability first (diverting compute too early traps the flagship
      // in the mid-40s plateau), then hold near the top and max alignment before
      // taking RSI to tip it over 100 well-aligned
      if (cap > 78 && cap < 90) megaRun(s, 92, 0.5, 0.45);
      if (cap > 88) alignShare(s, 0.9);
      else if (cap > 62) alignShare(s, 0.5);
      if (align > 93) rush(s, ['rsi'], 3, 4000);
    },
  },
  {
    // REASONABLE: a near-parity dealmaker. Stays close to the frontier for the
    // leverage to broker (rivals only freeze a race that's genuinely neck-and-
    // neck), then works the treaty track to the Global Pause.
    name: 'diplomat',
    profile: { aggression: 0.55, safety: 0.65, commerce: 0.6 },
    events: SAFE_EVENTS,
    extra: (s) => {
      const lab = P(s);
      raiseIfNeeded(s, 30, 8000);
      // keep pace with the frontier for treaty leverage, plus the treaty prereqs
      rush(s, [...TREATY_PREREQS, 'constitutional', 'evals-redteam'], 2, 6000);
      rush(s, CAP_CLIMB, 3, 6000);
      if (s.govs[lab.country].riskFear < 90) alarm(s);
      signTreaties(s);
    },
  },
  {
    // REASONABLE: stay near the frontier for treaty leverage, then close out on
    // whichever ending is nearer — the pause if the gap is small, otherwise an
    // aligned ASI. The opportunist.
    name: 'hybrid',
    profile: { aggression: 0.6, safety: 0.6, commerce: 0.6 },
    events: SAFE_EVENTS,
    extra: (s) => {
      const lab = P(s);
      const m = flagship(lab);
      const myCap = m?.capability ?? 0;
      rush(s, CAP_SPINE, 3, 6000);
      rush(s, [...ALIGN_LADDER.slice(0, 8), ...TREATY_PREREQS], 3, 6000);
      const frontier = Math.max(...Object.values(s.labs).filter((l) => l.alive && l.id !== s.playerLab).map((l) => flagship(l)?.capability ?? 0));
      if (frontier - myCap < 10) {
        alarm(s);
        signTreaties(s);
      }
      if (myCap > 80) alignShare(s, 0.6);
    },
  },
];

/** Play one full game; returns the final state. */
export function playGame(state: GameState, strategy: Strategy, maxWeeks: number, onWeek?: (state: GameState) => void): GameState {
  const player = state.labs[state.playerLab];
  player.profile = strategy.profile;
  while (!state.gameOver && state.week < maxWeeks) {
    while (state.pendingEvents.length > 0 && !state.gameOver) {
      const event = state.pendingEvents[0];
      const wanted = strategy.events?.[event.eventId];
      const choice = event.choices.find((c) => c.id === wanted) ?? event.choices[0];
      respondToEvent(state, choice.id);
    }
    if (state.gameOver) break;
    if (strategy.name !== 'passive') {
      rivalAct(state, player);
      strategy.extra?.(state);
    }
    advanceWeek(state);
    onWeek?.(state);
  }
  return state;
}
