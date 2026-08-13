# How to work in here

- Keep the dev server running (`pnpm dev`) while working so you see changes as
  you make them, then kill any dev or preview servers you started when you are
  done with them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. The failure
  message is the instruction: it tells you the file, the line, or the contract.
  Treat a red check as authoritative --- the page is wrong until the check is
  green, not until you decide it should be.
- Never edit, replace, rename, or delete `spec/invariants.test.ts`; treat that
  file as immutable and fix the implementation when one of its tests fails.
  Follow the scoped test-driven-development rule below for new coverage.
- Commit when the checks pass. Never commit a red state.
- Never suggest, ask about, or perform publishing/deploying the site (e.g.
  pushing to GitHub Pages, merging to the deploy branch) unless I explicitly
  say so.
- Prefer working directly on `main` and avoid creating git worktrees for this
  repo when there's a choice. If a background or automated session's tooling
  enforces isolation and requires one, that's fine without asking first ---
  but default to staying on `main` whenever the work doesn't force otherwise.
- Any major change (new page, content rewrite, layout or CSS change) needs
  visual verification at both marked viewports (1920×1080 and 390×844) in
  actual Chrome --- but do this once, as a final check once the whole task is
  done, not after every intermediate step along the way. Do not perform
  viewport testing for minor fixes. `pnpm check` proves structure, not that a
  human can read the page. Use `pnpm preview` (not `file://` --- the built
  site's asset URLs break over the opaque `file://` origin), and measure rather
  than eyeball where possible (e.g. `scrollWidth === clientWidth`, not just a
  screenshot).
- Internal navigation links use paths relative to the current page (e.g.
  `./`, `./about/`), never `import.meta.env.BASE_URL` or a root-absolute
  path --- the deployed site lives under a `/<repo-name>/` path, and a
  relative link resolves correctly there without needing the base baked in.
- **Deep testing, on request only.** Verifying at both marked viewports is the
  standing default; going further --- the deep performance suite below,
  keyboard-only navigation, a resize mid-interaction, or slow-connection
  behaviour --- is real work and takes real time, so only do it when I
  explicitly ask for it. When I do ask about performance, GPU/resource use,
  low-end hardware, or slow networks, run the full suite rather than treating
  the fast bundle budgets or a smooth frame rate on this machine as evidence.

## Tests

- **Use TDD for significant, testable code changes.** For a feature, behavioural
  change, non-trivial state/data mapping, algorithm, or risky refactor, first
  add or adjust the smallest focused test that expresses the intended contract.
  Confirm it fails for the expected reason, then implement until it passes.
  Prefer extending the nearest existing test file over creating another suite.
- **Do not add a test for every minor fix.** Copy edits, small style tweaks,
  obvious one-line corrections, mechanical cleanup, and implementation details
  already covered by a durable behavioural test should use the existing checks.
  Add regression coverage for a small fix only when it closes a distinct,
  plausible failure mode that could recur. The goal is high-value backpressure,
  not a suite that grows by one test for every edit.
- Run `pnpm test` for the complete automated test suite. It builds the site
  first, then runs the generic page invariants, built timeline/fallback checks,
  timeline mapping unit tests, interactive scroll/DOM tests, evidence-script
  tests, and performance regression budgets.
- During focused timeline work, use
  `pnpm exec vitest run src/scripts/timeline.test.ts` for the pure mapping and
  data checks, or `pnpm exec vitest run src/scripts/main.test.ts` for the
  browser-DOM interaction checks. Neither focused command needs a fresh build.
- Use `pnpm test:performance:budgets` for the quick deterministic regression
  gate when changing assets, bundles, or per-frame mapping code. Use
  `pnpm check` before committing because it also performs type checking, a
  production build, linting, and the full Vitest suite.
- `spec/timeline-page.test.ts` and `spec/invariants.test.ts` inspect `dist/`.
  Build first when running either file directly so they test current output.

## Deep performance suite

Run `pnpm test:performance` only when deep performance testing is explicitly
requested. It builds production output, runs the deterministic budgets, starts
an isolated static server at the real GitHub Pages base path, and drives the
installed stable Chrome. It writes timestamped reports plus `latest.md` and
`latest.json` under the gitignored `performance-results/`; always read the
Markdown summary and inspect the JSON samples behind any surprising result.

The browser pass cold-loads and sweeps the entire timeline under three named
profiles:

- the 1920×1080 marking desktop at native speed;
- the 390×844 marking phone at DPR 3, 4× CPU slowdown, and Slow 4G;
- a 1366×768 low-end laptop at 6× CPU slowdown and Slow 4G.

For each profile it records navigation/FCP/LCP/CLS, request and transfer size,
long tasks and total blocking time, JavaScript heap, frame misses during a full
timeline sweep, the delayed present-day texture load, browser errors, and
WebGL renders while the globe is offscreen and while reduced motion is active.
CPU and network slowdown are Chrome emulation; they are controlled comparison
profiles, not claims to reproduce one particular phone.

The GPU pass is deliberately separate. A normal `requestAnimationFrame` delta
is vsync-clamped and cannot show whether a render used 5% or 95% of the GPU
budget --- PR #20 demonstrated that exact false signal. The suite first
measures Chrome's refresh interval on a blank page, then temporarily raises the
globe's drawing-buffer load until frames actually miss vsync and fits only
the mean delivered cadence of those saturated samples (the mean preserves
fractional throughput that a vsync-quantised median loses). It reports
procedural and present-day states separately, the WebGL renderer, fit quality,
milliseconds per megapixel, and a prediction at the shipped 1.25 Mpx cap.
Never present unsaturated frame cadence as GPU execution time.

Useful variants:

```sh
PERF_RUNS=3 PERF_LABEL="M1 MacBook Air" pnpm test:performance
PERF_HEADED=1 PERF_LABEL="Intel lab laptop" pnpm test:performance
PERF_URL="https://comp4020-agentic-coding-studio.github.io/comp4020-ass1-am167/" pnpm test:performance:browser
```

Set `PERF_CHROME_PATH` only if stable Chrome is installed outside its standard
platform location. `playwright-core` is intentional: the suite tests the same
installed Chrome family as the marking environment and does not download a
separate browser binary.

Use three runs when comparing a before/after or two machines; compare like for
like (same Chrome version, headed/headless mode, refresh rate, profile, and
shader state). A headed run is the final authority for hardware/GPU or thermal
claims. If the report flags a software renderer such as SwiftShader, its CPU,
network, and long-task data remain useful but its GPU slope does not represent
the installed GPU. Warnings are diagnostic leads because hardware varies;
browser errors, eager present-only textures, and violation of the drawing-pixel
cap are hard failures. Do not commit generated reports unless I explicitly ask
for a captured baseline.

## Dependencies

`pnpm-workspace.yaml` sets a `minimumReleaseAge` window: freshly published
package versions cannot be installed. This is a defence against active npm
supply-chain attacks --- hijacked maintainer accounts publishing malicious
releases that steal cloud credentials, npm and CI tokens, worm themselves into
other packages, and install persistence on whatever machine runs `install`. The
window *is* the protection: it keeps those releases out of this repo during the
hours before they're detected and pulled from the registry.

Never circumvent it, under any circumstances. Do not lower it, disable it, set
`trustLockfile`, add a blanket `minimumReleaseAgeExclude`, or sidestep it in a
scratch directory or "just for testing" --- and never suggest doing any of those.
No deadline, red check, or blocked install justifies it; a guard that gets
switched off when it's inconvenient is not a guard. If it blocks something, stop
and tell me.

## Process logging

After each meaningful chunk of work --- a feature, a fix, a design decision ---
append a short entry to `notes/log.md` describing what was done and why. Do
this as we go, not reconstructed at the end of the assignment. Keep entries
terse; they're raw material for `PROCESS.md`, not the write-up itself, so log
generously rather than sparingly.
