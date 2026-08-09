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

  it("is deterministic and clamps out-of-range input", () => {
    expect(stateForScrollFraction(0.4)).toEqual(stateForScrollFraction(0.4));
    expect(stateForScrollFraction(-10).active.id).toBe("formation");
    expect(stateForScrollFraction(10).active.id).toBe("after-earth");
  });
});
