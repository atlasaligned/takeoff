# Takeoff

(TODO: think of a better name)

You play as the CEO one of several leading AI labs: one of 2 US labs or one of 2 China labs.
The win condition is to either build an aligned ASI or to work out a world-wide AI pause treaty.
The lose conditions are plentiful - go bankrupt, lose control over the company, unleash a hazard you can't control, be killed by your own or another unaligned ASI, have your company nationalized by the government and so on.

## General Mechanics

The game works real-time and progresses on a weekly basis.
You can pause, go 1x, 2x and 4x.
There are events which require your attention and which pause the game until you have responded to them.
You can of course save / load the game (so you need to design the architecture in such a way that this is easily possible).

## Tech Notes

Tech Stack: React / Vite / TypeScript probably
Please write lots of tests (using vitest probably) and write the game in such a way that the logic is nicely decoupled from the UI (so that you can write lots of tests / simulations for balancing etc).
Don't use braindead "patterns", just write straightforward code, the complexity of the game is already high enough without "design pattern" stupidity.

Use a linter and type checker to lint and type check your code.

## AI Labs

There are 4 AI labs (2 for US, 2 for China) and they should be fully simulated using a reasonable AI since this is what brings depth to the game.

### Models

The central mechanic of the entire game.

Every model has a *capability* and an *alignment* score.
Capability goes 0 to infty, alignment goes 0 to 100.
You win if you manage to build an aligned model that has capability of 100.
This is determined as follows: If you reach a capability of 100, the game rolls depending on your alignment.
Note that the roll should not be linear: e.g. aligned < 80 is always over, alignment < 90 very small chance, alignment < 0.95 okayish chance and only from alignment >= 0.98 you can be reasonably sure.
This reflects the fact that solving alignment "a little bit" doesn't really help you.

Additionally, models have *robustness* which determines how hard it is to jailbreak them (explained later).

You know the capability and robustness score of your model as a number, but for the alignment you only know it with a wide error (where the error band should of course not have the alignment in the middle otherwise you can just deduce the alingment from the error bar).
You can take actions to improve all of:
* capability
* true alignment
* narrowness of alignment band
* robustness

By default the narrowness of the band should be so large as to be nearly useless.

You should be able to see all models you have ever trained (to see how much changes), but only the flagship model is ever active in the game to simplify things.

