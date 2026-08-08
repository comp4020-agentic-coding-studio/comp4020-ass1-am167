# Plan: Earth Through Time

## The idea

An interactive explainer of Earth's entire lifespan — formation to destruction
— where **scroll position is time**. As the visitor scrolls down, the page
moves forward across ~14 billion years: the solar nebula collapsing into a
planet, the first oceans, the first life, the rise and fall of the dinosaurs,
humans, the present moment, and onward past it to the Sun's red-giant phase
swallowing the Earth. One mechanic (scroll = time), one dataset (a timeline of
Earth/solar-system milestones), nothing else layered on top.

The point of view: most people's mental model of "Earth's history" is a flat
list of facts (dinosaurs, ice ages, humans) with no felt sense of *scale* —
that humans are a rounding error at the very end, and that the planet's death
is already scheduled and mundane, not a hypothetical. Scroll-as-time can make
that scale visceral in a way a list or infographic can't: most of the scrolling
happens before anything recognisable exists, and the entire span of human
history is compressed into a sliver you could miss if you scroll too fast.

## Inspiration (genre exemplars from the brief)

The brief names six exemplars of "one strong idea, one dataset or mechanic,
and nothing else." Worth being explicit about what this project borrows from
each, so the scope discipline stays grounded in examples rather than just
asserted:

