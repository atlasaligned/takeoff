import { BAL, clamp, clamp100 } from './balance';
import { flagship, shiftAlignment } from './model';
import { RESEARCH_BY_ID } from './research';
import { chance } from './rng';
import type { GameState, GovId, Lab } from './types';

export interface TreatyNode {
  id: string;
  tier: 1 | 2 | 3 | 4;
  name: string;
  desc: string;
  quote: string;
  effect: string;
  cost: number; // $M
  prereqs: string[];
  /** minimum risk fear required in the player's home govt */
  minRiskFear?: number;
  /** research node ids the player must have completed */
  researchReqs?: string[];
  /** needs the 2nd-strongest rival to agree */
  needsAgreement?: boolean;
}

export const TREATIES: TreatyNode[] = [
  // ---- T1: unilateral confidence-building (no fear gate)
  {
    id: 'transparency-pledge',
    tier: 1,
    name: 'Transparency Pledge',
    desc: 'Voluntarily publish what your models can do, where they fall short, and how you keep them in line. Honesty is cheap; the edge you give up isn’t — your rivals read it too.',
    quote: 'Sunlight, and all that.',
    effect: '+6 public trust · +3 govt trust · rivals close a little of the capability gap',
    cost: 1500,
    prereqs: [],
  },
  {
    id: 'incident-reporting',
    tier: 1,
    name: 'Shared Incident Reporting',
    desc: 'Log every jailbreak, dangerous capability and near-miss into a common pool instead of burying it. Nobody hides the crashes, so everybody learns from them.',
    quote: 'Nobody hides the crashes anymore.',
    effect: '+6 public trust · −4 race fear, all govts',
    cost: 1800,
    prereqs: [],
  },
  {
    id: 'responsible-scaling',
    tier: 1,
    name: 'Responsible Scaling Policy',
    desc: 'Commit in advance to if–then tripwires: if a model crosses a named dangerous-capability line, you halt and take precautions first. Concrete enough that regulators trust it.',
    quote: "We'll stop. If. Then.",
    effect: '+7 govt trust · +5 public trust',
    cost: 2200,
    prereqs: [],
  },

  // ---- T2: institutions (require some global fear — nobody negotiates until frightened)
  {
    id: 'joint-safety-institute',
    tier: 2,
    name: 'Joint Safety Institute',
    desc: 'A CERN for AI safety: labs that compete on capability cooperate on not dying. Everyone contributes people and findings; safety stops being a competitive secret.',
    quote: 'We compete on capability. We cooperate on not dying.',
    effect: '+4 true alignment for ALL labs · −8 race fear, all govts',
    cost: 16000,
    prereqs: ['transparency-pledge'],
    minRiskFear: 40,
    needsAgreement: true,
  },
  {
    id: 'crisis-hotline',
    tier: 2,
    name: 'Crisis Hotline',
    desc: 'A direct, always-open line between labs and governments, so a frightening 3 AM incident is explained before it is assumed to be an attack. A red telephone for the AI age.',
    quote: 'For when something goes bump in the night.',
    effect: 'jailbreak fallout −40% · −6 race fear, all govts',
    cost: 4500,
    prereqs: ['incident-reporting'],
    minRiskFear: 40,
  },
  {
    id: 'frontier-registry',
    tier: 2,
    name: 'Frontier Model Registry',
    desc: 'Every large training run is declared before it begins — who, how big, how much compute. No teeth on its own, but it turns “we have no idea what they’re building” into a list you can check.',
    quote: 'First, everyone says what they’re building.',
    effect: '−7 race fear, all govts',
    cost: 5000,
    prereqs: ['responsible-scaling'],
    minRiskFear: 40,
  },

  // ---- T3: verification
  {
    id: 'hardware-verified-compute',
    tier: 3,
    name: 'Hardware-Verified Compute',
    desc: 'Make your self-attesting, rule-bound chips the backbone of an international regime: hardware that cryptographically proves you run only what you declared. A treaty written into the silicon.',
    quote: 'The treaty is written into the silicon.',
    effect: '−12 race fear, all govts',
    cost: 8000,
    prereqs: ['frontier-registry'],
    researchReqs: ['hardware-governance'],
    needsAgreement: true,
  },
  {
    id: 'mutual-inspection',
    tier: 3,
    name: 'Mutual Inspection Regime',
    desc: 'Reciprocal, intrusive inspection — your people in their datacenters, theirs in yours. It only works atop institutions that already talk, which is why it needs both the safety body and the hotline.',
    quote: 'Your inspectors in our datacenters, ours in yours.',
    effect: '−10 race fear, all govts',
    cost: 12000,
    prereqs: ['joint-safety-institute', 'crisis-hotline'],
    needsAgreement: true,
  },

  // ---- T4: the ceiling and the capstone
  {
    id: 'compute-cap-treaty',
    tier: 4,
    name: 'Compute Cap Treaty',
    desc: 'With chips proving compliance and inspectors checking the rest, the powers agree to a hard ceiling on frontier compute. It holds by mutual deterrence — everyone can now see, and disable, a cheater.',
    quote: 'A ceiling everyone can see, and no one can quietly raise.',
    effect: "caps every lab's compute at the current leader's fleet · large −race fear, all govts",
    cost: 26000,
    prereqs: ['hardware-verified-compute', 'mutual-inspection'],
    minRiskFear: 78,
    needsAgreement: true,
  },
  {
    id: 'global-pause',
    tier: 4,
    name: 'Global AI Pause',
    desc: 'A binding, verified, worldwide halt to the race for superintelligence — not forever, but until humanity knows what it is doing. You win not by building the most powerful thing, but by getting everyone to agree not to.',
    quote: 'Not forever. Just until we know what we’re doing.',
    effect: 'you win the game — Pause victory',
    cost: 55000,
    prereqs: ['compute-cap-treaty'],
    minRiskFear: 92,
    needsAgreement: true,
  },
];

