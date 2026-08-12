import { createGlobe } from "./globe";
import { initStarfield } from "./starfield";
import type { TimelineEra } from "./timeline";
import { moonHeatFor, stateForScrollFraction, TIMELINE } from "./timeline";

const PRESENT_SCROLL = TIMELINE.find((era) => era.id === "present")?.scroll ?? 0.58;
const PRESENT_PAUSE_SPAN = 0.04;
const PRESENT_PAUSE_START = PRESENT_SCROLL * (1 - PRESENT_PAUSE_SPAN);
const PRESENT_PAUSE_END = PRESENT_PAUSE_START + PRESENT_PAUSE_SPAN;
const FINAL_ERA_DWELL_VIEWPORTS = 1.1;

// The globe crossfades across a whole segment, but the text must not: two
// paragraphs of body copy stacked at half opacity are unreadable, and a wide
// window means a reader who stops mid-transition sees double. The outgoing
// panel finishes fading exactly where the incoming one starts — which is also
// mix 0.5, where `active` flips, so the visible swap matches the announced one.
// Kept tight on purpose: the wider the swap, the longer the band of scroll
// where neither panel is at full strength. At this width that band is about
// ten pixels, against roughly 450 per era.
const COPY_SWAP_START = 0.44;
const COPY_SWAP_MID = 0.5;
const COPY_SWAP_END = 0.56;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface PresentPauseState {
  progress: number;
  storyProgress: number;
  paused: boolean;
}

function progressWithPresentPause(progress: number): PresentPauseState {
  if (progress < PRESENT_PAUSE_START) {
    return {
      progress: 0,
      storyProgress: (progress / PRESENT_PAUSE_START) * PRESENT_SCROLL,
      paused: false,
    };
  }

  if (progress <= PRESENT_PAUSE_END) {
    return {
      progress:
        (progress - PRESENT_PAUSE_START) /
        (PRESENT_PAUSE_END - PRESENT_PAUSE_START),
      storyProgress: PRESENT_SCROLL,
      paused: true,
    };
  }

  return {
    progress: 1,
    storyProgress:
      PRESENT_SCROLL +
      ((progress - PRESENT_PAUSE_END) / (1 - PRESENT_PAUSE_END)) *
        (1 - PRESENT_SCROLL),
    paused: false,
  };
}

// The inverse of progressWithPresentPause: where in the raw scroll a given
// point in the story lives. Without this a jump control would land short of
// the present by the width of the pause, and short of everything after it.
function rawProgressForStory(storyProgress: number): number {
  const story = Math.min(1, Math.max(0, storyProgress));
  if (story < PRESENT_SCROLL) {
    return (story / PRESENT_SCROLL) * PRESENT_PAUSE_START;
  }
  if (story === PRESENT_SCROLL) return PRESENT_PAUSE_START;
  return (
    PRESENT_PAUSE_END +
    ((story - PRESENT_SCROLL) / (1 - PRESENT_SCROLL)) * (1 - PRESENT_PAUSE_END)
  );
}

function interpolateColour(from: string, to: string, mix: number): string {
  const fromValue = Number.parseInt(from.slice(1), 16);
  const toValue = Number.parseInt(to.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const start = (fromValue >> shift) & 255;
    const end = (toValue >> shift) & 255;
    return Math.round(start + (end - start) * mix);
  });
  return `rgb(${channels.join(" ")})`;
}

function requiredElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T | undefined {
  return root.querySelector<T>(selector) ?? undefined;
}

function hasVisibleMoon(era: TimelineEra): boolean {
  return era.millionYearsFromNow >= -4510 && era.id !== "after-earth";
}

interface EraPanelElements {
  root: HTMLElement;
  date: HTMLElement;
  period: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  counter: HTMLElement;
  presentReflection?: HTMLElement;
}

