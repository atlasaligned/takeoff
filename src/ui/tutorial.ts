import { BAL } from '../engine/balance';
import type { GameState, Lab } from '../engine/types';
import type { TabId } from './useGame';

/**
 * The guided tutorial script. Each step routes the player to a tab, unlocks
 * (and highlights) exactly the controls tagged with the step's `allow`
 * selectors, and auto-advances when `done` sees the action land in GameState.
 * Steps without `done` advance via the dock's Next button.
 */
export interface TutorialStep {
  id: string;
  /** dock headline */
  title: string;
  /** advisor prose — what the mechanic is and why it matters */
  body: string;
  /** tab this step happens on; until the player is there, only that nav button is clickable */
  tab: TabId;
  /** imperative TASK line shown under the prose */
  task?: string;
  /** CSS selectors re-enabled and highlighted once the player is on the tab */
  allow?: string[];
  /** auto-advance predicate, checked after every mutation; omit for Next-button steps */
  done?: (st: GameState, ui: { speed: number; enteredWeek: number }) => boolean;
  /** force the clock back to 0 when the step starts */
  pauseOnEnter?: boolean;
}

const player = (st: GameState): Lab => st.labs[st.playerLab];

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to the corner office',
    body:
      'You run Entropic. Whoever reaches capability 100 first rolls the dice on their model’s TRUE alignment — save the world or end it. The only other exit is talking every government into a verified Global Pause. The clock is stopped and the board wired you $25B to learn the controls: I’ll point, you click. Up top: the frontier meter, your cash and runway, and the race standings.',
    tab: 'overview',
  },
  {
    id: 'post-train',
    title: 'Tune the flagship',
    body:
      'This is your flagship — the model you serve. Its capability is public; its TRUE alignment is hidden somewhere in that green band, and not necessarily in the middle. Post-training is the cheap lever: a few weeks, a little capability, alignment and robustness.',
    tab: 'models',
    task: 'Start post-training (flagship panel, left).',
    allow: ['[data-tut="panel-flagship"]'],
    done: (st) => player(st).postTraining !== null,
  },
  {
    id: 'train-run',
    title: 'Scale is the loud lever',
    body:
      'Training runs turn compute into capability — log-like, so each extra point costs roughly 10× more. Committed chips are locked until the run finishes and the cash is gone up front. Around 8,000 chips for 24 weeks is a sensible first run; watch the estimated capability while you drag.',
    tab: 'models',
    task: 'Set the sliders and start a training run (right panel).',
    allow: ['[data-tut="panel-train"]'],
    done: (st) => player(st).run !== null,
  },
  {
    id: 'alloc',
    title: 'Where the chips point',
    body:
      'One slider splits your free chips between inference (serves customers — that’s revenue) and alignment (the only thing that raises TRUE alignment and narrows the band). Alignment chips earn nothing, which is exactly why your rivals skimp on them. Don’t.',
    tab: 'compute',
    task: 'Drag alignment compute to at least 3,000 chips.',
    allow: ['[data-tut="alloc-align"]'],
    done: (st) => {
      const a = player(st).alloc;
      const free = a.inference + a.alignment;
      return a.alignment >= Math.min(3000, free);
    },
  },
  {
    id: 'buy-chips',
    title: 'More silicon',
    body:
      'Chips are paid up front and arrive weeks later — your order joins the same global backlog as everyone else’s, pushing prices and delivery times up. Fleets age, too: efficiency decays weekly and fresh silicon refreshes the average.',
    tab: 'compute',
    task: 'Place a chip order.',
    allow: ['[data-tut="panel-buychips"]'],
    done: (st) => player(st).chipOrders.length > 0,
  },
  {
    id: 'research',
    title: 'Compounding, five flavors',
    body:
      'Five branches. Capabilities and Biology print money and speed; Alignment keeps your success survivable; Warfare buys government love and global fear. Red-iconed nodes have teeth — read them twice. Evaluations & Red-Teaming is the classic first buy: it narrows the alignment band and hardens the model.',
    tab: 'research',
    task: 'Select a node and begin research.',
    allow: ['[data-tut="research-root"]'],
    done: (st) => player(st).research.active.length > 0,
  },
  {
    id: 'diplomacy',
    title: 'The other way to win',
    body:
      'The treaty track ends at the Global AI Pause — a full win, no capability-100 roulette. Treaty gates open on government risk fear, and frontrunner labs refuse to sign; the odds panel is honest about it. Small actions nudge the fear dials in between.',
    tab: 'diplomacy',
    task: 'Use one small action (below the treaty tree).',
    allow: ['[data-tut="panel-smallactions"]'],
    done: (st) => Object.keys(st.diplomacy.cooldowns).length > 0,
  },
  {
    id: 'people',
    title: 'Warm bodies, board seats',
    body:
      'C-suite bonuses run passively; vacancies fill through events. Star researchers carry percentage bonuses and can be poached — headhunters bill win or lose. And mind the board panel: raises cost seats, discontent stacks, and enough of both ends with your name off the door.',
    tab: 'people',
    task: 'Browse the roster and the board panel, then continue.',
  },
  {
    id: 'finance',
    title: 'The money loop',
    body:
      'License price trades seats for margin — demand follows your capability lead, world adoption, and the price. When cash runs low you raise: LARGE costs a board seat, SMALL sets a revenue target that punishes a miss, and the EMERGENCY round is how desperate founders get diluted.',
    tab: 'finance',
    task: 'Drag the license price and watch demand react.',
    allow: ['[data-tut="panel-pricing"]'],
    done: (st) => player(st).licensePrice !== BAL.DEFAULT_LICENSE_PRICE,
  },
  {
    id: 'time',
    title: 'Let it run',
    body:
      'Everything ticks weekly — revenue, research, training, and three rival labs with plans of their own. Status reports pause the clock until acknowledged; blocking events stop the world until you decide. Let three weeks run and watch the numbers move.',
    tab: 'overview',
    task: 'Unpause the clock — press 1× (top of the screen).',
    allow: ['[data-tut="speed"]'],
    done: (st, ui) => st.week >= ui.enteredWeek + 3,
  },
  {
    id: 'wrap',
    title: 'Flight checks complete',
    body:
      'That was every control: tune it, scale it, aim the chips, compound the research, work the treaties, feed the board. Win by crossing 100 with TRUE alignment on your side — or by pausing the world before anyone gets there. Everything else is a way to lose. The real race starts from the menu.',
    tab: 'overview',
    pauseOnEnter: true,
  },
];
