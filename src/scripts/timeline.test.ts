import { describe, expect, it } from "vitest";

import {
  hasVisibleMoon,
  MILESTONE_ERA_IDS,
  moonHeatFor,
  PLANET_MODES,
  shouldLoadPresentTextures,
  stateForScrollFraction,
  TIMELINE,
  timeForScrollFraction,
} from "./timeline";
import {
  mixPlanetShading,
  PLANET_SHADING_KEYS,
  planetShadingFor,
} from "./planet-shading";

describe("Earth timeline mapping", () => {
  it("maps the two ends of the scroll track to Earth's formation and end", () => {
    expect(stateForScrollFraction(0).active.id).toBe("formation");
    expect(stateForScrollFraction(1).active.id).toBe("after-earth");
    expect(timeForScrollFraction(0)).toBe(-4540);
    expect(timeForScrollFraction(1)).toBe(8000);
  });

  it("always moves forward in time as the visitor scrolls", () => {
    const samples = Array.from({ length: 201 }, (_, index) =>
      timeForScrollFraction(index / 200),
    );

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1]);
    }
  });

  it("gives the future a substantial share of the scroll journey", () => {
    const present = TIMELINE.find((era) => era.id === "present");
    expect(present).toBeDefined();
    expect(present?.scroll).toBeCloseTo(0.58);
    expect(1 - (present?.scroll ?? 1)).toBeGreaterThan(0.4);
    expect(
      TIMELINE.filter((era) => era.millionYearsFromNow > 0).length,
    ).toBeGreaterThanOrEqual(21);
  });

  it("contains a dense but chronological sequence of events", () => {
    expect(TIMELINE.length).toBeGreaterThanOrEqual(60);
    expect(new Set(TIMELINE.map((era) => era.id)).size).toBe(TIMELINE.length);

    for (let index = 1; index < TIMELINE.length; index += 1) {
      expect(TIMELINE[index].scroll).toBeGreaterThan(
        TIMELINE[index - 1].scroll,
      );
      expect(TIMELINE[index].millionYearsFromNow).toBeGreaterThan(
        TIMELINE[index - 1].millionYearsFromNow,
      );
    }
  });

  it("keeps every era complete and every visual value renderable", () => {
    const colour = /^#[0-9a-f]{6}$/i;
    const boundedVisualKeys = [
      "cloudCover",
      "iceCover",
      "oceanCover",
      "heat",
      "sun",
      "opacity",
    ] as const;

    for (const era of TIMELINE) {
      expect(era.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(era.date.trim()).not.toBe("");
      expect(era.shortDate.trim()).not.toBe("");
      expect(era.period.trim()).not.toBe("");
      expect(era.title.trim()).not.toBe("");
      expect(era.description.trim()).not.toBe("");
      expect(era.scroll).toBeGreaterThanOrEqual(0);
      expect(era.scroll).toBeLessThanOrEqual(1);

      for (const key of [
        "background",
        "surface",
        "ocean",
        "land",
        "detail",
        "atmosphere",
        "glow",
      ] as const) {
        expect(era.visual[key], `${era.id}.${key}`).toMatch(colour);
      }

      for (const key of boundedVisualKeys) {
        expect(era.visual[key], `${era.id}.${key}`).toBeGreaterThanOrEqual(0);
        expect(era.visual[key], `${era.id}.${key}`).toBeLessThanOrEqual(1);
      }

      if (era.visual.sunSize !== undefined) {
        expect(era.visual.sunSize, `${era.id}.sunSize`).toBeGreaterThanOrEqual(0);
        expect(era.visual.sunSize, `${era.id}.sunSize`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("reserves the photographic present-day visual mode for the actual present", () => {
    expect(
      TIMELINE.filter((era) => era.visual.mode === "present").map(
        (era) => era.id,
      ),
    ).toEqual(["present"]);
  });

  it("names a milestone spine that spans the whole journey in order", () => {
    const milestones = TIMELINE.filter((era) => MILESTONE_ERA_IDS.has(era.id));

    // Every named milestone has to exist in the balanced timeline.
    expect(milestones).toHaveLength(MILESTONE_ERA_IDS.size);
    expect(milestones.length).toBeGreaterThanOrEqual(8);
    expect(milestones.length).toBeLessThan(TIMELINE.length / 2);

    // The spine has to reach both ends, or the jump controls cannot take a
    // visitor back to the start or on to the end.
    expect(milestones[0].id).toBe(TIMELINE[0].id);
    expect(milestones.at(-1)?.id).toBe(TIMELINE.at(-1)?.id);
    expect(MILESTONE_ERA_IDS.has("present")).toBe(true);

    // Monotonic, so the controls read down the rail in chronological order.
    for (let index = 1; index < milestones.length; index += 1) {
      expect(milestones[index].scroll).toBeGreaterThan(
        milestones[index - 1].scroll,
      );
    }
  });

  it("holds the photographic present-day maps back until the present approaches", () => {
    const present = TIMELINE.find((era) => era.visual.mode === "present");
    expect(present).toBeDefined();
    const presentScroll = present?.scroll ?? 0;

    // The deep past must not pay for a texture set it never shows.
    expect(shouldLoadPresentTextures(0)).toBe(false);
    expect(shouldLoadPresentTextures(presentScroll / 2)).toBe(false);

    // They have to be ready by the time the present is on screen.
    expect(shouldLoadPresentTextures(presentScroll)).toBe(true);
    expect(shouldLoadPresentTextures(1)).toBe(true);

    // The request starts far enough ahead that the planet is never blank,
    // but not so early that it lands in the opening third of the journey.
    const lead = presentScroll - 0.08;
    expect(shouldLoadPresentTextures(lead + 0.001)).toBe(true);
    expect(shouldLoadPresentTextures(lead - 0.001)).toBe(false);
    expect(lead).toBeGreaterThan(0.33);
  });

  it("keeps the red-giant disc off until the Sun leaves the main sequence", () => {
    const coreHydrogenEnds = TIMELINE.find(
      (era) => era.id === "core-hydrogen-ends",
    );
    expect(coreHydrogenEnds).toBeDefined();

    for (const era of TIMELINE) {
      if (era.millionYearsFromNow < (coreHydrogenEnds?.millionYearsFromNow ?? 0)) {
        expect(era.visual.sun, era.id).toBeLessThan(0.08);
        expect(era.visual.mode, era.id).not.toBe("red-giant");
      }
    }

    expect(coreHydrogenEnds?.visual.sun).toBeGreaterThanOrEqual(0.35);
    expect(
      TIMELINE.find((era) => era.id === "sun-swells")?.visual.sun,
    ).toBeGreaterThanOrEqual(0.75);
  });

  it("holds Moon heating below the orange-glow threshold until solar expansion", () => {
    const glowThreshold = 0.58;
    const coreHydrogenEnds = TIMELINE.find(
      (era) => era.id === "core-hydrogen-ends",
    );
    expect(coreHydrogenEnds).toBeDefined();

    for (const era of TIMELINE) {
      if (
        era.millionYearsFromNow >= 0 &&
        era.millionYearsFromNow < (coreHydrogenEnds?.millionYearsFromNow ?? 0)
      ) {
        expect(moonHeatFor(era), era.id).toBeLessThan(glowThreshold);
      }
    }

    // +5.4 BY should be a clear visible start, not a barely-crossed threshold.
    expect(moonHeatFor(coreHydrogenEnds!)).toBeGreaterThanOrEqual(0.72);
    expect(
      moonHeatFor(TIMELINE.find((era) => era.id === "sun-swells")!),
    ).toBeGreaterThan(0.85);
  });

  it("interpolates continuously across an era segment", () => {
    const fromIndex = 8;
    const from = TIMELINE[fromIndex];
    const to = TIMELINE[fromIndex + 1];
    const midpoint = from.scroll + (to.scroll - from.scroll) / 2;
    const state = stateForScrollFraction(midpoint);

    expect(state.from).toBe(from);
    expect(state.to).toBe(to);
    expect(state.mix).toBeCloseTo(0.5);
    expect(state.active).toBe(to);
    expect(state.activeIndex).toBe(fromIndex + 1);
    expect(state.millionYearsFromNow).toBeCloseTo(
      (from.millionYearsFromNow + to.millionYearsFromNow) / 2,
    );
  });

  it("selects each exact milestone without skipping its content", () => {
    for (const [index, era] of TIMELINE.entries()) {
      const state = stateForScrollFraction(era.scroll);
      expect(state.active.id, era.id).toBe(era.id);
      expect(state.millionYearsFromNow, era.id).toBe(era.millionYearsFromNow);
      expect(state.activeIndex, era.id).toBe(index);
    }
  });

  it("is deterministic and clamps out-of-range input", () => {
    expect(stateForScrollFraction(0.4)).toEqual(stateForScrollFraction(0.4));
    expect(stateForScrollFraction(-10).active.id).toBe("formation");
    expect(stateForScrollFraction(10).active.id).toBe("after-earth");
    expect(stateForScrollFraction(Number.NaN).active.id).toBe("formation");
  });
});

// The globe shades itself from these numbers rather than from the mode name:
// the fragment shader has no branches per era, it just reads a set of scalars
// and blends between the two an era transition sits between. That makes the
// contract worth stating here — a mode with no entry, or a value outside the
// range the shader assumes, is a silently wrong-looking planet rather than a
// crash, which is exactly the failure a test should catch.
describe("planet shading parameters", () => {
  it("gives every planet mode an explicit set of shading parameters", () => {
    for (const mode of PLANET_MODES) {
      const shading = planetShadingFor({
        ...TIMELINE[0].visual,
        mode,
      });

      for (const key of PLANET_SHADING_KEYS) {
        expect(shading[key], `${mode}.${key}`).toBeTypeOf("number");
        expect(Number.isFinite(shading[key]), `${mode}.${key}`).toBe(true);
      }
    }
  });

  it("keeps every era's shading parameters inside the shader's 0-1 range", () => {
    for (const era of TIMELINE) {
      const shading = planetShadingFor(era.visual);
      for (const key of PLANET_SHADING_KEYS) {
        expect(shading[key], `${era.id}.${key}`).toBeGreaterThanOrEqual(0);
        expect(shading[key], `${era.id}.${key}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("blends any two eras without leaving that range", () => {
    // Scroll lands the globe between two arbitrary eras every frame, so the
    // blend has to stay in range for every pair, not just for neighbours.
    for (const from of TIMELINE) {
      for (const to of TIMELINE) {
        for (const mix of [0, 0.13, 0.5, 0.87, 1]) {
          const blended = mixPlanetShading(
            planetShadingFor(from.visual),
            planetShadingFor(to.visual),
            mix,
          );
          for (const key of PLANET_SHADING_KEYS) {
            const label = `${from.id}->${to.id}@${mix}.${key}`;
            expect(blended[key], label).toBeGreaterThanOrEqual(0);
            expect(blended[key], label).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  // The renderer draws the Moon and the copy layer names it in the globe's
  // accessible description, so both have to agree about when it is there.
  // They used to hold separate copies of this rule.
  it("shows the Moon only between the impact that made it and the end", () => {
    const visible = TIMELINE.filter(hasVisibleMoon);
    const hidden = TIMELINE.filter((era) => !hasVisibleMoon(era));

    expect(visible.length).toBeGreaterThan(0);
    expect(hidden.map((era) => era.id)).toContain("formation");
    expect(hidden.map((era) => era.id)).toContain("after-earth");
    // Nothing between the Moon-forming impact and the white dwarf may blink
    // the Moon out and back again.
    const firstVisible = TIMELINE.findIndex(hasVisibleMoon);
    const lastVisible = TIMELINE.length - 1 - [...TIMELINE].reverse().findIndex(hasVisibleMoon);
    for (let index = firstVisible; index <= lastVisible; index += 1) {
      expect(hasVisibleMoon(TIMELINE[index]), TIMELINE[index].id).toBe(true);
    }
  });

  it("spends the photographic maps and city lights only on the present", () => {
    for (const era of TIMELINE) {
      const shading = planetShadingFor(era.visual);
      const present = era.visual.mode === "present";
      expect(shading.referenceMap, era.id).toBe(present ? 1 : 0);
      expect(shading.nightLights, era.id).toBe(present ? 1 : 0);
    }
  });

  it("separates a molten world from a living one", () => {
    const molten = planetShadingFor(
      TIMELINE.find((era) => era.id === "formation")!.visual,
    );
    const living = planetShadingFor(
      TIMELINE.find((era) => era.id === "present")!.visual,
    );

    expect(molten.molten).toBe(1);
    expect(molten.vegetation).toBe(0);
    expect(living.molten).toBe(0);
    expect(living.vegetation).toBe(1);
  });
});
