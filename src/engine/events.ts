import { BAL, clamp, clamp100 } from './balance';
import { flagship, rebalanceAllocations } from './model';
import { makeExec, makeStar, starFieldLabel } from './people';
import { chance, pick, pickWeighted, randRange } from './rng';
import type { ActiveEvent, Executive, GameState, Lab, Star } from './types';

/**
 * Blocking events target the PLAYER lab and pause the game until answered.
 * Rival labs face equivalent pressure through the systemic simulation
 * (trust drift, jailbreak rolls, their AI decisions), not through this file.
 */

export interface ChoiceDef {
  id: string;
  label: string;
  detail: (state: GameState, data: Record<string, unknown>) => string;
  /** returns the resolution text for the feed */
  apply: (state: GameState, data: Record<string, unknown>) => string;
}

export interface EventDef {
  id: string;
  title: string | ((state: GameState, data: Record<string, unknown>) => string);
  body: (state: GameState, data: Record<string, unknown>) => string;
  /** relative weight; 0 = cannot fire now */
  weight: (state: GameState) => number;
  /** prepare event payload (e.g. generate the star being offered) */
  setup?: (state: GameState) => Record<string, unknown>;
  cooldown?: number; // weeks before it may fire again (default BAL.EVENT_COOLDOWN)
  once?: boolean;
  choices: ChoiceDef[];
}

function player(state: GameState): Lab {
  return state.labs[state.playerLab];
}

function fmtM(x: number): string {
  return x >= 1000 ? `$${(x / 1000).toFixed(1)}B` : `$${Math.round(x)}M`;
}

const cap = (state: GameState) => flagship(player(state))?.capability ?? 0;

// ------------------------------------------------------------------ people

const newStarEvent: EventDef = {
  id: 'star-on-market',
  title: (_s, d) => `Researcher on the market: ${(d.star as Star).name}`,
  body: (_s, d) => {
    const star = d.star as Star;
    return `${star.name} (${starFieldLabel(star.field)} ${'★'.repeat(star.tier)} · +${star.bonus}% ${starFieldLabel(star.field)}) just left a rival lab and is taking meetings. Asking ${fmtM(star.salary * 52)}/yr. Every week you wait, someone else might sign them.`;
  },
  weight: (s) => (s.week > 6 ? 3 : 0),
  cooldown: 10,
  setup: (s) => ({ star: makeStar(s.rng) }),
  choices: [
    {
      id: 'hire',
      label: 'Sign them',
      detail: (_s, d) => {
        const star = d.star as Star;
        return `${fmtM(star.salary * 52)}/yr · +${star.bonus}% ${starFieldLabel(star.field)}`;
      },
      apply: (s, d) => {
        const star = d.star as Star;
        player(s).stars.push(star);
        return `${star.name} signed with ${player(s).name}.`;
      },
    },
    {
      id: 'pass',
      label: 'Pass',
      detail: () => 'a rival lab may sign them',
      apply: (s, d) => {
        const star = d.star as Star;
        const rivals = Object.values(s.labs).filter((l) => l.alive && l.id !== s.playerLab);
        if (rivals.length && chance(s.rng, 0.6)) {
          const lucky = pick(s.rng, rivals);
          lucky.stars.push(star);
          return `${star.name} signed with ${lucky.name}.`;
        }
        return `${star.name} took a sabbatical instead.`;
      },
    },
  ],
};

/**
 * Poaching has to be credible: a rival can only bid for a star it can actually
 * afford — richer stars need richer suitors (≈ tier years of the raised salary
 * in cash). A broke lab never bids for your superstar.
 */
function poachablePairs(state: GameState): { star: Star; rival: Lab }[] {
  const p = player(state);
  const rivals = Object.values(state.labs).filter((l) => l.alive && l.id !== state.playerLab);
  const pairs: { star: Star; rival: Lab }[] = [];
  for (const star of p.stars) {
    const askCash = star.salary * 1.5 * 52 * (1 + star.tier); // tier+1 years of the offer, in the bank
    for (const rival of rivals) {
      if (rival.cash >= askCash) pairs.push({ star, rival });
    }
  }
  return pairs;
}

const rivalPoachEvent: EventDef = {
  id: 'rival-poach',
  title: (_s, d) => `${(d.rivalName as string)} is poaching ${(d.star as Star).name}`,
  body: (_s, d) => {
    const star = d.star as Star;
    return `Your ${starFieldLabel(star.field)} lead ${star.name} (${'★'.repeat(star.tier)} · +${star.bonus}% ${starFieldLabel(star.field)} · ${fmtM(star.salary * 52)}/yr) has an offer at ${d.rivalName as string} for 1.5× their salary — and ${d.rivalName as string} has the cash to mean it. Your move.`;
  },
  weight: (s) => (poachablePairs(s).length > 0 ? 2.5 : 0),
  cooldown: 16,
  setup: (s) => {
    const { star, rival } = pick(s.rng, poachablePairs(s));
    return { star, rivalName: rival.name, rivalId: rival.id };
  },
  choices: [
    {
      id: 'counter',
      label: 'Match it — 1.5× their salary',
      detail: (_s, d) => `salary ${fmtM((d.star as Star).salary * 52)} → ${fmtM((d.star as Star).salary * 78)}/yr, they stay`,
      apply: (s, d) => {
        const star = d.star as Star;
        const mine = player(s).stars.find((x) => x.id === star.id);
        if (mine) mine.salary = Math.round(mine.salary * 1.5 * 10) / 10;
        return `${star.name} stays — at one and a half times the price.`;
      },
    },
    {
      id: 'letgo',
      label: 'Let them go',
      detail: () => 'lose the bonus; save the salary',
      apply: (s, d) => {
        const star = d.star as Star;
        const p = player(s);
        p.stars = p.stars.filter((x) => x.id !== star.id);
        const rival = s.labs[d.rivalId as keyof typeof s.labs];
        if (rival?.alive) rival.stars.push({ ...star, salary: Math.round(star.salary * 1.5 * 10) / 10 });
        return `${star.name} left for ${d.rivalName as string}.`;
      },
    },
  ],
};

const HIREABLE_ROLES = ['coo', 'cto', 'cfo', 'research', 'alignment', 'comms'] as const;

