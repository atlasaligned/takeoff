import { BAL } from './balance';
import { raiseTerms, runwayWeeks, serveCapacity, licenseDemand } from './finance';
import { jailbreakChance } from './jailbreak';
import { bandWidth, flagship, predictCapability } from './model';
import { demandChips, planRun, researchWishlist } from './rivalAI';
import { RESEARCH_BY_ID, researchBlocked } from './research';
import { TREATIES, treatyBlocked } from './diplomacy';
import type { GameState, Lab } from './types';

/**
 * The hint system for newer players: prioritized "here is a sensible next
 * action" suggestions, derived from the same planning primitives the rival AI
 * plays with (planRun, researchWishlist, runway thresholds). Pure — never
 * mutates state, never rolls the RNG.
 */
export interface Hint {
  id: string;
  /** short imperative headline */
  title: string;
  /** one or two sentences of why */
  body: string;
  /** tab where the action lives */
  tab: 'overview' | 'models' | 'research' | 'diplomacy' | 'people' | 'finance' | 'rivals' | 'world';
  /** danger = do this now; info = good idea */
  urgent: boolean;
}

const fmtB = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${Math.round(m)}M`);

/** All currently applicable hints, best first. The UI lets players cycle through them. */
export function suggestActions(state: GameState): Hint[] {
  if (state.gameOver) return [];
  const lab = state.labs[state.playerLab];
  const m = flagship(lab);
  const out: Hint[] = [];

  // ---- 1. solvency emergencies
  if (lab.cash < 0) {
    out.push({
      id: 'emergency-raise',
      title: 'Take the emergency round — now',
      body: `You are ${fmtB(-lab.cash)} in the red with ${Math.max(0, BAL.BANKRUPTCY_GRACE_WEEKS - lab.brokeWeeks)} weeks of grace left. The terms are brutal; bankruptcy is worse.`,
      tab: 'finance',
      urgent: true,
    });
  }
  const runway = runwayWeeks(lab);
  const canRaise = state.week >= lab.fundraiseCooldownUntil;
  if (lab.cash >= 0 && runway < 20 && canRaise) {
    const small = raiseTerms(state, lab, 'small');
    out.push({
      id: 'raise-runway',
      title: 'Fundraise — the runway is getting short',
      body: `${Math.ceil(runway)} weeks of cash left. A small round brings in ${fmtB(small.amount)}; it comes with a revenue target, but that beats an emergency round later.`,
      tab: 'finance',
      urgent: runway < 12,
    });
  }

  // ---- 2. flagship housekeeping
  if (!m) {
    const best = [...lab.models].sort((a, b) => b.capability - a.capability)[0];
    if (best) {
      out.push({
        id: 'promote-any',
        title: `Promote ${best.name} to flagship`,
        body: 'No flagship means no revenue, no evals and no progress. Promote a model from the vault.',
        tab: 'models',
        urgent: true,
      });
    }
  }
  if (m) {
    const better = lab.models.find((x) => x.id !== m.id && x.capability > m.capability + 1.5);
    if (better) {
      out.push({
        id: 'promote-better',
        title: `Consider promoting ${better.name} (capability ${better.capability.toFixed(1)})`,
        body: `It beats your flagship by ${(better.capability - m.capability).toFixed(1)} capability. Check its alignment band (${better.alignmentLo.toFixed(0)}–${better.alignmentHi.toFixed(0)}) and robustness before you serve it.`,
        tab: 'models',
        urgent: false,
      });
    }
  }

  // ---- 3. endgame safety: don't cross 100 misaligned
  if (m && m.capability > 78 && m.alignmentLo < 85) {
    const alignShare = lab.alloc.alignment / Math.max(1, lab.chips);
    if (alignShare < 0.3) {
      out.push({
        id: 'align-or-die',
        title: 'Pivot compute to alignment — the threshold is close',
        body: `At capability ${m.capability.toFixed(0)}, crossing 100 rolls on TRUE alignment, and your band still allows ${m.alignmentLo.toFixed(0)}. Below 80 always loses; you want 95+. Shift chips to alignment and finish the alignment tree.`,
        tab: 'overview',
        urgent: true,
      });
    }
  }

  // ---- 4. jailbreak exposure
  const jb = jailbreakChance(state, lab);
  if (m && jb > 0.015) {
    out.push({
      id: 'robustness',
      title: 'Your jailbreak risk is high — harden the model',
      body: `${(jb * 100).toFixed(1)}%/week at robustness ${m.robustness.toFixed(0)}. Post-training adds a little; Red Team Automation and Formal Verification add a lot. At capability ${m.capability.toFixed(0)} a jailbreak is ${m.capability >= BAL.JB_SEVERE_MAX ? 'game-ending' : 'expensive'}.`,
      tab: m.robustness < 60 ? 'research' : 'models',
      urgent: m.capability >= BAL.JB_SEVERE_MAX,
    });
  }

  // ---- 5. alignment compute completely off
  if (m && lab.alloc.alignment === 0 && lab.chips > 3000) {
    out.push({
      id: 'some-alignment',
      title: 'Allocate at least some alignment compute',
      body: 'Zero alignment chips means the band never narrows and true alignment never moves. You cannot win a roll you never worked on.',
      tab: 'overview',
      urgent: false,
    });
  }

  // ---- 6. start a training run when funded
  if (!lab.run && m) {
    const plan = planRun(state, lab);
    if (plan.flop > 0 && lab.cash > plan.cost * 1.3) {
      const est = predictCapability(lab, plan.flop, state.world.algoProgress);
      if (est > m.capability + 2) {
        out.push({
          id: 'start-run',
          title: 'Start a training run — the frontier is moving without you',
          body: `Committing ~${plan.chips.toLocaleString()} chips reaches ~${est.toFixed(0)} capability for ${fmtB(plan.cost)}. Rivals are training.`,
          tab: 'models',
          urgent: false,
        });
      }
    } else if (plan.cost > 0 && canRaise && runway > 20) {
      // 7b. can't afford the next real run → raise for it
      out.push({
        id: 'raise-for-run',
        title: 'Raise to fund your next training run',
        body: `The run worth doing costs ~${fmtB(plan.cost)} and you have ${fmtB(lab.cash)}. Profitable-but-static is how you lose the race.`,
        tab: 'finance',
        urgent: false,
      });
    }
  }

  // ---- 8. research: keep the queue full
  if (lab.research.active.length < 2 && m) {
    const picks = pickResearch(state, lab, m.capability, 2);
    for (const pick of picks) {
      const node = RESEARCH_BY_ID[pick];
      out.push({
        id: `research-${pick}`,
        title: `Research ${node.name}`,
        body: `${node.effect}. You have a free research slot — an empty queue is compounding you're not collecting.`,
        tab: 'research',
        urgent: false,
      });
    }
  }

  // ---- 9. board trouble brewing
  if (lab.boardYours <= 4 && lab.discontent > 45) {
    out.push({
      id: 'board-danger',
      title: 'Your board can vote you out — keep them calm',
      body: `${lab.boardYours} of 9 seats and discontent at ${Math.round(lab.discontent)}. Hit revenue targets, avoid emergency raises, and think twice before refusing board demands.`,
      tab: 'people',
      urgent: lab.discontent > 60,
    });
  }

  // ---- 10. diplomacy: a treaty is on the table
  for (const t of TREATIES) {
    if (!state.diplomacy.completed.includes(t.id) && treatyBlocked(state, t.id) === null) {
      out.push({
        id: `treaty-${t.id}`,
        title: `${t.name} is signable`,
        body: `${t.effect}. ${t.tier >= 3 ? 'This is real progress toward the Pause victory.' : 'Cheap goodwill — and a step toward the treaty track.'}`,
        tab: 'diplomacy',
        urgent: false,
      });
    }
  }

  // ---- 11. serve unmet demand
  if (m) {
    const demand = licenseDemand(state)[lab.id] ?? 0;
    const capacity = serveCapacity(lab);
    if (demand > capacity * 1.3 && lab.cash > 500) {
      const wanted = demandChips(state, lab);
      out.push({
        id: 'buy-chips',
        title: 'Demand outstrips your inference capacity',
        body: `Customers want ~${Math.round(demand / 1000)}k seats; you can serve ${Math.round(capacity / 1000)}k. More inference chips (~${wanted.toLocaleString()} total) turn that into revenue.`,
        tab: 'finance',
        urgent: false,
      });
    }
  }

  // ---- 12. all clear
  if (out.length === 0) {
    out.push({
      id: 'cruise',
      title: 'Nothing urgent — let the weeks run',
      body: 'Cash is fine, compute is working, research is queued. Watch the race chart and the fear dials; speed up time.',
      tab: 'overview',
      urgent: false,
    });
  }
  return out;
}

