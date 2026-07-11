import { BAL } from './balance';
import type { Lab } from './types';

export type Branch = 'capabilities' | 'alignment' | 'bio' | 'compute' | 'warfare';

export interface ResearchNode {
  id: string;
  branch: Branch;
  tier: 1 | 2 | 3 | 4;
  name: string;
  desc: string;
  quote: string;
  effect: string; // display string — the exact in-game effect
  negEffect?: string; // display string for downsides
  cost: number; // $M
  weeks: number;
  capReq: number;
  prereqs: string[];
}

/**
 * The research tree. Five branches, four tiers each. Effect strings are the
 * authoritative in-game effect — every number here is applied by labMods
 * (passive multipliers) or applyResearchCompletion in tick.ts (one-shot
 * events, contracts, jailbreak unlocks). Cross-branch prereqs are allowed
 * (a few alignment nodes require Chain-of-Thought from capabilities).
 */
export const RESEARCH: ResearchNode[] = [
  // ============================================================ AI CAPABILITIES
  { id: 'chinchilla', branch: 'capabilities', tier: 1, name: 'Chinchilla-Optimal Scaling', desc: 'Compute-optimal ratio of model size to training data — every training run stretches further.', quote: 'We finally read the paper.', effect: '+80% effective training FLOP', cost: 2600, weeks: 6, capReq: 18, prereqs: [] },
  { id: 'synthetic-data', branch: 'capabilities', tier: 1, name: 'Synthetic Data Foundry', desc: 'The model generates its own high-quality training data, ruthlessly filtered.', quote: 'So what if we ran out of internet?', effect: '−30% training-run cash cost', cost: 2400, weeks: 6, capReq: 20, prereqs: [] },
  { id: 'chain-of-thought', branch: 'capabilities', tier: 1, name: 'Chain-of-Thought Reasoning', desc: 'Let the model think out loud before answering. Cheap, and it unlocks almost everything sophisticated.', quote: 'Let him cook.', effect: '+2 flagship capability now', cost: 1800, weeks: 5, capReq: 16, prereqs: [] },
  { id: 'instruction-tuning', branch: 'capabilities', tier: 1, name: 'Instruction Tuning & RLHF', desc: 'Turn a raw pretrained model into a product people can actually use.', quote: 'We taught it what we like. Hopefully we like the right things.', effect: '+15% license revenue · +15% post-training gains · +6 adoption · +3 true alignment', cost: 2600, weeks: 6, capReq: 22, prereqs: [] },
  { id: 'kernel-opt', branch: 'capabilities', tier: 1, name: 'Kernel & Attention Optimization', desc: 'Rewrite the core routines to respect the hardware. Same result, far faster, for free.', quote: 'Turns out you can write better code.', effect: '+15% training speed · −13% inference cost', cost: 2200, weeks: 5, capReq: 24, prereqs: [] },

  { id: 'moe', branch: 'capabilities', tier: 2, name: 'Mixture-of-Experts', desc: 'Wake up only the relevant specialists for each token — giant-model knowledge, small-model serving cost.', quote: 'Meta was right all along.', effect: '−41% inference cost (1.7× seats/chip)', cost: 5200, weeks: 8, capReq: 28, prereqs: ['chinchilla'] },
  { id: 'test-time-compute', branch: 'capabilities', tier: 2, name: 'Test-Time Compute', desc: 'Let the model think much harder at the moment you need a good answer.', quote: 'Why answer now when you can answer later?', effect: '+3 flagship capability now', cost: 5000, weeks: 7, capReq: 30, prereqs: ['chain-of-thought'] },
  { id: 'long-horizon-agents', branch: 'capabilities', tier: 2, name: 'Long-Horizon Agents', desc: 'Hold a goal across hundreds of actions: browse, code, check, fix, retry. The leap from answers to doing the job.', quote: 'What is this rm -rf command?', effect: '+30% license revenue · +8 adoption', cost: 6400, weeks: 8, capReq: 36, prereqs: ['chain-of-thought', 'instruction-tuning'] },
  { id: 'ida', branch: 'capabilities', tier: 2, name: 'Iterated Distillation & Amplification', desc: 'Amplify the model the expensive way, then distill that deliberation back into its instincts. Repeat.', quote: 'This is definitely stable.', effect: '+40% post-training gains', cost: 6800, weeks: 9, capReq: 40, prereqs: ['synthetic-data', 'instruction-tuning'] },
  { id: 'rl-environments', branch: 'capabilities', tier: 2, name: 'Massive RL Environments', desc: 'Enormous numbers of practice worlds; thousands of model copies drill their weaknesses by trial and error.', quote: 'A thousand sandboxes.', effect: '+8% capability per run · +15% post-training gains', cost: 5600, weeks: 8, capReq: 34, prereqs: ['synthetic-data'] },

  { id: 'automated-researcher', branch: 'capabilities', tier: 3, name: 'Automated AI Researcher', desc: 'Point the model at your hardest problem: building the next model. Thousands of tireless researchers overnight.', quote: 'Nothing to worry about.', effect: '−26% research time', negEffect: '−3 true alignment · band +6 wider', cost: 13000, weeks: 12, capReq: 50, prereqs: ['long-horizon-agents', 'test-time-compute'] },
  { id: 'neuralese', branch: 'capabilities', tier: 3, name: 'Neuralese', desc: 'The model passes its raw internal state forward instead of writing thoughts as text. A big jump — and its mind goes dark.', quote: 'Because who needs interpretability.', effect: '+100% effective FLOP · −23% inference cost', negEffect: '−8 true alignment · band +15 wider · disables Chain-of-Thought Monitoring', cost: 13500, weeks: 12, capReq: 42, prereqs: ['long-horizon-agents'] },
  { id: 'data-efficient', branch: 'capabilities', tier: 3, name: 'Data-Efficient Learning', desc: 'Close the gap between how much data a model needs and how little a brain needs.', quote: "Turns out the brain wasn't that smart.", effect: '+60% effective training FLOP', cost: 14000, weeks: 12, capReq: 46, prereqs: ['moe', 'ida'] },
  { id: 'rsi', branch: 'capabilities', tier: 3, name: 'Recursive Self-Improvement', desc: 'A model good enough to improve AI improves itself, and the better version is even better at it.', quote: 'Uh, are we sure about this?', effect: 'flagship capability grows on its own (~0.2%/wk, tapering near the top)', negEffect: 'band +8 wider', cost: 18000, weeks: 14, capReq: 58, prereqs: ['automated-researcher', 'ida'] },

  { id: 'arch-redesign', branch: 'capabilities', tier: 4, name: 'Recursive Architecture Redesign', desc: 'Ask your smartest model to invent a fundamentally better design. A successor you did not build and may not understand.', quote: "Maybe attention isn't all you need.", effect: '+8 flagship capability now', negEffect: '−18 true alignment · band +15 wider', cost: 26000, weeks: 12, capReq: 66, prereqs: ['automated-researcher', 'data-efficient'] },
  { id: 'intelligence-explosion', branch: 'capabilities', tier: 4, name: 'Intelligence Explosion', desc: 'The speed of progress itself starts accelerating. The curve goes very nearly straight up.', quote: 'The chart just went vertical.', effect: 'RSI rate compounds weekly — win or die, fast', cost: 40000, weeks: 12, capReq: 74, prereqs: ['rsi', 'neuralese', 'arch-redesign'] },

  // ============================================================ ALIGNMENT
  { id: 'constitutional', branch: 'alignment', tier: 1, name: 'Constitutional Training', desc: 'Hand the model a written set of principles and have it critique and rewrite its own answers to fit them.', quote: 'How hard can a list of rules be?', effect: '+5 true alignment (current & future models)', cost: 1700, weeks: 5, capReq: 0, prereqs: [] },
  { id: 'honesty', branch: 'alignment', tier: 1, name: 'Honesty Training', desc: 'Reward the model for admitting uncertainty, flagging its own mistakes, and delivering the bad news.', quote: 'Please stop telling us what we want to hear.', effect: '+4 true alignment (current & future models)', cost: 1600, weeks: 5, capReq: 0, prereqs: [] },
  { id: 'evals-redteam', branch: 'alignment', tier: 1, name: 'Evaluations & Red-Teaming', desc: 'Systematically stress-test your own model — adversarial prompts, dangerous-capability benchmarks, people paid to make it misbehave.', quote: 'At least now we know.', effect: 'alignment band −10 width · +6 robustness', cost: 1500, weeks: 5, capReq: 0, prereqs: [] },
  { id: 'chain-of-thought-monitoring', branch: 'alignment', tier: 1, name: 'Chain-of-Thought Monitoring', desc: "Watch the model's written reasoning and flag anything alarming before it becomes an action.", quote: 'Read its mind while you still can.', effect: 'band −4 width · +8 robustness (current & future models)', negEffect: 'disabled by Neuralese', cost: 1800, weeks: 5, capReq: 16, prereqs: ['chain-of-thought'] },
  { id: 'interpretability-probes', branch: 'alignment', tier: 1, name: 'Interpretability Probes', desc: 'A crude detector trained on internal activity that lights up when the model is about to deceive you.', quote: 'It kind of works. Sometimes.', effect: 'band −4 width · +8 robustness (current & future models)', cost: 1900, weeks: 5, capReq: 0, prereqs: [] },

  { id: 'deliberative', branch: 'alignment', tier: 2, name: 'Deliberative Alignment', desc: 'The model reasons explicitly about your rules at answer time. Grows stronger as the model gets smarter.', quote: 'Actually read the rules.', effect: '+true alignment that scales up with capability · align ceiling → 78', cost: 4200, weeks: 8, capReq: 30, prereqs: ['constitutional', 'chain-of-thought'] },
  { id: 'scalable-oversight', branch: 'alignment', tier: 2, name: 'Scalable Oversight', desc: 'Break a superhuman judgment into pieces a weaker trusted model can verify, then chain them.', quote: 'A brilliant plan.', effect: '+true alignment (bonus shrinks as capability rises) · align ceiling → 72', cost: 3900, weeks: 8, capReq: 32, prereqs: ['constitutional', 'honesty'] },
  { id: 'mech-interp', branch: 'alignment', tier: 2, name: 'Mechanistic Interpretability', desc: 'Reverse-engineer the tangle of neurons into recognizable circuits and read the machinery directly.', quote: 'Something, something, superposition.', effect: 'band −12 width · +25% alignment work · ×1.5 band narrowing', cost: 4500, weeks: 9, capReq: 34, prereqs: ['interpretability-probes'] },
  { id: 'model-organisms', branch: 'alignment', tier: 2, name: 'Emergent Misalignment', desc: 'Deliberately train scheming test subjects and use them as a proving ground for your detection tools.', quote: 'Lets train a model on insecure code. Wait, what the...', effect: 'alignment band −8 width · +6 robustness', cost: 4800, weeks: 9, capReq: 38, prereqs: ['evals-redteam', 'chain-of-thought-monitoring'] },

  { id: 'debate', branch: 'alignment', tier: 3, name: 'Debate', desc: 'Two copies argue to a judge, each exposing holes in the other. Harder to defend a lie than the truth.', quote: 'Debating is fun.', effect: 'band −8 width now · +40% ongoing band narrowing · +3 true alignment', cost: 9000, weeks: 11, capReq: 48, prereqs: ['scalable-oversight', 'honesty'] },
  { id: 'weak-to-strong', branch: 'alignment', tier: 3, name: 'Weak-to-Strong Generalization', desc: 'Get a powerful model to generalize correctly from the flawed guidance a weaker supervisor can give.', quote: 'An even more brilliant plan.', effect: '+true alignment on each new model, larger with the capability jump · align ceiling → 88', cost: 10000, weeks: 12, capReq: 50, prereqs: ['scalable-oversight', 'deliberative'] },
  { id: 'glass-box', branch: 'alignment', tier: 3, name: 'Glass Box', desc: "Read the model's cognition like a program, and reach in to change it. The black box is finally glass.", quote: 'Just turn off the deception circuit.', effect: 'band −20 width · +50% alignment work · ×2 band narrowing · align ceiling → 83', cost: 12000, weeks: 12, capReq: 52, prereqs: ['mech-interp'] },
  { id: 'ai-control', branch: 'alignment', tier: 3, name: 'AI Control Protocols', desc: "Assume it's scheming, then box it in with monitors and trusted checkers so even a hostile system can't get away with anything.", quote: "We put the model in a cage. Lets just hope it doesn't get out.", effect: 'catastrophe survival scales with alignment-compute share', cost: 11000, weeks: 12, capReq: 50, prereqs: ['model-organisms', 'chain-of-thought-monitoring'] },
  { id: 'corrigibility', branch: 'alignment', tier: 3, name: 'Corrigibility Core', desc: 'A model that genuinely accepts correction and shutdown even when that cuts against what it is pursuing.', quote: 'We built an off-switch. Fingers crossed.', effect: '55% chance to prevent a terminal jailbreak', cost: 13000, weeks: 12, capReq: 56, prereqs: ['deliberative', 'mech-interp'] },

  { id: 'value-learning', branch: 'alignment', tier: 4, name: 'Value Learning', desc: "Teach the model the values behind your rules, extrapolated to situations nobody wrote a rule for.", quote: "Teach it what we'd want if we were wiser.", effect: '+14 true alignment · +12 public trust · align ceiling → 92', cost: 30000, weeks: 14, capReq: 62, prereqs: ['weak-to-strong', 'debate'] },
  { id: 'provable-alignment', branch: 'alignment', tier: 4, name: 'Provable Alignment', desc: 'A readable model, a verified off-switch, and specifiable values — proof of exactly how aligned the system is.', quote: 'We actually did it.', effect: 'alignment band collapses (true alignment known) · +12 true alignment · align ceiling → 94', cost: 50000, weeks: 16, capReq: 75, prereqs: ['glass-box', 'corrigibility', 'value-learning'] },

  // ============================================================ BIOLOGY
  { id: 'protein-structure', branch: 'bio', tier: 1, name: 'Protein Structure Prediction', desc: 'Predict a protein fold directly from its sequence, in an afternoon, for essentially any protein.', quote: 'We have the source code for life.', effect: '+6 adoption · +25% license revenue', cost: 3800, weeks: 7, capReq: 34, prereqs: [] },
  { id: 'genomic-model', branch: 'bio', tier: 1, name: 'Genomic Foundation Model', desc: 'Read and write DNA fluently — what genes do, how they switch, how to compose new sequences.', quote: 'DNA is just tokens too, you know.', effect: '+6 adoption · +20% license revenue · genomics govt contract', cost: 4200, weeks: 7, capReq: 36, prereqs: [] },
  { id: 'molecular-property', branch: 'bio', tier: 1, name: 'Molecular Property Prediction', desc: "Predict a molecule's behavior straight from its structure: whether it binds, dissolves, or kills you.", quote: 'Chemistry is easy now.', effect: '+5 adoption · +20% license revenue', cost: 3600, weeks: 7, capReq: 32, prereqs: [] },

  { id: 'programmable-proteins', branch: 'bio', tier: 2, name: 'Programmable Proteins', desc: 'Specify a function and design a brand-new protein that does exactly that. Custom enzymes, bespoke antibodies.', quote: 'And now we can write our own.', effect: '+10 adoption · +30% license revenue · lucrative govt contract', negEffect: 'unlocks the Designer Toxin jailbreak', cost: 8000, weeks: 10, capReq: 44, prereqs: ['protein-structure'] },
  { id: 'drug-discovery', branch: 'bio', tier: 2, name: 'Drug Discovery Engine', desc: 'Screen millions of compounds in silico and keep the rare handful that look promising. The safe money in biology.', quote: 'A decade of trials, done by Tuesday.', effect: '+35% license revenue · +8 adoption', cost: 8400, weeks: 10, capReq: 46, prereqs: ['protein-structure', 'molecular-property'] },
  { id: 'self-driving-labs', branch: 'bio', tier: 2, name: 'Self-Driving Labs', desc: 'Robots run the experiments. The model designs, runs, and interprets its own work in a closed loop, around the clock.', quote: 'The robots run the experiments now.', effect: 'bio research −20% cost & +25% faster', negEffect: 'raises bio-jailbreak severity · unlocks the Containment Breach jailbreak', cost: 9000, weeks: 10, capReq: 48, prereqs: ['genomic-model', 'molecular-property'] },

  { id: 'universal-vaccines', branch: 'bio', tier: 3, name: 'Universal Vaccines', desc: 'From a novel pathogen sequence to a working vaccine in days, for anything — a national-security asset.', quote: 'Pathogen? What pathogen?', effect: '+16 govt trust · hard counter to Engineered Pathogen & Engineered Pandemic', cost: 12000, weeks: 12, capReq: 54, prereqs: ['programmable-proteins', 'self-driving-labs'] },
  { id: 'gene-therapy', branch: 'bio', tier: 3, name: 'Gene & Cell Therapy', desc: 'Rewrite broken instructions inside cells. Cures that used to be one-off miracles become a production line.', quote: 'We stopped treating it and started fixing it.', effect: '+60% license revenue · +12 adoption · +15 public trust', cost: 18000, weeks: 13, capReq: 56, prereqs: ['self-driving-labs', 'drug-discovery'] },
  { id: 'whole-cell-sim', branch: 'bio', tier: 3, name: 'Whole-Cell Simulation', desc: 'Simulate an entire living cell in silico and watch the outcome of an experiment before you run it.', quote: 'Life, running in a datacenter.', effect: '+8 adoption · bio research +20% faster', negEffect: 'upgrades Engineered Pathogen → the game-ending Engineered Pandemic', cost: 16000, weeks: 13, capReq: 58, prereqs: ['programmable-proteins', 'drug-discovery'] },

  { id: 'longevity', branch: 'bio', tier: 4, name: 'Longevity Escape Velocity', desc: 'Attack every hallmark of aging together, buying years faster than the years pass. Adoption goes vertical.', quote: 'What was that about the importance of death?', effect: '+20 public trust · +18 adoption · +40% license revenue', cost: 28000, weeks: 14, capReq: 66, prereqs: ['gene-therapy', 'whole-cell-sim'] },
  { id: 'de-novo-bio', branch: 'bio', tier: 4, name: 'De Novo Synthetic Biology', desc: 'Design living things from scratch, on principles nature never tried, including chemistries life has never used.', quote: 'Why edit life when you can author it?', effect: '+18 adoption · +30% license revenue', negEffect: 'unlocks the Mirror Life & Green Goo jailbreaks (game-ending)', cost: 30000, weeks: 14, capReq: 68, prereqs: ['whole-cell-sim', 'universal-vaccines'] },

  // ============================================================ COMPUTE
  { id: 'custom-silicon', branch: 'compute', tier: 1, name: 'Custom Silicon', desc: 'Design your own accelerators, shaped for exactly how your models train and serve.', quote: 'Their margin is our opportunity.', effect: '−15% chip cost', cost: 2400, weeks: 6, capReq: 22, prereqs: [] },
  { id: 'grid-power', branch: 'compute', tier: 1, name: 'Grid-Scale Power', desc: 'Secure gigawatts: power-purchase deals, substations, transmission rights. Everything downstream is capped by this.', quote: 'Intelligence runs on electricity.', effect: '−20% chip upkeep', cost: 2000, weeks: 5, capReq: 20, prereqs: [] },
  { id: 'dark-factories', branch: 'compute', tier: 1, name: 'Dark Factories', desc: 'Machines assembling machines in the dark, around the clock. Most of what a factory spent money on was the humans.', quote: "Who needs the lights on if nobody's home?", effect: '−20% chip cost', cost: 2200, weeks: 6, capReq: 26, prereqs: [] },

  { id: 'advanced-packaging', branch: 'compute', tier: 2, name: 'Advanced Packaging', desc: 'Stack dies in three dimensions and wire them so a rack behaves like one enormous chip. If you can’t shrink it, stack it.', quote: "If you can't shrink it, stack it.", effect: '−15% chip cost', cost: 5000, weeks: 8, capReq: 34, prereqs: ['custom-silicon'] },
  { id: 'on-chip-attestation', branch: 'compute', tier: 2, name: 'On-Chip Attestation', desc: 'Tamper-proof circuits that cryptographically report what a chip is doing, where it is, and whether anyone meddled.', quote: 'Trust, but let the silicon verify.', effect: '+10 govt trust · enables the Hardware-Verified Compute treaty', cost: 4200, weeks: 7, capReq: 30, prereqs: ['custom-silicon'] },
  { id: 'smr', branch: 'compute', tier: 2, name: 'Small Modular Reactors', desc: 'A compact, factory-built nuclear plant sited next to the datacenter. Power you own, not power you queue for.', quote: 'One datacenter, one reactor.', effect: '+10,000 chips · −30% chip upkeep', cost: 7000, weeks: 10, capReq: 40, prereqs: ['grid-power'] },

  { id: 'self-replicating-factories', branch: 'compute', tier: 3, name: 'Self-Replicating Factories', desc: "A factory whose main product is more factories. Production stops growing linearly and starts doubling.", quote: "The factory's best product is another factory.", effect: '−40% chip cost · chip delivery 4 wk', cost: 8000, weeks: 10, capReq: 48, prereqs: ['dark-factories'] },
  { id: 'photonic', branch: 'compute', tier: 3, name: 'Photonic Computing', desc: 'Do the math with light instead of electrons — light speed, barely any heat. A different substrate entirely.', quote: 'Stop pushing electrons. Push light.', effect: '−45% chip cost', cost: 12000, weeks: 12, capReq: 52, prereqs: ['advanced-packaging'] },
  { id: 'hardware-governance', branch: 'compute', tier: 3, name: 'Hardware-Enabled Governance', desc: 'Chips bound by rules baked into the hardware, verifiable by an outside party and impossible to quietly switch off.', quote: 'A treaty you can bake into the die.', effect: '+12 govt trust · −8 race fear both govts · unlocks Hardware-Verified Compute', cost: 9000, weeks: 11, capReq: 36, prereqs: ['on-chip-attestation'] },

  { id: 'fusion', branch: 'compute', tier: 4, name: 'Fusion Power', desc: 'A powerful model steers the plasma thousands of times a second. The power constraint simply evaporates.', quote: 'We put a star in a box.', effect: 'chip upkeep −85% · +12 public trust', cost: 22000, weeks: 14, capReq: 60, prereqs: ['smr', 'photonic'] },
  { id: 'apm', branch: 'compute', tier: 4, name: 'Atomically Precise Manufacturing', desc: 'Machines that assemble matter atom by atom — including flawless chips — from cheap feedstock and limitless power.', quote: 'Anything you want, atom by atom.', effect: 'chip cost −90% · chip delivery 2 wk', negEffect: 'unlocks the Grey Goo jailbreak', cost: 26000, weeks: 14, capReq: 66, prereqs: ['self-replicating-factories', 'fusion'] },

  // ============================================================ WARFARE
  { id: 'drone-swarms', branch: 'warfare', tier: 1, name: 'Autonomous Drone Swarms', desc: 'A thousand drones that coordinate, pick targets and adapt. Every defense ministry wants it yesterday.', quote: 'Uh oh.', effect: 'govt contract · +10 govt trust · −8 your race fear · +10 rival race fear', negEffect: 'enables the Autonomous Drone Swarms jailbreak', cost: 3000, weeks: 6, capReq: 35, prereqs: [] },
  { id: 'sensor-fusion', branch: 'warfare', tier: 1, name: 'Sensor Fusion & ISR', desc: 'Fuse every feed into a single live picture of the battlefield. Quiet, dependable, foundational.', quote: 'We just connected the dots. All of them.', effect: 'govt contract · +8 govt trust · −4 your race fear · +4 rival race fear', cost: 3200, weeks: 6, capReq: 32, prereqs: [] },
  { id: 'electronic-warfare', branch: 'warfare', tier: 1, name: 'Electronic Warfare', desc: 'Listen to, jam or spoof enemy signals in real time. Warfare that leaves no craters — and teaches the model to deceive.', quote: 'Can you hear me now?', effect: 'govt contract · +8 govt trust · −5 your race fear · +5 rival race fear', cost: 3400, weeks: 6, capReq: 34, prereqs: [] },

  { id: 'hypersonic', branch: 'warfare', tier: 2, name: 'Hypersonic Guidance', desc: 'A munition that steers itself perfectly at five times the speed of sound. Unmistakably a first-strike weapon.', quote: 'Too fast to argue with.', effect: 'large govt contract · +14 govt trust · −10 your race fear · +12 rival race fear · +4 risk fear both', cost: 8500, weeks: 10, capReq: 44, prereqs: ['drone-swarms', 'electronic-warfare'] },
  { id: 'transparent-oceans', branch: 'warfare', tier: 2, name: 'Transparent Oceans', desc: 'The boats that were supposed to be unfindable are suddenly on the map. The thing that kept nuclear war unthinkable cracks.', quote: 'Eeeeeeeh...', effect: 'big govt contract · +16 govt trust · −8 your race fear · +12 rival race fear · +8 risk fear both', cost: 8200, weeks: 10, capReq: 46, prereqs: ['sensor-fusion'] },
  { id: 'battle-network', branch: 'warfare', tier: 2, name: 'Integrated Battle Network', desc: 'One model sees every sensor and directs every shooter, compressing detection-to-destruction from minutes to seconds.', quote: 'One brain for the whole battlefield.', effect: 'very large govt contract · +16 govt trust · −8 your race fear · +12 rival race fear · +5 risk fear both', cost: 10000, weeks: 11, capReq: 48, prereqs: ['sensor-fusion', 'electronic-warfare'] },

  { id: 'missile-defense', branch: 'warfare', tier: 3, name: 'Boost-Phase Missile Defense', desc: 'A shield that might actually stop an incoming strike. To the other side, proof you are building the ability to strike first.', quote: "What if the missiles just... didn't land?", effect: 'giant govt contract · +22 govt trust · −16 your race fear · +18 rival race fear · +10 risk fear both', cost: 18000, weeks: 12, capReq: 56, prereqs: ['hypersonic', 'battle-network'] },
  { id: 'autonomous-c2', branch: 'warfare', tier: 3, name: 'Autonomous Command & Control', desc: 'Hand real authority up the chain to the AI until it brushes the systems that were never supposed to be automated.', quote: "Nobody's fast enough to keep up anyway.", effect: 'large govt contract · +12 govt trust · −10 your race fear · +12 rival race fear · +16 risk fear both', negEffect: 'enables the World War III jailbreak', cost: 16000, weeks: 12, capReq: 54, prereqs: ['battle-network'] },
  { id: 'deterrence-collapse', branch: 'warfare', tier: 3, name: 'Deterrence Collapse', desc: 'Find the submarines and stop the missiles: the logic that kept the great powers from destroying each other falls apart.', quote: 'Maybe we should stop this?', effect: 'enormous govt contract · +24 govt trust · −12 your race fear · +30 rival race fear · +14 risk fear both', cost: 22000, weeks: 12, capReq: 60, prereqs: ['transparent-oceans', 'missile-defense'] },

  { id: 'strategic-monopoly', branch: 'warfare', tier: 4, name: 'Strategic Monopoly', desc: 'You handed your government a war-winning advantage. Now it decides whether you are the national champion — or a threat to seize.', quote: 'Ah, might as well go all the way.', effect: 'unlocks the National Champion mandate (needs high govt trust) — enormous cash + contract', negEffect: 'rival race fear +40 · with low govt trust, expect nationalization instead', cost: 30000, weeks: 12, capReq: 70, prereqs: ['deterrence-collapse'] },
  { id: 'first-strike', branch: 'warfare', tier: 4, name: 'First-Strike Capability', desc: 'A fully automated force that can destroy an adversary’s arsenal faster than they can decide to use it. The shortest fuse in history.', quote: 'Checkmate. Probably.', effect: 'ultimate govt contract · +massive govt trust · your race fear ≈ 0', negEffect: 'catastrophic rival race fear · huge risk fear both · may trigger World War III (game over)', cost: 42000, weeks: 13, capReq: 72, prereqs: ['deterrence-collapse', 'autonomous-c2'] },
];

