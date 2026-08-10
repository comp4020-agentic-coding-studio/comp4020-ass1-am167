import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { stateForScrollFraction, TIMELINE } from "../src/scripts/timeline";

const DIST = resolve("dist");
const PAGE = join(DIST, "index.html");
const ASTRO = join(DIST, "_astro");

// These are regression budgets, not claims about every network or device. They
// are intentionally a little above the current build so normal build-tool
// churn does not make the suite flaky while a large accidental addition still
// gets caught in review.
const BUDGETS = {
  totalRawBytes: 2_200_000,
  totalGzipBytes: 1_650_000,
  javascriptRawBytes: 600_000,
  javascriptGzipBytes: 160_000,
  stylesheetRawBytes: 32_000,
  htmlRawBytes: 32_000,
  largestAssetRawBytes: 550_000,
  maximumPublishedFiles: 7,
  scrollSamples: 20_000,
  scrollMappingMilliseconds: 250,
} as const;

function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? allFiles(path) : [path];
  });
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function outputFiles(): string[] {
  expect(
    statSync(DIST).isDirectory(),
    "Run `pnpm build` before performance tests",
  ).toBe(true);
  return allFiles(DIST);
}

function fileBytes(path: string): number {
  return readFileSync(path).byteLength;
}

function pageDocument(): Document {
  return new JSDOM(readFileSync(PAGE, "utf8")).window.document;
}

describe("performance budgets: shipped site", () => {
  const files = outputFiles();
  const assets = files.filter((path) => path !== PAGE);
  const javascript = assets.filter((path) => path.endsWith(".js"));
  const stylesheets = assets.filter((path) => path.endsWith(".css"));
  const binaryAssets = assets.filter(
    (path) => !path.endsWith(".js") && !path.endsWith(".css"),
  );
  const totalRawBytes = files.reduce((total, path) => total + fileBytes(path), 0);
  const totalGzipBytes = files.reduce(
    (total, path) => total + gzipSync(readFileSync(path)).byteLength,
    0,
  );

  it("keeps the complete published payload within the transfer budget", () => {
    expect(
      totalRawBytes,
      `published payload is ${formatBytes(totalRawBytes)}`,
    ).toBeLessThanOrEqual(BUDGETS.totalRawBytes);
    expect(
      totalGzipBytes,
      `gzip payload is ${formatBytes(totalGzipBytes)}`,
    ).toBeLessThanOrEqual(BUDGETS.totalGzipBytes);
  });

  it("keeps the client bundle and stylesheet within their budgets", () => {
    const javascriptRawBytes = javascript.reduce(
      (total, path) => total + fileBytes(path),
      0,
    );
    const javascriptGzipBytes = javascript.reduce(
      (total, path) => total + gzipSync(readFileSync(path)).byteLength,
      0,
    );
    const stylesheetRawBytes = stylesheets.reduce(
      (total, path) => total + fileBytes(path),
      0,
    );

    expect(
      javascriptRawBytes,
      `JavaScript is ${formatBytes(javascriptRawBytes)}`,
    ).toBeLessThanOrEqual(BUDGETS.javascriptRawBytes);
    expect(
      javascriptGzipBytes,
      `gzip JavaScript is ${formatBytes(javascriptGzipBytes)}`,
    ).toBeLessThanOrEqual(BUDGETS.javascriptGzipBytes);
    expect(
      stylesheetRawBytes,
      `stylesheet is ${formatBytes(stylesheetRawBytes)}`,
    ).toBeLessThanOrEqual(BUDGETS.stylesheetRawBytes);
  });

  it("keeps the initial document and published request graph small", () => {
    const document = pageDocument();
    const htmlBytes = fileBytes(PAGE);
    const largestAssetBytes = Math.max(...binaryAssets.map(fileBytes));
    const stylesheetLinks = document.querySelectorAll('link[rel="stylesheet"]');
    const externalScripts = document.querySelectorAll("script[src]");

    expect(htmlBytes, `HTML is ${formatBytes(htmlBytes)}`).toBeLessThanOrEqual(
      BUDGETS.htmlRawBytes,
    );
    expect(
      largestAssetBytes,
      `largest non-code asset is ${formatBytes(largestAssetBytes)}`,
    ).toBeLessThanOrEqual(BUDGETS.largestAssetRawBytes);
    expect(files.length).toBeLessThanOrEqual(BUDGETS.maximumPublishedFiles);
    expect(stylesheetLinks).toHaveLength(1);
    expect(externalScripts).toHaveLength(1);
    expect(externalScripts[0]?.getAttribute("type")).toBe("module");
  });

  it("does not emit duplicate asset names into the build", () => {
    const names = assets.map((path) => relative(ASTRO, path));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("performance-sensitive scroll mapping", () => {
  it("maps animation-frame-sized scroll samples within the CPU budget", () => {
    let checksum = 0;
    const startedAt = performance.now();

    for (let index = 0; index < BUDGETS.scrollSamples; index += 1) {
      const state = stateForScrollFraction(index / (BUDGETS.scrollSamples - 1));
      checksum += state.activeIndex + state.mix + state.millionYearsFromNow;
    }

    const elapsedMilliseconds = performance.now() - startedAt;
    expect(Number.isFinite(checksum)).toBe(true);
    expect(
      elapsedMilliseconds,
      `${BUDGETS.scrollSamples.toLocaleString()} scroll mappings took ${elapsedMilliseconds.toFixed(1)} ms`,
    ).toBeLessThanOrEqual(BUDGETS.scrollMappingMilliseconds);
  });

  it("keeps the timeline data bounded for per-frame interpolation", () => {
    expect(TIMELINE.length).toBeLessThanOrEqual(100);
    expect(TIMELINE.every((era) => Number.isFinite(era.scroll))).toBe(true);
  });
});
