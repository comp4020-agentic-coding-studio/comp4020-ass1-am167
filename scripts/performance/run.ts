import { gzipSync } from "node:zlib";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { arch, cpus, hostname, platform, totalmem } from "node:os";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
} from "playwright-core";

import {
  estimateRenderDutyCycle,
  fitRenderCost,
  SHIPPED_DRAWING_PIXEL_CAP,
  summarizeCadence,
  summarizeDurations,
  totalBlockingTime,
  type RenderCostSample,
} from "./report.ts";

const ROOT = resolve(".");
const DIST = join(ROOT, "dist");
const REPORT_DIRECTORY = join(ROOT, "performance-results");
const BASE_PATH = "/comp4020-ass1-am167/";
const PROFILE_RUNS = boundedEnvironmentInteger("PERF_RUNS", 1, 1, 5);
const HEADED =
  process.env.PERF_HEADED === "1" || process.env.PERF_HEADLESS === "0";
// The lower points show the shipped state; the deliberately oversized points
// push even a fast GPU beyond vsync. Only those saturated points are used to
// fit cost, avoiding the vsync-clamped measurement failure documented in PR
// #20.
const GPU_DRAWING_PIXELS = [
  1_250_000,
  5_000_000,
  10_000_000,
  15_000_000,
  20_000_000,
];

interface NetworkConditions {
  label: string;
  latencyMilliseconds: number;
  downloadBytesPerSecond: number;
  uploadBytesPerSecond: number;
}

interface RuntimeProfile {
  name: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  cpuSlowdown: number;
  network?: NetworkConditions;
  scrollDurationMilliseconds: number;
}

const SLOW_4G: NetworkConditions = {
  label: "Slow 4G (1.6 Mbps / 150 ms RTT)",
  latencyMilliseconds: 150,
  downloadBytesPerSecond: 1_600_000 / 8,
  uploadBytesPerSecond: 750_000 / 8,
};

const RUNTIME_PROFILES: readonly RuntimeProfile[] = [
  {
    name: "marking-desktop",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    cpuSlowdown: 1,
    scrollDurationMilliseconds: 4_500,
  },
  {
    name: "marking-phone-constrained",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    cpuSlowdown: 4,
    network: SLOW_4G,
    scrollDurationMilliseconds: 6_000,
  },
  {
    name: "low-end-laptop",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    isMobile: false,
    cpuSlowdown: 6,
    network: SLOW_4G,
    scrollDurationMilliseconds: 6_000,
  },
];

interface BrowserObservations {
  longTasks: Array<{ startTime: number; duration: number }>;
  layoutShift: number;
  largestContentfulPaint: number;
  interactionDurations: number[];
}

interface BrowserState {
  navigation: {
    responseStart: number;
    domContentLoaded: number;
    load: number;
    transferSize: number;
    encodedBodySize: number;
  };
  firstContentfulPaint: number;
  observations: BrowserObservations;
  resources: Array<{
    name: string;
    initiatorType: string;
    duration: number;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
  }>;
  javascriptHeapBytes: number | null;
}

interface ProbeSnapshot {
  version: number;
  activeEra: string | null;
  renderCalls: number;
  commandSubmissionMilliseconds: number[];
  renderFrameIntervals: number[];
  drawingBuffer: {
    cssWidth: number;
    cssHeight: number;
    width: number;
    height: number;
    pixels: number;
    pixelRatio: number;
  };
  webgl: {
    version: string;
    vendor: string;
    renderer: string;
    maximumTextureSize: number;
  };
}

interface PhaseResult {
  durationMilliseconds: number;
  cadence: ReturnType<typeof summarizeCadence>;
  rendersPerSecond: number | null;
  probe: ProbeSnapshot | null;
  longTasks: ReturnType<typeof summarizeDurations>;
  totalBlockingMilliseconds: number;
}

interface Finding {
  severity: "warning" | "failure";
  code: string;
  message: string;
}

function boundedEnvironmentInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatMilliseconds(milliseconds: number): string {
  return `${milliseconds.toFixed(1)} ms`;
}

async function allFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? allFiles(path) : [path];
    }),
  );
  return nested.flat();
}

async function collectBuildMetrics(): Promise<Record<string, unknown>> {
  const files = await allFiles(DIST);
  const entries = await Promise.all(
    files.map(async (path) => {
      const contents = await readFile(path);
      return {
        path: relative(DIST, path),
        rawBytes: contents.byteLength,
        gzipBytes: gzipSync(contents).byteLength,
      };
    }),
  );
  const sum = (key: "rawBytes" | "gzipBytes", suffix?: string): number =>
    entries
      .filter((entry) => !suffix || entry.path.endsWith(suffix))
      .reduce((total, entry) => total + entry[key], 0);

  return {
    fileCount: entries.length,
    rawBytes: sum("rawBytes"),
    gzipBytes: sum("gzipBytes"),
    javascriptRawBytes: sum("rawBytes", ".js"),
    javascriptGzipBytes: sum("gzipBytes", ".js"),
    stylesheetRawBytes: sum("rawBytes", ".css"),
    files: entries.sort((left, right) => right.rawBytes - left.rawBytes),
  };
}