const execCandidateEvent: EventDef = {
  id: 'exec-candidate',
  title: (_s, d) => `C-suite candidate: ${(d.exec as { name: string }).name}`,
  body: (s, d) => {
    const roleNames: Record<string, string> = { coo: 'COO', cto: 'CTO', cfo: 'CFO', research: 'Head of Research', alignment: 'Head of Alignment', comms: 'Head of Communications' };
    const e = d.exec as Executive;
    const stats =
      e.role === 'coo'
        ? `−${e.opsBonus}% burn`
        : e.role === 'cto'
          ? `+${e.trainingSpeed}% training speed · +${e.capabilityBonus}% capability per run`
          : e.role === 'cfo'
            ? `+${e.financeBonus}% raise sizes, lower burn`
            : e.role === 'research'
              ? `+${e.researchBonus}% research speed`
              : e.role === 'alignment'
                ? `+${e.alignmentBonus}% alignment work`
                : e.role === 'comms'
                  ? `${e.commsBonus}% slower trust decay`
                  : `charisma ${e.charisma} · credibility ${e.credibility}`;
    const incumbent = player(s).csuite[e.role];
    return `A strong candidate for ${roleNames[e.role]} is available: ${stats}. ${incumbent ? `They would replace ${incumbent.name}.` : 'The seat is vacant.'} Headhunters say they won't wait long.`;
  },
  weight: (s) => {
    const p = player(s);
    const vacant = HIREABLE_ROLES.filter((r) => !p.csuite[r]);
    return vacant.length > 0 ? 4 : 1; // vacant seats get priority; upgrades still trickle in
  },
  cooldown: 18,
  setup: (s) => {
    const p = player(s);
    const vacant = HIREABLE_ROLES.filter((r) => !p.csuite[r]);
    const role = vacant.length ? pick(s.rng, vacant) : pick(s.rng, HIREABLE_ROLES);
    return { exec: makeExec(s.rng, role, 0.55 + randRange(s.rng, 0, 0.4)) };
  },
  choices: [
    {
      id: 'hire',
      label: 'Hire them',
      detail: (_s, d) => {
        const e = d.exec as { salary: number };
        return `${fmtM(e.salary * 52)}/yr · replaces the current holder if any`;
      },
      apply: (s, d) => {
        const e = d.exec as ReturnType<typeof makeExec>;
        player(s).csuite[e.role] = e;
        return `${e.name} joined as ${e.role.toUpperCase()}.`;
      },
    },
    { id: 'pass', label: 'Pass', detail: () => 'keep looking', apply: (_s, d) => `Passed on ${(d.exec as { name: string }).name}.` },
  ],
};

// ------------------------------------------------------------------ board / investors
// Board events are gated on boardPressure = discontent × investor seat share,
// escalating from pointed questions all the way to removal (game over).
// Gambles resolve on your CEO's charisma.

/** discontent (0..100) scaled by how much of the board the investors hold */
function boardPressure(state: GameState): number {
  const p = player(state);
  return p.discontent * (p.boardInvestors / (p.boardYours + p.boardInvestors));
}

/** charm gamble: base odds at charisma 50, ±0.5% per point */
function charismaRoll(state: GameState, base: number): boolean {
  const cha = player(state).csuite.ceo?.charisma ?? 50;
  return chance(state.rng, clamp(base + (cha - 50) * 0.005, 0.1, 0.92));
}

const boardQuestionsEvent: EventDef = {
  id: 'board-questions',
  title: 'Pointed questions from the board',
  body: (s) => `Discontent is at ${Math.round(player(s).discontent)}, and this quarter's board meeting has an unusually specific agenda: burn rate, "science projects", your calendar. They want answers, in person.`,
  weight: (s) => (boardPressure(s) > 4 ? 2.5 : 0),
  cooldown: 14,
  choices: [
    {
      id: 'answer',
      label: 'Walk them through everything',
      detail: () => 'charisma gamble: discontent −6 — or +6 if you fumble it',
      apply: (s) => {
        const p = player(s);
        if (charismaRoll(s, 0.6)) {
          p.discontent = clamp(p.discontent - 6, 0, 100);
          return 'Three hours of questions, answered nicely. The meeting ended with handshakes instead of motions.';
        }
        p.discontent = clamp(p.discontent + 6, 0, 100);
        return 'You got defensive on question two and it went downhill from there. The minutes read like an indictment.';
      },
    },
  ],
};

const boardResolutionEvent: EventDef = {
  id: 'board-resolution',
  title: 'Binding resolution: hit the number',
  body: (_s, d) => `The board just passed a binding resolution: ${fmtM(d.target as number)}/week in revenue within ${d.weeks as number} weeks. Nobody asked how. That part is your job.`,
  weight: (s) => (boardPressure(s) > 8 && !player(s).revenueExpectation ? 2.5 : 0),
  cooldown: 28,
  setup: (s) => {
    const p = player(s);
    return { target: Math.max(Math.round(p.weeklyRevenue * 1.35), Math.round(p.weeklyRevenue) + 40), weeks: 18 };
  },
  choices: [
    {
      id: 'ok',
      label: 'Acknowledge the resolution',
      detail: (_s, d) => `revenue target ${fmtM(d.target as number)}/wk in ${d.weeks as number} weeks · miss = discontent + valuation hit`,
      apply: (s, d) => {
        const p = player(s);
        p.revenueExpectation = { target: d.target as number, deadlineWeek: s.week + (d.weeks as number) };
        return `The board's number is on the wall: ${fmtM(d.target as number)}/wk. The countdown is running.`;
      },
    },
  ],
};

const boardHostileCooEvent: EventDef = {
  id: 'board-hostile-coo',
  title: (_s, d) => `The board has a COO for you: ${(d.exec as Executive).name}`,
  body: (_s, d) => {
    const e = d.exec as Executive;
    return `The investor bloc wants "operational discipline" — specifically, ${e.name}, a turnaround operator with their trust and none of yours. Your current COO would be out. So, eventually, might be anything the board doesn't like.`;
  },
  weight: (s) => (boardPressure(s) > 14 ? 2 : 0),
  cooldown: 30,
  setup: (s) => {
    const e = makeExec(s.rng, 'coo', 0.5 + randRange(s.rng, 0, 0.3));
    e.hostile = true;
    return { exec: e };
  },
  choices: [
    {
      id: 'refuse',
      label: 'Refuse — you run operations',
      detail: () => 'charisma gamble: they back down — or discontent +10',
      apply: (s) => {
        if (charismaRoll(s, 0.55)) return 'You stared them down. The board was bluffing — the candidate quietly withdraws.';
        player(s).discontent = clamp(player(s).discontent + 10, 0, 100);
        return 'You refused. The investor bloc now opens every meeting with the org chart.';
      },
    },
    {
      id: 'accept',
      label: 'Install them',
      detail: () => 'discontent −8 now · they feed the board discontent weekly while installed · replaces your COO',
      apply: (s, d) => {
        const p = player(s);
        const e = d.exec as Executive;
        p.csuite.coo = e;
        p.discontent = clamp(p.discontent - 8, 0, 100);
        return `${e.name} is your COO now. Their first act: a standing Friday call with the investor directors. Replace them when you find someone better.`;
      },
    },
  ],
};

const boardRealignmentEvent: EventDef = {
  id: 'board-realignment',
  title: 'Boardroom realignment',
  body: (s) => `A motion is circulating to "broaden governance experience" — by replacing one of your loyal directors with an investor pick. You hold ${player(s).boardYours} of 9 seats. Seats lost this way never come back.`,
  weight: (s) => (boardPressure(s) > 20 && player(s).boardYours > 3 ? 2.5 : 0),
  cooldown: 32,
  choices: [
    {
      id: 'resist',
      label: 'Fight the motion',
      detail: () => 'charisma gamble: the motion dies — or discontent +18',
      apply: (s) => {
        if (charismaRoll(s, 0.5)) return 'You worked the phones all weekend. The motion died in committee, 5–4.';
        player(s).discontent = clamp(player(s).discontent + 18, 0, 100);
        return 'You fought it and lost the room doing it. The motion failed, but the board now treats you as the problem.';
      },
    },
    {
      id: 'concede',
      label: 'Let the seat go',
      detail: () => 'your seats −1 · discontent −10',
      apply: (s) => {
        const p = player(s);
        p.boardYours -= 1;
        p.boardInvestors += 1;
        p.discontent = clamp(p.discontent - 10, 0, 100);
        return 'Your ally cleaned out their desk. The new director sends long emails with the word "fiduciary" in them.';
      },
    },
  ],
};