export const TREATY_BY_ID: Record<string, TreatyNode> = Object.fromEntries(TREATIES.map((t) => [t.id, t]));

/** The 2nd-strongest rival lab (by flagship capability) — the treaty gatekeeper. */
export function treatyGatekeeper(state: GameState): Lab | null {
  const rivals = Object.values(state.labs)
    .filter((l) => l.alive && l.id !== state.playerLab)
    .sort((a, b) => (flagship(b)?.capability ?? 0) - (flagship(a)?.capability ?? 0));
  // the strongest rival has the most to lose from freezing the race
  return rivals[0] ?? null;
}

export function agreementProbability(state: GameState): number {
  const player = state.labs[state.playerLab];
  const keeper = treatyGatekeeper(state);
  if (!keeper) return 0.95;
  const keeperCap = flagship(keeper)?.capability ?? 0;
  // distance from parity in EITHER direction hurts: a rival far ahead of you
  // refuses to freeze its lead, and a rival far BEHIND you refuses to lock in
  // your lead — agreement is likeliest near parity. This closes the
  // "run ahead, then pause to cash the lead as a win" exploit.
  const gap = Math.abs(keeperCap - (flagship(player)?.capability ?? 0));
  // the diplomatic window also shuts as the frontier itself approaches ASI
  const window = clamp((100 - keeperCap) / BAL.TREATY_ASI_WINDOW, 0, 1);
  return clamp((BAL.TREATY_BASE - gap * BAL.TREATY_GAP_WEIGHT) * window, 0.02, 0.95);
}

/** Why can't the player sign this treaty right now? null = they can. */
export function treatyBlocked(state: GameState, id: string): string | null {
  const t = TREATY_BY_ID[id];
  if (!t) return 'unknown treaty';
  const player = state.labs[state.playerLab];
  if (state.diplomacy.completed.includes(id)) return 'already in force';
  for (const p of t.prereqs) {
    if (!state.diplomacy.completed.includes(p)) return `needs ${TREATY_BY_ID[p].name}`;
  }
  if (t.researchReqs) {
    for (const r of t.researchReqs) {
      if (!player.research.completed.includes(r)) return `needs research: ${RESEARCH_BY_ID[r]?.name ?? r}`;
    }
  }
  if (t.minRiskFear !== undefined && state.govs[player.country].riskFear < t.minRiskFear) {
    return `needs ${player.country === 'us' ? 'US' : 'PRC'} risk fear ≥ ${t.minRiskFear}`;
  }
  if ((state.diplomacy.cooldowns[`treaty-${id}`] ?? 0) > state.week) {
    return 'talks recently collapsed — wait';
  }
  if (player.cash < t.cost) return 'not enough cash';
  return null;
}

/** Apply a successfully signed treaty's effects. */
export function applyTreaty(state: GameState, id: string): void {
  const player = state.labs[state.playerLab];
  state.diplomacy.completed.push(id);
  const allGovs = Object.values(state.govs);
  const dropRace = (n: number) => allGovs.forEach((g) => (g.raceFear = clamp(g.raceFear - n, BAL.FEAR_FLOOR, 100)));
  switch (id) {
    case 'transparency-pledge':
      player.publicTrust = clamp100(player.publicTrust + 6);
      player.govTrust = clamp100(player.govTrust + 3);
      // your disclosures help rivals patch their own weaknesses — they close a sliver of the gap
      for (const lab of Object.values(state.labs)) {
        if (lab.id === state.playerLab) continue;
        const m = flagship(lab);
        if (m) m.capability = Math.min(BAL.ASI_CAPABILITY, m.capability + BAL.TRANSPARENCY_RIVAL_CAP_GAIN);
      }
      break;
    case 'incident-reporting':
      player.publicTrust = clamp100(player.publicTrust + 6);
      dropRace(4);
      break;
    case 'responsible-scaling':
      player.govTrust = clamp100(player.govTrust + 7);
      player.publicTrust = clamp100(player.publicTrust + 5);
      break;
    case 'joint-safety-institute':
      for (const lab of Object.values(state.labs)) {
        const m = flagship(lab);
        if (m) shiftAlignment(m, 4);
      }
      dropRace(8);
      break;
    case 'crisis-hotline':
      dropRace(6);
      break;
    case 'frontier-registry':
      dropRace(7);
      break;
    case 'hardware-verified-compute':
      dropRace(12);
      break;
    case 'mutual-inspection':
      dropRace(10);
      break;
    case 'compute-cap-treaty': {
      // cap every lab at the current leader's fleet — the race slows to a walk
      const cap = Math.max(...Object.values(state.labs).filter((l) => l.alive).map((l) => l.chips));
      state.world.chipCap = cap;
      for (const lab of Object.values(state.labs)) {
        if (lab.chips > cap) lab.chips = cap;
      }
      dropRace(16);
      break;
    }
    case 'global-pause':
      // handled by endgame check
      break;
  }
}