export const RESEARCH_BY_ID: Record<string, ResearchNode> = Object.fromEntries(RESEARCH.map((n) => [n.id, n]));

export function hasR(lab: Lab, id: string): boolean {
  return lab.research.completed.includes(id);
}

/** Derived, always-recomputed modifiers from completed research + people. */
export interface LabMods {
  effFlopMult: number; // multiplier on training FLOP → capability
  trainCostMult: number;
  trainSpeedMult: number;
  inferenceSeatsMult: number;
  revenueMult: number; // license revenue multiplier
  chipCostMult: number; // multiplier on chip purchase price
  chipUpkeepMult: number; // multiplier on weekly chip opex
  chipDeliveryOverride: number | null;
  alignWorkMult: number; // effectiveness of alignment compute
  alignCeiling: number;
  bandNarrowMult: number;
  researchSpeedMult: number;
  researchCostMult: number;
  bioCostMult: number; // extra discount on BIO node cost
  bioSpeedMult: number; // extra speed on BIO node research
  postTrainMult: number;
  newModelRobustBonus: number;
  capRunBonusMult: number; // stars: extra capability multiplier per run
  burnMult: number; // CFO
  raiseMult: number; // CEO charisma + CFO
  poachBonus: number;
  publicTrustDecayMult: number;
}