const boardNoConfidenceEvent: EventDef = {
  id: 'board-no-confidence',
  title: 'Vote of no confidence',
  body: (s) => `It's on the agenda, item one: a vote of no confidence in the CEO. You hold ${player(s).boardYours} of 9 seats and discontent is ${Math.round(player(s).discontent)}. Time to give the speech of your life.`,
  weight: (s) => (player(s).discontent > 60 && player(s).boardYours <= 4 ? 3.5 : 0),
  cooldown: 20,
  choices: [
    {
      id: 'face',
      label: 'Face the vote',
      detail: () => 'charisma gamble: flip a seat to you, discontent −12 — or lose a seat, discontent +15',
      apply: (s) => {
        const p = player(s);
        if (charismaRoll(s, 0.5)) {
          if (p.boardInvestors > 0) {
            p.boardYours += 1;
            p.boardInvestors -= 1;
          }
          p.discontent = clamp(p.discontent - 12, 0, 100);
          return 'You survived it — and one investor director liked the speech enough to switch sides.';
        }
        if (p.boardYours > 0) {
          p.boardYours -= 1;
          p.boardInvestors += 1;
        }
        p.discontent = clamp(p.discontent + 15, 0, 100);
        return 'You survived the vote by one. A wavering ally defected mid-meeting, and everyone saw it.';
      },
    },
  ],
};

const boardRemovalEvent: EventDef = {
  id: 'board-removal',
  title: 'The board moves to remove you',
  body: (s) => `Security is already in the lobby. With ${player(s).boardYours} of 9 seats and discontent at ${Math.round(player(s).discontent)}, the outcome was arithmetic. The vote is a formality, and so are you.`,
  weight: (s) => (player(s).discontent > 80 && player(s).boardYours <= 3 ? 6 : 0),
  cooldown: 8,
  choices: [
    {
      id: 'end',
      label: 'Attend your last board meeting',
      detail: () => 'game over',
      apply: (s) => {
        s.gameOver = {
          result: 'loss',
          reason: 'voted-out',
          title: 'The board votes you out',
          body: `The investor bloc finally moved, ${9 - player(s).boardYours} votes to ${player(s).boardYours}. Security walks you out past the model vault. The new CEO's first memo is about "returning to fundamentals".`,
          week: s.week,
        };
        s.pendingEvents = [];
        return 'The board has removed you.';
      },
    },
  ],
};

// ------------------------------------------------------------------ public
// Public events are gated on public trust: the lower it sits, the nastier the
// draw — bad press → campaigns → lawsuits/leaks → firebombing → political
// capture. Damage-control gambles run on your CEO's charisma.

const badPressEvent: EventDef = {
  id: 'bad-press',
  title: 'A bad story is about to run',
  body: (_s, d) => `${d.flavor as string} The reporter gave you 48 hours to comment.`,
  weight: (s) => (player(s).publicTrust < 50 ? 1.8 : 0),
  cooldown: 20,
  setup: (s) => ({
    flavor: pick(s.rng, [
      'A magazine has your contractors-in-the-eval-mines exposé: screenshots, pay stubs, the works.',
      'A reporter has internal Slack logs where your staff joke about "shipping it anyway".',
      'A documentary crew spent three months with families who say your model cost them their jobs.',
    ]),
  }),
  choices: [
    {
      id: 'nothing',
      label: 'Let it run',
      detail: () => 'public trust −4 · adoption −0.5',
      apply: (s) => {
        const p = player(s);
        p.publicTrust = clamp100(p.publicTrust - 4);
        s.world.adoption = clamp100(s.world.adoption - 0.5);
        return 'The story ran, trended for a day, and joined the pile. The pile is getting tall.';
      },
    },
    {
      id: 'bury',
      label: 'Bury the story',
      detail: () => 'charisma gamble: it dies quietly — or the burial leaks: public trust −9, adoption −1',
      apply: (s) => {
        const p = player(s);
        if (charismaRoll(s, 0.55)) return 'A well-placed call, a competing exclusive, a Friday news dump. The story died before lunch.';
        p.publicTrust = clamp100(p.publicTrust - 9);
        s.world.adoption = clamp100(s.world.adoption - 1);
        return 'The burial attempt became the story. "LAB TRIED TO KILL THIS PIECE" outperformed the piece.';
      },
    },
  ],
};

const organizedCampaignEvent: EventDef = {
  id: 'organized-campaign',
  title: 'An organized campaign against you',
  body: () => 'It has a name, a logo, a former employee as spokesperson and a media calendar. Coordinated op-eds, campus chapters, a pledge circulating at conferences: "I will not work for them."',
  weight: (s) => (player(s).publicTrust < 35 ? 2.5 : 0),
  cooldown: 24,
  choices: [
    {
      id: 'weather',
      label: 'Weather it',
      detail: () => 'public trust −4 · adoption −0.8 · the hiring pool cools for a while',
      apply: (s) => {
        const p = player(s);
        p.publicTrust = clamp100(p.publicTrust - 4);
        s.world.adoption = clamp100(s.world.adoption - 0.8);
        // researchers stop taking your calls — the star market goes quiet
        s.eventCooldowns['star-on-market'] = s.week + 8;
        return 'The campaign rolls on. Two candidates ghosted your recruiters this week, citing "the pledge".';
      },
    },
  ],
};

const classActionEvent: EventDef = {
  id: 'class-action',
  title: 'Class-action lawsuit certified',
  body: (_s, d) => `A court just certified the class: everyone whose ${d.flavor as string}. The plaintiffs' firm has billboards. Settle, or roll the dice at trial.`,
  weight: (s) => (player(s).publicTrust < 45 && s.world.adoption > 20 ? 1.8 : 0),
  cooldown: 30,
  setup: (s) => {
    const p = player(s);
    return {
      flavor: pick(s.rng, ['work product trained your model without consent', 'chatbot sessions were retained after deletion', 'job application was auto-rejected by your model']),
      settle: Math.min(Math.max(400, Math.round(p.weeklyRevenue * 3)), 2500),
    };
  },
  choices: [
    {
      id: 'settle',
      label: 'Settle',
      detail: (_s, d) => `−${fmtM(d.settle as number)} now, it goes away`,
      apply: (s, d) => {
        player(s).cash -= d.settle as number;
        return 'Settled without admission of wrongdoing. The billboards come down; the plaintiffs\' firm buys a boat.';
      },
    },
    {
      id: 'fight',
      label: 'Fight it in court',
      detail: (_s, d) => `charisma gamble: dismissed, public trust +4 — or lose: −${fmtM((d.settle as number) * 2.5)}, public trust −8`,
      apply: (s, d) => {
        const p = player(s);
        if (charismaRoll(s, 0.5)) {
          p.publicTrust = clamp100(p.publicTrust + 4);
          return 'Dismissed with prejudice. Your general counsel frames the ruling; the press calls you "vindicated".';
        }
        p.cash -= (d.settle as number) * 2.5;
        p.publicTrust = clamp100(p.publicTrust - 8);
        return 'The jury took four hours. The verdict is a number with a lot of zeros, and the appeal would take years you don\'t have.';
      },
    },
  ],
};

