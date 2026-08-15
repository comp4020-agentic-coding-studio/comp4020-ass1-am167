# Process overview

## What I built

Earth Through Time is an interactive scroll-driven journey through Earth's past and future. As users scroll, the globe evolves through 62 real, scientifically grounded moments, from the planet's formation to its distant future as a lifeless rock.

## The moments that mattered

### Abandoned scroll resistance after using it

Across PRs #9, #10, and #11, I noticed users could accidentally scroll past events and get stuck half-transitioned. I kept trying to fix this by making each era harder to skip: first accumulating scroll input, then adding cooldown and smoothing on top. On my third attempt, instead of another round of tuning, I reverted both merged PRs and closed the third, knowingly throwing away work I'd already reviewed and merged into main.
What drove that decision was realising the tests were never going to catch what felt wrong. The logic and DOM state were correct, and `pnpm check` stayed green throughout. But using it myself, it still felt off. Continuous scrolling wasn't registering, it felt jittery, and the smoothing made transitions between eras feel less direct.
I was just tuning numbers, not improving the experience. The interaction itself had to be the deciding signal, not the test suite. That gave me a rule for future work: if adding friction to a primary input doesn't improve the experience immediately, revert to native behaviour rather than keep asking for fixes.
[`556b153`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/556b153)
[`77740fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/77740fb)
[PR #11](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/pull/11)

### Turned a blanket test ban into a scoped TDD rule

The starter template encouraged a new test whenever something broke, so the spec kept expanding each iteration instead of staying focused on real constraints. My first fix was to remove the starter test, make `spec/invariants.test.ts` immutable, and tell the agent to add tests only when I explicitly asked ([`8271304`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/8271304)).
That was too restrictive, it blocked useful regression coverage for genuine behavioural changes. I replaced the blanket ban with a scoped TDD rule: for significant, testable changes (a new feature, a state mapping, a risky refactor), start with the smallest failing test; for copy edits, style tweaks, or changes already covered, skip additional coverage ([`04b39c6`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/04b39c6)).

### Wired performance into the harness, not the prompt

After a major graphics overhaul, everything looked fine on manual review, smooth scrolling, all checks green. But my GPU was pinned at 100% and the fans were loud. I asked the agent to check; it reported 8.3ms per frame, but a separate agent pointed out that number was meaningless on its own.
Capping rendering to 60fps only masked the symptom on my machine. Rather than keep prompting for one-off tweaks, I had a separate agent build the performance test suite the harness was missing: it calibrates the display's refresh rate, deliberately saturates the GPU until frames miss, and reports cost per pixel. I updated CLAUDE.md so agents know how to use it. That suite let a new agent find the actual performance gaps and fix them.
[PR #20](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/pull/20)
[`0e2662d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/0e2662d)
[PR #22](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/pull/22)

### What the finished page caught that no test could

By the end, the page passed everything I'd built to evaluate it, tests green, both viewports validated, spec reviewed. But reading the closing paragraph myself, it felt empty: lines like "Endings are transformations" sounded polished without saying much.
No test would catch that, and rewriting those two lines myself would only have fixed those two lines. So I looked at what made the strongest parts of the page work: they were concrete, oceans, ice, a pixel, a tenth of a second, while the weak ones stayed abstract.
I gave that rule back to the agent to rewrite the closing section, then checked the two figures it kept rather than taking them on faith: written history really is about 0.095 seconds of a 24-hour Earth, and roughly 0.015 pixels of the page's scroll. A reminder that even after the tests pass, the page still has to be read and felt on its own terms.
[`8e47c52`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-am167/commit/8e47c52)