async function startPreview(): Promise<{
  url: string;
  server?: Server;
}> {
  if (process.env.PERF_URL) {
    const url = new URL(process.env.PERF_URL);
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return { url: url.href };
  }

  const index = join(DIST, "index.html");
  try {
    if (!(await stat(index)).isFile()) throw new Error("not a file");
  } catch {
    throw new Error("Missing dist/index.html; run `pnpm build` first");
  }

  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
  };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (!pathname.startsWith(BASE_PATH)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const relativePath = decodeURIComponent(pathname.slice(BASE_PATH.length));
      const filePath = resolve(DIST, relativePath || "index.html");
      const pathFromDist = relative(DIST, filePath);
      if (pathFromDist.startsWith("..") || isAbsolute(pathFromDist)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const contents = await readFile(filePath);
      const extension = extname(filePath);
      const compress = [".css", ".html", ".js"].includes(extension);
      const body = compress ? gzipSync(contents) : contents;
      const headers: Record<string, string | number> = {
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
        Vary: "Accept-Encoding",
      };
      if (compress) headers["Content-Encoding"] = "gzip";
      response.writeHead(200, headers);
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not allocate a preview port");
  }
  return {
    url: `http://127.0.0.1:${address.port}${BASE_PATH}`,
    server,
  };
}

async function launchChrome(): Promise<Browser> {
  const executablePath = process.env.PERF_CHROME_PATH;
  return chromium.launch({
    channel: executablePath ? undefined : "chrome",
    executablePath,
    headless: !HEADED,
    args: ["--enable-precise-memory-info"],
  });
}

async function installObservers(
  context: BrowserContext,
  profilerConfig: Record<string, unknown>,
): Promise<void> {
  await context.addInitScript((config) => {
    const observations: BrowserObservations = {
      longTasks: [],
      layoutShift: 0,
      largestContentfulPaint: 0,
      interactionDurations: [],
    };
    Object.defineProperty(window, "__PERFORMANCE_OBSERVATIONS__", {
      configurable: true,
      value: observations,
    });
    Object.defineProperty(window, "__EARTH_PERFORMANCE_CONFIG__", {
      configurable: true,
      value: config,
    });

    const observe = (
      type: string,
      callback: (entries: PerformanceEntry[]) => void,
    ): void => {
      try {
        const observer = new PerformanceObserver((list) =>
          callback(list.getEntries()),
        );
        observer.observe({ type, buffered: true });
      } catch {
        // Older Chrome builds can omit individual entry types.
      }
    };

    observe("longtask", (entries) => {
      observations.longTasks.push(
        ...entries.map((entry) => ({
          startTime: entry.startTime,
          duration: entry.duration,
        })),
      );
    });
    observe("layout-shift", (entries) => {
      for (const entry of entries) {
        const shift = entry as PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
        };
        if (!shift.hadRecentInput) observations.layoutShift += shift.value ?? 0;
      }
    });
    observe("largest-contentful-paint", (entries) => {
      const last = entries.at(-1);
      if (last) observations.largestContentfulPaint = last.startTime;
    });
    observe("event", (entries) => {
      observations.interactionDurations.push(
        ...entries
          .map((entry) => entry.duration)
          .filter((duration) => duration > 0),
      );
    });
  }, profilerConfig);
}

async function configureThrottling(
  context: BrowserContext,
  page: Page,
  profile: RuntimeProfile,
): Promise<CDPSession> {
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.clearBrowserCache");
  await session.send("Emulation.setCPUThrottlingRate", {
    rate: profile.cpuSlowdown,
  });
  if (profile.network) {
    // Chrome 151 no longer applies the deprecated all-in-one command
    // consistently to loopback traffic. Use the replacement pair: one rule
    // shapes requests, the other keeps navigator.connection honest.
    const rawSend = session.send.bind(session) as unknown as (
      method: string,
      parameters: Record<string, unknown>,
    ) => Promise<unknown>;
    const conditions = {
      offline: false,
      latency: profile.network.latencyMilliseconds,
      downloadThroughput: profile.network.downloadBytesPerSecond,
      uploadThroughput: profile.network.uploadBytesPerSecond,
      connectionType: "cellular4g",
    };
    await rawSend("Network.emulateNetworkConditionsByRule", {
      offline: false,
      matchedNetworkConditions: [{ urlPattern: "", ...conditions }],
    });
    await rawSend("Network.overrideNetworkState", conditions);
  }
  await session.send("Performance.enable");
  return session;
}