const insiderLeakEvent: EventDef = {
  id: 'insider-leak',
  title: 'An insider is about to blow the whistle',
  body: () => 'A senior researcher has documents showing your dangerous-capability evals were "sanitized" before the board saw them. They are talking to a journalist and a Senate staffer. You have days, maybe hours.',
  weight: (s) => (player(s).publicTrust < 40 || player(s).discontent > 45 ? 2 : 0),
  cooldown: 32,
  choices: [
    {
      id: 'nothing',
      label: 'Let it happen',
      detail: () => 'public trust −6 · govt trust −5',
      apply: (s) => {
        const p = player(s);
        p.publicTrust = clamp100(p.publicTrust - 6);
        p.govTrust = clamp100(p.govTrust - 5);
        return 'The story ran with your name in the headline and "sanitized" in quotes. Two agencies opened inquiries.';
      },
    },
    {
      id: 'intimidate',
      label: 'Lean on them',
      detail: () => 'charisma gamble: they reconsider — or it backfires: public trust −12, govt trust −10',
      apply: (s) => {
        const p = player(s);
        if (charismaRoll(s, 0.55)) return 'A quiet conversation about NDAs, equity vesting and "everyone\'s bright future". They reconsidered.';
        p.publicTrust = clamp100(p.publicTrust - 12);
        p.govTrust = clamp100(p.govTrust - 10);
        return 'They recorded the conversation. Now the story is the cover-up, the leak AND the intimidation — a trilogy.';
      },
    },
  ],
};

const dcFirebombEvent: EventDef = {
  id: 'dc-firebombing',
  title: 'Datacenter firebombed',
  body: () => 'At 3 AM, someone put incendiaries through the intake vents of your newest facility. A group calling itself "the Butlerians" claims credit, and half the internet is quietly cheering them on.',
  weight: (s) => (player(s).publicTrust < BAL.PUBLIC_TRUST_LOW ? 2.5 : 0),
  cooldown: 26,
  choices: [
    {
      id: 'ok',
      label: 'Assess the damage',
      detail: (s) => `lose ~4% of fleet (${Math.floor(player(s).chips * 0.04).toLocaleString()} chips)`,
      apply: (s) => {
        const p = player(s);
        const lost = Math.floor(p.chips * 0.04);
        p.chips -= lost;
        return `Arson confirmed: ${lost.toLocaleString()} chips destroyed. When the public hates you this much, some of them bring accelerants.`;
      },
    },
  ],
};

const politicalCaptureEvent: EventDef = {
  id: 'political-capture',
  title: 'The anti-AI caucus takes the gavel',
  body: (s) =>
    `With your public approval in the gutter, being against you is now good politics. ${player(s).country === 'us' ? 'The new subcommittee chair ran ads with your logo over ominous music.' : 'A Politburo member made "AI discipline" his signature issue.'} Hearings are scheduled; the fear is institutional now.`,
  weight: (s) => (player(s).publicTrust < 32 ? 2 : 0),
  cooldown: 40,
  choices: [
    {
      id: 'ok',
      label: 'Noted',
      detail: () => 'home govt risk fear +12',
      apply: (s) => {
        const g = s.govs[player(s).country];
        g.riskFear = clamp(g.riskFear + 12, BAL.FEAR_FLOOR, 100);
        return 'Public anger has become political machinery. The government now fears your models — because voters do.';
      },
    },
  ],
};

// ------------------------------------------------------------------ chips / world

const chipCrunchEvent: EventDef = {
  id: 'chip-crunch',
  title: 'Chip supply shock',
  body: (_s, d) => d.flavor as string,
  weight: () => 1.5,
  cooldown: 22,
  setup: (s) => ({
    flavor: pick(s.rng, [
      'A typhoon shut two advanced packaging plants in Taiwan for a month.',
      'A fab contamination incident scrapped six weeks of wafer starts.',
      'A crypto-adjacent buyer just placed a rumored 200k-unit order.',
    ]),
  }),
  choices: [
    {
      id: 'ok',
      label: 'Noted',
      detail: () => 'chip backlog +150k · deliveries slower',
      apply: (s) => {
        s.world.backlog += 150_000;
        return 'Chip supply shock: prices and delivery times up.';
      },
    },
  ],
};

const newFabEvent: EventDef = {
  id: 'new-fab',
  title: 'New fab comes online',
  body: () => 'A long-promised fab is finally producing at volume. Supply loosens.',
  weight: (s) => (s.world.backlog > 300_000 ? 2 : 0.8),
  cooldown: 30,
  choices: [
    {
      id: 'ok',
      label: 'Good news',
      detail: () => 'chip backlog −200k',
      apply: (s) => {
        s.world.backlog = Math.max(0, s.world.backlog - 200_000);
        return 'New fab online — chip prices ease.';
      },
    },
  ],
};

const viralMomentEvent: EventDef = {
  id: 'viral-moment',
  title: (_s, d) => d.title as string,
  body: (_s, d) => d.body as string,
  weight: () => 1.2,
  cooldown: 20,
  setup: (s) =>
    pick(s.rng, [
      { title: 'Your model saves a life', body: 'A rural clinic used your model to catch a rare diagnosis. The thread has 40M views.', good: true },
      { title: 'Demo goes viral', body: 'Your agent booked, planned and catered an entire wedding. Adoption ticks up.', good: true },
      { title: 'Hallucination of the week', body: 'Your model confidently cited a Supreme Court case from 2031. In a real brief.', good: false },
    ]) as unknown as Record<string, unknown>,
  choices: [
    {
      id: 'ok',
      label: 'Noted',
      detail: (_s, d) => ((d.good as boolean) ? 'public trust +4 · adoption +1' : 'public trust −4'),
      apply: (s, d) => {
        const p = player(s);
        if (d.good as boolean) {
          p.publicTrust = clamp100(p.publicTrust + 4);
          s.world.adoption = clamp100(s.world.adoption + 1);
          return 'A very good week for the brand.';
        }
        p.publicTrust = clamp100(p.publicTrust - 4);
        return 'A very bad week for the brand.';
      },
    },
  ],
};

// ------------------------------------------------------------------ EU meme events

const euAiActEvent: EventDef = {
  id: 'eu-ai-act',
  title: 'EU AI Act: Annex XIV(b) applies to you',
  body: () =>
    'Brussels has determined your flagship is a "systemic-risk general-purpose model with transversal capabilities" under Annex XIV(b). Compliance requires a 340-page technical file, a fundamental-rights impact assessment, and a risk taxonomy in all 24 official languages.',
  weight: (s) => (cap(s) > 30 ? 1.5 : 0),
  cooldown: 45,
  choices: [
    {
      id: 'comply',
      label: 'Comply — hire the Brussels office',
      detail: () => 'nothing happens',
      apply: () => 'Your Annex XIV(b) technical file is now itself the size of a small model. Nothing else changes. The Maltese translation was praised.',
    },
    {
      id: 'exit',
      label: 'Ignore it',
      detail: () => 'also nothing happens',
      apply: () => 'Enforcement is delegated to a coordination subgroup that meets biannually. Brussels announces a €2.4B fund to build a European champion by 2034.',
    },
  ],
};

