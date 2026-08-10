import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { TIMELINE } from "../src/scripts/timeline";

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
