/**
 * When the globe should be drawing.
 *
 * The planet shader is expensive per fragment, so the cheapest frame is the
 * one never drawn. Three states cover it:
 *
 * - `animate`   the rotation is visible, so run a continuous loop;
 * - `on-demand` nothing moves, so hold the last frame and repaint only when
 *               scrolling changes the era;
 * - `paused`    nothing is on screen to draw to, so stop completely.
 */
export type RenderMode = "animate" | "on-demand" | "paused";

export interface RenderConditions {
  /** The tab is backgrounded. */
  documentHidden: boolean;
  /** Any part of the canvas is inside the viewport. */
  onscreen: boolean;
  /** The reader asked for reduced motion. */
  reducedMotion: boolean;
  /**
   * The performance suite's saturation probe is driving a fixed drawing
   * buffer. It pins reduced motion so each frame costs the same, then times
   * the loop, so it needs the loop to keep running. Only the probe sets this;
   * the shipped site never does.
   */
  measurementOverride: boolean;
}

export function renderModeFor(conditions: RenderConditions): RenderMode {
  if (conditions.measurementOverride) return "animate";
  if (conditions.documentHidden || !conditions.onscreen) return "paused";
  return conditions.reducedMotion ? "on-demand" : "animate";
}
