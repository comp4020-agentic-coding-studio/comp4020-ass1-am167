import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { MILESTONE_ERA_IDS, TIMELINE } from "../src/scripts/timeline";

// These checks compare the built page with the source timeline so Astro
// template changes cannot silently make the readable fallback incomplete.
// Run `pnpm build` first; `pnpm check` does this automatically.
const document = new JSDOM(
  readFileSync(resolve("dist/index.html"), "utf8"),
).window.document;

describe("built Earth timeline", () => {
  it("ships every era in chronological order without JavaScript", () => {
    const stops = [...document.querySelectorAll<HTMLElement>("[data-era-stop]")];

    expect(stops).toHaveLength(TIMELINE.length);
    expect(stops.map((stop) => stop.dataset.eraStop)).toEqual(
      TIMELINE.map((era) => era.id),
    );

    for (const [index, stop] of stops.entries()) {
      const era = TIMELINE[index];
      const paragraphs = stop.querySelectorAll("p");
      expect(paragraphs[0]?.textContent?.trim(), era.id).toBe(era.date);
      expect(stop.querySelector("h2")?.textContent?.trim(), era.id).toBe(
        era.title,
      );
      expect(paragraphs[1]?.textContent?.trim(), era.id).toBe(era.description);
    }
  });

  it("renders a meter tick at every event's mapped position", () => {
    const ticks = [...document.querySelectorAll<HTMLElement>(".meter-tick")];

    expect(ticks).toHaveLength(TIMELINE.length);
    for (const [index, tick] of ticks.entries()) {
      expect(
        Number(tick.style.getPropertyValue("--event-position")),
        TIMELINE[index].id,
      ).toBeCloseTo(TIMELINE[index].scroll);
    }
  });

  it("offers a named, operable control for every milestone", () => {
    const jumps = [
      ...document.querySelectorAll<HTMLElement>("[data-era-jump]"),
    ];

    expect(jumps).toHaveLength(MILESTONE_ERA_IDS.size);

    for (const jump of jumps) {
      const era = TIMELINE.find((stop) => stop.id === jump.dataset.eraJump);
      expect(era, `unknown era ${jump.dataset.eraJump}`).toBeDefined();
      // A real button, so it is reachable and operable by keyboard for free.
      expect(jump.tagName).toBe("BUTTON");
      expect(jump.getAttribute("type")).toBe("button");
      // Named by its destination rather than by its position on the rail.
      expect(jump.getAttribute("aria-label")).toContain(era?.title);
      expect(
        Number(jump.style.getPropertyValue("--event-position")),
      ).toBeCloseTo(era?.scroll ?? -1);
    }
  });

  it("keeps the non-milestone ticks decorative", () => {
    const ticks = [...document.querySelectorAll<HTMLElement>(".meter-tick")];
    const decorative = ticks.filter((tick) => !tick.hasAttribute("data-era-jump"));

    expect(decorative).toHaveLength(TIMELINE.length - MILESTONE_ERA_IDS.size);
    for (const tick of decorative) {
      expect(tick.tagName).not.toBe("BUTTON");
    }
  });

  it("starts with matching content and accessible globe alternatives", () => {
    const first = TIMELINE[0];
    const sourcePanel = document.querySelector<HTMLElement>(
      '[data-era-panel][data-era-layer="from"]',
    );
    const description = document.querySelector<HTMLElement>(
      "#globe-description",
    );

    expect(sourcePanel?.querySelector("[data-era-date]")?.textContent?.trim()).toBe(
      first.date,
    );
    expect(sourcePanel?.querySelector("[data-era-title]")?.textContent?.trim()).toBe(
      first.title,
    );
    expect(document.querySelector("[data-short-date]")?.textContent?.trim()).toBe(
      first.shortDate,
    );
    expect(description?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      `Earth during ${first.period}, ${first.date}`,
    );

    for (const visual of document.querySelectorAll<HTMLElement>(
      "[data-earth-canvas], [data-earth-fallback]",
    )) {
      expect(visual.getAttribute("role")).toBe("img");
      expect(visual.getAttribute("aria-describedby")).toBe(description?.id);
    }
  });
});