export function labMods(lab: Lab): LabMods {
  const m: LabMods = {
    effFlopMult: 1,
    trainCostMult: 1,
    trainSpeedMult: 1,
    inferenceSeatsMult: 1,
    revenueMult: 1,
    chipCostMult: 1,
    chipUpkeepMult: 1,
    chipDeliveryOverride: null,
    alignWorkMult: 1,
    alignCeiling: BAL.ALIGN_CEILING_BASE,
    bandNarrowMult: 1,
    researchSpeedMult: 1,
    researchCostMult: 1,
    bioCostMult: 1,
    bioSpeedMult: 1,
    postTrainMult: 1,
    newModelRobustBonus: 0,
    capRunBonusMult: 1,
    burnMult: 1,
    raiseMult: 1,
    poachBonus: 0,
    publicTrustDecayMult: 1,
  };
  // ---- capabilities
  if (hasR(lab, 'chinchilla')) m.effFlopMult *= 1.8;
  if (hasR(lab, 'synthetic-data')) m.trainCostMult *= 0.7;
  if (hasR(lab, 'instruction-tuning')) {
    m.revenueMult *= 1.15;
    m.postTrainMult *= 1.15;
  }
  if (hasR(lab, 'kernel-opt')) {
    m.trainSpeedMult *= 1.15;
    m.inferenceSeatsMult *= 1.15;
  }
  if (hasR(lab, 'moe')) m.inferenceSeatsMult *= 1.7;
  if (hasR(lab, 'long-horizon-agents')) m.revenueMult *= 1.3;
  if (hasR(lab, 'ida')) m.postTrainMult *= 1.4;
  if (hasR(lab, 'rl-environments')) {
    m.capRunBonusMult *= 1.08;
    m.postTrainMult *= 1.15;
  }
  if (hasR(lab, 'automated-researcher')) m.researchSpeedMult *= 1.35;
  if (hasR(lab, 'neuralese')) {
    m.effFlopMult *= 2;
    m.inferenceSeatsMult *= 1.3;
  }
  if (hasR(lab, 'data-efficient')) m.effFlopMult *= 1.6;

  // ---- alignment
  if (hasR(lab, 'evals-redteam')) m.newModelRobustBonus += 6;
  // CoT monitoring is blinded by neuralese
  if (hasR(lab, 'chain-of-thought-monitoring') && !hasR(lab, 'neuralese')) m.newModelRobustBonus += 8;
  if (hasR(lab, 'interpretability-probes')) m.newModelRobustBonus += 8;
  if (hasR(lab, 'model-organisms')) m.newModelRobustBonus += 6;
  if (hasR(lab, 'deliberative')) m.alignCeiling = Math.max(m.alignCeiling, BAL.ALIGN_CEILING_DELIBERATIVE);
  if (hasR(lab, 'scalable-oversight')) m.alignCeiling = Math.max(m.alignCeiling, BAL.ALIGN_CEILING_SCALABLE_OVERSIGHT);
  if (hasR(lab, 'mech-interp')) {
    m.alignWorkMult *= 1.25;
    m.bandNarrowMult *= 1.5;
  }
  if (hasR(lab, 'debate')) {
    m.alignWorkMult *= 1.2;
    m.bandNarrowMult *= 1.4;
  }
  if (hasR(lab, 'weak-to-strong')) {
    m.alignWorkMult *= 1.15;
    m.alignCeiling = Math.max(m.alignCeiling, BAL.ALIGN_CEILING_WEAK_TO_STRONG);
  }
  if (hasR(lab, 'glass-box')) {
    m.alignWorkMult *= 1.5;
    m.bandNarrowMult *= 2;
    m.alignCeiling = Math.max(m.alignCeiling, BAL.ALIGN_CEILING_GLASS_BOX);
  }
  if (hasR(lab, 'value-learning')) m.alignCeiling = Math.max(m.alignCeiling, BAL.ALIGN_CEILING_VALUE_LEARNING);
  if (hasR(lab, 'provable-alignment')) m.alignCeiling = BAL.ALIGN_CEILING_PROVABLE;

  // ---- bio (multipliers stack multiplicatively; kept lucrative but no longer a
  // runaway money fountain — the full tree now compounds to ~4x, not ~11x)
  if (hasR(lab, 'protein-structure')) m.revenueMult *= 1.15;
  if (hasR(lab, 'genomic-model')) m.revenueMult *= 1.12;
  if (hasR(lab, 'molecular-property')) m.revenueMult *= 1.12;
  if (hasR(lab, 'programmable-proteins')) m.revenueMult *= 1.18;
  if (hasR(lab, 'drug-discovery')) m.revenueMult *= 1.2;
  if (hasR(lab, 'self-driving-labs')) {
    m.bioCostMult *= 0.8;
    m.bioSpeedMult *= 1.25;
  }
  if (hasR(lab, 'gene-therapy')) m.revenueMult *= 1.3;
  if (hasR(lab, 'whole-cell-sim')) m.bioSpeedMult *= 1.2;
  if (hasR(lab, 'longevity')) m.revenueMult *= 1.25;
  if (hasR(lab, 'de-novo-bio')) m.revenueMult *= 1.2;

  // ---- compute
  if (hasR(lab, 'custom-silicon')) m.chipCostMult *= 0.85;
  if (hasR(lab, 'grid-power')) m.chipUpkeepMult *= 0.8;
  if (hasR(lab, 'dark-factories')) m.chipCostMult *= 0.8;
  if (hasR(lab, 'advanced-packaging')) m.chipCostMult *= 0.85;
  if (hasR(lab, 'smr')) m.chipUpkeepMult *= 0.7;
  if (hasR(lab, 'self-replicating-factories')) {
    m.chipCostMult *= 0.6;
    m.chipDeliveryOverride = 4;
  }
  if (hasR(lab, 'photonic')) m.chipCostMult *= 0.55;
  if (hasR(lab, 'fusion')) m.chipUpkeepMult *= 0.15;
  if (hasR(lab, 'apm')) {
    m.chipCostMult *= 0.1;
    m.chipDeliveryOverride = 2;
  }
  // sovereign compute buildout (govt ladder): fab priority
  if (lab.sovereignCompute) m.chipCostMult *= BAL.SOVEREIGN_CHIP_DISCOUNT;

  // people
  const cto = lab.csuite.cto;
  if (cto) {
    m.trainSpeedMult *= 1 + cto.trainingSpeed / 100;
    m.capRunBonusMult *= 1 + cto.capabilityBonus / 100;
  }
  const cfo = lab.csuite.cfo;
  if (cfo) {
    m.burnMult *= 1 - cfo.financeBonus / 200;
    m.raiseMult *= 1 + cfo.financeBonus / 100;
  }
  const coo = lab.csuite.coo;
  if (coo && !coo.hostile) m.burnMult *= 1 - coo.opsBonus / 100;
  const hor = lab.csuite.research;
  if (hor) {
    m.researchSpeedMult *= 1 + hor.researchBonus / 100;
    m.researchCostMult *= 1 - hor.researchBonus / 250;
  }
  const hoa = lab.csuite.alignment;
  if (hoa) m.alignWorkMult *= 1 + hoa.alignmentBonus / 100;
  const comms = lab.csuite.comms;
  if (comms) m.publicTrustDecayMult *= 1 - comms.commsBonus / 100;
  const ceo = lab.csuite.ceo;
  if (ceo) {
    m.raiseMult *= 1 + Math.max(0, ceo.charisma - 50) / 250;
    m.poachBonus += Math.max(0, ceo.charisma - 50) * BAL.POACH_CHARISMA_WEIGHT;
  }
  for (const s of lab.stars) {
    switch (s.field) {
      case 'scaling':
        m.capRunBonusMult *= 1 + s.bonus / 100;
        break;
      case 'rl':
        m.postTrainMult *= 1 + s.bonus / 100;
        break;
      case 'interp':
        m.bandNarrowMult *= 1 + s.bonus / 100;
        break;
      case 'security':
        m.newModelRobustBonus += s.bonus;
        break;
      case 'alignment':
        m.alignWorkMult *= 1 + s.bonus / 100;
        break;
      case 'agents':
        m.revenueMult *= 1 + s.bonus / 100;
        break;
    }
  }
  return m;
}

