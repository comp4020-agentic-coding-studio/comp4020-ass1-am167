import { describe, expect, it } from "vitest";

import { parsePerformanceProfilerConfig } from "./performance-profiler";

describe("performance profiler configuration", () => {
  it("stays absent from the normal site unless the browser runner enables it", () => {
    expect(parsePerformanceProfilerConfig(undefined)).toBeUndefined();
    expect(parsePerformanceProfilerConfig({})).toBeUndefined();
    expect(parsePerformanceProfilerConfig({ enabled: false })).toBeUndefined();
  });

  it("accepts bounded diagnostic overrides", () => {
    expect(
      parsePerformanceProfilerConfig({
        enabled: true,
        drawingPixels: 2_500_000,
        maximumSamples: 80,
      }),
    ).toEqual({
      drawingPixels: 2_500_000,
      maximumSamples: 80,
    });
  });

  it("clamps hostile or accidental values before they reach WebGL", () => {
    expect(
      parsePerformanceProfilerConfig({
        enabled: true,
        drawingPixels: Number.POSITIVE_INFINITY,
        maximumSamples: 50_000,
      }),
    ).toEqual({
      drawingPixels: undefined,
      maximumSamples: 600,
    });
  });
});
