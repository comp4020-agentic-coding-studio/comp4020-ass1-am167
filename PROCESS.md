# Process overview

## What I built

Earth Through Time is intended to be an interactive journery though the history and the future of the Earth. As users scroll, the globe changes across 62 meaningful moments, from the planet's formation to its distant future as a dead rock. All moments are grounded in real scientific research.

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

### Wired performance into the harness, not the prompt

Scrolling was smooth and every check green, but my GPU sat at 99% and the fans
were loud. The agent's evidence was 8.3 ms a frame — a requestAnimationFrame
delta clamped to vsync, which would read 8.3 ms whether the shader cost one
millisecond or eight. Its first fix, a 60 fps cap, only helped the machine it
ran on. The obvious move was more prompting. Instead I had it build the missing
instrument: a suite that calibrates refresh, saturates the GPU until frames
miss, and reports per-pixel cost, with CLAUDE.md barring unsaturated cadence as
evidence. It immediately found the globe shading 121 frames a second off-screen
and under reduced motion.
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
