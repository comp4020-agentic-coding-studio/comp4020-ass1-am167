# Process overview

## What I built


## The moments that mattered

### Turned accidental timeline skips into deliberate steps

The 62-event timeline initially treated scrolling as one completely continuous track, so a trackpad flick could cross several events or stop midway through a text and globe transition. I first added native snap points at every era, which fixed the half-transition resting states, but testing in Chrome showed that a high-momentum gesture could still jump across several snap points. I kept those lightweight settle points for touch and scrollbar movement, then added a small wheel/trackpad threshold that advances only one milestone per gesture and absorbs its remaining momentum. Both the visual state and stop positions are derived from the same present-day pause mapping, so the interaction stays reversible and the intentional “Now” dwell cannot drift away from its label. I verified the result at both marked viewports: arbitrary scroll positions settled on complete eras, a large wheel gesture requested exactly the next event, mobile stayed free of horizontal overflow, and the final stop still released normally into the conclusion. [`3c7c7d7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/3c7c7d7)

### Enforced test immutability at the harness level

The starter test template invited adding new tests every time something broke, which meant the spec grew with every iteration instead of staying focused on the real constraints. Instead of re-prompting the agent to ignore this invitation each time, I removed the starter test, made `spec/invariants.test.ts` immutable, and hardened `CLAUDE.md` to require explicit approval for new tests. This shifted the default from "add a test" to "fix the implementation," preventing scope creep and keeping the spec focused on the invariants that actually matter. The verification was immediate: `pnpm check` now rejects new test additions outright, and the spec stayed stable across all subsequent work. [`8271304`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/8271304)

### Added a boundary rule for deep testing

The temptation to check keyboard-only navigation, mid-interaction resizes, and slow-network behaviour crept into every review cycle—each time it was reasonable to check "while we're at it," but together they ballooned the default verification. Instead of re-prompting the agent to ignore this creep each cycle, I added an explicit `CLAUDE.md` rule that these are real extra work and only happen on request, not folded into routine final checks. This protected the default workflow from expanding and made it clear when deeper testing is a change in scope, not a refinement. The result was immediate: subsequent final checks stayed focused on marked viewports and the check suite, and keyboard-only or slow-connection testing only ran when I explicitly asked for it. [`06f0900`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/06f0900)

### Built a layered planet that responds independently to each era

The first Earth was a single painted sphere where every visual change — red heating, white atmosphere, cloud shifts — happened at once. Instead of painting all effects into one texture and hoping it looked coherent, I split the planet into independent renderers: textured terrain, ocean with specular mask, rotating cloud shell, and atmospheric scattering. Each layer responds to era transitions separately, so the Sun's expansion can heat the planet and Moon visibly without flattening their appearance into one wash effect. The approach also made the timeline's visual transitions feel coherent rather than tacked on, because each layer's change reinforced the others. The no-WebGL fallback received matching depth, clouds, and atmosphere treatment so the CSS globe no longer reads as a flat disc. I verified this worked by checking the page at both marked viewports and watching the planet through several era transitions to confirm each layer responded as intended. [`5c17951`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/5c17951)