async function collectFrameIntervals(
  page: Page,
  durationMilliseconds: number,
): Promise<number[]> {
  return page.evaluate(
    (duration) =>
      new Promise<number[]>((resolveIntervals) => {
        const intervals: number[] = [];
        let first = 0;
        let previous = 0;
        const sample = (now: number): void => {
          if (first === 0) first = now;
          if (previous > 0) intervals.push(now - previous);
          previous = now;
          if (now - first >= duration) resolveIntervals(intervals);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    durationMilliseconds,
  );
}

async function calibrateRefresh(browser: Browser): Promise<{
  intervalMilliseconds: number;
  refreshRateHz: number;
  samples: number[];
}> {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
  });
  try {
    const page = await context.newPage();
    await page.goto("data:text/html,<title>refresh calibration</title>");
    const samples = await collectFrameIntervals(page, 1_200);
    const summary = summarizeDurations(samples);
    return {
      intervalMilliseconds: summary.median,
      refreshRateHz: summary.median > 0 ? 1000 / summary.median : 60,
      samples,
    };
  } finally {
    await context.close();
  }
}

async function resetBrowserObservations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const observations = (
      window as typeof window & {
        __PERFORMANCE_OBSERVATIONS__?: BrowserObservations;
      }
    ).__PERFORMANCE_OBSERVATIONS__;
    if (observations) observations.longTasks.length = 0;
    window.__EARTH_PERFORMANCE__?.reset();
  });
}

async function readProbe(page: Page): Promise<ProbeSnapshot | null> {
  return page.evaluate(
    () => (window.__EARTH_PERFORMANCE__?.snapshot() as ProbeSnapshot) ?? null,
  );
}

async function readBrowserState(page: Page): Promise<BrowserState> {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType("paint");
    const firstContentfulPaint =
      paints.find((entry) => entry.name === "first-contentful-paint")
        ?.startTime ?? 0;
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return {
          name: resource.name,
          initiatorType: resource.initiatorType,
          duration: resource.duration,
          transferSize: resource.transferSize,
          encodedBodySize: resource.encodedBodySize,
          decodedBodySize: resource.decodedBodySize,
        };
      });
    const observations = (
      window as typeof window & {
        __PERFORMANCE_OBSERVATIONS__?: BrowserObservations;
      }
    ).__PERFORMANCE_OBSERVATIONS__ ?? {
      longTasks: [],
      layoutShift: 0,
      largestContentfulPaint: 0,
      interactionDurations: [],
    };
    const memory = (
      performance as Performance & {
        memory?: { usedJSHeapSize?: number };
      }
    ).memory;

    return {
      navigation: {
        responseStart: navigation?.responseStart ?? 0,
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
        load: navigation?.loadEventEnd ?? 0,
        transferSize: navigation?.transferSize ?? 0,
        encodedBodySize: navigation?.encodedBodySize ?? 0,
      },
      firstContentfulPaint,
      observations: {
        longTasks: [...observations.longTasks],
        layoutShift: observations.layoutShift,
        largestContentfulPaint: observations.largestContentfulPaint,
        interactionDurations: [...observations.interactionDurations],
      },
      resources,
      javascriptHeapBytes: memory?.usedJSHeapSize ?? null,
    };
  });
}

async function collectPhase(
  page: Page,
  durationMilliseconds: number,
  refreshIntervalMilliseconds: number,
): Promise<PhaseResult> {
  await resetBrowserObservations(page);
  const frameIntervals = await collectFrameIntervals(page, durationMilliseconds);
  const [probe, state] = await Promise.all([
    readProbe(page),
    readBrowserState(page),
  ]);
  const longTaskDurations = state.observations.longTasks.map(
    (task) => task.duration,
  );
  return {
    durationMilliseconds,
    cadence: summarizeCadence(frameIntervals, refreshIntervalMilliseconds),
    rendersPerSecond: probe
      ? probe.renderCalls / (durationMilliseconds / 1000)
      : null,
    probe,
    longTasks: summarizeDurations(longTaskDurations),
    totalBlockingMilliseconds: totalBlockingTime(longTaskDurations),
  };
}

