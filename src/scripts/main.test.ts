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
import { MILESTONE_ERA_IDS, TIMELINE } from "./timeline";

const VIEWPORT_HEIGHT = 1_000;
const TIMELINE_HEIGHT = 5_000;
const FINAL_DWELL_VIEWPORTS = 1.1;
// The hero sits above the timeline, so the timeline starts one viewport down.
const TIMELINE_DOCUMENT_TOP = VIEWPORT_HEIGHT;

function narrativeDistanceFor(
  viewportHeight: number,
  timelineHeight: number,
): number {
  const scrollDistance = Math.max(1, timelineHeight - viewportHeight);
  return Math.max(
    1,
    scrollDistance - viewportHeight * FINAL_DWELL_VIEWPORTS,
  );
}

interface TimelineFixture {
  document: Document;
  flushFrame: () => void;
  narrativeProgress: () => number;
  resizeViewport: (viewportHeight: number, timelineHeight: number) => void;
  scrollPosition: () => number;
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
          <p data-era-announcer role="status" aria-live="polite"></p>
          <span class="meter-ticks">${TIMELINE.filter((era) =>
            MILESTONE_ERA_IDS.has(era.id),
          )
            .map(
              (era) =>
                `<button type="button" class="meter-tick" data-era-jump="${era.id}"></button>`,
            )
            .join("")}</span>
        </section>
      </body>
    </html>`);
  const { document, window } = dom.window;
  const timeline = document.querySelector<HTMLElement>("[data-timeline]");
  if (!timeline) throw new Error("Timeline fixture is incomplete");

  let viewportHeight = VIEWPORT_HEIGHT;
  let timelineHeight = TIMELINE_HEIGHT;
  let scrollY = 0;
  let nextFrameId = 1;
  const frames = new Map<number, FrameRequestCallback>();

  const defineViewport = (): void => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: viewportHeight,
    });
    Object.defineProperty(timeline, "offsetHeight", {
      configurable: true,
      value: timelineHeight,
    });
  };
  defineViewport();

  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => scrollY,
  });
  window.scrollTo = ((x: number, y: number): void => {
    scrollY = typeof x === "object" ? ((x as { top?: number }).top ?? 0) : y;
  }) as typeof window.scrollTo;

  // Layout the fixture models: the timeline pins once it reaches the top of
  // the viewport, so its client rect top is its document offset minus scroll.
  timeline.getBoundingClientRect = () => {
    const top = TIMELINE_DOCUMENT_TOP - scrollY;
    return {
      bottom: top + timelineHeight,
      height: timelineHeight,
      left: 0,
      right: 0,
      top,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  };
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
    narrativeProgress() {
      return (
        (scrollY - TIMELINE_DOCUMENT_TOP) /
        narrativeDistanceFor(viewportHeight, timelineHeight)
      );
    },
    scrollPosition() {
      return scrollY;
    },
    setRawProgress(progress) {
      scrollY =
        TIMELINE_DOCUMENT_TOP +
        progress * narrativeDistanceFor(viewportHeight, timelineHeight);
      document.dispatchEvent(new window.Event("scroll"));
    },
    resizeViewport(nextViewportHeight, nextTimelineHeight) {
      viewportHeight = nextViewportHeight;
      timelineHeight = nextTimelineHeight;
      defineViewport();
      window.dispatchEvent(new window.Event("resize"));
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

  it("keeps the visitor at the same moment in the story across a resize", () => {
    const fixture = installFixture();
    initTimeline();

    const present = TIMELINE.find((era) => era.id === "present");
    if (!present) throw new Error("Timeline requires a present era");
    const heldProgress = present.scroll * 0.96 + 0.02;

    fixture.setRawProgress(heldProgress);
    fixture.flushFrame();

    const titleOf = (): string | null | undefined =>
      fixture.document.querySelector(
        '[data-era-panel][data-era-layer="from"] [data-era-title]',
      )?.textContent;
    expect(titleOf()).toBe(present.title);

    // A phone rotating to landscape, or a desktop window being dragged
    // narrower, changes both the viewport and the timeline's own height.
    fixture.resizeViewport(600, 9_000);
    fixture.flushFrame();

    // Scroll positions are whole pixels, so the restored progress lands within
    // half a pixel of where it was — against 0.36 of drift without the anchor.
    expect(fixture.narrativeProgress()).toBeCloseTo(heldProgress, 3);
    expect(titleOf()).toBe(present.title);
    expect(fixture.timeline.classList.contains("is-present")).toBe(true);
  });

  it("does not drag the reader into the timeline when they resize elsewhere", () => {
    const fixture = installFixture();
    initTimeline();

    // Still up in the hero, above the timeline entirely.
    fixture.setRawProgress(-0.5);
    fixture.flushFrame();
    const heroScroll = fixture.scrollPosition();

    fixture.resizeViewport(600, 9_000);
    fixture.flushFrame();

    expect(fixture.scrollPosition()).toBe(heroScroll);
  });

  it("announces each era change once for assistive technology", () => {
    const fixture = installFixture();
    initTimeline();

    const announcer = fixture.document.querySelector<HTMLElement>(
      "[data-era-announcer]",
    );
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
    expect(announcer?.textContent).toContain(TIMELINE[0].title);

    fixture.setRawProgress(1);
    fixture.flushFrame();

    const finalEra = TIMELINE.at(-1);
    if (!finalEra) throw new Error("Timeline requires a final era");
    expect(announcer?.textContent).toContain(finalEra.title);
    expect(announcer?.textContent).toContain(finalEra.date);
    expect(announcer?.textContent).toContain(String(TIMELINE.length));

    // Scrolling within one era must not re-announce it.
    const announced = announcer?.textContent;
    fixture.setRawProgress(0.999);
    fixture.flushFrame();
    expect(announcer?.textContent).toBe(announced);
  });

  it("jumps to the chosen milestone, including across the present pause", () => {
    const fixture = installFixture();
    initTimeline();

    const activeId = (): string | undefined =>
      globeSetStateMock.mock.calls.at(-1)?.[0].active.id;

    const jumpTo = (id: string): void => {
      const button = fixture.document.querySelector<HTMLElement>(
        `[data-era-jump="${id}"]`,
      );
      if (!button) throw new Error(`No jump control for ${id}`);
      button.dispatchEvent(
        new fixture.document.defaultView!.MouseEvent("click", { bubbles: true }),
      );
      fixture.flushFrame();
    };

    // The present sits behind a scroll pause, so its scroll position is not a
    // straight multiple of its story fraction — jumping has to invert that.
    jumpTo("present");
    expect(activeId()).toBe("present");

    // Backwards, to an era before the pause.
    jumpTo("dinosaurs");
    expect(activeId()).toBe("dinosaurs");

    // Forwards, past the pause, to the far end of the journey.
    jumpTo(TIMELINE[TIMELINE.length - 1].id);
    expect(activeId()).toBe(TIMELINE[TIMELINE.length - 1].id);

    // And back to the very beginning.
    jumpTo(TIMELINE[0].id);
    expect(activeId()).toBe(TIMELINE[0].id);
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
