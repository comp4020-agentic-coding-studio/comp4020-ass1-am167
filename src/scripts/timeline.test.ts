import { describe, expect, it } from "vitest";

import {
  stateForScrollFraction,
  TIMELINE,
  timeForScrollFraction,
} from "./timeline";

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
