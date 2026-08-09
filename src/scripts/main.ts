import { createGlobe } from "./globe";
import { initStarfield } from "./starfield";
import type { TimelineEra } from "./timeline";
import { stateForScrollFraction, TIMELINE } from "./timeline";

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

export function initTimeline(): void {
  initStarfield();

  const timeline = document.querySelector<HTMLElement>("[data-timeline]");
  if (!timeline) return;

  const canvas = requiredElement<HTMLCanvasElement>(timeline, "[data-earth-canvas]");
  const fallback = requiredElement<HTMLElement>(timeline, "[data-earth-fallback]");
  const copy = requiredElement<HTMLElement>(timeline, "[data-era-copy]");
  const date = requiredElement<HTMLElement>(timeline, "[data-era-date]");
  const period = requiredElement<HTMLElement>(timeline, "[data-era-period]");
  const title = requiredElement<HTMLElement>(timeline, "[data-era-title]");
  const description = requiredElement<HTMLElement>(
    timeline,
    "[data-era-description]",
  );
  const counter = requiredElement<HTMLElement>(timeline, "[data-era-counter]");
  const shortDate = requiredElement<HTMLElement>(timeline, "[data-short-date]");
  const globeLabel = requiredElement<HTMLElement>(timeline, "[data-globe-label]");
  const scrollCue = requiredElement<HTMLElement>(document, "[data-scroll-cue]");

  if (
    !canvas ||
    !fallback ||
    !copy ||
    !date ||
    !period ||
    !title ||
    !description ||
    !counter ||
    !shortDate ||
    !globeLabel
  ) {
    return;
  }

  timeline.dataset.enhanced = "true";
  const globe = createGlobe(canvas, fallback);
  const rootStyle = document.documentElement.style;
  let activeId = "";
  let scheduledFrame = 0;

  const update = (): void => {
    scheduledFrame = 0;
    const scrollDistance = Math.max(1, timeline.offsetHeight - window.innerHeight);
    const progress = Math.min(
      1,
      Math.max(0, -timeline.getBoundingClientRect().top / scrollDistance),
    );
    const state = stateForScrollFraction(progress);
    const { from, to, mix, active } = state;

    globe.setState(state);
    rootStyle.setProperty("--timeline-progress", String(progress));
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
      copy.classList.remove("is-entering");
      void copy.offsetWidth;
      date.textContent = active.date;
      period.textContent = active.period;
      title.textContent = active.title;
      description.textContent = active.description;
      counter.textContent = String(state.activeIndex + 1).padStart(2, "0");
      shortDate.textContent = active.shortDate;
      globeLabel.textContent = `${
        hasVisibleMoon(active) ? "Earth and Moon" : "Earth"
      } during ${active.period}, ${active.date}`;
      copy.classList.add("is-entering");
    }

    if (scrollCue) scrollCue.classList.toggle("is-hidden", progress > 0.025);
  };

  const scheduleUpdate = (): void => {
    if (scheduledFrame !== 0) return;
    scheduledFrame = window.requestAnimationFrame(update);
  };

  document.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  update();

  document.documentElement.style.setProperty(
    "--timeline-count",
    String(TIMELINE.length),
  );
}