async function sweepTimeline(
  page: Page,
  durationMilliseconds: number,
): Promise<number[]> {
  return page.evaluate(
    async (duration) => {
      const timeline = document.querySelector<HTMLElement>("[data-timeline]");
      if (!timeline) throw new Error("Missing [data-timeline]");
      const top = timeline.getBoundingClientRect().top + window.scrollY;
      const end = top + timeline.offsetHeight - window.innerHeight;
      window.scrollTo(0, top);
      await new Promise<void>((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
      );

      return new Promise<number[]>((resolveIntervals) => {
        const intervals: number[] = [];
        let first = 0;
        let previous = 0;
        const step = (now: number): void => {
          if (first === 0) first = now;
          if (previous > 0) intervals.push(now - previous);
          previous = now;
          const progress = Math.min(1, (now - first) / duration);
          window.scrollTo(0, top + (end - top) * progress);
          if (progress >= 1) resolveIntervals(intervals);
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    },
    durationMilliseconds,
  );
}

async function waitForPresentTextures(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => /earth-(day|specular|clouds|lights)/.test(entry.name))
          .length >= 4,
      undefined,
      { timeout: 45_000 },
    );
    return true;
  } catch {
    return false;
  }
}

function cdpMetrics(
  result: Awaited<ReturnType<CDPSession["send"]>>,
): Record<string, number> {
  const metrics = (result as { metrics?: Array<{ name: string; value: number }> })
    .metrics;
  return Object.fromEntries(
    (metrics ?? []).map((metric) => [metric.name, metric.value]),
  );
}

async function runRuntimeProfile(
  browser: Browser,
  url: string,
  profile: RuntimeProfile,
  run: number,
  refreshIntervalMilliseconds: number,
): Promise<Record<string, unknown>> {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.isMobile,
    reducedMotion: "no-preference",
  });
  await installObservers(context, {
    enabled: true,
    maximumSamples: 360,
  });

  const errors: string[] = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().startsWith("Failed to load resource:")
      ) {
        const source = message.location().url;
        errors.push(`console: ${message.text()}${source ? ` (${source})` : ""}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const path = new URL(response.url()).pathname;
      if (path === "/favicon.ico") return;
      errors.push(`response: ${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      errors.push(
        `request: ${request.url()} (${request.failure()?.errorText ?? "failed"})`,
      );
    });
    const session = await configureThrottling(context, page, profile);

    await page.goto(url, { waitUntil: "load", timeout: 90_000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-timeline]")?.getAttribute("data-enhanced") ===
          "true" || !document.querySelector("[data-earth-canvas]")?.isConnected,
      undefined,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(600);
    const load = await readBrowserState(page);
    const initialTextureRequests = load.resources.filter((resource) =>
      /earth-(day|specular|clouds|lights)/.test(resource.name),
    );

    const hero = await collectPhase(
      page,
      1_500,
      refreshIntervalMilliseconds,
    );

    await resetBrowserObservations(page);
    const scrollIntervals = await sweepTimeline(
      page,
      profile.scrollDurationMilliseconds,
    );
    await page.waitForTimeout(250);
    const [scrollProbe, scrollState] = await Promise.all([
      readProbe(page),
      readBrowserState(page),
    ]);
    const scrollLongTasks = scrollState.observations.longTasks.map(
      (task) => task.duration,
    );
    const scroll: PhaseResult = {
      durationMilliseconds: profile.scrollDurationMilliseconds,
      cadence: summarizeCadence(
        scrollIntervals,
        refreshIntervalMilliseconds,
      ),
      rendersPerSecond: scrollProbe
        ? scrollProbe.renderCalls /
          (profile.scrollDurationMilliseconds / 1000)
        : null,
      probe: scrollProbe,
      longTasks: summarizeDurations(scrollLongTasks),
      totalBlockingMilliseconds: totalBlockingTime(scrollLongTasks),
    };

    await page.evaluate(() => {
      document
        .querySelector<HTMLElement>('[data-era-jump="present"]')
        ?.click();
    });
    const presentTexturesLoaded = await waitForPresentTextures(page);
    await page.waitForTimeout(600);
    const present = await collectPhase(
      page,
      1_500,
      refreshIntervalMilliseconds,
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    const reducedMotion = await collectPhase(
      page,
      1_200,
      refreshIntervalMilliseconds,
    );

    const finalState = await readBrowserState(page);
    const performanceMetrics = cdpMetrics(
      await session.send("Performance.getMetrics"),
    );

    return {
      name: profile.name,
      run,
      conditions: {
        viewport: profile.viewport,
        deviceScaleFactor: profile.deviceScaleFactor,
        cpuSlowdown: profile.cpuSlowdown,
        network: profile.network?.label ?? "unthrottled",
      },
      load: {
        ...load.navigation,
        firstContentfulPaint: load.firstContentfulPaint,
        largestContentfulPaint: load.observations.largestContentfulPaint,
        cumulativeLayoutShift: load.observations.layoutShift,
        longTasks: summarizeDurations(
          load.observations.longTasks.map((task) => task.duration),
        ),
        totalBlockingMilliseconds: totalBlockingTime(
          load.observations.longTasks.map((task) => task.duration),
        ),
        resourceCount: load.resources.length + 1,
        transferredBytes:
          load.navigation.transferSize +
          load.resources.reduce(
            (total, resource) => total + resource.transferSize,
            0,
          ),
        initialTextureRequests: initialTextureRequests.map(
          (resource) => resource.name,
        ),
      },
      hero,
      scroll,
      present: {
        ...present,
        texturesLoaded: presentTexturesLoaded,
      },
      reducedMotion,
      final: {
        cumulativeLayoutShift: finalState.observations.layoutShift,
        maximumInteractionMilliseconds:
          summarizeDurations(finalState.observations.interactionDurations)
            .maximum,
        javascriptHeapBytes: finalState.javascriptHeapBytes,
        resourceCount: finalState.resources.length + 1,
        transferredBytes:
          finalState.navigation.transferSize +
          finalState.resources.reduce(
            (total, resource) => total + resource.transferSize,
            0,
          ),
      },
      chromePerformanceMetrics: performanceMetrics,
      errors,
    };
  } finally {
    await context.close();
  }
}

async function runGpuStress(
  browser: Browser,
  url: string,
  refreshIntervalMilliseconds: number,
): Promise<Record<string, unknown>> {
  const points: Array<{
    requestedPixels: number;
    mode: "procedural" | "present";
    snapshot: ProbeSnapshot;
    cadence: ReturnType<typeof summarizeCadence>;
  }> = [];
  let webgl: ProbeSnapshot["webgl"] | null = null;

  for (const drawingPixels of GPU_DRAWING_PIXELS) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await installObservers(context, {
      enabled: true,
      drawingPixels,
      maximumSamples: 360,
    });

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "load", timeout: 90_000 });
      await page.waitForFunction(() => Boolean(window.__EARTH_PERFORMANCE__), {
        timeout: 15_000,
      });
      await page.evaluate(() => {
        const timeline = document.querySelector<HTMLElement>("[data-timeline]");
        if (timeline) {
          window.scrollTo(
            0,
            timeline.getBoundingClientRect().top + window.scrollY,
          );
        }
      });
      await page.waitForTimeout(900);
      await resetBrowserObservations(page);
      const proceduralIntervals = await collectFrameIntervals(page, 2_200);
      const procedural = await readProbe(page);
      if (!procedural) {
        throw new Error("The WebGL performance probe is unavailable");
      }
      webgl ??= procedural.webgl;
      points.push({
        requestedPixels: drawingPixels,
        mode: "procedural",
        snapshot: procedural,
        cadence: summarizeCadence(
          proceduralIntervals,
          refreshIntervalMilliseconds,
        ),
      });

      await page.evaluate(() => {
        document
          .querySelector<HTMLElement>('[data-era-jump="present"]')
          ?.click();
      });
      await waitForPresentTextures(page);
      await page.waitForTimeout(900);
      await resetBrowserObservations(page);
      const presentIntervals = await collectFrameIntervals(page, 1_500);
      const present = await readProbe(page);
      if (!present) {
        throw new Error("The WebGL performance probe is unavailable");
      }
      points.push({
        requestedPixels: drawingPixels,
        mode: "present",
        snapshot: present,
        cadence: summarizeCadence(
          presentIntervals,
          refreshIntervalMilliseconds,
        ),
      });
    } finally {
      await context.close();
    }
  }

  const fitFor = (mode: "procedural" | "present") => {
    const samples: RenderCostSample[] = points
      .filter(
        (point) =>
          point.mode === mode &&
          point.cadence.median > refreshIntervalMilliseconds * 1.5,
      )
      .map((point) => ({
        megapixels: point.snapshot.drawingBuffer.pixels / 1_000_000,
        // Once saturated, total elapsed time / delivered frames retains the
        // fractional cost that the vsync-quantized median throws away.
        milliseconds: point.cadence.mean,
      }));
    return {
      saturatedPointCount: samples.length,
      fit: samples.length >= 2 ? fitRenderCost(samples) : null,
    };
  };
  const softwareRenderer = /swiftshader|llvmpipe|software/i.test(
    webgl?.renderer ?? "",
  );

  return {
    method:
      "increase drawing pixels until rAF is slower than 1.5× an independent blank-page refresh calibration, then fit mean cadence across saturated points only",
    representativeOfInstalledGpu: !softwareRenderer,
    webgl,
    refreshIntervalMilliseconds,
    points,
    fits: {
      procedural: fitFor("procedural"),
      present: fitFor("present"),
    },
  };
}