export interface SmallAction {
  id: string;
  name: string;
  effect: string;
  cost: number;
  cooldown: number;
  needsTarget: boolean;
}

export const SMALL_ACTIONS: SmallAction[] = [
  { id: 'charm', name: 'Charm Offensive', effect: '−race fear, one govt', cost: BAL.CHARM_COST, cooldown: BAL.CHARM_COOLDOWN, needsTarget: true },
  { id: 'summit', name: 'International Summit', effect: '−race fear, global', cost: BAL.SUMMIT_COST, cooldown: BAL.SUMMIT_COOLDOWN, needsTarget: false },
  { id: 'alarm', name: 'Sound the Alarm', effect: '+risk fear all govts · +public trust · −revenue for a while', cost: 0, cooldown: BAL.ALARM_COOLDOWN, needsTarget: false },
  { id: 'backchannel', name: 'Backchannel Negotiations', effect: '−race fear, target · leak risk', cost: BAL.BACKCHANNEL_COST, cooldown: BAL.BACKCHANNEL_COOLDOWN, needsTarget: true },
];

export function smallActionReady(state: GameState, id: string): boolean {
  return (state.diplomacy.cooldowns[id] ?? 0) <= state.week;
}

export interface AlarmEffect {
  /** revenue penalty multiplier applied for a while; stored on state via lawsuit-like entry */
  weeks: number;
}

export function applySmallAction(state: GameState, id: string, target: GovId | null): string {
  const player = state.labs[state.playerLab];
  const action = SMALL_ACTIONS.find((a) => a.id === id);
  if (!action) return 'unknown action';
  player.cash -= action.cost;
  state.diplomacy.cooldowns[id] = state.week + action.cooldown;
  switch (id) {
    case 'charm': {
      const gov = state.govs[target ?? player.country];
      gov.raceFear = clamp(gov.raceFear - BAL.CHARM_RACE_FEAR, BAL.FEAR_FLOOR, 100);
      return `Charm offensive: ${gov.id.toUpperCase()} race fear −${BAL.CHARM_RACE_FEAR}`;
    }
    case 'summit': {
      for (const g of Object.values(state.govs)) g.raceFear = clamp(g.raceFear - BAL.SUMMIT_RACE_FEAR, BAL.FEAR_FLOOR, 100);
      return `Summit concluded: race fear −${BAL.SUMMIT_RACE_FEAR} globally`;
    }
    case 'alarm': {
      for (const g of Object.values(state.govs)) g.riskFear = clamp(g.riskFear + BAL.ALARM_RISK_FEAR, BAL.FEAR_FLOOR, 100);
      player.publicTrust = clamp100(player.publicTrust + BAL.ALARM_PUBLIC_TRUST);
      player.lawsuits.push({ name: 'Enterprise churn after doomer press tour', weeklyCost: player.weeklyRevenue * BAL.ALARM_REVENUE_HIT, weeksLeft: BAL.ALARM_REVENUE_WEEKS });
      return `You sounded the alarm: risk fear +${BAL.ALARM_RISK_FEAR} everywhere, public trust +${BAL.ALARM_PUBLIC_TRUST}`;
    }
    case 'backchannel': {
      const targetId = target ?? (player.country === 'us' ? 'prc' : 'us');
      const gov = state.govs[targetId];
      gov.raceFear = clamp(gov.raceFear - BAL.BACKCHANNEL_RACE_FEAR, BAL.FEAR_FLOOR, 100);
      if (chance(state.rng, BAL.BACKCHANNEL_LEAK_CHANCE)) {
        const other = state.govs[targetId === 'us' ? 'prc' : 'us'];
        other.raceFear = clamp(other.raceFear + BAL.BACKCHANNEL_LEAK_RACE_FEAR, BAL.FEAR_FLOOR, 100);
        return `Backchannel opened: ${gov.id.toUpperCase()} race fear −${BAL.BACKCHANNEL_RACE_FEAR} — but the talks LEAKED (${other.id.toUpperCase()} race fear +${BAL.BACKCHANNEL_LEAK_RACE_FEAR})`;
      }
      return `Backchannel opened: ${gov.id.toUpperCase()} race fear −${BAL.BACKCHANNEL_RACE_FEAR}`;
    }
  }
  return '';
}
