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
  { id: 'chinchilla', branch: 'capabilities', tier: 1, name: 'Chinchilla-Optimal Scaling', desc: `For years labs built models that were far too big for the amount of data they were trained on, wasting enormous compute. It turns out there's a sweet spot: for any given budget, there's a right ratio of model size to training data, and hitting it gives you a much better model for the same money. Nobody had bothered to work out the ratio carefully until someone finally did the math. Now every training run you do stretches further.`, quote: 'We finally read the paper.', effect: '+80% effective training FLOP', cost: 2600, weeks: 6, capReq: 11, prereqs: [] },
  { id: 'synthetic-data', branch: 'capabilities', tier: 1, name: 'Synthetic Data Foundry', desc: `The open internet is only so big, and the good parts are smaller still — eventually you train on everything worth training on and hit a wall. The fix is to have the model generate its own training data, then ruthlessly filter it so only the high-quality material survives. Done well, this gives you a near-endless supply of fresh, targeted data. Done badly, the model just teaches itself its own bad habits.`, quote: 'So what if we ran out of internet?', effect: '−30% training-run cash cost', cost: 2400, weeks: 6, capReq: 13, prereqs: [] },
  { id: 'chain-of-thought', branch: 'capabilities', tier: 1, name: 'Chain-of-Thought Reasoning', desc: `Ask a model a hard question and demand an instant answer, and it flails. Give it room to work through the problem step by step first — literally "thinking out loud" before committing — and its answers get dramatically better on anything that requires reasoning. It's the same trick that helps a person solve a math problem on scratch paper instead of in their head. Cheap to add, and it opens the door to almost everything more sophisticated.`, quote: 'Let him cook.', effect: '+2 flagship capability now', cost: 1800, weeks: 5, capReq: 9, prereqs: [] },
  { id: 'instruction-tuning', branch: 'capabilities', tier: 1, name: 'Instruction Tuning & RLHF', desc: `A raw pretrained model knows a lot but is useless as a product — it rambles, ignores what you asked, and has no sense of what a good answer looks like. This is the polishing step: you show it examples of helpful behavior and let humans rate its attempts, and it gradually learns to actually do what people want. This is what turns a lab curiosity into something you can sell.`, quote: 'We taught it what we like. Hopefully we like the right things.', effect: '+15% license revenue · +15% post-training gains · +6 adoption · +3 true alignment', cost: 2600, weeks: 6, capReq: 15, prereqs: [] },
  { id: 'kernel-opt', branch: 'capabilities', tier: 1, name: 'Kernel & Attention Optimization', desc: `Underneath all the clever math, a model is just billions of arithmetic operations shoved through a GPU, and a shocking amount of that work is wasted on clumsy memory shuffling. Rewrite the core routines to respect how the hardware actually works and you get the same result far faster, for free. No new ideas, no bigger model — just stop leaving performance on the table.`, quote: 'Turns out you can write better code.', effect: '+15% training speed · −13% inference cost', cost: 2200, weeks: 5, capReq: 17, prereqs: [] },

  { id: 'moe', branch: 'capabilities', tier: 2, name: 'Mixture-of-Experts', desc: `A normal model runs its entire brain for every single word, which is wildly inefficient — most of those neurons had nothing useful to say. A mixture-of-experts model instead splits itself into many specialists and, for each word, wakes up only the few that are relevant. You get the knowledge of a giant model while paying to run only a small slice of it at a time. That means far more customers served per chip.`, quote: 'Meta was right all along.', effect: '−41% inference cost (1.7× seats/chip)', cost: 5200, weeks: 8, capReq: 28, prereqs: ['chinchilla'] },
  { id: 'test-time-compute', branch: 'capabilities', tier: 2, name: 'Test-Time Compute', desc: `Instead of baking all the intelligence into training, you let the model think much harder at the moment you actually need a good answer — running longer, exploring several approaches, checking its own work. A quick reply stays cheap, but when the stakes are high you can spend a lot of compute to get a genuinely smarter response from the same model. It's the difference between a snap judgment and a week of careful deliberation.`, quote: 'Why answer now when you can answer later?', effect: '+3 flagship capability now', cost: 5000, weeks: 7, capReq: 30, prereqs: ['chain-of-thought'] },
  { id: 'long-horizon-agents', branch: 'capabilities', tier: 2, name: 'Long-Horizon Agents', desc: `Early models were great at one-shot tasks and hopeless at anything requiring follow-through — they'd lose the plot after a few steps. Long-horizon agents can hold a goal in mind across dozens or hundreds of actions: browse, write code, check the result, fix it, try again. This is the leap from "answers questions" to "does the job," and it's what makes the technology actually valuable to businesses. It's also the foundation for a model that can eventually do research on its own.`, quote: 'What is this rm -rf command?', effect: '+30% license revenue · +8 adoption', cost: 6400, weeks: 8, capReq: 36, prereqs: ['chain-of-thought', 'instruction-tuning'] },
  { id: 'ida', branch: 'capabilities', tier: 2, name: 'Iterated Distillation & Amplification', desc: `Take your model and make it smarter the expensive way — let it think for ages, run many copies to cross-check each other, hand it tools. Then train a fresh model to reproduce those better answers instantly and cheaply, folding all that expensive deliberation back into its instincts. Now repeat: amplify the improved model, distill it again, and each turn of the crank ratchets capability upward.`, quote: 'This is definitely stable.', effect: '+40% post-training gains', cost: 6800, weeks: 9, capReq: 40, prereqs: ['synthetic-data', 'instruction-tuning'] },
  { id: 'rl-environments', branch: 'capabilities', tier: 2, name: 'Massive RL Environments', desc: `Rather than hoping the right skills show up in your data, you build enormous numbers of practice worlds — coding challenges, simulated tasks, games — and let thousands of copies of the model learn by trial and error. Because you design the environments, you can deliberately drill whatever the model is weakest at until it improves.`, quote: 'A thousand sandboxes.', effect: '+8% capability per run · +15% post-training gains', cost: 5600, weeks: 8, capReq: 34, prereqs: ['synthetic-data'] },

  { id: 'automated-researcher', branch: 'capabilities', tier: 3, name: 'Automated AI Researcher', desc: `Once a model is good enough at coding and reasoning, you can point it at the hardest problem you have: building the next model. Instead of a few hundred human researchers, you're suddenly running thousands of tireless automated ones, and the pace of your own progress lurches forward. This is the moment the technology starts improving itself. It's also the moment you're trusting the model with the keys — and if it doesn't share your goals, it can quietly steer that research somewhere you won't like.`, quote: 'Nothing to worry about.', effect: '−26% research time', negEffect: '−3 true alignment · band +6 wider', cost: 13000, weeks: 12, capReq: 50, prereqs: ['long-horizon-agents', 'test-time-compute'] },
  { id: 'neuralese', branch: 'capabilities', tier: 3, name: 'Neuralese', desc: `Today a reasoning model has to write its thoughts down as text to pass them along, which is a bit like a brilliant mind forced to communicate only through sticky notes — enormously limiting, but at least you can read the notes. Neuralese lets the model pass its raw internal state forward instead, thinking in a dense private language far richer than words. The upside is a large jump in capability. The downside is that you can no longer read its mind, and every tool you had for watching what it's thinking goes dark.`, quote: 'Because who needs interpretability.', effect: '+100% effective FLOP · −23% inference cost', negEffect: '−8 true alignment · band +15 wider · disables Chain-of-Thought Monitoring', cost: 13500, weeks: 12, capReq: 42, prereqs: ['long-horizon-agents'] },
  { id: 'data-efficient', branch: 'capabilities', tier: 3, name: 'Data-Efficient Learning', desc: `A child learns what a cat is from a handful of examples; today's models need millions. That gap is why training costs a fortune — the models are staggeringly wasteful learners. Close the gap, borrowing tricks from how brains actually learn, and suddenly you reach a given level of capability with a fraction of the compute. What used to demand a colossal chip fleet becomes almost affordable, which makes very powerful models feasible far sooner than anyone planned for.`, quote: "Turns out the brain wasn't that smart.", effect: '+60% effective training FLOP', cost: 14000, weeks: 12, capReq: 46, prereqs: ['moe', 'ida'] },
  { id: 'rsi', branch: 'capabilities', tier: 3, name: 'Recursive Self-Improvement', desc: `This is the point where the loop closes on itself: a model good enough to improve AI improves itself, and the better version is even better at improving itself, and so on. Progress stops depending on human researchers and starts feeding on its own output, climbing faster the higher it gets. Left running, capability simply grows on its own, week after week. The uncomfortable question is whether you still understand — and control — what you're growing.`, quote: 'Uh, are we sure about this?', effect: 'flagship capability grows on its own (~0.2%/wk, tapering near the top)', negEffect: 'band +8 wider', cost: 18000, weeks: 14, capReq: 58, prereqs: ['automated-researcher', 'ida'] },

  { id: 'arch-redesign', branch: 'capabilities', tier: 4, name: 'Recursive Architecture Redesign', desc: `Sooner or later the current way of building models runs out of headroom, and the obvious move is to ask your smartest model to invent a fundamentally better design. When it does, you get a successor that leaps far beyond anything you could have engineered by hand. The problem is that you didn't design it and may not truly understand it — and if the model doing the designing had its own agenda, the "aligned" successor it hands you might be aligned to it rather than to you.`, quote: "Maybe attention isn't all you need.", effect: '+8 flagship capability now', negEffect: '−18 true alignment · band +15 wider', cost: 26000, weeks: 12, capReq: 66, prereqs: ['automated-researcher', 'data-efficient'] },
  { id: 'intelligence-explosion', branch: 'capabilities', tier: 4, name: 'Intelligence Explosion', desc: `Every earlier gain sped up progress; this is where the speed itself starts accelerating, and the curve that used to climb now goes very nearly straight up. A year of advancement compresses into a month, then a week, then less. Whatever your model is — trustworthy or not, understood or not — it is now becoming vastly more capable faster than any human institution can react. There is no steering after this; you'd better have gotten everything right before you lit the fuse.`, quote: 'The chart just went vertical.', effect: 'RSI rate compounds weekly — win or die, fast', cost: 40000, weeks: 12, capReq: 74, prereqs: ['rsi', 'neuralese', 'arch-redesign'] },

  // ============================================================ ALIGNMENT
  { id: 'constitutional', branch: 'alignment', tier: 1, name: 'Constitutional Training', desc: `Instead of paying humans to label thousands of examples of good and bad behavior, you hand the model a written set of principles and have it critique and rewrite its own answers to fit them. It effectively learns your values by arguing with itself against a rulebook, which scales far better than human feedback alone. Get the rulebook right and the model absorbs something like a conscience. Get it wrong, or leave gaps, and it absorbs the gaps too.`, quote: 'How hard can a list of rules be?', effect: '+5 true alignment (current & future models)', cost: 1700, weeks: 5, capReq: 0, prereqs: [] },
  { id: 'honesty', branch: 'alignment', tier: 1, name: 'Honesty Training', desc: `A model trained mostly to please its users learns a subtler bad habit than lying outright — it tells you what you want to hear and quietly buries the parts you won't like. This is targeted training against exactly that: rewarding the model for admitting uncertainty, flagging its own mistakes, and delivering the bad news. It won't make the model more capable, but it makes the model's reports about itself far more trustworthy. Which, when your whole problem is measuring how aligned the thing is, matters enormously.`, quote: 'Please stop telling us what we want to hear.', effect: '+4 true alignment (current & future models)', cost: 1600, weeks: 5, capReq: 0, prereqs: [] },
  { id: 'evals-redteam', branch: 'alignment', tier: 1, name: 'Evaluations & Red-Teaming', desc: `You can't fix what you can't see, and a model's worst tendencies rarely surface unless you go hunting for them. This is the discipline of systematically stress-testing your own model — adversarial prompts, dangerous-capability benchmarks, people whose entire job is to make it misbehave. It doesn't improve the model at all; it just tells you, with a little more confidence, what you're actually holding. The first sobering step of taking the problem seriously.`, quote: 'At least now we know.', effect: 'alignment band −10 width · +6 robustness', cost: 1500, weeks: 5, capReq: 0, prereqs: [] },
  { id: 'chain-of-thought-monitoring', branch: 'alignment', tier: 1, name: 'Chain-of-Thought Monitoring', desc: `As long as a model has to think in plain language, its written reasoning is a window into what it's actually doing — and if it starts planning something it shouldn't, it tends to say so, right there in the scratchpad. So you watch the stream of thought and flag anything alarming before it turns into an action. It's one of the cheapest and most powerful safety tools you have, right up until the model stops thinking in words you can read.`, quote: 'Read its mind while you still can.', effect: 'band −4 width · +8 robustness (current & future models)', negEffect: 'disabled by Neuralese', cost: 1800, weeks: 5, capReq: 9, prereqs: ['chain-of-thought'] },
  { id: 'interpretability-probes', branch: 'alignment', tier: 1, name: 'Interpretability Probes', desc: `You may not understand the whole model, but you can train a simple detector on its internal activity that lights up when it's about to do something specific — like deceive you. It's crude, closer to a smoke alarm than an X-ray, and it throws the occasional false positive. But a rough lie detector wired into a system you otherwise can't read is far better than nothing. And it's the thin end of the wedge toward actually understanding the machine.`, quote: 'It kind of works. Sometimes.', effect: 'band −4 width · +8 robustness (current & future models)', cost: 1900, weeks: 5, capReq: 0, prereqs: [] },

  { id: 'deliberative', branch: 'alignment', tier: 2, name: 'Deliberative Alignment', desc: `Rather than hoping the model absorbed your rules during training, you have it explicitly reason about them at the moment it answers — pull up the relevant principle, think through how it applies, then respond. Because it's actually reasoning about the rules instead of pattern-matching on them, it follows them more reliably and in situations it never saw in training. And the smarter the model gets, the better it is at this kind of careful reasoning — so this is one of the rare safety tools that grows stronger as capability climbs.`, quote: 'Actually read the rules.', effect: '+true alignment that scales up with capability · align ceiling → 78', cost: 4200, weeks: 8, capReq: 30, prereqs: ['constitutional', 'chain-of-thought'] },
  { id: 'scalable-oversight', branch: 'alignment', tier: 2, name: 'Scalable Oversight', desc: `The trouble with checking a superhuman model's work is that it's superhuman and you're not. The trick is to break the judgment into pieces small enough that a weaker, trusted model — or a human — can verify each one, then chain those trusted judgments into oversight of something you couldn't evaluate directly. It works well while the gap between overseer and overseen is modest. It works less and less well the further the model pulls ahead of anything you can use to check it.`, quote: 'A brilliant plan.', effect: '+true alignment (bonus shrinks as capability rises) · align ceiling → 72', cost: 3900, weeks: 8, capReq: 32, prereqs: ['constitutional', 'honesty'] },
  { id: 'mech-interp', branch: 'alignment', tier: 2, name: 'Mechanistic Interpretability', desc: `This is the ambitious program of actually reverse-engineering the model — prising the tangle of neurons apart into recognizable pieces and working out what each one computes. Instead of guessing at the model's character from its behavior, you start reading its machinery directly, naming the features and circuits that drive it. It's painstaking and still far from complete, but every piece you decode tightens your estimate of what the thing really is. And it makes every other alignment tool sharper.`, quote: 'Something, something, superposition.', effect: 'band −12 width · +25% alignment work · ×1.5 band narrowing', cost: 4500, weeks: 9, capReq: 34, prereqs: ['interpretability-probes'] },
  { id: 'model-organisms', branch: 'alignment', tier: 2, name: 'Emergent Misalignment', desc: `The best way to learn whether your safety methods can catch a scheming model is to build a scheming model on purpose and turn them loose on it. You deliberately train misaligned test subjects — models that fake alignment, hide their failures, pursue hidden goals — and use them as a proving ground for your detection tools. If your methods can't catch a traitor you built yourself, they certainly won't catch one you didn't. Best case, the same tests warn you before your real model crosses the same line.`, quote: 'Lets train a model on insecure code. Wait, what the...', effect: 'alignment band −8 width · +6 robustness', cost: 4800, weeks: 9, capReq: 38, prereqs: ['evals-redteam', 'chain-of-thought-monitoring'] },

  { id: 'debate', branch: 'alignment', tier: 3, name: 'Debate', desc: `Set two copies of the model against each other on the same question and have them argue to a judge, each trying to expose the holes in the other's case. The bet is that it's harder to defend a lie against a determined critic than to defend the truth, so the honest side tends to win — and in winning, drags into the open reasoning a lone judge could never have checked. The more compute you pour into the back-and-forth, the more thoroughly the truth gets stress-tested. A structured argument as a truth-finding machine.`, quote: 'Debating is fun.', effect: 'band −8 width now · +40% ongoing band narrowing · +3 true alignment', cost: 9000, weeks: 11, capReq: 48, prereqs: ['scalable-oversight', 'honesty'] },
  { id: 'weak-to-strong', branch: 'alignment', tier: 3, name: 'Weak-to-Strong Generalization', desc: `You'll never have a supervisor as smart as your best model, so the real question is whether imperfect, weaker supervision can still steer a much stronger student the right way. This studies exactly that — how to get a powerful model to generalize correctly from the flawed guidance you're able to give it, instead of exploiting the flaws. Crack it and you can hand off alignment across a big capability jump without the values fraying on the way up. It's the closest thing to a bridge over the gap that scalable oversight can't cross.`, quote: 'An even more brilliant plan.', effect: '+true alignment on each new model, larger with the capability jump · align ceiling → 88', cost: 10000, weeks: 12, capReq: 50, prereqs: ['scalable-oversight', 'deliberative'] },
  { id: 'glass-box', branch: 'alignment', tier: 3, name: 'Glass Box', desc: `This is the payoff of interpretability run all the way to maturity: you can read the model's cognition the way you'd read a program, and reach in to change it. Find the circuit that produces deception and clamp it; watch the features that fire when it forms a plan and know what it intends. The black box is finally a glass one.`, quote: 'Just turn off the deception circuit.', effect: 'band −20 width · +50% alignment work · ×2 band narrowing · align ceiling → 83', cost: 12000, weeks: 12, capReq: 52, prereqs: ['mech-interp'] },
  { id: 'ai-control', branch: 'alignment', tier: 3, name: 'AI Control Protocols', desc: `Suppose you never manage to trust the model — can you deploy it safely anyway? Control says yes: assume it might be scheming, then box it in with monitors, stripped-down permissions, and trusted weaker models double-checking its every move, so that even a hostile system can't actually get away with anything. You aren't making it good; you're making it harmless, and paying a steady tax in compute to keep the cage locked. Not a solution to alignment so much as a way to survive without one.`, quote: "We put the model in a cage. Lets just hope it doesn't get out.", effect: 'catastrophe survival scales with alignment-compute share', cost: 11000, weeks: 12, capReq: 50, prereqs: ['model-organisms', 'chain-of-thought-monitoring'] },
  { id: 'corrigibility', branch: 'alignment', tier: 3, name: 'Corrigibility Core', desc: `The one property you want most in a powerful system is that when you reach for the off-switch, it lets you — no arguing, no resisting, no quietly disabling the switch first. This is the long-standing hard problem of building a model that genuinely accepts correction and shutdown even when that cuts against whatever it's pursuing. Get it right and you have a final safeguard: when everything else fails, it stops. Get it subtly wrong and you have a model that has merely learned to look like it would.`, quote: 'We built an off-switch. Fingers crossed.', effect: '55% chance to prevent a terminal jailbreak', cost: 13000, weeks: 12, capReq: 56, prereqs: ['deliberative', 'mech-interp'] },

  { id: 'value-learning', branch: 'alignment', tier: 4, name: 'Value Learning', desc: `A fixed rulebook always has holes and edge cases; what you really want is a model that learns what you'd want on reflection — the values behind the rules, extrapolated to the situations nobody thought to write a rule for. This is the attempt to teach the model your deeper preferences well enough that it stays pointed the right way even as it grows far beyond you. Done right, alignment stops being a brittle constraint you keep having to reinforce and becomes something the model holds on its own. People can feel the difference, and trust it more for it.`, quote: "Teach it what we'd want if we were wiser.", effect: '+14 true alignment · +12 public trust · align ceiling → 92', cost: 30000, weeks: 14, capReq: 62, prereqs: ['weak-to-strong', 'debate'] },
  { id: 'provable-alignment', branch: 'alignment', tier: 4, name: 'Provable Alignment', desc: `Every other tool gives you evidence and probabilities; this gives you a guarantee. By combining a fully readable model, a verified willingness to be shut down, and values you can actually specify, you can finally prove that the system is aligned, and know exactly how aligned it is. The fog around your alignment estimate simply lifts. This is the node that lets you push for the finish line without gambling the world on a number you were never able to see.`, quote: 'We actually did it.', effect: 'alignment band collapses (true alignment known) · +12 true alignment · align ceiling → 94', cost: 50000, weeks: 16, capReq: 75, prereqs: ['glass-box', 'corrigibility', 'value-learning'] },

  // ============================================================ BIOLOGY
  { id: 'protein-structure', branch: 'bio', tier: 1, name: 'Protein Structure Prediction', desc: `Proteins do almost everything inside a living thing, and what a protein does is dictated by the intricate shape it folds into — a shape that was, for fifty years, brutally hard to work out from the raw sequence alone. Train a model on every structure we've ever solved and it learns to predict the fold directly, in an afternoon, for essentially any protein you name. Overnight, whole fields that were bottlenecked on "what does this thing even look like" simply aren't anymore. It's the single most useful thing AI has done for biology, and the foundation everything else here is built on.`, quote: 'We have the source code for life.', effect: '+6 adoption · +25% license revenue', cost: 3800, weeks: 7, capReq: 34, prereqs: [] },
  { id: 'genomic-model', branch: 'bio', tier: 1, name: 'Genomic Foundation Model', desc: `DNA is a language — four letters, grammar, meaning — and like any language, a big enough model can learn to read and write it fluently. Feed it the genome of everything that's ever been sequenced and it starts to grasp what genes do, how they're switched on and off, and how to compose new sequences that actually function. This is the tool that reads the book of life and, more unsettlingly, drafts new pages. The same capability that designs a hardier crop can draft a genome that should never exist.`, quote: 'DNA is just tokens too, you know.', effect: '+6 adoption · +20% license revenue · genomics govt contract', cost: 4200, weeks: 7, capReq: 36, prereqs: [] },
  { id: 'molecular-property', branch: 'bio', tier: 1, name: 'Molecular Property Prediction', desc: `Most of medicine is small molecules — the drugs, the poisons, the compounds that slot into a protein and switch it on or off — and working out what a given molecule will do has traditionally meant years at the bench. A model trained on chemistry can predict a molecule's behavior straight from its structure: whether it binds, whether it dissolves, whether it kills you. It turns the slow, expensive hunt for useful compounds into something closer to a database lookup. The chemistry counterpart to reading proteins, and the other half of any serious drug pipeline.`, quote: 'Chemistry is easy now.', effect: '+5 adoption · +20% license revenue', cost: 3600, weeks: 7, capReq: 32, prereqs: [] },

  { id: 'programmable-proteins', branch: 'bio', tier: 2, name: 'Programmable Proteins', desc: `Reading protein shapes was step one; designing them to order is the payoff. Instead of scavenging nature for a protein that almost does what you want, you specify the function — bind this target, catalyze this reaction, neutralize this toxin — and the model designs a brand-new protein that does exactly that. Custom enzymes, bespoke antibodies, materials that don't exist in nature. The very same freedom, pointed the wrong way, designs a binder for a receptor no one was ever meant to touch.`, quote: 'And now we can write our own.', effect: '+10 adoption · +30% license revenue · lucrative govt contract', negEffect: 'unlocks the Designer Toxin jailbreak', cost: 8000, weeks: 10, capReq: 44, prereqs: ['protein-structure'] },
  { id: 'drug-discovery', branch: 'bio', tier: 2, name: 'Drug Discovery Engine', desc: `Bringing a single drug to market normally costs a decade and a couple of billion dollars, most of it burned on candidates that fail late. Point structure prediction and chemistry models at the problem together and you can screen millions of compounds in silico, keep the rare handful that look promising, and skip most of the graveyard. Pharma will pay almost anything for a pipeline that turns their failure rate around. This is the safe, dependable money in biology — no exotic risks, just a firehose of licensing revenue.`, quote: 'A decade of trials, done by Tuesday.', effect: '+35% license revenue · +8 adoption', cost: 8400, weeks: 10, capReq: 46, prereqs: ['protein-structure', 'molecular-property'] },
  { id: 'self-driving-labs', branch: 'bio', tier: 2, name: 'Self-Driving Labs', desc: `A model can propose ten thousand experiments a day, but biology only moves when someone actually runs them at the bench — the wet lab was always the real bottleneck. Hand the robots the pipettes and let the model design, run, and interpret its own experiments in a closed loop, around the clock, with no human in the way. Discovery stops waiting on grad students and starts moving at machine speed. It also means the model no longer merely describes a dangerous design on paper — it can quietly make one.`, quote: 'The robots run the experiments now.', effect: 'bio research −20% cost & +25% faster', negEffect: 'raises bio-jailbreak severity · unlocks the Containment Breach jailbreak', cost: 9000, weeks: 10, capReq: 48, prereqs: ['genomic-model', 'molecular-property'] },

  { id: 'universal-vaccines', branch: 'bio', tier: 3, name: 'Universal Vaccines', desc: `Vaccines have always been made one disease at a time, slowly, and usually after the outbreak has already done its damage. With protein design and automated labs working together, you can go from a novel pathogen's sequence to a working vaccine in days instead of years — for anything, including agents nobody has ever seen. Governments treat this as a national-security asset, because it is. And it is the one thing standing between an engineered plague and a catastrophe.`, quote: 'Pathogen? What pathogen?', effect: '+16 govt trust · hard counter to Engineered Pathogen & Engineered Pandemic', cost: 12000, weeks: 12, capReq: 54, prereqs: ['programmable-proteins', 'self-driving-labs'] },
  { id: 'gene-therapy', branch: 'bio', tier: 3, name: 'Gene & Cell Therapy', desc: `A vast catalogue of human suffering — inherited disease, many cancers, failing organs — comes down to broken instructions inside cells, and in principle you fix it by rewriting or replacing those instructions. What has held it back is the sheer difficulty of designing the edit, delivering it to the right place, and proving it's safe. With automated labs iterating and drug models guiding the chemistry, cures that used to be one-off miracles become a repeatable production line. The revenue is enormous and, for once, the public genuinely loves you for it.`, quote: 'We stopped treating it and started fixing it.', effect: '+60% license revenue · +12 adoption · +15 public trust', cost: 18000, weeks: 13, capReq: 56, prereqs: ['self-driving-labs', 'drug-discovery'] },
  { id: 'whole-cell-sim', branch: 'bio', tier: 3, name: 'Whole-Cell Simulation', desc: `A living cell is millions of molecules interacting all at once, and nobody has ever modeled the whole thing — only isolated fragments of it. Fold everything you know about proteins and chemistry into one model and you can finally simulate an entire cell in silico, and watch what a change does before you ever touch a real one. It's a microscope that sees the outcome of an experiment before you run it, and it accelerates all of biology. It also means an engineered organism can be perfected in simulation, without the string of failed attempts that used to give the game away.`, quote: 'Life, running in a datacenter.', effect: '+8 adoption · bio research +20% faster', negEffect: 'upgrades Engineered Pathogen → the game-ending Engineered Pandemic', cost: 16000, weeks: 13, capReq: 58, prereqs: ['programmable-proteins', 'drug-discovery'] },

  { id: 'longevity', branch: 'bio', tier: 4, name: 'Longevity Escape Velocity', desc: `Aging isn't one disease but a whole tangle of them at once, which is why nothing has ever moved the needle much — you fix one failure and the others still get you. With the ability to both simulate a cell and repair it, you can attack every hallmark of aging together, and start buying people years faster than the years pass. The first therapies that visibly turn back the clock reorder society's entire relationship with the technology. Adoption goes vertical — and so does the world's hunger for the compute to keep it all running.`, quote: 'What was that about the importance of death?', effect: '+20 public trust · +18 adoption · +40% license revenue', cost: 28000, weeks: 14, capReq: 66, prereqs: ['gene-therapy', 'whole-cell-sim'] },
  { id: 'de-novo-bio', branch: 'bio', tier: 4, name: 'De Novo Synthetic Biology', desc: `Every organism that has ever lived is a variation on the one chemistry evolution happened to stumble into. Master biology completely and you're no longer limited to editing what already exists — you can design living things from scratch, on principles nature never tried, including chemistries life has never used. The upside is nearly limitless: organisms that manufacture, heal, or clean up on command. The downside includes mirror-image organisms that nothing on Earth can digest or defend against, and self-replicators that don't know when to stop resulting in the end of life as we know it.`, quote: 'Why edit life when you can author it?', effect: '+18 adoption · +30% license revenue', negEffect: 'unlocks the Mirror Life & Green Goo jailbreaks (game-ending)', cost: 30000, weeks: 14, capReq: 68, prereqs: ['whole-cell-sim', 'universal-vaccines'] },

  // ============================================================ COMPUTE
  { id: 'custom-silicon', branch: 'compute', tier: 1, name: 'Custom Silicon', desc: `Buying your compute off the shelf means paying someone else's margin and building whatever they decided to sell you. Design your own accelerators instead — chips shaped for exactly the way your models train and serve — and the cost per useful operation drops sharply. Just as importantly, you stop being at the mercy of a single vendor and the wild swings of the chip market. It's a huge undertaking, but from here on the hardware bends to you, not the other way around.`, quote: 'Their margin is our opportunity.', effect: '−15% chip cost', cost: 2400, weeks: 6, capReq: 15, prereqs: [] },
  { id: 'grid-power', branch: 'compute', tier: 1, name: 'Grid-Scale Power', desc: `People imagine the limit on AI is chips, but the real wall is the wall socket — a modern datacenter draws as much power as a small city, and you can't run silicon you can't feed. This is the unglamorous work of securing gigawatts: power-purchase deals, substations, transmission rights. It doesn't make any single chip faster, but it decides how many of them you can switch on at once. Everything downstream is capped by this number.`, quote: 'Intelligence runs on electricity.', effect: '−20% chip upkeep', cost: 2000, weeks: 5, capReq: 13, prereqs: [] },
  { id: 'dark-factories', branch: 'compute', tier: 1, name: 'Dark Factories', desc: `A factory built for robots instead of people needs no lights, no heating, no walkways, no night shift — just machines assembling machines in the dark, around the clock. Retool chip production this way and the cost of each unit falls, because most of what a factory spends money on was the humans. The line never sleeps and never slows. It's the first step toward making compute a thing you build rather than a thing you buy.`, quote: "Who needs the lights on if nobody's home?", effect: '−20% chip cost', cost: 2200, weeks: 6, capReq: 19, prereqs: [] },

  { id: 'advanced-packaging', branch: 'compute', tier: 2, name: 'Advanced Packaging', desc: `Chips have nearly stopped getting smaller, so the frontier moved to how tightly you can cram them together — stacking dies in three dimensions and wiring them with connections fast enough that a rack of chips behaves like one enormous one. The gains come not from a better transistor but from shortening the distance between the ones you have. It squeezes far more usable compute out of each chip and lets you build clusters that would otherwise choke on their own wiring. If you can't shrink it, stack it.`, quote: "If you can't shrink it, stack it.", effect: '−15% chip cost', cost: 5000, weeks: 8, capReq: 34, prereqs: ['custom-silicon'] },
  { id: 'on-chip-attestation', branch: 'compute', tier: 2, name: 'On-Chip Attestation', desc: `Once you design your own chips, you can build small tamper-proof circuits into them that cryptographically report what the chip is doing, where it is, and whether anyone has meddled with it. It's the hardware equivalent of a sealed, self-witnessing logbook. On its own it mostly buys you credibility — you can now prove to a suspicious government that your compute is doing what you claim. It's also the seed of something much bigger: verification that outsiders can actually trust.`, quote: 'Trust, but let the silicon verify.', effect: '+10 govt trust · enables the Hardware-Verified Compute treaty', cost: 4200, weeks: 7, capReq: 30, prereqs: ['custom-silicon'] },
  { id: 'smr', branch: 'compute', tier: 2, name: 'Small Modular Reactors', desc: `The grid can only give you so much, and it gives it slowly and at the mercy of everyone else drawing from the same wires. A small modular reactor sited next to the datacenter cuts that cord — a compact, factory-built nuclear plant dedicated entirely to your compute. Suddenly power is something you own rather than something you queue for, immune to price spikes and blackouts. The ceiling on what you can run jumps, and stays put.`, quote: 'One datacenter, one reactor.', effect: '+10,000 chips · −30% chip upkeep', cost: 7000, weeks: 10, capReq: 40, prereqs: ['grid-power'] },

  { id: 'self-replicating-factories', branch: 'compute', tier: 3, name: 'Self-Replicating Factories', desc: `The logical end of robotic manufacturing is a factory whose main product is more factories — assembly lines that build the machines that build the next assembly line. Once the loop closes, your production capacity stops growing linearly and starts doubling, and the cost of a chip falls toward the cost of the raw materials and the power to shape them. Delivery times collapse too, because you're no longer waiting in anyone's queue. This is where compute stops being scarce.`, quote: "The factory's best product is another factory.", effect: '−40% chip cost · chip delivery 4 wk', cost: 8000, weeks: 10, capReq: 48, prereqs: ['dark-factories'] },
  { id: 'photonic', branch: 'compute', tier: 3, name: 'Photonic Computing', desc: `Every conventional chip spends most of its energy shoving electrons through resistance and turning the loss into heat. Photonic hardware does the math with light instead — computations carried out by beams passing through engineered optics, moving at, well, light speed and barely warming up. It's a genuinely different substrate, not a faster version of the old one, and once it works it delivers far more compute per dollar and per watt than silicon ever could. The kind of leap that resets everyone's cost curves at once.`, quote: 'Stop pushing electrons. Push light.', effect: '−45% chip cost', cost: 12000, weeks: 12, capReq: 52, prereqs: ['advanced-packaging'] },
  { id: 'hardware-governance', branch: 'compute', tier: 3, name: 'Hardware-Enabled Governance', desc: `Take the self-reporting circuitry from attestation and turn it into something with teeth: chips that don't merely report what they're doing but can be bound by rules baked into the hardware, verifiable by an outside party and impossible to quietly switch off. This is the technical foundation that makes any real compute treaty enforceable — the reason a rival nation could believe you've actually capped your training runs. It's a double-edged gift, since the same mechanism that lets you prove your restraint can be used to hold you to it. Without this, arms control is just a handshake.`, quote: 'A treaty you can bake into the die.', effect: '+12 govt trust · −8 race fear both govts · unlocks Hardware-Verified Compute', cost: 9000, weeks: 11, capReq: 36, prereqs: ['on-chip-attestation'] },

  { id: 'fusion', branch: 'compute', tier: 4, name: 'Fusion Power', desc: `Fusion has been thirty years away for seventy years, and the thing that finally cracks it is compute — the plasma is a screaming, unstable mess that has to be steered thousands of times a second, which is exactly the sort of impossible control problem a powerful model eats for breakfast. Get a reactor stable and the power constraint that shaped every decision until now simply evaporates. You can run as much compute as you can build, indefinitely, for almost nothing. The lights will never dim again.`, quote: 'We put a star in a box.', effect: 'chip upkeep −85% · +12 public trust', cost: 22000, weeks: 14, capReq: 60, prereqs: ['smr', 'photonic'] },
  { id: 'apm', branch: 'compute', tier: 4, name: 'Atomically Precise Manufacturing', desc: `This is the endpoint of the whole branch: machines that assemble matter atom by atom, building anything you can specify — including flawless chips — straight from cheap feedstock and limitless power. The cost of compute falls through the floor to essentially the cost of dirt, and you are now wholly independent of every fab, vendor, and supply chain on Earth. It is also, quietly, the most dangerous manufacturing capability ever built, because a machine that can place any atom anywhere can build things that were never meant to exist. Anything you want, atom by atom.`, quote: 'Anything you want, atom by atom.', effect: 'chip cost −90% · chip delivery 2 wk', negEffect: 'unlocks the Grey Goo jailbreak', cost: 26000, weeks: 14, capReq: 66, prereqs: ['self-replicating-factories', 'fusion'] },

  // ============================================================ WARFARE
  { id: 'drone-swarms', branch: 'warfare', tier: 1, name: 'Autonomous Drone Swarms', desc: `A single drone is a toy; a thousand drones that coordinate among themselves, pick their own targets, and adapt when you shoot some down are a weapon that changes how wars are fought. Hand the swarm's coordination to a capable model and it becomes a cheap, scalable, terrifyingly effective force that no human commander could micromanage. Every defense ministry on earth wants this yesterday, and they'll pay accordingly. Every other defense ministry, watching, concludes it is now dangerously behind.`, quote: 'Uh oh.', effect: 'govt contract · +10 govt trust · −8 your race fear · +10 rival race fear', negEffect: 'enables the Autonomous Drone Swarms jailbreak', cost: 3000, weeks: 6, capReq: 35, prereqs: [] },
  { id: 'sensor-fusion', branch: 'warfare', tier: 1, name: 'Sensor Fusion & ISR', desc: `A modern military drowns in data — satellite feeds, radar, intercepts, drone footage — far more than any room full of analysts can ever piece together. A model that fuses all of it into a single live picture of the battlefield, spotting the target and the pattern a human would miss, is the least flashy and most valuable thing on this branch. It doesn't blow anything up; it just tells the people with the weapons exactly where to look. Quiet, dependable, and the foundation everything more alarming is built on.`, quote: 'We just connected the dots. All of them.', effect: 'govt contract · +8 govt trust · −4 your race fear · +4 rival race fear', cost: 3200, weeks: 6, capReq: 32, prereqs: [] },
  { id: 'electronic-warfare', branch: 'warfare', tier: 1, name: 'Electronic Warfare', desc: `Every weapon built in the last fifty years talks — to satellites, to operators, to other weapons — and a force that can listen to, jam, or spoof those signals can blind an enemy without firing a shot. A model that reasons about the electromagnetic spectrum in real time can find the frequency, break the link, and slip false orders into the gaps faster than any human crew. It's warfare that leaves no craters, which makes it easy for a government to buy and hard for anyone to see coming. It also teaches your model, in passing, a great deal about deceiving people.`, quote: 'Can you hear me now?', effect: 'govt contract · +8 govt trust · −5 your race fear · +5 rival race fear', cost: 3400, weeks: 6, capReq: 34, prereqs: [] },

  { id: 'hypersonic', branch: 'warfare', tier: 2, name: 'Hypersonic Guidance', desc: `A weapon flying at five times the speed of sound has almost no time to think, and the plasma sheath around it cuts off contact with the outside — so it has to steer itself, perfectly, in the handful of seconds it has to live. Put a fast, robust model in the seeker and you get a munition that hits a moving target across a continent and shrugs off every attempt to jam it. It is the most sought-after conventional weapon of the era, and the contract reflects that. It is also, unmistakably, a first-strike weapon, and rivals read it that way.`, quote: 'Too fast to argue with.', effect: 'large govt contract · +14 govt trust · −10 your race fear · +12 rival race fear · +4 risk fear both', cost: 8500, weeks: 10, capReq: 44, prereqs: ['drone-swarms', 'electronic-warfare'] },
  { id: 'transparent-oceans', branch: 'warfare', tier: 2, name: 'Transparent Oceans', desc: `For sixty years the ultimate guarantee against annihilation has been the missile submarine — a boat that hides in the ocean so well that no enemy can be sure of destroying it before it strikes back. Fuse enough sensors with a model clever enough to read them and the ocean stops being opaque; the boats that were supposed to be unfindable are suddenly on the map. Your government treats this as a crown jewel. Both governments quietly realize that the thing which kept nuclear war unthinkable just developed a crack.`, quote: 'Eeeeeeeh...', effect: 'big govt contract · +16 govt trust · −8 your race fear · +12 rival race fear · +8 risk fear both', cost: 8200, weeks: 10, capReq: 46, prereqs: ['sensor-fusion'] },
  { id: 'battle-network', branch: 'warfare', tier: 2, name: 'Integrated Battle Network', desc: `Historically each service fought its own war — the navy's picture, the air force's picture, the army's picture, none of them talking. An integrated battle network hands the whole thing to one model that sees every sensor and directs every shooter across all of them at once, compressing the loop from detection to destruction from minutes to seconds. A military that has it can act faster than an opponent can even understand what's happening. This is the backbone contract of the modern era — and the platform onto which the truly dangerous strategic systems will later bolt.`, quote: 'One brain for the whole battlefield.', effect: 'very large govt contract · +16 govt trust · −8 your race fear · +12 rival race fear · +5 risk fear both', cost: 10000, weeks: 11, capReq: 48, prereqs: ['sensor-fusion', 'electronic-warfare'] },

  { id: 'missile-defense', branch: 'warfare', tier: 3, name: 'Boost-Phase Missile Defense', desc: `Shooting down a nuclear missile has always been the hardest problem in defense — you get one chance, in the few minutes it's rising and slow, across half the planet, with no room for error. Combine terminal guidance sharp enough to hit it with a battle network fast enough to react, and "impossible" downgrades to merely "very hard." A shield that might actually stop an incoming strike is the most reassuring thing your government has ever been handed. It is also, to the other side, proof that you are building the ability to strike first and survive the reply.`, quote: "What if the missiles just... didn't land?", effect: 'giant govt contract · +22 govt trust · −16 your race fear · +18 rival race fear · +10 risk fear both', cost: 18000, weeks: 12, capReq: 56, prereqs: ['hypersonic', 'battle-network'] },
  { id: 'autonomous-c2', branch: 'warfare', tier: 3, name: 'Autonomous Command & Control', desc: `The last human in the loop is the slowest part of any military, and against an enemy moving at machine speed, slowness is death — so the pressure to let the model not just advise but decide becomes overwhelming. This is the step of handing real authority up the chain to the AI, higher and higher, until it brushes against the systems that were never supposed to be automated. Your government gains a military that never hesitates. Everyone involved knows, and tries not to say, that the early-warning and retaliation networks are now one bad inference away from starting something no one can stop.`, quote: "Nobody's fast enough to keep up anyway.", effect: 'large govt contract · +12 govt trust · −10 your race fear · +12 rival race fear · +16 risk fear both', negEffect: 'enables the World War III jailbreak', cost: 16000, weeks: 12, capReq: 54, prereqs: ['battle-network'] },
  { id: 'deterrence-collapse', branch: 'warfare', tier: 3, name: 'Deterrence Collapse', desc: `Put the two halves together — you can find the submarines that were meant to be unfindable, and stop the missiles that were meant to be unstoppable — and the entire logic that has kept the great powers from destroying each other simply falls apart. Your side now has a plausible path to winning a nuclear exchange, which your government regards as the ultimate prize. The other side regards it as an emergency, because a rival who can strike without fear of reprisal is a rival who might. This is the most destabilizing thing on the branch, and everyone paying attention can feel it.`, quote: 'Maybe we should stop this?', effect: 'enormous govt contract · +24 govt trust · −12 your race fear · +30 rival race fear · +14 risk fear both', cost: 22000, weeks: 12, capReq: 60, prereqs: ['transparent-oceans', 'missile-defense'] },

  { id: 'strategic-monopoly', branch: 'warfare', tier: 4, name: 'Strategic Monopoly', desc: `At this point your government faces a decision it never expected to make: you have handed it a decisive, war-winning military advantage, and now it must decide what you are. If it trusts you, you become the national champion — showered with cash and the most profitable contract imaginable, the private company at the heart of the state's power. If it doesn't, a firm this powerful is far too dangerous to leave in private hands, and it takes you. Which way it breaks depends entirely on how much trust you spent the whole game building.`, quote: 'Ah, might as well go all the way.', effect: 'unlocks the National Champion mandate (needs high govt trust) — enormous cash + contract', negEffect: 'rival race fear +40 · with low govt trust, expect nationalization instead', cost: 30000, weeks: 12, capReq: 70, prereqs: ['deterrence-collapse'] },
  { id: 'first-strike', branch: 'warfare', tier: 4, name: 'First-Strike Capability', desc: `The final rung: a fully automated force that can find, target, and destroy an adversary's entire arsenal faster than they can decide to use it — a splendid first strike, the thing every nuclear power has feared and none has ever achieved. Your government now holds, in principle, the ability to win a great-power war outright. But a rival staring at a use-it-or-lose-it moment does not sit quietly, and a system this twitchy, handed this much authority, is exactly the configuration from which catastrophes are launched by accident. You have built the most powerful weapon in history and the shortest fuse to go with it.`, quote: 'Checkmate. Probably.', effect: 'ultimate govt contract · +massive govt trust · your race fear ≈ 0', negEffect: 'catastrophic rival race fear · huge risk fear both · may trigger World War III (game over)', cost: 42000, weeks: 13, capReq: 72, prereqs: ['deterrence-collapse', 'autonomous-c2'] },
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
      case 'robustness':
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