function analyseReport(report: {
  refreshCalibration: { refreshRateHz: number };
  runtimeProfiles: Array<Record<string, unknown>>;
  gpuStress: Record<string, unknown>;
}): Finding[] {
  const findings: Finding[] = [];
  for (const rawProfile of report.runtimeProfiles) {
    const profile = rawProfile as {
      name: string;
      run: number;
      load: {
        cumulativeLayoutShift: number;
        totalBlockingMilliseconds: number;
        initialTextureRequests: string[];
      };
      hero: PhaseResult;
      scroll: PhaseResult;
      reducedMotion: PhaseResult;
      errors: string[];
    };
    const prefix = `${profile.name} run ${profile.run}`;

    if (profile.errors.length > 0) {
      findings.push({
        severity: "failure",
        code: "browser-errors",
        message: `${prefix}: ${profile.errors.join("; ")}`,
      });
    }
    if (profile.load.initialTextureRequests.length > 0) {
      findings.push({
        severity: "failure",
        code: "eager-present-textures",
        message: `${prefix}: present-only Earth textures loaded before the visitor reached the present.`,
      });
    }
    if (profile.load.cumulativeLayoutShift > 0.1) {
      findings.push({
        severity: "warning",
        code: "layout-shift",
        message: `${prefix}: load CLS was ${profile.load.cumulativeLayoutShift.toFixed(3)} (target ≤ 0.1).`,
      });
    }
    const loadBlockingBudget = profile.name === "marking-desktop" ? 200 : 600;
    if (profile.load.totalBlockingMilliseconds > loadBlockingBudget) {
      findings.push({
        severity: "warning",
        code: "load-blocking-time",
        message: `${prefix}: load blocking time was ${formatMilliseconds(profile.load.totalBlockingMilliseconds)} (profile budget ${loadBlockingBudget} ms).`,
      });
    }
    if (profile.scroll.totalBlockingMilliseconds > 200) {
      findings.push({
        severity: "warning",
        code: "scroll-long-tasks",
        message: `${prefix}: timeline sweep accumulated ${formatMilliseconds(profile.scroll.totalBlockingMilliseconds)} of blocking time.`,
      });
    }
    if (profile.scroll.cadence.missedFrameRatio > 0.1) {
      findings.push({
        severity: "warning",
        code: "scroll-frame-misses",
        message: `${prefix}: ${(profile.scroll.cadence.missedFrameRatio * 100).toFixed(1)}% of scroll frames missed the calibrated refresh interval.`,
      });
    }
    const drawingPixels = profile.hero.probe?.drawingBuffer.pixels;
    if (drawingPixels && drawingPixels > SHIPPED_DRAWING_PIXEL_CAP * 1.02) {
      findings.push({
        severity: "failure",
        code: "drawing-buffer-cap",
        message: `${prefix}: the shipped globe allocated ${drawingPixels.toLocaleString()} drawing pixels, above the 1.25 Mpx cap.`,
      });
    }
    if ((profile.hero.rendersPerSecond ?? 0) > 5) {
      findings.push({
        severity: "warning",
        code: "offscreen-continuous-rendering",
        message: `${prefix}: WebGL rendered ${profile.hero.rendersPerSecond?.toFixed(1)} frames/s while the globe was below the fold.`,
      });
    }
    if ((profile.reducedMotion.rendersPerSecond ?? 0) > 5) {
      findings.push({
        severity: "warning",
        code: "reduced-motion-continuous-rendering",
        message: `${prefix}: reduced-motion still rendered ${profile.reducedMotion.rendersPerSecond?.toFixed(1)} frames/s.`,
      });
    }
  }

  const gpu = report.gpuStress as {
    representativeOfInstalledGpu: boolean;
    fits: {
      procedural: {
        saturatedPointCount: number;
        fit: ReturnType<typeof fitRenderCost> | null;
      };
      present: {
        saturatedPointCount: number;
        fit: ReturnType<typeof fitRenderCost> | null;
      };
    };
  };
  const proceduralFit = gpu.fits.procedural.fit;
  const proceduralDuty = proceduralFit
    ? estimateRenderDutyCycle(
        proceduralFit.predictedMillisecondsAtShippedCap,
        report.refreshCalibration.refreshRateHz,
      )
    : null;
  if (proceduralDuty !== null && proceduralDuty > 50) {
    findings.push({
      severity: "warning",
      code: "gpu-duty-cycle",
      message: `Procedural terrain is estimated to occupy ${proceduralDuty.toFixed(1)}% of the calibrated refresh budget at the shipped 1.25 Mpx cap.`,
    });
  }
  if (!proceduralFit) {
    findings.push({
      severity: "warning",
      code: "gpu-not-saturated",
      message:
        "Fewer than two procedural stress points fell below vsync; no GPU slope was reported. Increase the diagnostic pixel ladder or rerun on slower hardware.",
    });
  } else if (proceduralFit.rSquared < 0.8) {
    findings.push({
      severity: "warning",
      code: "gpu-fit-unstable",
      message: `The procedural GPU scaling fit had R² ${proceduralFit.rSquared.toFixed(2)}; rerun before trusting the slope.`,
    });
  }
  if (!gpu.representativeOfInstalledGpu) {
    findings.push({
      severity: "warning",
      code: "software-webgl",
      message:
        "Chrome used a software WebGL renderer. CPU/network results remain useful, but rerun headed on real hardware for GPU conclusions.",
    });
  }
  return findings;
}

