# Process overview

## What I built

Earth Through Time is a scroll-driven explainer. One WebGL globe carries 62
researched moments from the planet's formation to the white dwarf that outlives
it, with "now" placed at 58% of the journey so the future gets real space. The
scroll stops at the present and holds there before letting you continue.

## The moments that mattered

### Abandoned scroll resistance after using it

PRs #9, #10 and #11 tried to make each era harder to skip: first by accumulating
wheel input, then by adding cooldown and smoothing on top. The obvious next step
was a fourth attempt at tuning. Instead I reverted both merged PRs and closed the
third, throwing away work that had already been reviewed and shipped to main.

What made that call possible was that the tests never disagreed with me. The
threshold logic and DOM state were provably correct and `pnpm check` stayed green
through all three attempts; what failed was using it — continuous scrolling
registered as having stopped, the copy jumped before settling, and the smoothing
I added to fix that made the transition feel less direct rather than more. Each
attempt moved the numbers and not the experience. The deciding sensor had to be
the interaction itself, not the suite, and the boundary it set holds: friction
added to a primary input has to improve things immediately, or browser-native
behaviour is the better baseline.
[`556b153`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/556b153)
[`77740fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/77740fb)
[PR #11](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/pull/11)

### Enforced test immutability at the harness level

The starter template invited a new test every time something broke, so the spec
grew with each iteration instead of staying focused on the real constraints.
Rather than re-prompting the agent to resist that every session, I removed the
starter test, made `spec/invariants.test.ts` immutable, and hardened `CLAUDE.md`
to require explicit approval before any test is added. That moved the default
from "add a test" to "fix the implementation". It held: the spec stayed stable
across every change that followed, and new coverage since has arrived only when
I asked for it.
[`8271304`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/8271304)

### Rejected an optimisation my own metric endorsed

I had reported the globe at 8.3 ms a frame. It was a requestAnimationFrame
delta clamped to vsync: it would have read 8.3 ms whether the shader cost one
millisecond or eight. It could not fail, so it was not evidence; what
contradicted it was a laptop's fans, not a check. The obvious repair was to
tune the shader. Instead I built a harness that scales the drawing buffer until
the GPU misses refresh, so the figure can fail out loud. It then caught me:
trimming noise octaves moved its headline duty cycle from 88% to 62% while the
measured slope stayed flat. The gain was fit artefact; I reverted it.
[PR #20](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/pull/20)
[`0e2662d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/0e2662d)
[PR #22](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/pull/22)

### What the finished page caught that no test could

By the final week the page passed everything: 47 tests, both marked viewports, a
full review against the published spec. Read aloud, the conclusion was still
words with no real meaning — "Endings are transformations", "Earth is temporary,
but not insignificant". No check I could write would catch that. Rather than
rewrite by feel, I worked out why the good lines were good: the ones that land
name things — oceans, ice, a pixel, a tenth of a second — and the ones that
failed named concepts. I rewrote against that rule, then verified the two lines I
kept rather than trusting them: written history really is 0.095 s of a 24-hour
Earth, and 0.015 px of this page's scroll.
[`8e47c52`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/8e47c52)