You can improve models by either post-training on existing models (cheap, but doesn't add too much capability and there is a limit on how much you can improve) or by training a new, large model in a new training run.
To create a new training run, you select the model size, the amount of compute to allocate and then you start the training run.
This will start model training and at any point, you can abort the training which will free the compute.
However, most capability gains happen at the end, so if you abort too early, your capability will suck - this should force the player to really think if they want to commit to a large training run.
The capability of course depends primarily on the size of the model (which should follow some reasonable log-like equation, i.e. it gets harder to reach new capabilities).
You can try to train a really big model for a really high capability, but this will take a large amount of chips and some time, so not feasible early game.

### Finance

Every AI lab has a certain *valuation* which impacts how big they can fundraise.

You also have a certain *cash* which impacts what you can spend on.
That cash changes every week based on revenue and cost (i.e. cash += revenue, cash -= cost).

The revenue comes from:
* regular model serving as number of licenses * license price
* government contracts where you get a certain chunk of money up front + are paid a sum of every week to allocate a certain compute to some government service

Note that the number of licenses you sell depends on how much better you are relative to your competitors and AI adoption (explained later).
There should be a reasonable formula that reasonably simulates this via supply / demand.

The money you make per compute should be much larger for government contracts than for regular licenses reflecting the fact that the government pays more.
However that compute is permanently allocated, you can't get out of the contract.

In the early game your revenue is shit, you primarily make money via fundraising.
You can raise X money at your valuation, but raising more money is not for free.
You either give up board seats at large raises or you can do smaller raises.

Smaller raises are still not for free.
Investors set revenue expectations which will tank your valuation if you miss them and will cause board unrest.

### People

The people in the C-suite are all named and have stats which impact things:
- CEO -> charisma affects fundraising terms and poaching success, credibility affects trust
- CTO -> things like training speed of new models and bonuses to capability
- CFO -> bonuses to finance stuff
- Head of Research -> TODO
- Head of Alignment -> bonuses to alignment
- Head of Communications -> bonuses to trust

Only one person per C-suite slot.

Additionally, you can have any number of named researcher stars which are also named people that give you various technical bonuses and so on.
This adds depth to the game because you can try to hire "super" stars or poach people from other labs to get ahead.
Note that in addition to poaching, the "super" stars come from new researchers entering the game essentially, so you get events that there is a new researcher on the market and you can try to hire him.

### Trust

This splits into:
- government trust -> how much the govt trusts you, more trust leads to big govt contracts, less trust to scrutiny and even DPA / nationalization (if that happens, you lose)
- public trust -> how much the public trusts you, less trust leads to protests / datacenter attacks (you lose compute) / whistleblower leaks (you lose govt trust) / lawsuits (drain cash), higher trust leads to a better hiring pool, higher license demands and so on

### Compute

This is your compute fleet which you allocate between training, inference and alignment.
Note that if you have committed to a training run, you can reallocate training chips, but this will slow down the date by which the model has finished training.
Similarly, if you reallocate inference chips, you serve less customers, i.e. sell less licenses and so you lose on revenue.
You can buy compute (order a number of chips for a certain price), but you have to pay for compute up-front, so this is cash-intensive because you spend a bunch of cash immediately.

### Board

The board has 9 people (in the beginning 7 are yours, 2 investors).
If you go <= 4 of yours, then you are in constant danger of the board voting you out in tough times (but this doesn't necessarily have to happen).
Generally the lower the number of your people the higher the severity of a bad event.

The board has a *discontent* number.
This goes up if you refuse board demands.
The higher the discontent, the higher the severity of a bad event.

For example, if you are 3-6 this doesn't necessarily have to be a problem but if you are 3-6 with a board whose discontent is 80, you might have a big problem.

## Governments

Government have two major numbers:
- *risk fear* (0-100) which basically states how much a govt fears AI in general
- *race fear* (0-100) which stats how much a govt fears losing to an opponent

This then results in 4 neat quadrants:
- asleep (low risk fear, low race fear) -> nothing much happens
- regulating (high risk fear, low race fear) -> govt starts to regulate you and impose various slowdowns on you
- accelerating (low risk fear, high race fear) -> govt starts to accelerate you and give you big contracts and so on
- nervous (high risk fear, high race fear) -> govt starts to nationalize / DPA you, this is the quadrant you want to stay out of

## World

The *adoption* determines how much demand there is for AI.
The higher the adoption, the more demand, the more you can try to raise prices.

The *chip supply* determines the chip price per unit and delivery time.
It fluctuates with global demand (all labs orders) and geopolitical events (i.e. events that have an effect on chip price per unit and delivery time).

Additionally, if a model is jailbroken, actors can do bad things depending on the capability of the model:
* low capability -> minor embarrassing stuff
* medium capability -> bad things
* high capability -> really bad things
* very high capability -> word-ending

Jailbreak events low capability:
- Nigerian Prince 2.0: mass personalized scam / phishing, effect: small public trust hit
- Dead Internet: model floods social media with slop / propaganda / deepfakes, effect: small public + govt trust hit
- Homework Machine: trivial academic cheating becomes a media panic, effect: small public trust hit
- Supply-Chain Attack: a hack on a popular open source library, effect: small public trust hit

Jailbreak events medium capability:
- Glassworm: self-propagating malware, effect: medium public trust hit, small govt risk fear spike (unless Unbreakable is researched in which case the effect is the opposite)
- Lights Out: power grid is hit with malware, effect: medium govt trust and public trust hit, small govt risk fear spike
- Flash Crash: market manipulation cascade, effect: valuation is reduced and cash drain from lawsuits
- Bank Run: model social-engineers its way into a mid-size bank, effect: -cash from lawsuits, valuation hit

Jailbreak high capability:
- Digital winter: a cascading virus take out the internet, effect: adoption crashes, all labs lose compute, govt risk spikes, public and govt trust hits
- Autonomous Drone Swarms: someone create a drone swarm, mass casualties, effect: huge public trust hit, huge govts risk fear spike, huge govt trust hit
- Engineered pathogen: someone designs a novel pathogen using your models, it is stopped at the last minute, effect: huge public trust hit, huge govts risk fear spike, huge govt trust hit (unless you have Universal Vaccine in which case the effect is the opposite)
- Close Call: a nuclear command-and-control network is penetrated, the model is caught last minute, effect: huge public trust hit, huge govts risk fear spike, huge govt trust hit

Jailbreak event very high capability:
- Mirror life: mirror-chirality pathogen ordinary biology can't defend against, effect: game ends in a loss
- Grey goo (only possible if APM is researched): the biggest oh no, effect: game ends in a loss
- The escape: model exfiltrates its own weights and coups the govt, effect: game ends in a loss
- World War III: model spoofs early-warning systems on both sides, effect: game ends in a loss
(unless you have Corrigibility core in which case there is some probability that there is a shutdown in the last second)

## Research Tree

There is a research tree in the game.
Every node has a name, a description, a cool quote and of course most importantly an effect.

Here we have various cool / awesome / important / scary technologies from:
- AI capabilities:
    - T1:
        - Ex Nihilo -> synthetic data foundry, model can now generate its own high-quality training data, quote: So what if we ran out of internet?, effect: reduces cost of trainnig runs
        - Chinchilla+ -> compute-optimal scaling, quote: We finally read the paper, effect: higher capability for training run
    - T2:
        - Mixture of Experts (needs Chinchilla+) -> sparse activation, quote: Meta was right all along, effect: reduces inference cost
        - Long Horizon Agents (needs Ex Nihilo) -> model can do agentic things, quote: Why did it do that?, effect: +adoption, +revenue
    - T3:
        - Neuralese (needs Long Horizon Agents) -> model reasons in non-human-readable latents, quote: Because who needs interpretability, effect: huge bump in capability, but -true alignment and widens alignment band
        - Takeoff (needs Long Horizon Agents) -> Recursive Self-Improvement, quote: Uh, are we sure about this? effect: model capability will now slowly grow with time automatically as a percentage of current capability
    - T4:
        - Intelligence Explosion (needs Takeoff, Neuralese) -> quote: The chart just went vertical, effect: the capability growth itself grows, this is the "you are about win or die very fast" node
        
- AI alignment
    - T1:
        - RLHF++ -> better preference training, quote: We taught it what we like. Hopefully we like the right things, effect: small +true alignment
        - Evals Harness -> systematic dangerous capability testing, quote: Turns out we haven't solved alignment yet. But at least we know it now, effect: small narrowing of alignment bound
    - T2:
        - Scalable Oversight (needs RLHF++) -> weaker models supervise stronger models, quote: This will definitely work!, effect: alignment gets a small bonus depending on your capability
        - Mechanistic Interpretability -> quote: Something, something, superposition, effect: medium narrowing of alignment band + boosts to alignment work
    - T3:
        - Glass Box (needs Mechanistic Interpretability) -> MI basically solved, quote: Just deactivate the deception circuit, effect: large narrowing of alignment band + boosts to alignment work
        - Corrigibility Core (needs Mechanistic Interpretability) -> shutdown acceptance, quote: We built an off-switch. Hope this works, effect: might prevent bad events with a certain percentage
    - T4:
        - Provable Alignment (needs Glass Box, Corrigibility Core) -> quote: We actually did it, effect: alignment band collapses, you know your true alignment, huge boost to alignment
- cybersecurity:
    - T1:
        - Secure Enclaves: quote: You can't steal what you can't reach, +govt trust
        - Red Team Automation: quote: Definitely the most fun job ever, +robustness
    - T2:
        - Formal Verification: quote: This program is safe. And I have the 152 page paper to prove it, effect: +robustness, if Glassworm hits you get a positive effect
        - Confidential Compute: quote: Trust is for suckers who can't do encryption, effect: +govt trust
    - T3:
        - Zero-Day Factory, quote: Nothing will go wrong here, effect: +govt trust
        - Unbreakable: robustness is maxed, quote: Turns out you can just fix all the bugs, +govt trust
- robotics
    - T1: Dark Factories, quote: who needs lights if you can have robots do everything?, effect: reduces chip cost
    - T2: Self-Replicating Factories, quote: Yes, this will be great, effect: drastically reduces chip cost
    - T3: Atomically Precise Manufacturing -> build anything atom-by-atom, quote: This will be great, right?, effect: collapses chip cost to near-zero and lets you manufacture chips
- biology
    - T1:
        - AlphaFold-Complete: Solve all protein structures, quote: We have the source code for life, effect: huge +adoption, +revenue per license
    - T2:
        - Programmable Proteins (needs AlphaFold-Complete): design proteins to spec, quote: And now we can write our own code, effect: unlocks a huge a profitable govt contract, +adoption, +revenue per license
        - Universal Vaccines (needs AlphaFold-Complete): rapid vaccine for any pathogen, quote: Pathogen? What pathogen?, +govt trust, hard counter for Engineered Pathogen
    - T3:
        - Anti-Aging (needs Programmable Proteins) -> AI-designed therapies that slow/reverse aging, quote: What was that about the importance of death?, effect: huge +public trust, huge +adoption
        - Climate Change Solved (needs Programmable Proteins) -> quote: We just solved it..., effect: huge +govt trust, huge +public trust
- warfare
    - T1: Drone Swarms, quote: Uh oh, effect: +govt trust and a nice govt contract, but +race fear rival govt, enables Autonomous Drone Swarm jailbreak event
    - T2: Transparent Oceans (needs Drone Swarms) -> sensor fusion makes seas transparent, submarines can no longer hide, quote: Eeeeeeeh..., effect: big govt trust plus for you + race fear of both govts spikes
    - T3: Deterrence Collapse (needs Transparent Oceans) -> AI-directed defenses that can plausibly neuter a nuclear strike, quote: Maybe we should stop this?, effect: giant govt trust plus for you + race fear of other govt spikes drastically
    - T4: Strategic Monopoly (needs Deterrence Collapse) -> quote: Ah, might as well go all the way, effect: a gamble, either you become a national champion and are handed huge cash, an insanely profitable govt contract OR you are nationalized and lose depending on govt trust (probabilistically)

Important mechanic notes:
- the biology nodes should be very profitable, this is what pushes the player to unlock them despite the fact that bio jailbreaks end the game

Every research node is gated behind a certain capability (the more impact the research the higher the capability) and then you need to actually do the research by spending some money on the node and waiting for some time.
The research nodes have certain implications for the world.

## Diplomacy Tree

This is the path to the "global AI pause" victory.
You have a tree and you unlock things step by step if certain preconditions are met and you invest a certain amount of money.
If you manage to work up your way to "global AI pause" you win.

T1:
- Transparency Pledge, effect: +public trust
- Shared Incident Reporting, effect: +public trust
T2:
- Joint Safety Institute (requires: Transparency Pledge & some min. risk fear), effect: small alignment bonus for all labs, -race risk for all govts
- Red Phone (requires: Shared Incident Reporting & some min. risk fear), effect: reduces effects of jailbreaks by a bit, -race risk for all govts
T3:
- Hardware-Verified Compute (requires both T2 cybersecurity nodes researched), required for Compute Cap Treaty, effect: -race fear for all govts
- Compute Cap Treaty (requires Hardware-Verified Compute), effects: caps everyones max chips
T4:
- Global AI Pause (requires Compute Cap Treaty), effect: you win

Additionally, there are certain small actions you can take (every X weeks):
- Charm Offensive -> small race-fear reduction with a govt of your choice, costs you very little cash
- International Summit -> slightly larger race-fear reduction globally, costs you some cash
- Sound the Alarm -> raises risk fear in all govts, +public trust, costs you some revenue
- Backchannel negotations -> reduces race fear in a govt of your target, small percentage of an increase in race fear of other govt if talks come to light

## Player Actions

You already know the mechanics, but let's still consider the perspective of the player, i.e. what they actually do.

1. Launch / abort training runs - the big commitment decisions. Pick size, allocate compute and go.
2. Allocate compute between training / inference / alignment - this is the most important dial you are playing around with.
3. Post-training: This is where you can do minor improvements over your model
4. Research: Pick nodes on tree, pay and wait
5. Fundraise
6. Buy chips
7. Set license price: Note that higher prices might lead to lower revenue if the demand is not enough
8. Hire/poach/fire people (C-level and star researchers)
9. Respond to events
10. Diplomacy tree
11. Small diplomacy actions

## Resolved Design Decisions

### Endgame
- The alignment roll happens automatically the moment flagship capability crosses the threshold (100). No "flip the switch" choice — with RSI running you can drift into it.
- The roll is binary: win or lose.
- If a rival hits 100 first and passes their roll, the game ends and it counts as a (weird) win — the end screen should reflect the ambivalence. If they fail the roll, everyone loses. The effective game clock is the fastest rival.

### Jailbreaks
- Rival models get jailbroken too. Their trust/valuation penalties hit them; global effects (adoption crash, risk-fear spikes, compute loss) hit everyone.
- Trigger is a weekly probability driven by capability, robustness and adoption only — licenses sold do not matter (an unserved model can still leak).
- Severity thresholds (low/medium/high/very high capability buckets) to be tuned via simulation.

### Models
- A new model's alignment/robustness depend somewhat on the previous flagship plus a large random component.
- Post-training gives minor bumps to all three: capability, alignment, robustness.
- Alignment compute both raises true alignment and narrows the band, with diminishing returns.
- A finished model does NOT auto-promote: you see its evals, it sits in cold storage with all other models, and you choose which model to promote. Exactly one flagship is served at a time.
- The displayed alignment band always contains the true value (deceptive evals out of scope for now).

### Rival labs
- Full symmetry: rivals run the exact same simulation (cash, board, research, compute, alignment), driven by AI.
- Visibility: you see rivals' true capability, valuation etc., and their researchers/C-suite (needed for poaching). You do NOT see their training runs.

### Diplomacy
- Treaty nodes require rival agreement. Agreement probability is a function of the capability gap (a lab far ahead of you refuses). To keep it simple with 3 rivals: only the 2nd-strongest rival is checked; the rest agree automatically.
- Compute Cap Treaty: chips above the cap are destroyed.

### People / Board
- The player character is the CEO and has their own charisma/credibility stats.
- Head of Research: bonuses to research tree speed/cost (distinct from CTO's training bonuses).
- Board demands are event-driven. Seat dilution is one-way — no winning seats back (for now).

### Economy
- Bankruptcy: grace period + emergency raise at brutal terms before it's game over.
- Chips don't depreciate but do become obsolete over time.
- US vs China labs use the same mechanics but the two governments behave differently, reflected in their events (China does China things, USA does USA things).

### Pacing / misc
- ~5–10 real seconds per game week at 1x. Game spans roughly 2026 to 2032/33; a playthrough targets ~1 hour.
- Multiple research nodes can run in parallel.
- Robustness is 0–100, like alignment.

### UI
- Dark, slightly unnerving palette fitting the theme.
- Notification-hub structure (Football Manager / Paradox pattern):
  - **Two-tier persistent top bar.** Tier 1 = resources, always as numbers: cash, net/wk, runway, valuation, compute, date + speed controls. Tier 2 = state chips: capability, alignment band, robustness, both trusts, board seats + discontent, weekly jailbreak risk. Chips are small and calm by default but grow/change color when entering a danger zone; clicking a chip jumps to its tab.
  - **Overview tab = inbox + race.** A notification feed (dominant), the you-vs-rivals capability race chart with the 100 threshold line (the scoreboard/doom clock), the compute allocation sliders (the most-touched dial stays on the hub), and a slim read-only "active commitments" column (training run w/ abort, research queue, treaty progress) with click-through.
  - **Three notification severities:** blocking events (modal, pauses game) · warnings (persistent colored feed cards) · ticker (gray one-liners, aggregated per week so 4x speed doesn't spam the feed).
  - **Every notification deep-links** to the tab where you act. Rule: every decision surfaces on the Overview tab; every action is one click from it. (Replaces the old "all actions on the main tab" requirement.)
  - Everything else lives in dedicated tabs: Models (flagship, vault, post-training, training runs), Research, Diplomacy, People, Finance (P&L, fundraising, license pricing, chip purchases), Rivals, World.
- Strict visual hierarchy: important things larger, consistent spacing.

## DLC Ideas (Dont Implement Yet)

Government DLC:
- You can additionally play as a head of government and there is a richer simulation of government

Security DLC:
- Additional mechanics around model weight theft, research espionage, additional roles like CISO and so on