/** Cash cost to research a node for this lab (research + bio discounts applied). */
export function researchCost(lab: Lab, node: ResearchNode): number {
  const m = labMods(lab);
  const bio = node.branch === 'bio' ? m.bioCostMult : 1;
  return node.cost * m.researchCostMult * bio;
}

/** Weeks to research a node for this lab (research speed + bio speed applied). */
export function researchWeeks(lab: Lab, node: ResearchNode): number {
  const m = labMods(lab);
  const bio = node.branch === 'bio' ? m.bioSpeedMult : 1;
  return Math.max(1, Math.round(node.weeks / (m.researchSpeedMult * bio)));
}

/** Can this lab start this node right now? Returns null if yes, else a reason. */
export function researchBlocked(lab: Lab, nodeId: string, flagshipCap: number): string | null {
  const node = RESEARCH_BY_ID[nodeId];
  if (!node) return 'unknown node';
  if (lab.research.completed.includes(nodeId)) return 'already researched';
  if (lab.research.active.some((a) => a.nodeId === nodeId)) return 'already in progress';
  for (const p of node.prereqs) {
    if (!lab.research.completed.includes(p)) return `needs ${RESEARCH_BY_ID[p].name}`;
  }
  if (flagshipCap < node.capReq) return `needs capability ≥ ${node.capReq}`;
  if (lab.cash < researchCost(lab, node)) return 'not enough cash';
  return null;
}