function markdownReport(report: {
  generatedAt: string;
  targetUrl: string;
  environment: Record<string, unknown>;
  build: Record<string, unknown>;
  refreshCalibration: { intervalMilliseconds: number; refreshRateHz: number };
  runtimeProfiles: Array<Record<string, unknown>>;
  gpuStress: Record<string, unknown>;
  findings: Finding[];
}): string {
  const runtimeRows = report.runtimeProfiles.map((rawProfile) => {
    const profile = rawProfile as {
      name: string;
      run: number;
      conditions: {
        cpuSlowdown: number;
        network: string;
      };
      load: {
        largestContentfulPaint: number;
        cumulativeLayoutShift: number;
        totalBlockingMilliseconds: number;
      };
      scroll: PhaseResult;
      hero: PhaseResult;
      reducedMotion: PhaseResult;
      errors: string[];
    };
    return `| ${profile.name} #${profile.run} | ${profile.conditions.cpuSlowdown}× / ${profile.conditions.network} | ${profile.load.largestContentfulPaint.toFixed(0)} ms | ${profile.load.cumulativeLayoutShift.toFixed(3)} | ${profile.load.totalBlockingMilliseconds.toFixed(0)} ms | ${profile.scroll.cadence.effectiveFramesPerSecond.toFixed(1)} | ${(profile.scroll.cadence.missedFrameRatio * 100).toFixed(1)}% | ${profile.hero.rendersPerSecond?.toFixed(1) ?? "n/a"} | ${profile.reducedMotion.rendersPerSecond?.toFixed(1) ?? "n/a"} | ${profile.errors.length} |`;
  });
  const gpu = report.gpuStress as {
    method: string;
    representativeOfInstalledGpu: boolean;
    webgl: ProbeSnapshot["webgl"] | null;
    points: Array<{
      requestedPixels: number;
      mode: string;
      snapshot: ProbeSnapshot;
      cadence: ReturnType<typeof summarizeCadence>;
    }>;
    fits: {
      procedural: {
        saturatedPointCount: number;
        fit: ReturnType<typeof fitRenderCost> | null;
      };
      present: {
        saturatedPointCount: number;
        fit: ReturnType<typeof fitRenderCost> | null;
      };
    };
  };
  const gpuRows = gpu.points.map(
    (point) =>
      `| ${point.mode} | ${(point.snapshot.drawingBuffer.pixels / 1_000_000).toFixed(2)} | ${point.cadence.mean.toFixed(2)} ms | ${point.cadence.median.toFixed(2)} ms | ${point.cadence.p95.toFixed(2)} ms | ${(point.cadence.missedFrameRatio * 100).toFixed(1)}% |`,
  );
  const build = report.build as {
    fileCount: number;
    rawBytes: number;
    gzipBytes: number;
    javascriptGzipBytes: number;
  };
  const proceduralFit = gpu.fits.procedural.fit;
  const proceduralDuty = proceduralFit
    ? estimateRenderDutyCycle(
        proceduralFit.predictedMillisecondsAtShippedCap,
        report.refreshCalibration.refreshRateHz,
      )
    : null;
  const formatFit = (
    label: string,
    fitResult: {
      saturatedPointCount: number;
      fit: ReturnType<typeof fitRenderCost> | null;
    },
  ): string => {
    const fit = fitResult.fit;
    return fit
      ? `| ${label} | ${fitResult.saturatedPointCount} | ${fit.millisecondsPerMegapixel.toFixed(2)} ms/Mpx | ${fit.fixedMilliseconds.toFixed(2)} ms | ${fit.rSquared.toFixed(3)} | ${fit.predictedMillisecondsAtShippedCap.toFixed(2)} ms |`
      : `| ${label} | ${fitResult.saturatedPointCount} | n/a | n/a | n/a | n/a |`;
  };
  const findings =
    report.findings.length === 0
      ? ["- No runtime warnings or failures."]
      : report.findings.map(
          (finding) =>
            `- **${finding.severity.toUpperCase()} · ${finding.code}:** ${finding.message}`,
        );

  return `# Earth Through Time performance report

Generated: ${report.generatedAt}  
Target: ${report.targetUrl}  
Machine label: ${String(report.environment.label)}  
Chrome: ${String(report.environment.chromeVersion)} (${String(report.environment.browserMode)})

## Executive signal

- Shipped build: ${build.fileCount} files, ${formatBytes(build.rawBytes)} raw / ${formatBytes(build.gzipBytes)} gzip; JavaScript ${formatBytes(build.javascriptGzipBytes)} gzip.
- Independent blank-page refresh calibration: ${report.refreshCalibration.refreshRateHz.toFixed(1)} Hz (${report.refreshCalibration.intervalMilliseconds.toFixed(2)} ms).
- Procedural shader fit: ${proceduralFit ? `${proceduralFit.millisecondsPerMegapixel.toFixed(2)} ms/Mpx (R² ${proceduralFit.rSquared.toFixed(3)}); predicted ${proceduralFit.predictedMillisecondsAtShippedCap.toFixed(2)} ms at the shipped cap` : "not available; the stress ladder did not produce two saturated points"}.
- At this browser's calibrated refresh rate, that prediction is ${proceduralDuty === null ? "unknown" : `${proceduralDuty.toFixed(1)}%`} render duty before the rest of the page. GPU representative: ${gpu.representativeOfInstalledGpu ? "yes" : "no — software renderer"}.

## Runtime profiles

| Profile | CPU / network | LCP | CLS | load TBT | scroll FPS | missed frames | offscreen renders/s | reduced-motion renders/s | errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${runtimeRows.join("\n")}

The frame-miss rate is measured against a separate blank-page refresh calibration. It is useful for jank; it is not used as a proxy for GPU execution time.

## WebGL saturation stress probe

Renderer: ${gpu.webgl?.renderer ?? "unavailable"}  
Method: ${gpu.method}

| Shader state | drawing buffer | mean frame interval | median | p95 | missed frames |
| --- | ---: | ---: | ---: | ---: | ---: |
${gpuRows.join("\n")}

| State | saturated points | slope | fixed cost | R² | predicted at 1.25 Mpx |
| --- | ---: | ---: | ---: | ---: | ---: |
${formatFit("Procedural", gpu.fits.procedural)}
${formatFit("Present", gpu.fits.present)}

## Findings

${findings.join("\n")}

## Interpretation boundaries

- CPU and network throttling are controlled Chrome emulation. Chrome cannot emulate a specific low-end GPU, so compare the JSON reports from real machines rather than treating one laptop as universal.
- Ordinary requestAnimationFrame cadence is vsync-clamped and says nothing about GPU cost while the browser still makes refresh. The stress probe therefore raises drawing pixels until cadence falls below the separately calibrated refresh rate, then fits the mean delivered cadence of only those saturated points; the mean preserves fractional throughput that a quantized median loses. The slope is diagnostic and machine-specific, not a CI budget.
- Headless Chrome can select a software renderer. When it does, rerun with \`PERF_HEADED=1 pnpm test:performance\` before making hardware or battery claims.
- Full raw samples, Chrome task/heap metrics, resource transfer data, and machine metadata are in the adjacent JSON report.
`;
}

