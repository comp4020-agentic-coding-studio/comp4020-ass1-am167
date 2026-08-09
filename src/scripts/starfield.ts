const STAR_COLOURS = [
  [181, 211, 255],
  [209, 227, 255],
  [226, 239, 255],
  [247, 250, 255],
  [255, 246, 229],
  [255, 225, 196],
  [255, 199, 174],
] as const;

type StarColour = (typeof STAR_COLOURS)[number];

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
  colour: StarColour,
): void {
  const colourValue = colour.join(" ");

  if (radius > 0.68) {
    const bloomRadius = radius * (4.4 + radius * 1.5);
    const bloom = context.createRadialGradient(x, y, 0, x, y, bloomRadius);
    bloom.addColorStop(0, `rgb(${colourValue} / ${alpha * 0.32})`);
    bloom.addColorStop(1, `rgb(${colour.join(" ")} / 0)`);
    context.fillStyle = bloom;
    context.beginPath();
    context.arc(x, y, bloomRadius, 0, Math.PI * 2);
    context.fill();
  }

  if (radius > 1.25) {
    context.strokeStyle = `rgb(${colourValue} / ${alpha * 0.22})`;
    context.lineWidth = 0.35;
    context.beginPath();
    context.moveTo(x - radius * 3.8, y);
    context.lineTo(x + radius * 3.8, y);
    context.moveTo(x, y - radius * 2.6);
    context.lineTo(x, y + radius * 2.6);
    context.stroke();
  }

  context.fillStyle = `rgb(${colourValue} / ${alpha})`;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function pickStarColour(random: () => number): StarColour {
  const roll = random();
  if (roll < 0.035) return STAR_COLOURS[0];
  if (roll < 0.17) return STAR_COLOURS[1];
  if (roll < 0.38) return STAR_COLOURS[2];
  if (roll < 0.78) return STAR_COLOURS[3];
  if (roll < 0.93) return STAR_COLOURS[4];
  if (roll < 0.985) return STAR_COLOURS[5];
  return STAR_COLOURS[6];
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
  const deepStarCount = Math.round(
    Math.min(3400, Math.max(520, (width * height) / 740)),
  );
  const foregroundStarCount = Math.round(
    Math.min(900, Math.max(150, (width * height) / 3000)),
  );

  for (let index = 0; index < deepStarCount; index += 1) {
    const radius = 0.1 + random() * 0.24;
    const alpha = 0.055 + Math.pow(random(), 3.4) * 0.28;
    drawStar(
      context,
      random() * width,
      random() * height,
      radius,
      alpha,
      pickStarColour(random),
    );
  }

  for (let index = 0; index < foregroundStarCount; index += 1) {
    const sizeRoll = random();
    const radius =
      sizeRoll < 0.76
        ? 0.24 + random() * 0.3
        : sizeRoll < 0.94
          ? 0.52 + random() * 0.38
          : sizeRoll < 0.992
            ? 0.9 + random() * 0.55
            : 1.5 + random() * 0.65;
    const alpha = 0.16 + Math.pow(random(), 2.15) * (radius > 0.9 ? 0.78 : 0.62);
    const colour = pickStarColour(random);
    const x = random() * width;
    const y = random() * height;

    drawStar(context, x, y, radius, alpha, colour);

    if (radius > 0.52 && random() < 0.055) {
      const angle = random() * Math.PI * 2;
      const separation = 2.2 + random() * 4.8;
      drawStar(
        context,
        x + Math.cos(angle) * separation,
        y + Math.sin(angle) * separation,
        radius * (0.28 + random() * 0.24),
        alpha * (0.42 + random() * 0.28),
        pickStarColour(random),
      );
    }
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