function getEraPanel(root: HTMLElement): EraPanelElements | undefined {
  const date = requiredElement<HTMLElement>(root, "[data-era-date]");
  const period = requiredElement<HTMLElement>(root, "[data-era-period]");
  const title = requiredElement<HTMLElement>(root, "[data-era-title]");
  const description = requiredElement<HTMLElement>(root, "[data-era-description]");
  const counter = requiredElement<HTMLElement>(root, "[data-era-counter]");

  if (!date || !period || !title || !description || !counter) return undefined;

  return {
    root,
    date,
    period,
    title,
    description,
    counter,
    presentReflection: requiredElement<HTMLElement>(
      root,
      "[data-present-reflection]",
    ),
  };
}

export function initTimeline(): void {
  initStarfield();

  const timeline = document.querySelector<HTMLElement>("[data-timeline]");
  if (!timeline) return;

  const canvas = requiredElement<HTMLCanvasElement>(timeline, "[data-earth-canvas]");
  const fallback = requiredElement<HTMLElement>(timeline, "[data-earth-fallback]");
  const copy = requiredElement<HTMLElement>(timeline, "[data-era-copy]");
  const sourcePanelRoot = requiredElement<HTMLElement>(
    timeline,
    '[data-era-panel][data-era-layer="from"]',
  );
  const shortDateStack = requiredElement<HTMLElement>(
    timeline,
    "[data-short-date-stack]",
  );
  const sourceShortDate = requiredElement<HTMLElement>(
    timeline,
    '[data-short-date][data-era-layer="from"]',
  );
  const globeLabel = requiredElement<HTMLElement>(timeline, "[data-globe-label]");
  const scrollCue = requiredElement<HTMLElement>(document, "[data-scroll-cue]");
  const announcer = requiredElement<HTMLElement>(timeline, "[data-era-announcer]");

  if (
    !canvas ||
    !fallback ||
    !copy ||
    !sourcePanelRoot ||
    !shortDateStack ||
    !sourceShortDate ||
    !globeLabel
  ) {
    return;
  }

  const targetPanelRoot = sourcePanelRoot.cloneNode(true) as HTMLElement;
  targetPanelRoot.dataset.eraLayer = "to";
  targetPanelRoot.setAttribute("aria-hidden", "true");
  sourcePanelRoot.after(targetPanelRoot);

  const targetShortDate = sourceShortDate.cloneNode(true) as HTMLElement;
  targetShortDate.dataset.eraLayer = "to";
  targetShortDate.setAttribute("aria-hidden", "true");
  shortDateStack.append(targetShortDate);

  const fromPanel = getEraPanel(sourcePanelRoot);
  const toPanel = getEraPanel(targetPanelRoot);
  if (!fromPanel || !toPanel) return;

  timeline.dataset.enhanced = "true";
  const globe = createGlobe(canvas, fallback);
  const rootStyle = document.documentElement.style;
  const eraIndexes = new Map(TIMELINE.map((era, index) => [era.id, index]));
  let activeId = "";
  let segmentId = "";
  let scheduledFrame = 0;

  const bindPanel = (panel: EraPanelElements, era: TimelineEra): void => {
    panel.date.textContent = era.date;
    panel.period.textContent = era.period;
    panel.title.textContent = era.title;
    panel.description.textContent = era.description;
    panel.counter.textContent = String((eraIndexes.get(era.id) ?? 0) + 1).padStart(
      2,
      "0",
    );
    if (panel.presentReflection) {
      panel.presentReflection.hidden = era.id !== "present";
    }
  };

  // How far the visitor is through the story, kept so that a viewport change
  // can restore the same moment rather than the same pixel offset. The dwell
  // after the final era is tracked separately because it is not narrative
  // time — it is the pause that lets the last panel be read.
  let narrativeAnchor = 0;
  let dwellAnchor = 0;
  let anchored = false;

  const scrollMetrics = (): {
    scrollDistance: number;
    narrativeDistance: number;
  } => {
    const scrollDistance = Math.max(1, timeline.offsetHeight - window.innerHeight);
    return {
      scrollDistance,
      narrativeDistance: Math.max(
        1,
        scrollDistance - window.innerHeight * FINAL_ERA_DWELL_VIEWPORTS,
      ),
    };
  };

  const update = (): void => {
    scheduledFrame = 0;
    const { scrollDistance, narrativeDistance } = scrollMetrics();
    const offsetIntoTimeline = -timeline.getBoundingClientRect().top;
    const rawProgress = Math.min(
      1,
      Math.max(0, offsetIntoTimeline / narrativeDistance),
    );

    anchored = offsetIntoTimeline >= 0 && offsetIntoTimeline <= scrollDistance;
    narrativeAnchor = rawProgress;
    dwellAnchor =
      scrollDistance > narrativeDistance
        ? Math.min(
            1,
            Math.max(
              0,
              (offsetIntoTimeline - narrativeDistance) /
                (scrollDistance - narrativeDistance),
            ),
          )
        : 0;

    const presentPause = progressWithPresentPause(rawProgress);
    const progress = presentPause.storyProgress;
    const state = stateForScrollFraction(progress);
    const { from, to, mix, active } = state;

    const nextSegmentId = `${from.id}:${to.id}`;
    if (nextSegmentId !== segmentId) {
      segmentId = nextSegmentId;
      bindPanel(fromPanel, from);
      bindPanel(toPanel, to);
      sourceShortDate.textContent = from.shortDate;
      targetShortDate.textContent = to.shortDate;
    }

    const copyTransition = clampUnit(
      (mix - COPY_SWAP_START) / (COPY_SWAP_END - COPY_SWAP_START),
    );
    const copyOut =
      1 - clampUnit((mix - COPY_SWAP_START) / (COPY_SWAP_MID - COPY_SWAP_START));
    const copyIn = clampUnit(
      (mix - COPY_SWAP_MID) / (COPY_SWAP_END - COPY_SWAP_MID),
    );
    copy.style.setProperty("--copy-transition", String(copyTransition));
    copy.style.setProperty("--copy-out", copyOut.toFixed(4));
    copy.style.setProperty("--copy-in", copyIn.toFixed(4));
    copy.style.setProperty(
      "--copy-from-y",
      `${(-0.55 * copyTransition).toFixed(3)}rem`,
    );
    copy.style.setProperty(
      "--copy-to-y",
      `${(0.55 * (1 - copyTransition)).toFixed(3)}rem`,
    );
    shortDateStack.style.setProperty(
      "--copy-transition",
      String(copyTransition),
    );
    shortDateStack.style.setProperty("--copy-out", copyOut.toFixed(4));
    shortDateStack.style.setProperty("--copy-in", copyIn.toFixed(4));
    shortDateStack.style.setProperty(
      "--copy-from-y",
      `${(-0.25 * copyTransition).toFixed(3)}rem`,
    );
    shortDateStack.style.setProperty(
      "--copy-to-y",
      `${(0.25 * (1 - copyTransition)).toFixed(3)}rem`,
    );

    const fromIsActive = active.id === from.id;
    const toIsActive = active.id === to.id && to.id !== from.id;
    fromPanel.root.setAttribute("aria-hidden", String(!fromIsActive));
    toPanel.root.setAttribute("aria-hidden", String(!toIsActive));
    sourceShortDate.setAttribute("aria-hidden", String(!fromIsActive));
    targetShortDate.setAttribute("aria-hidden", String(!toIsActive));

    globe.setState(state);
    rootStyle.setProperty("--timeline-progress", String(progress));
    rootStyle.setProperty(
      "--reflection-progress",
      String(presentPause.progress),
    );
    timeline.classList.toggle("is-present", active.id === "present");
    timeline.classList.toggle("is-present-pause", presentPause.paused);
    rootStyle.setProperty(
      "--era-background",
      interpolateColour(from.visual.background, to.visual.background, mix),
    );
    rootStyle.setProperty(
      "--era-glow",
      interpolateColour(from.visual.glow, to.visual.glow, mix),
    );
    rootStyle.setProperty(
      "--era-atmosphere",
      interpolateColour(from.visual.atmosphere, to.visual.atmosphere, mix),
    );
    const sunStrength = from.visual.sun + (to.visual.sun - from.visual.sun) * mix;
    const fromMoonPresence = hasVisibleMoon(from) ? 1 : 0;
    const toMoonPresence = hasVisibleMoon(to) ? 1 : 0;
    const moonPresence =
      fromMoonPresence + (toMoonPresence - fromMoonPresence) * mix;
    const moonHeat =
      moonHeatFor(from) + (moonHeatFor(to) - moonHeatFor(from)) * mix;
    const fromWhiteDwarf = from.id === "after-earth" ? from.visual.sun : 0;
    const toWhiteDwarf = to.id === "after-earth" ? to.visual.sun : 0;
    const whiteDwarfStrength =
      fromWhiteDwarf + (toWhiteDwarf - fromWhiteDwarf) * mix;
    rootStyle.setProperty("--sun-strength", String(sunStrength));
    rootStyle.setProperty(
      "--giant-strength",
      String(Math.max(0, sunStrength - whiteDwarfStrength)),
    );
    rootStyle.setProperty("--white-dwarf-strength", String(whiteDwarfStrength));
    const fromSunSize = from.visual.sunSize ?? from.visual.sun;
    const toSunSize = to.visual.sunSize ?? to.visual.sun;
    rootStyle.setProperty(
      "--sun-size",
      String(fromSunSize + (toSunSize - fromSunSize) * mix),
    );
    rootStyle.setProperty(
      "--earth-opacity",
      String(from.visual.opacity + (to.visual.opacity - from.visual.opacity) * mix),
    );
    rootStyle.setProperty("--moon-opacity", String(moonPresence));
    rootStyle.setProperty("--moon-heat", String(moonHeat));

    if (active.id !== activeId) {
      activeId = active.id;
      globeLabel.textContent = `${
        hasVisibleMoon(active) ? "Earth and Moon" : "Earth"
      } during ${active.period}, ${active.date}`;
      if (announcer) {
        // Announced only on an era change, not on every scrolled frame.
        announcer.textContent = `Era ${
          (eraIndexes.get(active.id) ?? 0) + 1
        } of ${TIMELINE.length}: ${active.title} ${active.date}.`;
      }
    }

    if (scrollCue) scrollCue.classList.toggle("is-hidden", progress > 0.025);
  };

  const scheduleUpdate = (): void => {
    if (scheduledFrame !== 0) return;
    scheduledFrame = window.requestAnimationFrame(update);
  };

  // A resize changes both the viewport and the timeline's own height, so the
  // visitor's pixel offset now points at a different moment in the story.
  // Put them back where they were reading before repainting.
  const restoreNarrativePosition = (): void => {
    if (!anchored) return;
    const { scrollDistance, narrativeDistance } = scrollMetrics();
    const timelineTop = timeline.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(
      0,
      Math.round(
        timelineTop +
          narrativeAnchor * narrativeDistance +
          dwellAnchor * Math.max(0, scrollDistance - narrativeDistance),
      ),
    );
  };

  const handleResize = (): void => {
    restoreNarrativePosition();
    scheduleUpdate();
  };

  // Jumping is instant rather than smooth: these distances run to tens of
  // thousands of pixels, and an animated scroll across that reads as a hang.
  const scrollToEra = (eraId: string): void => {
    const era = TIMELINE.find((stop) => stop.id === eraId);
    if (!era) return;
    const { narrativeDistance } = scrollMetrics();
    const timelineTop = timeline.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(
      0,
      Math.round(timelineTop + rawProgressForStory(era.scroll) * narrativeDistance),
    );
    scheduleUpdate();
  };

  for (const control of timeline.querySelectorAll<HTMLElement>("[data-era-jump]")) {
    control.addEventListener("click", () => {
      const eraId = control.dataset.eraJump;
      if (eraId) scrollToEra(eraId);
    });
  }

  document.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", handleResize);
  update();

  document.documentElement.style.setProperty(
    "--timeline-count",
    String(TIMELINE.length),
  );
}
