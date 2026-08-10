# How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
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
  Create additional tests only when I explicitly ask you to.
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
  done, not after every intermediate step along the way. `pnpm check` proves
  structure, not that a human can read the page. Use `pnpm preview` (not
  `file://` --- the built site's asset URLs break over the opaque `file://`
  origin), and measure rather than eyeball where possible (e.g.
  `scrollWidth === clientWidth`, not just a screenshot).
- Internal navigation links use paths relative to the current page (e.g.
  `./`, `./about/`), never `import.meta.env.BASE_URL` or a root-absolute
  path --- the deployed site lives under a `/<repo-name>/` path, and a
  relative link resolves correctly there without needing the base baked in.
- **Deep testing, on request only.** Verifying at both marked viewports is
  the standing default; going further --- keyboard-only navigation, a resize
  mid-interaction, throttled/slow-connection behaviour, anything probing
  whether the site holds up under use it wasn't designed for --- is real
  work and takes real time, so only do it when I explicitly ask for it. Don't
  run it proactively "while we're at it," and don't fold it into the routine
  final-check pass.

## Tests

- Run `pnpm test` for the complete automated test suite. It builds the site
  first, then runs the generic page invariants, built timeline/fallback checks,
  timeline mapping unit tests, interactive scroll/DOM tests, evidence-script
  tests, and performance regression budgets.
- During focused timeline work, use
  `pnpm exec vitest run src/scripts/timeline.test.ts` for the pure mapping and
  data checks, or `pnpm exec vitest run src/scripts/main.test.ts` for the
  browser-DOM interaction checks. Neither focused command needs a fresh build.
- Use `pnpm test:performance` when specifically changing assets, bundles, or
  per-frame scroll work. Use `pnpm check` before committing because it also
  performs type checking, a production build, linting, and the full test suite.
- `spec/timeline-page.test.ts` and `spec/invariants.test.ts` inspect `dist/`.
  Build first when running either file directly so they test current output.

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
