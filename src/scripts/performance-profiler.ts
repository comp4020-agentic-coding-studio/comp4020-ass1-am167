import type * as THREE from "three";

export interface PerformanceProfilerConfig {
  drawingPixels?: number;
  maximumSamples: number;
}

interface PerformanceProfilerRequest {
  enabled?: unknown;
  drawingPixels?: unknown;
  maximumSamples?: unknown;
}

export interface PerformanceProfilerSnapshot {
  version: 1;
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

export interface PerformanceProfilerApi {
  reset: () => void;
  snapshot: () => PerformanceProfilerSnapshot;
}

declare global {
  interface Window {
    __EARTH_PERFORMANCE_CONFIG__?: PerformanceProfilerRequest;
    __EARTH_PERFORMANCE__?: PerformanceProfilerApi;
  }
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function parsePerformanceProfilerConfig(
  value: unknown,
): PerformanceProfilerConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const request = value as PerformanceProfilerRequest;
  if (request.enabled !== true) return undefined;

  const drawingPixels =
    typeof request.drawingPixels === "number" &&
    Number.isFinite(request.drawingPixels)
      ? Math.min(25_000_000, Math.max(100_000, request.drawingPixels))
      : undefined;

  return {
    drawingPixels,
    maximumSamples: boundedInteger(request.maximumSamples, 240, 10, 600),
  };
}

function rendererDescription(context: WebGLRenderingContext): {
  version: string;
  vendor: string;
  renderer: string;
  maximumTextureSize: number;
} {
  const debug = context.getExtension("WEBGL_debug_renderer_info") as
    | {
        UNMASKED_VENDOR_WEBGL: number;
        UNMASKED_RENDERER_WEBGL: number;
      }
    | null;
  const parameter = (name: number): string => {
    const value = context.getParameter(name) as unknown;
    return typeof value === "string" ? value : String(value ?? "unknown");
  };

  return {
    version: parameter(context.VERSION),
    vendor: parameter(debug?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR),
    renderer: parameter(debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER),
    maximumTextureSize: Number(context.getParameter(context.MAX_TEXTURE_SIZE)),
  };
}

function appendBounded(
  target: number[],
  value: number,
  maximumSamples: number,
): void {
  if (!Number.isFinite(value)) return;
  target.push(value);
  if (target.length > maximumSamples) target.shift();
}

export class PerformanceProfiler {
  readonly config: PerformanceProfilerConfig;

  private readonly context: WebGLRenderingContext;
  private readonly webgl: PerformanceProfilerSnapshot["webgl"];
  private activeEra: string | null = null;
  private renderCalls = 0;
  private lastRenderAt = 0;
  private commandSubmissionMilliseconds: number[] = [];
  private renderFrameIntervals: number[] = [];

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly canvas: HTMLCanvasElement,
    config: PerformanceProfilerConfig,
  ) {
    this.config = config;
    this.context = renderer.getContext();
    this.webgl = rendererDescription(this.context);
  }

  drawingPixelRatio(
    cssWidth: number,
    cssHeight: number,
    defaultRatio: number,
  ): number {
    if (!this.config.drawingPixels) return defaultRatio;
    const requested = Math.sqrt(
      this.config.drawingPixels / (cssWidth * cssHeight),
    );
    const maximumDimensionRatio = Math.min(
      this.webgl.maximumTextureSize / cssWidth,
      this.webgl.maximumTextureSize / cssHeight,
    );
    return Math.min(6, maximumDimensionRatio, Math.max(0.25, requested));
  }

  setActiveEra(eraId: string): void {
    this.activeEra = eraId;
  }

  render(now: number, draw: () => void): void {
    this.renderCalls += 1;
    if (this.lastRenderAt > 0) {
      appendBounded(
        this.renderFrameIntervals,
        now - this.lastRenderAt,
        this.config.maximumSamples,
      );
    }
    this.lastRenderAt = now;

    const startedAt = performance.now();
    draw();
    const submittedAt = performance.now();
    appendBounded(
      this.commandSubmissionMilliseconds,
      submittedAt - startedAt,
      this.config.maximumSamples,
    );

  }

  reset(): void {
    this.renderCalls = 0;
    this.lastRenderAt = 0;
    this.commandSubmissionMilliseconds = [];
    this.renderFrameIntervals = [];
  }

  snapshot(): PerformanceProfilerSnapshot {
    const bounds = this.canvas.getBoundingClientRect();
    const pixels = this.canvas.width * this.canvas.height;
    return {
      version: 1,
      activeEra: this.activeEra,
      renderCalls: this.renderCalls,
      commandSubmissionMilliseconds: [...this.commandSubmissionMilliseconds],
      renderFrameIntervals: [...this.renderFrameIntervals],
      drawingBuffer: {
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        width: this.canvas.width,
        height: this.canvas.height,
        pixels,
        pixelRatio:
          bounds.width > 0 && bounds.height > 0
            ? Math.sqrt(pixels / (bounds.width * bounds.height))
            : 0,
      },
      webgl: { ...this.webgl },
    };
  }
}

export function attachPerformanceProfiler(
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
): PerformanceProfiler | undefined {
  const config = parsePerformanceProfilerConfig(
    window.__EARTH_PERFORMANCE_CONFIG__,
  );
  if (!config) return undefined;

  const profiler = new PerformanceProfiler(renderer, canvas, config);
  window.__EARTH_PERFORMANCE__ = {
    reset: () => profiler.reset(),
    snapshot: () => profiler.snapshot(),
  };
  return profiler;
}

export function detachPerformanceProfiler(
  profiler: PerformanceProfiler | undefined,
): void {
  if (profiler && window.__EARTH_PERFORMANCE__) {
    delete window.__EARTH_PERFORMANCE__;
  }
}
