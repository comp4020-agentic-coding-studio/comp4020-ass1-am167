const STAR_COLOURS = [
  [226, 239, 255],
  [244, 248, 255],
  [255, 246, 229],
] as const;

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  colour: (typeof STAR_COLOURS)[number],
): void {
  if (radius > 0.82) {
    const bloom = context.createRadialGradient(x, y, 0, x, y, radius * 4.2);
    bloom.addColorStop(0, `rgb(${colour.join(" ")} / ${alpha * 0.3})`);
    bloom.addColorStop(1, `rgb(${colour.join(" ")} / 0)`);
    context.fillStyle = bloom;
    context.beginPath();
    context.arc(x, y, radius * 4.2, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = `rgb(${colour.join(" ")} / ${alpha})`;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function paintStarfield(canvas: HTMLCanvasElement): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const context = canvas.getContext("2d");
  if (!context) return;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const seed = 0x7f4a7c15 ^ Math.imul(width, 73856093) ^ Math.imul(height, 19349663);
  const random = seededRandom(seed);
  const starCount = Math.round(Math.min(1150, Math.max(170, (width * height) / 2550)));

  for (let index = 0; index < starCount; index += 1) {
    const sizeRoll = random();
    const radius =
      sizeRoll < 0.88
        ? 0.18 + random() * 0.28
        : sizeRoll < 0.985
          ? 0.48 + random() * 0.34
          : 0.84 + random() * 0.68;
    const brightness = Math.pow(random(), 2.7);
    const alpha = 0.12 + brightness * (radius > 0.82 ? 0.76 : 0.58);
    const colourRoll = random();
    const colour =
      colourRoll < 0.2
        ? STAR_COLOURS[0]
        : colourRoll < 0.82
          ? STAR_COLOURS[1]
          : STAR_COLOURS[2];

    drawStar(context, random() * width, random() * height, radius, alpha, colour);
  }
}

export function initStarfield(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-starfield]");
  if (!canvas) return;

  let resizeFrame = 0;
  const schedulePaint = (): void => {
    if (resizeFrame !== 0) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      paintStarfield(canvas);
    });
  };

  window.addEventListener("resize", schedulePaint, { passive: true });
  paintStarfield(canvas);
}