async function main(): Promise<void> {
  const build = await collectBuildMetrics();
  const preview = await startPreview();
  let browser: Browser | undefined;

  try {
    browser = await launchChrome();
    const refreshCalibration = await calibrateRefresh(browser);
    const runtimeProfiles: Array<Record<string, unknown>> = [];
    for (let run = 1; run <= PROFILE_RUNS; run += 1) {
      for (const profile of RUNTIME_PROFILES) {
        process.stdout.write(
          `Profiling ${profile.name} (${run}/${PROFILE_RUNS})...\n`,
        );
        runtimeProfiles.push(
          await runRuntimeProfile(
            browser,
            preview.url,
            profile,
            run,
            refreshCalibration.intervalMilliseconds,
          ),
        );
      }
    }

    process.stdout.write("Running WebGL saturation stress probe...\n");
    const gpuStress = await runGpuStress(
      browser,
      preview.url,
      refreshCalibration.intervalMilliseconds,
    );
    const generatedAt = new Date().toISOString();
    const reportCore = {
      generatedAt,
      targetUrl: preview.url,
      environment: {
        label: process.env.PERF_LABEL ?? `${hostname()} (${platform()} ${arch()})`,
        hostname: hostname(),
        platform: platform(),
        architecture: arch(),
        logicalCpuCount: cpus().length,
        cpuModel: cpus()[0]?.model ?? "unknown",
        totalMemoryBytes: totalmem(),
        nodeVersion: process.version,
        chromeVersion: browser.version(),
        browserMode: HEADED ? "headed" : "headless",
        profileRuns: PROFILE_RUNS,
      },
      build,
      refreshCalibration: {
        intervalMilliseconds: refreshCalibration.intervalMilliseconds,
        refreshRateHz: refreshCalibration.refreshRateHz,
        samples: refreshCalibration.samples,
      },
      runtimeProfiles,
      gpuStress,
    };
    const findings = analyseReport(reportCore);
    const report = { ...reportCore, findings };
    const timestamp = generatedAt.replaceAll(":", "-");

    await mkdir(REPORT_DIRECTORY, { recursive: true });
    const json = `${JSON.stringify(report, null, 2)}\n`;
    const markdown = markdownReport(report);
    await Promise.all([
      writeFile(join(REPORT_DIRECTORY, `${timestamp}.json`), json),
      writeFile(join(REPORT_DIRECTORY, `${timestamp}.md`), markdown),
      writeFile(join(REPORT_DIRECTORY, "latest.json"), json),
      writeFile(join(REPORT_DIRECTORY, "latest.md"), markdown),
    ]);

    process.stdout.write(`\n${markdown}\n`);
    process.stdout.write(
      `Reports: ${relative(ROOT, join(REPORT_DIRECTORY, "latest.md"))} and ${relative(ROOT, join(REPORT_DIRECTORY, "latest.json"))}\n`,
    );
    if (findings.some((finding) => finding.severity === "failure")) {
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
    if (preview.server) {
      await new Promise<void>((resolveClose, reject) => {
        preview.server?.close((error) =>
          error ? reject(error) : resolveClose(),
        );
      });
    }
  }
}

await main();
