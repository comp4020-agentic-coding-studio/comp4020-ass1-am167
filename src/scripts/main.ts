import { createGlobe } from "./globe";
import { initStarfield } from "./starfield";
import type { TimelineEra } from "./timeline";
import {
  stateForScrollFraction,
  timelineProgressForTrackProgress,
  TIMELINE,
  trackProgressForTimelineProgress,
} from "./timeline";

const FINAL_ERA_DWELL_VIEWPORTS = 1.1;
const WHEEL_RESISTANCE_PX = 55;
const WHEEL_STEP_COOLDOWN_MS = 160;
const VISUAL_SMOOTHING_MS = 120;
const VISUAL_PROGRESS_EPSILON = 0.00001;

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
  const scrollTrack = requiredElement<HTMLElement>(timeline, ".scroll-track");
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

  if (
    !canvas ||
    !fallback ||
    !copy ||
    !scrollTrack ||
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
  document.documentElement.classList.add("timeline-scroll-snap");

  const snapStops = TIMELINE.map((era) => {
    const stop = document.createElement("span");
    stop.className = "scroll-stop";
    stop.dataset.trackProgress = String(
      trackProgressForTimelineProgress(era.scroll),
    );
    return stop;
  });
  scrollTrack.replaceChildren(...snapStops);

  const globe = createGlobe(canvas, fallback);
  const rootStyle = document.documentElement.style;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const eraIndexes = new Map(TIMELINE.map((era, index) => [era.id, index]));
  let activeId = "";
  let segmentId = "";
  let scheduledFrame = 0;
  let displayedRawProgress: number | undefined;
  let lastFrameTime = 0;
  let positionedSnapDistance = -1;
  let snapPositions: number[] = [];
  let wheelDelta = 0;
  let wheelStepLocked = false;
  let wheelStepTimer = 0;

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

  const update = (frameTime = 0): void => {
    scheduledFrame = 0;
    const scrollDistance = Math.max(1, timeline.offsetHeight - window.innerHeight);
    const narrativeDistance = Math.max(
      1,
      scrollDistance - window.innerHeight * FINAL_ERA_DWELL_VIEWPORTS,
    );

    if (narrativeDistance !== positionedSnapDistance) {
      positionedSnapDistance = narrativeDistance;
      snapPositions = snapStops.map((stop) => {
        const trackProgress = Number(stop.dataset.trackProgress ?? 0);
        const position = trackProgress * narrativeDistance;
        stop.style.top = `${position}px`;
        return position;
      });
    }

    const targetRawProgress = Math.min(
      1,
      Math.max(0, -timeline.getBoundingClientRect().top / narrativeDistance),
    );
    if (
      displayedRawProgress === undefined ||
      prefersReducedMotion.matches
    ) {
      displayedRawProgress = targetRawProgress;
    } else {
      const elapsed =
        lastFrameTime === 0
          ? 16
          : Math.min(50, Math.max(0, frameTime - lastFrameTime));
      const smoothing = 1 - Math.exp(-elapsed / VISUAL_SMOOTHING_MS);
      displayedRawProgress +=
        (targetRawProgress - displayedRawProgress) * smoothing;

      if (
        Math.abs(targetRawProgress - displayedRawProgress) <
        VISUAL_PROGRESS_EPSILON
      ) {
        displayedRawProgress = targetRawProgress;
      }
    }
    lastFrameTime = frameTime;

    const presentPause = timelineProgressForTrackProgress(displayedRawProgress);
    const progress = presentPause.timelineProgress;
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

    const copyTransition = mix;
    copy.style.setProperty("--copy-transition", String(copyTransition));
    shortDateStack.style.setProperty(
      "--copy-transition",
      String(copyTransition),
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
      String(presentPause.pauseProgress),
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
    const heatStrength =
      from.visual.heat + (to.visual.heat - from.visual.heat) * mix;
    const fromMoonPresence = hasVisibleMoon(from) ? 1 : 0;
    const toMoonPresence = hasVisibleMoon(to) ? 1 : 0;
    const moonPresence =
      fromMoonPresence + (toMoonPresence - fromMoonPresence) * mix;
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
    rootStyle.setProperty("--moon-heat", String(heatStrength));

    if (active.id !== activeId) {
      activeId = active.id;
      globeLabel.textContent = `${
        hasVisibleMoon(active) ? "Earth and Moon" : "Earth"
      } during ${active.period}, ${active.date}`;
    }

    if (scrollCue) scrollCue.classList.toggle("is-hidden", progress > 0.025);

    const needsVisualSmoothing =
      !prefersReducedMotion.matches &&
      Math.abs(targetRawProgress - displayedRawProgress) >=
        VISUAL_PROGRESS_EPSILON;
    if (needsVisualSmoothing) {
      scheduledFrame = window.requestAnimationFrame(update);
    } else {
      lastFrameTime = 0;
    }
  };

  const scheduleUpdate = (): void => {
    if (scheduledFrame !== 0) return;
    scheduledFrame = window.requestAnimationFrame(update);
  };

  const resetWheelStep = (): void => {
    window.clearTimeout(wheelStepTimer);
    wheelStepTimer = 0;
    wheelDelta = 0;
    wheelStepLocked = false;
  };

  const lockWheelStep = (): void => {
    wheelStepLocked = true;
    wheelStepTimer = window.setTimeout(() => {
      wheelStepTimer = 0;
      wheelDelta = 0;
      wheelStepLocked = false;
    }, WHEEL_STEP_COOLDOWN_MS);
  };

  const handleWheel = (event: WheelEvent): void => {
    if (
      event.ctrlKey ||
      Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
      snapPositions.length === 0
    ) {
      return;
    }

    const deltaScale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
    const delta = event.deltaY * deltaScale;
    const timelineTop = timeline.offsetTop;
    const firstStop = timelineTop + snapPositions[0];
    const lastStop = timelineTop + snapPositions.at(-1)!;
    const currentScroll = window.scrollY;
    const approachingFirstStop =
      delta > 0 &&
      currentScroll < firstStop &&
      currentScroll + delta >= firstStop;

    if (
      (!approachingFirstStop && currentScroll < firstStop - 1) ||
      currentScroll > lastStop + 1 ||
      (currentScroll <= firstStop + 1 && delta < 0) ||
      (currentScroll >= lastStop - 1 && delta > 0)
    ) {
      resetWheelStep();
      return;
    }

    event.preventDefault();

    if (wheelStepLocked) return;

    wheelDelta += delta;
    if (Math.abs(wheelDelta) < WHEEL_RESISTANCE_PX) return;

    const direction = wheelDelta > 0 ? 1 : -1;
    const currentOffset = currentScroll - timelineTop;
    const targetIndex =
      direction > 0
        ? snapPositions.findIndex((position) => position > currentOffset + 1)
        : snapPositions.findLastIndex(
            (position) => position < currentOffset - 1,
          );

    if (targetIndex < 0) return;

    wheelDelta = 0;
    lockWheelStep();
    window.scrollTo({
      top: timelineTop + snapPositions[targetIndex],
      behavior: "auto",
    });
  };

  document.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("resize", scheduleUpdate);
  update();

  document.documentElement.style.setProperty(
    "--timeline-count",
    String(TIMELINE.length),
  );
}