const euUsbCEvent: EventDef = {
  id: 'eu-usb-c',
  title: 'EU mandates USB-C on datacenters',
  body: () =>
    'The Radio Equipment Directive has been extended: all "compute delivery endpoints" must expose a universal charging port. Your lawyers believe this technically includes your H100 racks. Nobody is sure. The Commission is also unsure but confident.',
  weight: () => 0.8,
  cooldown: 60,
  once: true,
  choices: [
    {
      id: 'comply',
      label: 'Retrofit the racks',
      detail: () => 'nothing happens · the ports will never be used',
      apply: () => 'An intern installs one USB-C port on rack 7 and charges a phone off it. Compliance is declared achieved. Nothing changes.',
    },
    {
      id: 'contest',
      label: 'Contest it at the CJEU',
      detail: () => 'nothing happens · ruling expected 2034',
      apply: () => 'Case C-847/26 "TAKEOFF v. Commission" is now pending. Estimated resolution: after the singularity. Nothing changes.',
    },
  ],
};

const euGdprEvent: EventDef = {
  id: 'eu-gdpr-forget',
  title: 'GDPR erasure request: the model must forget Klaus',
  body: () =>
    'A German citizen has filed a Right to Erasure request covering "all weights, activations and vibes" pertaining to him. Your engineers point out this is not how any of this works. His lawyer disagrees, in writing, frequently.',
  weight: (s) => (cap(s) > 25 ? 1.2 : 0),
  cooldown: 50,
  choices: [
    {
      id: 'unlearn',
      label: 'Attempt machine unlearning',
      detail: () => 'nothing happens',
      apply: () => 'Klaus has been unlearned. For six hours the model believed Germany was "a type of cheese". Klaus is satisfied. Nothing changes.',
    },
    {
      id: 'fine',
      label: 'Refuse and take the fine',
      detail: () => 'the fine is €95.40 · nothing happens',
      apply: () => 'You paid the fine from petty cash. Klaus has printed it out and framed it.',
    },
  ],
};

const euCernEvent: EventDef = {
  id: 'eu-cern-ai',
  title: 'EU launches "CERN for AI"',
  body: () =>
    'The Commission has unveiled EuroMind: a €500M moonshot to build a sovereign European frontier lab by 2033. It will be headquartered in three cities simultaneously, and the compute tender specifies chips that are "ethical, explainable, and ideally from before 2020".',
  weight: () => 0.7,
  cooldown: 55,
  once: true,
  choices: [
    {
      id: 'welcome',
      label: 'Publicly welcome the effort',
      detail: () => 'costs nothing, means nothing, does nothing',
      apply: () => 'You tweeted "Competition makes us all better 🇪🇺". EuroMind\'s first deliverable is a 96-page governance framework.',
    },
    {
      id: 'poach',
      label: 'Quietly scout their steering committee',
      detail: () => 'nothing happens · there is no one to poach',
      apply: () => 'Due diligence reveals the steering committee consists of 41 policy generalists and one researcher, who is on sabbatical. You close the file.',
    },
  ],
};

const euCookieEvent: EventDef = {
  id: 'eu-cookie-chat',
  title: 'Chatbots must serve cookie banners',
  body: () =>
    'A new ePrivacy interpretation requires your model to obtain consent before every conversation, including consent about the consent dialog. Early tests show users click "Reject All" and then complain the model won\'t answer.',
  weight: (s) => (s.world.adoption > 25 ? 0.9 : 0),
  cooldown: 60,
  once: true,
  choices: [
    {
      id: 'comply',
      label: 'Ship the consent flow',
      detail: () => 'nothing happens',
      apply: () => 'Your model now begins every EU conversation with a 14-checkbox modal. Users click "Reject All" and keep chatting anyway. Nothing changes.',
    },
    {
      id: 'malicious',
      label: 'Malicious compliance: make the model read the banner aloud',
      detail: () => 'it goes viral · nothing happens',
      apply: () => 'The model performs the cookie banner as a dramatic monologue. 60M views. The Commission calls it "not in the spirit". Nothing changes.',
    },
  ],
};

// ------------------------------------------------------------------ govt ladder
// Escalating procurement offers from the HOME government, offered strictly in
// order and gated on govt trust. Rejecting an offer costs a little trust and
// freezes the whole ladder (including bonus offers) for GOV_RETRY_COOLDOWN,
// after which the same rung is offered again. Scheduled by rollGovLadder, not
// by the random-event dice.

interface OfferTuning {
  trust: number;
  chipFrac: number;
  minChips: number;
  maxChips: number;
  payMult: number;
  upfrontWeeks: number;
  cash: number;
  trustGain: number;
  trustLoss: number;
}

interface GovOfferSpec {
  id: string;
  /** core ladder index, or null for research-gated bonus offers */
  rung: number | null;
  tuning: () => OfferTuning;
  contractName: (us: boolean) => string;
  title: (us: boolean) => string;
  body: (s: GameState, d: Record<string, unknown>) => string;
  acceptLabel: string;
  rejectLabel: string;
  extraAcceptDetail?: string;
  onAccept?: (s: GameState) => void;
  acceptText: (us: boolean) => string;
  rejectText: (us: boolean) => string;
}

function govOffer(spec: GovOfferSpec): EventDef {
  return {
    id: spec.id,
    title: (s) => spec.title(player(s).country === 'us'),
    body: spec.body,
    weight: () => 0, // never fires from the random pool — scheduled by rollGovLadder
    setup: (s) => {
      const t = spec.tuning();
      const p = player(s);
      const chips = t.chipFrac > 0 ? Math.min(t.maxChips, Math.max(t.minChips, Math.round((p.chips * t.chipFrac) / 500) * 500)) : 0;
      const pay = Math.round(chips * BAL.CHIP_OPEX * t.payMult);
      return { chips, pay, upfront: pay * t.upfrontWeeks, cash: t.cash };
    },
    choices: [
      {
        id: 'accept',
        label: spec.acceptLabel,
        detail: (_s, d) => {
          const t = spec.tuning();
          const parts: string[] = [];
          if (d.cash as number) parts.push(`+${fmtM(d.cash as number)} now`);
          if (d.upfront as number) parts.push(`+${fmtM(d.upfront as number)} up front`);
          if (d.pay as number) parts.push(`+${fmtM(d.pay as number)}/wk forever`);
          if (d.chips as number) parts.push(`${(d.chips as number).toLocaleString()} chips locked permanently`);
          if (spec.extraAcceptDetail) parts.push(spec.extraAcceptDetail);
          parts.push(`govt trust +${t.trustGain}`);
          return parts.join(' · ');
        },
        apply: (s, d) => {
          const t = spec.tuning();
          const p = player(s);
          p.cash += (d.cash as number) + (d.upfront as number);
          if ((d.chips as number) > 0) {
            p.contracts.push({ id: `${spec.id}-${s.week}`, name: spec.contractName(p.country === 'us'), weeklyPay: d.pay as number, chips: d.chips as number, startedWeek: s.week });
            rebalanceAllocations(p);
          }
          p.govTrust = clamp100(p.govTrust + t.trustGain);
          if (spec.rung !== null) s.govLadder.rung = spec.rung + 1;
          else s.govLadder.done.push(spec.id);
          spec.onAccept?.(s);
          return spec.acceptText(p.country === 'us');
        },
      },
      {
        id: 'reject',
        label: spec.rejectLabel,
        detail: () => `govt trust −${spec.tuning().trustLoss} · no offers for a while — they will try this one again`,
        apply: (s) => {
          const p = player(s);
          p.govTrust = clamp100(p.govTrust - spec.tuning().trustLoss);
          s.govLadder.rejectedUntil = s.week + BAL.GOV_RETRY_COOLDOWN;
          return spec.rejectText(p.country === 'us');
        },
      },
    ],
  };
}

