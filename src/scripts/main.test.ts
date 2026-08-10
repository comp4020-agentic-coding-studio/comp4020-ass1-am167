import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createGlobeMock, globeSetStateMock, initStarfieldMock } = vi.hoisted(
  () => ({
    createGlobeMock: vi.fn(),
    globeSetStateMock: vi.fn(),
    initStarfieldMock: vi.fn(),
  }),
);

vi.mock("./globe", () => ({ createGlobe: createGlobeMock }));
vi.mock("./starfield", () => ({ initStarfield: initStarfieldMock }));

import { initTimeline } from "./main";
import { TIMELINE } from "./timeline";

const VIEWPORT_HEIGHT = 1_000;
const TIMELINE_HEIGHT = 5_000;
const FINAL_DWELL_HEIGHT = VIEWPORT_HEIGHT * 1.1;
const NARRATIVE_DISTANCE =
  TIMELINE_HEIGHT - VIEWPORT_HEIGHT - FINAL_DWELL_HEIGHT;

interface TimelineFixture {
  document: Document;
  flushFrame: () => void;
  setRawProgress: (progress: number) => void;
  timeline: HTMLElement;
}

function panelMarkup(): string {
  return `
    <article data-era-panel data-era-layer="from">
      <span data-era-counter></span>
      <span data-era-period></span>
      <p data-era-date></p>
      <h2 data-era-title></h2>
      <p data-era-description></p>
      <aside data-present-reflection hidden></aside>
    </article>
  `;
}

function installFixture(): TimelineFixture {
  const dom = new JSDOM(`<!doctype html>
    <html>
      <body>
        <p data-scroll-cue></p>
        <section data-timeline>
          <canvas data-earth-canvas></canvas>
          <div data-earth-fallback></div>
          <div data-era-copy>${panelMarkup()}</div>
          <div data-short-date-stack>
            <span data-short-date data-era-layer="from"></span>
          </div>
          <span data-globe-label></span>
        </section>
      </body>
    </html>`);
  const { document, window } = dom.window;
  const timeline = document.querySelector<HTMLElement>("[data-timeline]");
  if (!timeline) throw new Error("Timeline fixture is incomplete");

  let timelineTop = 0;
  let nextFrameId = 1;
  const frames = new Map<number, FrameRequestCallback>();

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: VIEWPORT_HEIGHT,
  });
  Object.defineProperty(timeline, "offsetHeight", {
    configurable: true,
    value: TIMELINE_HEIGHT,
  });
  timeline.getBoundingClientRect = () =>
    ({
      bottom: timelineTop + TIMELINE_HEIGHT,
      height: TIMELINE_HEIGHT,
      left: 0,
      right: 0,
      top: timelineTop,
      width: 0,
      x: 0,
      y: timelineTop,
      toJSON: () => ({}),
    }) as DOMRect;
  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.set(id, callback);
    return id;
  };

  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);

  return {
    document,
    timeline,
    setRawProgress(progress) {
      timelineTop = -progress * NARRATIVE_DISTANCE;
      document.dispatchEvent(new window.Event("scroll"));
    },
    flushFrame() {
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback(16);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createGlobeMock.mockReturnValue({
    destroy: vi.fn(),
    setState: globeSetStateMock,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("interactive timeline", () => {
  it("enhances the initial content and connects the globe renderer", () => {
    const { document, timeline } = installFixture();

    initTimeline();

    expect(initStarfieldMock).toHaveBeenCalledOnce();
    expect(createGlobeMock).toHaveBeenCalledOnce();
    expect(timeline.dataset.enhanced).toBe("true");
    expect(document.querySelectorAll("[data-era-panel]")).toHaveLength(2);
    expect(document.querySelectorAll("[data-short-date]")).toHaveLength(2);
    expect(
      document.querySelector('[data-era-panel][data-era-layer="from"] [data-era-title]')
        ?.textContent,
    ).toBe(TIMELINE[0].title);
    expect(document.documentElement.style.getPropertyValue("--timeline-count")).toBe(
      String(TIMELINE.length),
    );
    expect(globeSetStateMock.mock.calls[0]?.[0].active.id).toBe("formation");
  });

  it("updates content, accessibility state and visual variables while scrolling", () => {
    const { document, flushFrame, setRawProgress, timeline } = installFixture();
    initTimeline();

    const present = TIMELINE.find((era) => era.id === "present");
    if (!present) throw new Error("Timeline requires a present era");
    const pauseStart = present.scroll * 0.96;
    const pauseMiddle = pauseStart + 0.02;

    setRawProgress(pauseMiddle);
    flushFrame();

    const sourcePanel = document.querySelector<HTMLElement>(
      '[data-era-panel][data-era-layer="from"]',
    );
    expect(timeline.classList.contains("is-present")).toBe(true);
    expect(timeline.classList.contains("is-present-pause")).toBe(true);
    expect(sourcePanel?.querySelector("[data-era-title]")?.textContent).toBe(
      present.title,
    );
    expect(sourcePanel?.getAttribute("aria-hidden")).toBe("false");
    expect(
      sourcePanel?.querySelector<HTMLElement>("[data-present-reflection]")?.hidden,
    ).toBe(false);
    expect(
      Number(
        document.documentElement.style.getPropertyValue("--reflection-progress"),
      ),
    ).toBeCloseTo(0.5);
    expect(document.querySelector("[data-globe-label]")?.textContent).toContain(
      present.date,
    );

    setRawProgress(1);
    flushFrame();

    const finalEra = TIMELINE.at(-1);
    expect(finalEra).toBeDefined();
    expect(sourcePanel?.querySelector("[data-era-title]")?.textContent).toBe(
      finalEra?.title,
    );
    expect(timeline.classList.contains("is-present")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--timeline-progress")).toBe(
      "1",
    );
    expect(document.querySelector("[data-scroll-cue]")?.classList).toContain(
      "is-hidden",
    );
    expect(globeSetStateMock.mock.calls.at(-1)?.[0].active.id).toBe(
      "after-earth",
    );
  });

  it("leaves incomplete markup untouched instead of throwing", () => {
    const dom = new JSDOM("<!doctype html><section data-timeline></section>");
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);

    expect(() => initTimeline()).not.toThrow();
    expect(createGlobeMock).not.toHaveBeenCalled();
    expect(dom.window.document.querySelector("[data-timeline]")?.hasAttribute(
      "data-enhanced",
    )).toBe(false);
  });
});
