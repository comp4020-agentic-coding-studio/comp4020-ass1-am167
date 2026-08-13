import { describe, expect, it } from "vitest";

import { renderModeFor } from "./render-scheduling";

const onscreenAndAwake = {
  documentHidden: false,
  onscreen: true,
  reducedMotion: false,
  measurementOverride: false,
};

describe("render scheduling", () => {
  it("animates a globe that is on screen in a visible tab", () => {
    expect(renderModeFor(onscreenAndAwake)).toBe("animate");
  });

  it("stops entirely while the globe is scrolled out of view", () => {
    // The hero fills the viewport at load, so this is the state the page
    // starts in and returns to whenever the reader scrolls away.
    expect(renderModeFor({ ...onscreenAndAwake, onscreen: false })).toBe(
      "paused",
    );
  });

  it("stops entirely while the tab is hidden", () => {
    expect(renderModeFor({ ...onscreenAndAwake, documentHidden: true })).toBe(
      "paused",
    );
  });

  it("draws only on change when the reader asked for reduced motion", () => {
    // Nothing moves, so redrawing the same frame is pure GPU cost; the globe
    // still has to be repainted when scrolling changes the era.
    expect(renderModeFor({ ...onscreenAndAwake, reducedMotion: true })).toBe(
      "on-demand",
    );
  });

  it("keeps a paused globe paused rather than drawing on change", () => {
    expect(
      renderModeFor({
        ...onscreenAndAwake,
        onscreen: false,
        reducedMotion: true,
      }),
    ).toBe("paused");
  });

  it("keeps rendering for the GPU stress probe, which measures under reduced motion", () => {
    // The saturation probe pins reduced motion so the workload per frame is
    // constant, then needs a continuous loop to measure cost per pixel.
    expect(
      renderModeFor({
        ...onscreenAndAwake,
        reducedMotion: true,
        measurementOverride: true,
      }),
    ).toBe("animate");
  });
});