export const GOV_LADDER_EVENTS: EventDef[] = [
  govOffer({
    id: 'gov-eval-grant',
    rung: 0,
    tuning: () => BAL.GOV_LADDER[0],
    contractName: () => '',
    title: (us) => (us ? 'AISI evaluation grant' : 'CAC evaluation mandate'),
    body: (s, d) =>
      player(s).country === 'us'
        ? `The AI Safety Institute offers a ${fmtM(d.cash as number)} grant for structured evaluation access to your flagship. Small money — but this is how the government decides who it can do business with.`
        : `The Cyberspace Administration offers ${fmtM(d.cash as number)} to run its evaluation suite against your flagship. It is phrased as an offer.`,
    acceptLabel: 'Take the grant',
    rejectLabel: 'Decline',
    acceptText: (us) => (us ? 'The evals went fine. Somewhere in a federal building, a spreadsheet now lists you as "cooperative".' : 'The evaluators left satisfied. A door in Beijing is now ajar.'),
    rejectText: () => 'You declined the evaluation grant. The file on you now has its first entry.',
  }),
  govOffer({
    id: 'gov-pilot-contract',
    rung: 1,
    tuning: () => BAL.GOV_LADDER[1],
    contractName: (us) => (us ? 'GSA pilot contract' : 'Provincial pilot mandate'),
    title: (us) => (us ? 'Federal pilot contract' : 'Provincial pilot mandate'),
    body: (s, d) =>
      `${player(s).country === 'us' ? 'The GSA wants a pilot: your model working benefits paperwork in one federal agency' : 'Zhejiang province wants a pilot: your model working permit backlogs in one provincial office'}, on ${(d.chips as number).toLocaleString()} dedicated chips. ${fmtM(d.pay as number)}/wk plus ${fmtM(d.upfront as number)} up front. Deliver, and bigger doors open.`,
    acceptLabel: 'Sign the pilot',
    rejectLabel: 'Pass',
    acceptText: () => 'The pilot is live. Civil servants are quietly amazed; the procurement office is taking notes.',
    rejectText: () => 'You passed on the pilot. Procurement offices have long memories.',
  }),
  govOffer({
    id: 'gov-civilian-deployment',
    rung: 2,
    tuning: () => BAL.GOV_LADDER[2],
    contractName: (us) => (us ? 'Civilian agency deployment' : 'Provincial services deployment'),
    title: () => 'Civilian agency deployment',
    body: (s, d) =>
      `${player(s).country === 'us' ? 'The pilot delivered. Now the tax authority, the benefits agency and the immigration service all want in' : 'The pilot delivered. The State Council wants the rollout extended across provincial service bureaus'} — a standing deployment on ${(d.chips as number).toLocaleString()} chips for ${fmtM(d.pay as number)}/wk plus ${fmtM(d.upfront as number)} up front.`,
    acceptLabel: 'Sign the deployment',
    rejectLabel: 'Pass',
    acceptText: () => 'Your model now answers the phone for the government. Reliable money, and the relationship deepens.',
    rejectText: () => 'You passed. The agencies went back to their queues, and the government noted who let them.',
  }),
  govOffer({
    id: 'gov-classified-contract',
    rung: 3,
    tuning: () => BAL.GOV_LADDER[3],
    contractName: (us) => (us ? 'Classified IC contract' : 'MSS tasking order'),
    title: (us) => (us ? 'Classified contract: the IC wants in' : 'Classified tasking: the MSS wants in'),
    body: (s, d) =>
      `${player(s).country === 'us' ? 'The intelligence community wants your model on analysis workloads in a cleared facility' : 'The Ministry of State Security wants your model on analysis workloads in a secured facility'} — ${(d.chips as number).toLocaleString()} chips behind a fence you don't control, for ${fmtM(d.pay as number)}/wk plus ${fmtM(d.upfront as number)} up front. You will not be told what it reads.`,
    acceptLabel: 'Take the clearance',
    rejectLabel: 'Stay out of the classified world',
    acceptText: () => 'The cleared facility hums day and night. The checks clear. You try not to think about the queries.',
    rejectText: () => 'You stayed out. The security establishment does not forget being told no.',
  }),
  govOffer({
    id: 'gov-strategic-supplier',
    rung: 4,
    tuning: () => BAL.GOV_LADDER[4],
    contractName: (us) => (us ? 'Strategic supplier program' : 'National supplier program'),
    title: () => 'Strategic supplier designation',
    body: (s, d) =>
      `${player(s).country === 'us' ? 'The Pentagon wants you designated a strategic supplier: a standing, multi-agency compute commitment with a procurement fast lane' : 'The State Council wants you designated a national supplier: a standing compute mandate across ministries'} — ${(d.chips as number).toLocaleString()} chips, ${fmtM(d.pay as number)}/wk, ${fmtM(d.upfront as number)} up front. You would be infrastructure now.`,
    acceptLabel: 'Accept the designation',
    rejectLabel: 'Stay a vendor',
    acceptText: () => 'You are infrastructure now. The money is superb and the leash is real.',
    rejectText: () => 'You kept your independence. The designation went to the file marked "reconsider later".',
  }),
  govOffer({
    id: 'gov-sovereign-compute',
    rung: 5,
    tuning: () => BAL.GOV_LADDER[5],
    contractName: () => 'Sovereign compute operations',
    title: () => 'Sovereign compute buildout',
    body: (s, d) =>
      `${player(s).country === 'us' ? 'Congress funded it; they want you to build and run it' : 'The Five-Year Plan funds it; you are to build and run it'}: a national AI compute complex. ${fmtM(d.cash as number)} lands in your account and the fabs give you sovereign priority — but ${(d.chips as number).toLocaleString()} of your chips run government workloads, permanently.`,
    acceptLabel: 'Build it',
    rejectLabel: 'Refuse the buildout',
    extraAcceptDetail: 'chip prices −20% forever',
    onAccept: (s) => {
      player(s).sovereignCompute = true;
    },
    acceptText: () => 'Ground breaks within the month. Your buying power at the fabs is now a matter of national policy.',
    rejectText: () => 'You refused a national project with your name already on the press release. That stung, and they showed it.',
  }),
];