- **[The Deep Sea](https://neal.fun/deep-sea/)** — scroll as the interface;
  depth *is* the data. This is the closest sibling to this project's mechanic
  (scroll as time instead of scroll as depth) and the main thing to borrow:
  scroll *distance* should track felt significance, not literal linear time —
  Deep Sea doesn't give the Mariana Trench the same pixel-height as the
  sunlit zone just because both are "a depth range." Same logic applies here:
  the ~9 billion years where nothing visibly changes should take a *lot* less
  scrolling than the last 66 million years, even though it's almost none of
  actual elapsed time. This directly informs the "scroll-length weighting"
  open question already in this plan.
- **[Mechanical Watch](https://ciechanow.ski/mechanical-watch/)** (and
  [Airfoil](https://ciechanow.ski/airfoil/)) — the genre's ceiling, where
  every part is manipulable and the explanation *is* the interaction. The
  globe is this project's one shot at that quality: it's worth asking, once
  the core scroll mechanic is solid, whether the globe should also respond to
  direct manipulation (drag to rotate, hover to pause the idle spin) rather
  than being purely scroll-driven and otherwise passive — a stretch goal, not
  a requirement, and only after the scroll mechanic itself is right.
- **[Absurd Trolley Problems](https://neal.fun/absurd-trolley-problems/)** —
  branching interaction as narrative, humour as engagement. Explicitly *not*
  borrowing the branching (this plan is deliberately linear, see "what's cut"
  below), but worth remembering register is a free variable: the brief says
  "earnest, playful, polemical — any register works," and a linear scroll
  through a planet's entire life doesn't have to be delivered dryly. Worth
  deciding the copy's voice deliberately rather than defaulting to museum-
  placard neutral.
- **[Spend Bill Gates' Money](https://neal.fun/spend/)** — a single absurd
  mechanic carries the whole page. Reinforces the "one mechanic, nothing
  else" discipline; not otherwise a close sibling to this project.
- **[Film Dialogue](https://pudding.cool/2017/03/film-dialogue/)** and
  **[Human Terrain](https://pudding.cool/2018/10/city_3d/)** — data
  journalism/scrollytelling at the more "serious dataset" end of the genre,
  closer in tone to what this project's actual content (real geological and
  astrophysical history) probably wants than the more absurdist exemplars
  above. Worth a look for how they pace scroll-triggered reveals of dense,
  real data without it reading as a slideshow of facts.

## Core interaction (must be testable)

**Scrolling the page moves a time cursor forward through Earth's history.**
Concretely:

- The page's scroll progress (`scrollTop / (scrollHeight - clientHeight)`, a
  0–1 fraction) maps onto a timeline from t = 0 (formation, ~4.6 bya) to
  t = 1 (a defined end state — the Sun's red-giant expansion, ~5–7.5 bya from
  now).
- At any scroll position, the page displays: a current-era label/date, and
  content (text + visual) for the nearest milestone(s) on the timeline.
- Scrolling back up moves the cursor backward — it's not a one-shot animation,
  it's a continuous function of scroll position, so a visitor can rewind to
  re-read something.
- **Test hook**: given a scroll fraction, the displayed era/date is
  deterministic and monotonic in time as the fraction increases. This is
  checkable without a real browser scroll — compute the mapping function
  directly (e.g. `timeForScrollFraction(0.5)` returns a plausible bya value)
  and assert the DOM's displayed label updates when a scroll/resize event
  fires at a given `scrollTop`.

Non-interactive fallback: if JS fails to load, the spec requires the invariant
checks to still pass (basic structure, no console errors) — the page should
degrade to a plain readable scroll of the same content in document order,
not a blank screen.

## Timeline content (the one dataset)

Rough milestone list — this is the thing to prune hardest; a shorter, well-
chosen list beats a long one that dilutes the point of view. Draft milestones,
roughly log-scaled in "time before/after now" so early eras don't dominate all
the scroll space at the expense of everything since life appeared:

1. **Formation** — ~4.6 bya, solar nebula collapses, Earth accretes
2. **Moon-forming impact** — ~4.5 bya, Theia collision
3. **First oceans / crust** — ~4.0 bya
4. **First life** — ~3.8–3.5 bya, single-celled organisms
5. **Great Oxidation Event** — ~2.4 bya, cyanobacteria change the atmosphere
6. **First complex/multicellular life** — ~1.5 bya – 600 mya
7. **Cambrian explosion** — ~540 mya
8. **Age of dinosaurs** — ~230–66 mya
9. **Asteroid impact / mass extinction** — 66 mya
10. **Rise of mammals, then humans** — last few million years, compressing fast
11. **Recorded human history** — last ~5,000 years (a sliver)
12. **Now** — the present moment, explicit marker
13. **Near future** — climate trajectory, next few centuries (kept brief and
    factual, not the centre of gravity of the piece)
14. **Sun becomes a red giant** — ~5 bya from now, oceans boil, Earth
    possibly engulfed
15. **End state** — Earth as a scorched/consumed remnant; the Sun a white
    dwarf

Milestones 11–13 (recorded history / now / near future) are the ones held to
the "one screen-height combined" compression above — everything else on this
list gets proportionately more room the further it sits from the present.

Each milestone needs: a date, a short label, 1–3 sentences of text, and a
simple visual (illustration, color palette, or generated graphic — no need for
photographic assets). Visuals can be CSS/SVG-driven rather than large images,
which keeps the build static and fast.

### Scroll-length weighting (decided)

**"Now" and the future are deliberately compressed, not given equal weight to
the deep past.** This was an open question and is now resolved: recorded
human history, the present moment, and everything after it get noticeably
*less* scroll-length than an even or "importance-weighted" split would
suggest — not because they matter less to the visitor, but because
under-weighting them is the point being made. It's the same logic as The
Deep Sea's depth-as-scroll (see "Inspiration" above), pointed at time instead
of distance: if "now" got a proportionate, comfortable amount of scroll space
the way it would in a normal timeline infographic, the piece would just be
restating the usual human-centred view of history rather than correcting it.

Concretely, this means:

- The overwhelming majority of the scroll track covers the ~4-billion-year
  stretch before anything visually recognisable exists (formation through
  early microbial life) — not because it's the most interesting section to
  read, but because that imbalance *is* the argument.
- "Recorded human history," "now," and "near future" together get roughly
  **one screen-height's worth of scroll**, combined — genuinely easy to
  scroll past in a second or two if the visitor isn't paying attention. That
  disorienting compression, not a caption explaining it, is what should
  deliver the point-of-view.
- The far future (Pangaea Ultima through the Sun's red-giant phase) gets a
  *little* more room than "now" does, since it's new information to most
  visitors rather than something they already hold a mental picture of, but
  it stays far short of the deep-past section's share.
- This needs care at the interaction level too: the "now" section being this
  short means the scroll-to-time mapping can't be perfectly linear (a linear
  map would make "now" occupy a fair scroll-length automatically, which is
  exactly what's being avoided) — the mapping function should be a
  deliberately non-linear curve (e.g. roughly logarithmic in "years before
  present," or a small number of unevenly-sized segments), not
  `scrollFraction * totalYears`. Keep this curve defined in the same typed
  timeline-data module as the milestones themselves, and keep it unit-tested
  in isolation (see "Core interaction" and "Technical approach") precisely
  because it's easy to accidentally flatten back to linear while iterating on
  layout.

## Visuals of Earth itself, through time

On top of the text/label per milestone, the page should show **a rendering of
the whole planet as it would have looked from space at that moment** — the
same "Earth" motif recurring throughout, its surface and atmosphere changing
under the visitor as they scroll, rather than a new illustration style per
era. That single evolving object is what should carry the "one mechanic, one
motif" feel, alongside the scroll-as-time interaction itself.

Practically: **a real rotating 3D globe**, fixed in the same screen position
across the whole page (e.g. pinned centre-right, with text scrolling past
it), slowly spinning on its own axis at all times, whose surface texture and
atmosphere/glow change with scroll position — see "3D globe implementation"
below for how, and the scope-cut section for why this is worth the extra
build effort here specifically.

Research notes on what it should actually look like at each stage (for
whoever builds this — a future agent or session should treat this table as
the source of truth on the science, separate from how it gets drawn):

| Time | Planet's appearance | Why |
| --- | --- | --- |
| ~4.6 bya, formation | A dull, dust-coloured accreting sphere with no defined surface — more like a forming asteroid than a planet | Still assembling from the protoplanetary disk |
| ~4.5 bya, Hadean / after the Moon-forming impact | Glowing red-orange, a global ocean of molten rock; a huge Moon looms close in a dark, star-thick sky | The Theia impact re-melted the surface; Earth had no solid crust yet |
| ~4.4–4.0 bya, late Hadean | Dark basaltic crust cooling, ashen grey-black, lit by constant volcanic glow and lightning; a thick, hazy, likely orange/brown atmosphere with no free oxygen | Crust solidifies, outgassing builds a CO₂/nitrogen/water-vapour atmosphere; the Sun itself was ~25–30% dimmer (the "faint young Sun") |
| ~4.0–3.8 bya | Surface mostly dark rock with the first liquid-water oceans appearing as steel-grey seas under an orange-brown sky | Water vapour condenses once the crust is cool enough; heavy bombardment is tailing off |
| ~3.5 bya, first life | Visually similar to the above — grey-black volcanic islands, orange-brown hazy sky, steel-grey oceans; no visible change from life itself yet, but the story milestone is what's happening at the microbial scale | Life is present but has no planet-scale visual signature for another ~1 billion years |
| ~2.4 bya, Great Oxidation Event | The haze thins and the sky begins shifting from orange/brown toward pale blue; oceans that were rusty from dissolved iron start clearing as that iron precipitates out (visible in the rock record as banded iron formations) | Cyanobacteria's oxygen finally overwhelms the planet's chemical oxygen sinks (dissolved iron, methane); this is arguably the single biggest visual/atmospheric turning point before humans |
| ~2.4–0.6 bya, mid-late Proterozoic | Mostly barren grey-brown-red continents (no land plants yet) against blue oceans and a modern-looking blue sky; supercontinents Rodinia (~1 bya) then Pannotia (~600 mya) assemble and break apart | Continents are barren rock/sediment — vivid green land is still ~400 million years away |
| ~720–635 mya, "Snowball Earth" (Cryogenian) | The entire planet white, edge to edge — a fully ice-covered "snowball" with no visible ocean or land colour at all | Runaway ice-albedo feedback during at least one (possibly several) near-total glaciations |
| ~540 mya, Cambrian explosion | Post-snowball: blue oceans teeming with newly-diverse animal life (invisible at planet-scale) over still-barren, reddish-brown continents; Pannotia has just rifted apart | Rapid diversification of animal body plans in the oceans; land remains lifeless |
| ~470–420 mya | First green fringe visible along coastlines as plants colonise land | First land plants (mosses, then vascular plants) appear |
| ~360–300 mya, Carboniferous | Extensive green lowland forests/swamps across the continents; noticeably higher atmospheric oxygen | Vast coal-forming forests; this is the period most of today's coal comes from |
| ~335–175 mya, Pangaea | A single large brown/green supercontinent dominates one hemisphere, with one vast global ocean (Panthalassa) covering the rest | All major landmasses assembled into one supercontinent; deserts widespread in its dry interior |
| ~230–66 mya, age of dinosaurs | Pangaea has rifted into recognisable proto-continents drifting apart, warm ice-free poles, extensive green cover, no visible sign of dinosaurs at planet scale but a generally warmer, greener-poled Earth than today | Warm "greenhouse Earth" climate, continents actively separating into their modern arrangement |
| 66 mya, Chicxulub impact | A bright impact flash/plume visible from space, then a planet dimmed by a global dust/soot haze blotting out the usual blue-green view for months to years | The asteroid impact and subsequent "impact winter" that ended the non-avian dinosaurs |
| ~34 mya–2.6 mya, cooling into ice ages | Polar ice caps become a permanent, growing feature (visible as white caps) as the planet cools from its Eocene warmth | Antarctic then Arctic ice sheets establish; the "icehouse" climate state we're still in |
| ~2.6 mya–11,700 ya, Pleistocene ice ages | Ice caps and glaciers repeatedly expand much further from the poles than today (visible as a much larger white area) and retreat, cycling roughly every ~100,000 years | Milankovitch orbital cycles driving glacial/interglacial swings |
| Present day | The familiar "blue marble": blue oceans, white swirling clouds, green/brown continents, white polar caps, and — the one artificial addition — visible city lights on the night side | This is the one frame in the whole timeline the visitor already has a mental image of; it should read as unmistakably "now" |
| Near future (centuries, human-driven, kept brief) | Slightly less white at the poles, slightly different coastlines/greening patterns are plausible but genuinely uncertain outcomes of human activity — this section stays short and hedged, since the brief's "no human intervention" framing is really about the deep future, not this stretch | Explicitly out of scope for confident illustration; the spec's point of view is about deep time, not near-term climate punditry |
| ~250 million years from now | Continents have reassembled into a new supercontinent ("Pangaea Ultima") straddling the equator; a scorched, largely lifeless-looking brown/orange interior with a thin green fringe near its coasts | Plate tectonics continues; modelling suggests a mostly-uninhabitable-for-mammals hot interior even before solar brightening is accounted for |
| ~1–2 billion years from now | Oceans visibly shrinking, a duller blue-white "hazy" look as a moist greenhouse develops and water vapour is lost to space; eventually little to no visible surface water | The Sun's slow brightening (~10% more luminous) pushes Earth out of the habitable zone; the "faint young Sun" problem in reverse |
| ~2–3 billion years from now | No visible magnetic-field-driven aurora; a thinning, stripped atmosphere; a duller, more Mars-like reddish-brown globe | The core dynamo may shut down, removing magnetospheric protection, accelerating atmosphere loss to the solar wind |
| ~4 billion years from now | Fully Venus-like: a thick, bright, uniform white-yellow cloud deck hiding any surface at all | Runaway greenhouse effect boils away remaining volatiles; surface temperature exceeds rock-melting point; this is the point at which "all life extinct" is not a contested claim |
| ~5–7.5 billion years from now, Sun's red-giant phase | The Sun itself dominates the view — swollen into a vast reddish disk filling much of the sky — while Earth (if not yet consumed) is a dark, cracked, partially remelted cinder | The Sun leaves the main sequence, expands past Mercury and Venus's orbits; current best estimate (Schröder & Smith, 2008) has the red giant Sun's outer envelope tidally dragging Earth inward and engulfing it around **7.59 billion years from now** |
| End state | Nothing left to show as "Earth" — the timeline's final frame can be the Sun alone, now a small, dim white dwarf, with no planet in view | Total engulfment (the leading hypothesis) or, in the small chance Earth's orbit widens enough to escape first, a bare, sterilised rock orbiting a white dwarf — either way, nothing resembling the "blue marble" survives |

### 3D globe implementation

- **Library**: Three.js (well-established, static-friendly — it's a plain
  npm dependency with no server component, so it fits "static and
  client-side throughout" and builds fine through Astro/Vite). Load it only
  on the client (no SSR concerns here since the whole site is static output
  anyway); keep the import scoped to the one script that needs it so it
  doesn't bloat pages that don't use it (there's currently only the one
  page, but worth the habit).
- **Geometry**: a single `SphereGeometry` with a light/rim-light setup (one
  key light + ambient, or an emissive glow for the molten-Hadean stage) —
  no need for more than that; the interest is in what's *on* the sphere and
  how it's lit, not the mesh complexity.
- **Texture per era, no photography**: since photographic/licensed imagery
  stays cut (see below), each "planet state" texture is generated
  procedurally — draw it onto an offscreen `<canvas>` with gradients, noise,
  and simple shapes (blotchy continents, ice caps, cloud swirls) sized to
  equirectangular-map onto the sphere, then hand that canvas to Three.js as
  a `CanvasTexture`. This keeps every visual asset in code (reviewable,
  regenerable, no binary assets to source or license) and matches the
  "generated visual" instinct from the original 2D plan, just mapped onto a
  sphere instead of a flat gradient.
- **Transition between eras**: crossfade between the current and next
  texture (two meshes or two materials blended by opacity, or blend two
  canvases into one texture per frame) as the scroll fraction moves from one
  milestone's texture to the next's, rather than a hard cut — keeps the
  "continuous function of scroll," not a slideshow, matching the core
  interaction's own continuity requirement.
- **Rotation**: continuous slow spin on the vertical axis regardless of
  scroll (idle animation via the render loop), independent of the scroll-
  driven texture/era changes — two separate axes of motion so scrolling
  doesn't have to also mean "spinning faster," which would confuse scroll
  position with rotation speed.
- **Render loop cost**: pause the `requestAnimationFrame` render loop (or
  drop to a lower rate) when the globe is out of view or the tab is hidden,
  and respect `prefers-reduced-motion` by freezing rotation (texture still
  updates with scroll, just no idle spin) — both matter for the phone
  viewport and for the "holds up under use it wasn't designed for" HD
  artefact criterion (a slow/hot phone shouldn't tank the whole page).
- **Fallback**: if `WebGLRenderingContext` can't be created (rare in Chrome,
  but cheap to guard), fall back to the flat CSS/SVG radial-gradient circle
  from the original plan rather than a blank space — same colour-stop data
  can drive either renderer, so this isn't wasted work if the 3D build hits
  a wall.

Sourcing for the future timeline: Schröder & Connon Smith, *"Distant future of
the Sun and Earth revisited"*, MNRAS 386 (2008) — the paper behind the widely
cited "Sun engulfs Earth in ~7.59 Gyr" figure; and the geologic-history
consensus summarised on Wikipedia's
[Geological history of the Earth](https://en.wikipedia.org/wiki/Geological_history_of_the_Earth)
and [Future of Earth](https://en.wikipedia.org/wiki/Future_of_Earth) pages
(themselves citing the primary literature). Treat the deep-future entries as
"best current scientific consensus with real uncertainty", not settled fact —
it's fine, and honest, for the copy to say so briefly (e.g. "most likely";
"current models suggest").

## Visual approach

- **The planet itself is the visual centrepiece** — a real rotating 3D globe
  (see "3D globe implementation" above), not a static graphic. See "Visuals
  of Earth itself, through time" above for the per-era appearance and the
  sourcing behind it. It stays in a fixed screen position (e.g. pinned
  centre-right on desktop, centred above the text on phone) while its
  texture/atmosphere/glow change with scroll, and it spins continuously on
  its own axis independent of scroll, so the visitor is always looking at
  "the same planet, a different moment" rather than a new picture per
  section.
- A persistent background (space/star field, or a sky-toned gradient once
  there's an atmosphere to speak of) that shifts continuously with scroll
  alongside the planet, reinforcing that time is continuous, not a slideshow.
- A fixed or sticky readout (current date/era) so the visitor always has an
  orientation, independent of which milestone text is currently in view.
- Milestone sections laid out as scroll-snapped or naturally-flowing panels;
  favour plain, readable typography for the body text, with the planet
  graphic as the one piece of "art" carrying the visual weight — not photos,
  not per-milestone illustrations.
- Must hold up at both marking viewports (1920×1080 desktop, 390×844 phone) —
  scroll-driven interaction generally translates well to touch scroll, but
  needs checking: sticky positioning, section heights, and text sizing all
  need explicit phone verification, not just responsive breakpoints assumed
  to work. The planet/text layout will likely need a different arrangement
  per viewport (side-by-side on desktop, stacked on phone) rather than one
  layout scaled down.

## Technical approach

- Stays inside the current Astro static setup — single page
  (`src/pages/index.astro`), no backend needed. Three.js is a client-side
  rendering library, not an app framework, so this doesn't reopen the
  "bare HTML vs. framework" stack decision from earlier.
- `src/scripts/main.ts` owns the scroll listener: reads `scrollY` /
  `document.documentElement.scrollHeight` on `scroll` (throttled via
  `requestAnimationFrame`) and `resize`, computes the time-fraction, and
  updates both the DOM (era/date readout) and the globe (texture crossfade
  target). Keep the time-mapping function pure and exported so it can be
  unit-tested without a DOM or a WebGL context (`scripts/*.test.ts` or
  co-located, per `pnpm check`'s Vitest run) — this is the harness reason for
  isolating that math into its own function, and it's what keeps the "core
  interaction" testable even though the globe rendering itself isn't
  practically unit-testable.
- The globe's own logic (scene/camera/renderer setup, texture generation,
  render loop) lives in its own module (e.g. `src/scripts/globe.ts`),
  exposing a small interface (`setEra(t: number)` or similar) that
  `main.ts`'s scroll handler calls — keeps the WebGL specifics out of the
  scroll-math module so the latter stays trivially testable.
- Timeline data as a typed array/const in TypeScript (or a small JSON file
  imported at build time) rather than scattered through markup — keeps the
  "one dataset" honest and easy to test/tune scroll-position scaling from one
  place, and is what both the DOM readout and the globe's texture stops read
  from.
- New dependency: `three` (plus its TypeScript types if not bundled). Add it
  normally via `pnpm add three` — it'll go through the existing
  `minimumReleaseAge` supply-chain check like any other dependency; no
  exemption needed since it's a long-established package.
- No routing, no other client-side app framework, no external APIs — matches
  the spec's "static and client-side throughout" line directly.

## What's explicitly cut (scope control)

- No audio/narration.
- No branching narrative — linear timeline only, forward/backward via scroll.
- No photographic/licensed imagery anywhere, including for the globe's
  surface — every texture is procedurally generated on a `<canvas>` (see "3D
  globe implementation"), to avoid asset-rights and loading-weight issues.
  The globe is one recurring 3D object with swappable generated textures,
  not a gallery of per-era images.
- No other 3D content beyond the one globe — no 3D UI chrome, no particle
  systems beyond a simple star field, no camera fly-throughs. Ambition goes
  into making the one globe convincing across eras, not into more 3D
  elements.
- No attempt at scientific completeness — a curated, opinionated set of
  milestones, not an exhaustive timeline. The point of view is in what's left
  out. The detailed history/future table above is reference material for
  accuracy, not a mandate to depict every row.

## Open questions to resolve before building

- Exact milestone list and precise scroll-length per era, now that the
  overall weighting principle is decided (see "Scroll-length weighting"
  above) — still need the actual numbers/segment sizes for each chosen
  milestone.
- Sticky-readout implementation detail (`position: sticky` vs. JS-toggled
  class) — verify behaviour at both viewports before committing to one.
- How to keep the background transition (color/starfield) smooth without
  large images or heavy client JS, given the "nothing else" constraint.
- Exact procedural-texture technique per era (noise function, shape count,
  canvas resolution) — needs some experimentation to look convincing rather
  than muddy at globe scale; budget time for this specifically since it's
  the highest-risk/highest-payoff piece of the plan.
- Confirm real-device/phone WebGL performance early (not just Chrome
  DevTools' emulated mobile viewport) — the render loop and reduced-motion
  fallback should be built and checked before the rest of the page is
  polished, not bolted on at the end.

## Next steps

1. Agree the final milestone list and scroll-length weighting (pick a subset
   of the research table above — probably 8–12 stops, not all ~20 rows).
2. Prototype the 3D globe in isolation first (a sphere, one or two
   procedural textures, rotation, a scroll-driven crossfade) before wiring it
   into the real page — this is the highest-risk piece of the plan and the
   one worth de-risking early, separate from timeline content/copy.
3. Define the colour/texture state per chosen milestone and how they
   interpolate/crossfade by scroll fraction.
4. Sketch the rest of the visual language (sticky readout style, globe
   placement per viewport) before writing the rest of the markup.
5. Build the time-mapping function with a unit test, before wiring it to the
   DOM/globe — this is the piece the spec's "testable core interaction" line
   is asking for, and it stays testable independent of whether the globe
   prototype above is finished yet.
6. Build the page content section by section, checking `pnpm dev` under the
   base path as we go.
7. Verify at both marking viewports — including real WebGL performance on
   phone, not just an emulated viewport — before calling it done.