/** The single best hint (first of suggestActions). */
export function suggestAction(state: GameState): Hint | null {
  return suggestActions(state)[0] ?? null;
}

/** Relevance-ordered research candidates: safety overrides first, then the AI wishlist. */
function researchCandidates(state: GameState, lab: Lab): string[] {
  const m = flagship(lab);
  // overrides: cheap robustness early, alignment tree when the model gets scary
  const priority: string[] = [];
  if (m && m.robustness < 45 && !lab.research.completed.includes('evals-redteam')) priority.push('evals-redteam', 'interpretability-probes');
  if (m && m.capability > 45 && bandWidth(m) > 30) priority.push('mech-interp', 'model-organisms');
  if (m && m.capability > 55) priority.push('glass-box', 'corrigibility');
  return [...priority, ...researchWishlist(state, lab)];
}

/** First affordable, unlocked nodes from the candidate list. */
function pickResearch(state: GameState, lab: Lab, cap: number, count: number): string[] {
  const picks: string[] = [];
  for (const id of researchCandidates(state, lab)) {
    if (picks.includes(id)) continue;
    if (lab.cash < (RESEARCH_BY_ID[id]?.cost ?? Infinity) * 1.3) continue;
    if (researchBlocked(lab, id, cap) === null) picks.push(id);
    if (picks.length >= count) break;
  }
  return picks;
}

/**
 * The next most relevant research nodes for the player — unlocked (prereqs +
 * capability met), possibly cash-short. A hint for the main screen; pure.
 */
export function nextResearchPicks(state: GameState, count = 3): string[] {
  const lab = state.labs[state.playerLab];
  const cap = flagship(lab)?.capability ?? 0;
  const picks: string[] = [];
  for (const id of researchCandidates(state, lab)) {
    if (picks.includes(id)) continue;
    const blocked = researchBlocked(lab, id, cap);
    if (blocked === null || blocked === 'not enough cash') picks.push(id);
    if (picks.length >= count) break;
  }
  return picks;
}

/**
 * The frontier of the treaty tree: the next treaties whose treaty prereqs are
 * in force, in track order. Fear gates / research / cash may still block —
 * that's the hint. Pure.
 */
export function nextTreatyPicks(state: GameState, count = 3): string[] {
  const out: string[] = [];
  for (const t of TREATIES) {
    if (state.diplomacy.completed.includes(t.id)) continue;
    if (!t.prereqs.every((p) => state.diplomacy.completed.includes(p))) continue;
    out.push(t.id);
    if (out.length >= count) break;
  }
  return out;
}
