import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

describe("Earth Through Time experience", () => {
  it("ships the scrollable Earth timeline and its readable fallback", () => {
    const distPath = resolve("dist/index.html");
    expect(
      existsSync(distPath),
      `${distPath} not found — run the build before the spec tests.`,
    ).toBe(true);

    const doc = new JSDOM(readFileSync(distPath, "utf8")).window.document;
    expect(doc.title).toBe("Earth Through Time");
    expect(doc.querySelector("[data-timeline]")).toBeTruthy();
    expect(doc.querySelector("[data-earth-canvas]")).toBeTruthy();
    expect(doc.querySelectorAll("[data-era-stop]").length).toBeGreaterThanOrEqual(
      60,
    );
    expect(doc.querySelector("[data-era-title]")?.textContent).toContain(
      "Earth begins in fire",
    );
    expect(doc.querySelector(".time-range")?.textContent).toContain("4.54 BYA");
    expect(doc.querySelector(".time-range")?.textContent).toContain("+8 BY");
  });
});
