import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

describe("Earth Through Time shell", () => {
  it("introduces the timeline in the site header", () => {
    const distPath = resolve("dist/index.html");
    expect(
      existsSync(distPath),
      `${distPath} not found — run the build before the spec tests.`,
    ).toBe(true);

    const doc = new JSDOM(readFileSync(distPath, "utf8")).window.document;
    expect(doc.title).toBe("Earth Through Time");
    expect(doc.querySelector("h1")?.textContent).toContain("Earth");
    expect(doc.querySelector(".hero-intro")?.textContent).toContain(
      "Scroll through the life of our planet",
    );
    expect(doc.querySelector(".time-range")?.textContent).toContain("4.54 BYA");
    expect(doc.querySelector(".time-range")?.textContent).toContain("+7.59 BY");
  });
});