const T1_WARFARE = ['drone-swarms', 'sensor-fusion', 'electronic-warfare'];
const T1_BIO = ['protein-structure', 'genomic-model', 'molecular-property'];
const hasAll = (lab: Lab, ids: string[]) => ids.every((id) => lab.research.completed.includes(id));

const sectorMegadealEvent = govOffer({
  id: 'gov-sector-megadeal',
  rung: null,
  tuning: () => ({ ...BAL.GOV_MEGADEAL, cash: 0 }),
  contractName: (us) => (us ? 'Sector megadeal' : 'Sector mandate'),
  title: () => 'Sector megadeal',
  body: (s, d) => {
    const war = hasAll(player(s), T1_WARFARE);
    return `Your ${war ? 'defense portfolio has every service branch lining up' : 'biomedical portfolio has every health agency lining up'} — the government wants to consolidate it into one sector-wide deal: ${(d.chips as number).toLocaleString()} chips, ${fmtM(d.pay as number)}/wk, ${fmtM(d.upfront as number)} up front.`;
  },
  acceptLabel: 'Consolidate the sector',
  rejectLabel: 'Keep the deals separate',
  acceptText: () => 'One contract to rule the sector. Your account manager for the government is now a department.',
  rejectText: () => 'You kept the sector piecemeal. The consolidators will be back.',
});

const nationalChampionEvent = govOffer({
  id: 'gov-national-champion',
  rung: null,
  tuning: () => ({ ...BAL.GOV_CHAMPION, upfrontWeeks: 0 }),
  contractName: () => 'National champion program',
  title: () => 'National champion',
  body: (s, d) =>
    `${player(s).country === 'us' ? 'Washington' : 'Beijing'} has made its decision: you are the instrument of national strategy. The package: ${fmtM(d.cash as number)} and a contract your CFO keeps re-reading in disbelief — ${(d.chips as number).toLocaleString()} chips at ${fmtM(d.pay as number)}/wk. The other government is not amused.`,
  acceptLabel: 'Accept the mandate',
  rejectLabel: 'Decline the crown',
  onAccept: (s) => {
    const rivalGov = s.govs[player(s).country === 'us' ? 'prc' : 'us'];
    rivalGov.raceFear = 100;
  },
  acceptText: () => 'NATIONAL CHAMPION. The government has picked its horse: you. The rival government just moved to a war footing.',
  rejectText: () => 'You declined to be the chosen one. History rarely offers that twice.',
});

/** Bonus offers: research-gated, fire out of ladder order, once each. */
const GOV_BONUS_OFFERS: { def: EventDef; trust: number; unlocked: (lab: Lab) => boolean }[] = [
  { def: nationalChampionEvent, trust: BAL.GOV_CHAMPION.trust, unlocked: (lab) => lab.research.completed.includes('strategic-monopoly') },
  { def: sectorMegadealEvent, trust: BAL.GOV_MEGADEAL.trust, unlocked: (lab) => hasAll(lab, T1_WARFARE) || hasAll(lab, T1_BIO) },
];

// ------------------------------------------------------------------ govt crackdown
// Fires instead of offers while govt trust sits below GOV_CRACKDOWN_TRUST,
// escalating one step at a time toward nationalization. Recovering trust above
// GOV_CRACKDOWN_RESET resets the escalation.

export const GOV_CRACKDOWN_EVENTS: EventDef[] = [
  {
    id: 'gov-hearing',
    title: (s) => (player(s).country === 'us' ? 'Summoned: public hearing' : 'Summoned: closed session'),
    body: (s) =>
      `Government trust is ${Math.round(player(s).govTrust)}. ${player(s).country === 'us' ? 'A Senate subcommittee wants you under oath, on camera,' : 'The CAC "invites" you to a closed session'} to explain what your lab owes the country. Played right, this resets the relationship. Played wrong, it gets worse in public.`,
    weight: () => 0,
    choices: [
      {
        id: 'testify',
        label: 'Take the stand yourself',
        detail: () => `${Math.round(BAL.HEARING_WIN_CHANCE * 100)}%: govt trust +${BAL.HEARING_TRUST_GAIN} · otherwise govt trust −${BAL.HEARING_TRUST_LOSS}, public trust −${BAL.HEARING_PUBLIC_LOSS}`,
        apply: (s) => {
          const p = player(s);
          if (chance(s.rng, BAL.HEARING_WIN_CHANCE)) {
            p.govTrust = clamp100(p.govTrust + BAL.HEARING_TRUST_GAIN);
            return 'You were candid, prepared and human. The clip of you correcting the chairman politely went viral — in your favor.';
          }
          p.govTrust = clamp100(p.govTrust - BAL.HEARING_TRUST_LOSS);
          p.publicTrust = clamp100(p.publicTrust - BAL.HEARING_PUBLIC_LOSS);
          return 'It went badly. The freeze-frame of your face during question four is now a meme.';
        },
      },
      {
        id: 'lawyers',
        label: 'Send the lawyers',
        detail: () => 'govt trust −3 · no surprises',
        apply: (s) => {
          player(s).govTrust = clamp100(player(s).govTrust - 3);
          return 'Your counsel answered every question without answering anything. The committee noticed the empty chair.';
        },
      },
    ],
  },
  {
    id: 'gov-binding-regs',
    title: 'Binding compute regulations',
    body: (s) =>
      `${player(s).country === 'us' ? 'Congress passed it and the President signed it' : 'The State Council issued the directive'}: training runs on ${BAL.BINDING_REGS_CHIP_MIN.toLocaleString()}+ chips now require licensing, reporting and third-party monitoring. Your counsel reviewed all 600 pages and found no appeal — only compliance.`,
    weight: () => 0,
    choices: [
      {
        id: 'comply',
        label: 'Comply',
        detail: () => `runs on ≥${BAL.BINDING_REGS_CHIP_MIN.toLocaleString()} chips train ${Math.round(BAL.BINDING_REGS_SLOWDOWN * 100)}% slower — permanent`,
        apply: (s) => {
          player(s).bindingRegulations = true;
          return 'The compliance office is hiring. Your big training runs now move at the speed of paperwork.';
        },
      },
    ],
  },
  {
    id: 'gov-oversight',
    title: 'Embedded oversight',
    body: (s) =>
      `${player(s).country === 'us' ? 'A federal monitor team moves into your building this month' : 'A Party work team moves into your building this month'} — badge access, read access, veto meetings. The compliance apparatus they require comes out of your top line, indefinitely.`,
    weight: () => 0,
    choices: [
      {
        id: 'accept',
        label: 'Open the doors',
        detail: () => `revenue −${Math.round(BAL.OVERSIGHT_REVENUE_CUT * 100)}% ongoing`,
        apply: (s) => {
          player(s).oversightCut = BAL.OVERSIGHT_REVENUE_CUT;
          return 'The monitors have their own floor now. Every product decision routes through people who bill by the hour.';
        },
      },
    ],
  },
  {
    id: 'gov-requisition',
    title: 'Compute requisition',
    body: (s, d) =>
      `Under ${player(s).country === 'us' ? 'the Defense Production Act' : 'a national security directive'}, ${(d.chips as number).toLocaleString()} of your chips are hereby commandeered for government workloads. Compensation: a receipt.`,
    weight: () => 0,
    setup: (s) => {
      const p = player(s);
      return { chips: Math.max(500, Math.round((p.chips * BAL.REQUISITION_FRAC) / 500) * 500) };
    },
    choices: [
      {
        id: 'comply',
        label: 'Hand over the racks',
        detail: (_s, d) => `${(d.chips as number).toLocaleString()} chips locked · pays nothing`,
        apply: (s, d) => {
          const p = player(s);
          p.contracts.push({ id: `gov-requisition-${s.week}`, name: 'Requisitioned compute', weeklyPay: 0, chips: d.chips as number, startedWeek: s.week });
          rebalanceAllocations(p);
          return `${(d.chips as number).toLocaleString()} chips now run workloads you are not cleared to see, for free.`;
        },
      },
    ],
  },
  {
    id: 'gov-nationalization',
    title: (s) => (player(s).country === 'us' ? 'Nationalization: the DPA order' : 'Nationalization: state takeover'),
    body: (s) =>
      `${player(s).country === 'us' ? 'Federal marshals arrive with the signed order at 6 AM.' : 'The Party committee arrives before breakfast.'} Hearings, regulations, monitors, requisitions — every step was a warning. Years of burned trust end the only way they could.`,
    weight: () => 0,
    choices: [
      {
        id: 'end',
        label: 'It ends here',
        detail: () => 'game over',
        apply: (s) => {
          s.gameOver = {
            result: 'loss',
            reason: 'nationalized',
            title: player(s).country === 'us' ? 'Nationalized under the DPA' : 'Nationalized by the state',
            body: 'The government spent years telling you exactly what it wanted and you kept saying no. Now it runs your lab, and you get a lanyard that no longer opens the model vault.',
            week: s.week,
          };
          s.pendingEvents = [];
          return 'The government has taken the keys.';
        },
      },
    ],
  },
];

