/**
 * The 'optimal' bot: model-predictive strategy switching.
 *
 * Every ARBITER.evalInterval weeks it clones the live game, plays it forward to
 * the end under each candidate playbook (the reasonable strategies) across a
 * few reseeded RNG draws, and adopts whichever playbook wins the imagined
 * futures most often. Between evaluations it simply executes the chosen
 * playbook. This is receding-horizon control: it never plans the whole game,
 * only the next commitment, and re-decides as the real game unfolds.
 *
 * The rollout forces sim mode and swaps every 'optimal' lab to a concrete
 * playbook, so nothing blocks on an event and the arbiter never recurses into
 * itself inside its own rollouts.
 */
import { advanceWeek } from './tick';
import { runStrategy, STRATEGY_BY_NAME } from './strategy';
import type { GameState, Lab, LabId } from './types';

/** Tunable knobs — the harness turns these down for a fast pass. */
export const ARBITER = {
  /** weeks between re-evaluations */
  evalInterval: 26,
  /** reseeded rollouts per candidate (averages out luck) */
  seedsPerCandidate: 3,
  /** cap a rollout so a stalemate can't run forever */
  rolloutMaxWeeks: 560,
  /** only switch playbooks if the best beats the incumbent by this score margin */
  switchMargin: 0.04,
  /** candidate playbooks the arbiter chooses among (reasonable strategy names) */
  candidates: ['balanced-racer', 'commerce-safety', 'diplomat', 'hybrid'] as string[],
};

/** Utility of a finished game to the lab we are deciding for. */
function outcomeValue(state: GameState, labId: LabId): number {
  const g = state.gameOver;
  if (!g || g.result !== 'win') return 0; // loss, doom or timeout
  return g.byLab === labId ? 1.0 : 0.4; // my win, or someone's aligned/pause win
}

/** Deep-clone the live state into an independent, headless (sim) universe. */
function forkState(state: GameState, candidate: string, mixSeed: number): GameState {
  const clone = JSON.parse(JSON.stringify(state)) as GameState;
  clone.sim = true; // headless: every lab auto-answers its own events, nothing blocks
  clone.tutorial = false;
  clone.feed = [];
  clone.history = [];
  clone.pendingEvents = [];
  // a distinct but deterministic future
  clone.rng = { s: (state.rng.s ^ (mixSeed * 2654435761) ^ (state.week * 40503)) >>> 0 };
  // swap every arbiter-driven lab to the concrete candidate — this both makes
  // the rollout play a fixed line AND breaks the recursion (no 'optimal' left)
  for (const lab of Object.values(clone.labs)) {
    if (lab.strategy && STRATEGY_BY_NAME[lab.strategy]?.meta) {
      lab.strategy = candidate;
      delete lab.metaStrategy;
    }
  }
  return clone;
}

/** Mean utility of playing `candidate` from here to the end, over K reseeds. */
function evaluateCandidate(state: GameState, labId: LabId, candidate: string): number {
  let total = 0;
  for (let k = 0; k < ARBITER.seedsPerCandidate; k++) {
    const clone = forkState(state, candidate, k + 1);
    let guard = 0;
    while (!clone.gameOver && clone.week < ARBITER.rolloutMaxWeeks && guard++ < ARBITER.rolloutMaxWeeks + 5) {
      advanceWeek(clone);
    }
    total += outcomeValue(clone, labId);
  }
  return total / ARBITER.seedsPerCandidate;
}

/** Pick (or keep) the best playbook for this lab, with hysteresis. */
function reevaluate(state: GameState, lab: Lab): string {
  const current = lab.metaStrategy?.current;
  let best = current ?? ARBITER.candidates[0];
  let bestScore = -1;
  const scores: Record<string, number> = {};
  for (const cand of ARBITER.candidates) {
    const s = evaluateCandidate(state, lab.id, cand);
    scores[cand] = s;
    if (s > bestScore) {
      bestScore = s;
      best = cand;
    }
  }
  // hysteresis: don't churn playbooks for a negligible edge over the incumbent
  if (current && current in scores && bestScore - scores[current] < ARBITER.switchMargin) return current;
  return best;
}

/**
 * Weekly action for an 'optimal' lab: re-evaluate on cadence, then execute the
 * chosen playbook. Safe to call for the player seat (real game) or any seat
 * (symmetric sim).
 */
export function optimalAct(state: GameState, lab: Lab): void {
  if (!lab.alive) return;
  const due = !lab.metaStrategy || state.week >= lab.metaStrategy.nextEvalWeek;
  if (due) {
    const current = reevaluate(state, lab);
    lab.metaStrategy = { current, nextEvalWeek: state.week + ARBITER.evalInterval };
  }
  const chosen = STRATEGY_BY_NAME[lab.metaStrategy!.current];
  if (chosen) {
    // the housekeeping pass reads lab.profile — keep it in sync with the playbook
    lab.profile = chosen.profile;
    runStrategy(state, lab, chosen);
  }
}