export const GOV_EVENTS: EventDef[] = [...GOV_LADDER_EVENTS, ...GOV_BONUS_OFFERS.map((b) => b.def), ...GOV_CRACKDOWN_EVENTS];

export const EVENTS: EventDef[] = [
  // people
  newStarEvent,
  rivalPoachEvent,
  execCandidateEvent,
  // board (escalating with discontent × investor seats)
  boardQuestionsEvent,
  boardResolutionEvent,
  boardHostileCooEvent,
  boardRealignmentEvent,
  boardNoConfidenceEvent,
  boardRemovalEvent,
  // public (escalating as public trust falls)
  badPressEvent,
  organizedCampaignEvent,
  classActionEvent,
  insiderLeakEvent,
  dcFirebombEvent,
  politicalCaptureEvent,
  // world
  chipCrunchEvent,
  newFabEvent,
  viralMomentEvent,
  // EU
  euAiActEvent,
  euUsbCEvent,
  euGdprEvent,
  euCernEvent,
  euCookieEvent,
];

export const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries([...EVENTS, ...GOV_EVENTS].map((e) => [e.id, e]));

function materializeEvent(state: GameState, def: EventDef): ActiveEvent {
  const data = def.setup ? def.setup(state) : {};
  return {
    eventId: def.id,
    week: state.week,
    title: typeof def.title === 'function' ? def.title(state, data) : def.title,
    body: def.body(state, data),
    choices: def.choices.map((c) => ({ id: c.id, label: c.label, detail: c.detail(state, data) })),
    data,
  };
}

/** Roll the weekly event dice; returns a materialized blocking event or null. */
export function rollEvent(state: GameState): ActiveEvent | null {
  const baseChance = Math.min(BAL.EVENT_CHANCE_MAX, BAL.EVENT_BASE_CHANCE + BAL.EVENT_CHANCE_PER_WEEK * state.week) + state.weeksSinceEvent * BAL.EVENT_DROUGHT_BOOST;
  if (!chance(state.rng, baseChance)) {
    state.weeksSinceEvent += 1;
    return null;
  }
  const candidates = EVENTS.filter((e) => {
    const last = state.eventCooldowns[e.id];
    if (last !== undefined && e.once) return false;
    if (last !== undefined && state.week - last < (e.cooldown ?? BAL.EVENT_COOLDOWN)) return false;
    return e.weight(state) > 0;
  });
  if (candidates.length === 0) {
    state.weeksSinceEvent += 1;
    return null;
  }
  const def = pickWeighted(state.rng, candidates, candidates.map((e) => e.weight(state)));
  state.eventCooldowns[def.id] = state.week;
  state.weeksSinceEvent = 0;
  return materializeEvent(state, def);
}

/**
 * Weekly govt-ladder check: at most one govt event per GOV_EVENT_MIN_GAP.
 * Crackdown steps escalate while trust is below GOV_CRACKDOWN_TRUST; otherwise
 * the next eligible offer (bonus first, then the core ladder rung) may land.
 */
export function rollGovLadder(state: GameState): ActiveEvent | null {
  const g = state.govLadder;
  const p = player(state);
  if (!p.alive) return null;
  if (p.govTrust >= BAL.GOV_CRACKDOWN_RESET) g.crackdown = 0; // redemption resets the escalation
  if (g.lastWeek > 0 && state.week - g.lastWeek < BAL.GOV_EVENT_MIN_GAP) return null;

  // crackdown escalates while trust is low — a rejection cooldown doesn't shield you
  if (p.govTrust < BAL.GOV_CRACKDOWN_TRUST && g.crackdown < GOV_CRACKDOWN_EVENTS.length) {
    if (!chance(state.rng, BAL.GOV_CRACKDOWN_CHANCE)) return null;
    const def = GOV_CRACKDOWN_EVENTS[g.crackdown];
    g.crackdown += 1;
    g.lastWeek = state.week;
    return materializeEvent(state, def);
  }

  // a rejected offer freezes the ladder — no offers, no higher rungs
  if (state.week < g.rejectedUntil) return null;

  // research-gated bonus offers take priority over the core ladder
  for (const bonus of GOV_BONUS_OFFERS) {
    if (g.done.includes(bonus.def.id)) continue;
    if (p.govTrust < bonus.trust || !bonus.unlocked(p)) continue;
    if (!chance(state.rng, BAL.GOV_OFFER_CHANCE)) return null;
    g.lastWeek = state.week;
    return materializeEvent(state, bonus.def);
  }

  // next core rung
  if (g.rung >= GOV_LADDER_EVENTS.length) return null;
  const t = BAL.GOV_LADDER[g.rung];
  if (state.week < t.week || p.govTrust < t.trust) return null;
  // the evaluation grant is the deterministic opener; later rungs land probabilistically
  if (g.rung > 0 && !chance(state.rng, BAL.GOV_OFFER_CHANCE)) return null;
  g.lastWeek = state.week;
  return materializeEvent(state, GOV_LADDER_EVENTS[g.rung]);
}

/** Apply the player's chosen resolution; returns feed text. */
export function resolveEvent(state: GameState, event: ActiveEvent, choiceId: string): string {
  const def = EVENTS_BY_ID[event.eventId];
  if (!def) return 'Event expired.';
  const choice = def.choices.find((c) => c.id === choiceId) ?? def.choices[0];
  return choice.apply(state, event.data);
}
