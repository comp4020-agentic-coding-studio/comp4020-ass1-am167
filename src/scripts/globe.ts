import * as THREE from "three";

import type { EraVisual, TimelineEra, TimelineState } from "./timeline";
import { TIMELINE } from "./timeline";

export interface GlobeController {
  setState: (state: TimelineState) => void;
  destroy: () => void;
}

const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 512;

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function drawBlob(
  context: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  radiusX: number,
  radiusY: number,
  random: () => number,
): void {
  const points = Array.from({ length: 18 }, (_, index) => {
    const angle = (index / 18) * Math.PI * 2;
    const wobble = 0.68 + random() * 0.5;
    return {
      x: centreX + Math.cos(angle) * radiusX * wobble,
      y: centreY + Math.sin(angle) * radiusY * wobble,
    };
  });

  const last = points.at(-1) ?? points[0];
  context.beginPath();
  context.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    context.quadraticCurveTo(
      point.x,
      point.y,
      (point.x + next.x) / 2,
      (point.y + next.y) / 2,
    );
  }
  context.closePath();
  context.fill();
}

function drawWrappedBlob(
  context: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  radiusX: number,
  radiusY: number,
  random: () => number,
): void {
  drawBlob(context, centreX, centreY, radiusX, radiusY, random);
  if (centreX - radiusX < 0) {
    drawBlob(
      context,
      centreX + TEXTURE_WIDTH,
      centreY,
      radiusX,
      radiusY,
      random,
    );
  }
  if (centreX + radiusX > TEXTURE_WIDTH) {
    drawBlob(
      context,
      centreX - TEXTURE_WIDTH,
      centreY,
      radiusX,
      radiusY,
      random,
    );
  }
}

function addSurfaceNoise(
  context: CanvasRenderingContext2D,
  visual: EraVisual,
  random: () => number,
): void {
  context.save();
  context.globalAlpha = 0.1;
  for (let index = 0; index < 720; index += 1) {
    const radius = 1 + random() * 8;
    context.fillStyle = random() > 0.54 ? visual.detail : visual.surface;
    context.beginPath();
    context.arc(
      random() * TEXTURE_WIDTH,
      random() * TEXTURE_HEIGHT,
      radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

function drawContinents(
  context: CanvasRenderingContext2D,
  visual: EraVisual,
  random: () => number,
): void {
  const dryWorld = visual.oceanCover < 0.35;
  const count = dryWorld ? 9 : 7;

  context.fillStyle = visual.land;
  for (let index = 0; index < count; index += 1) {
    const centreX = random() * TEXTURE_WIDTH;
    const centreY = TEXTURE_HEIGHT * (0.18 + random() * 0.64);
    const radiusX = (dryWorld ? 100 : 60) + random() * (dryWorld ? 150 : 120);
    const radiusY = 38 + random() * 82;
    drawWrappedBlob(context, centreX, centreY, radiusX, radiusY, random);

    if (["paleozoic", "mesozoic", "ice-age", "present"].includes(visual.mode)) {
      context.save();
      context.globalAlpha = visual.mode === "paleozoic" ? 0.46 : 0.72;
      context.fillStyle = visual.detail;
      drawWrappedBlob(
        context,
        centreX + (random() - 0.5) * radiusX * 0.35,
        centreY + (random() - 0.5) * radiusY * 0.25,
        radiusX * (0.5 + random() * 0.22),
        radiusY * (0.45 + random() * 0.22),
        random,
      );
      context.restore();
    }
  }
}

function drawIce(
  context: CanvasRenderingContext2D,
  amount: number,
  random: () => number,
): void {
  if (amount <= 0) return;

  const capDepth = TEXTURE_HEIGHT * Math.min(0.48, 0.05 + amount * 0.42);
  const gradient = context.createLinearGradient(0, 0, 0, capDepth);
  gradient.addColorStop(0, "rgba(248, 253, 255, 0.98)");
  gradient.addColorStop(1, "rgba(205, 231, 239, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, TEXTURE_WIDTH, capDepth);

  const southGradient = context.createLinearGradient(
    0,
    TEXTURE_HEIGHT,
    0,
    TEXTURE_HEIGHT - capDepth,
  );
  southGradient.addColorStop(0, "rgba(248, 253, 255, 0.98)");
  southGradient.addColorStop(1, "rgba(205, 231, 239, 0)");
  context.fillStyle = southGradient;
  context.fillRect(0, TEXTURE_HEIGHT - capDepth, TEXTURE_WIDTH, capDepth);

  if (amount > 0.8) {
    context.save();
    context.globalAlpha = 0.82;
    context.fillStyle = "#e6f0f2";
    for (let index = 0; index < 20; index += 1) {
      drawWrappedBlob(
        context,
        random() * TEXTURE_WIDTH,
        random() * TEXTURE_HEIGHT,
        100 + random() * 180,
        45 + random() * 95,
        random,
      );
    }
    context.restore();
  }
}

function drawClouds(
  context: CanvasRenderingContext2D,
  amount: number,
  random: () => number,
): void {
  if (amount <= 0) return;

  context.save();
  context.lineCap = "round";
  context.strokeStyle = `rgba(245, 250, 248, ${0.12 + amount * 0.44})`;
  for (let index = 0; index < Math.round(7 + amount * 20); index += 1) {
    const x = random() * TEXTURE_WIDTH;
    const y = TEXTURE_HEIGHT * (0.12 + random() * 0.76);
    context.lineWidth = 4 + random() * 16;
    context.beginPath();
    context.moveTo(x - 55 - random() * 80, y + (random() - 0.5) * 20);
    context.bezierCurveTo(
      x - 20,
      y - 28 - random() * 35,
      x + 28,
      y + 30 + random() * 30,
      x + 65 + random() * 100,
      y + (random() - 0.5) * 18,
    );
    context.stroke();
  }
  context.restore();
}

function drawHeat(
  context: CanvasRenderingContext2D,
  visual: EraVisual,
  random: () => number,
): void {
  if (visual.heat <= 0) return;

  context.save();
  context.globalCompositeOperation = "screen";
  context.strokeStyle = visual.detail;
  context.shadowColor = visual.glow;
  context.shadowBlur = 8 + visual.heat * 16;
  context.globalAlpha = 0.25 + visual.heat * 0.55;
  for (let index = 0; index < Math.round(8 + visual.heat * 28); index += 1) {
    let x = random() * TEXTURE_WIDTH;
    let y = random() * TEXTURE_HEIGHT;
    context.lineWidth = 0.7 + random() * 2.2;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 4 + Math.round(random() * 5); segment += 1) {
      x += (random() - 0.5) * 70;
      y += (random() - 0.5) * 45;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

function drawImpact(context: CanvasRenderingContext2D): void {
  const centreX = TEXTURE_WIDTH * 0.69;
  const centreY = TEXTURE_HEIGHT * 0.43;
  const flash = context.createRadialGradient(centreX, centreY, 0, centreX, centreY, 78);
  flash.addColorStop(0, "rgba(255, 255, 237, 1)");
  flash.addColorStop(0.12, "rgba(255, 204, 112, 0.95)");
  flash.addColorStop(0.38, "rgba(246, 104, 47, 0.5)");
  flash.addColorStop(1, "rgba(29, 20, 17, 0)");
  context.fillStyle = flash;
  context.fillRect(centreX - 80, centreY - 80, 160, 160);
}

function drawCityLights(
  context: CanvasRenderingContext2D,
  random: () => number,
): void {
  context.save();
  context.fillStyle = "#ffd88a";
  context.shadowColor = "#ffb64c";
  context.shadowBlur = 4;
  context.globalAlpha = 0.7;
  for (let cluster = 0; cluster < 13; cluster += 1) {
    const x = random() * TEXTURE_WIDTH;
    const y = TEXTURE_HEIGHT * (0.24 + random() * 0.52);
    for (let light = 0; light < 7; light += 1) {
      context.beginPath();
      context.arc(
        x + (random() - 0.5) * 30,
        y + (random() - 0.5) * 18,
        0.7 + random() * 1.2,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  context.restore();
}

function createPlanetTexture(visual: EraVisual, index: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const random = seededRandom(9187 + index * 7919);
  const base = visual.oceanCover > 0.35 ? visual.ocean : visual.surface;
  const baseGradient = context.createLinearGradient(0, 0, 0, TEXTURE_HEIGHT);
  baseGradient.addColorStop(0, visual.surface);
  baseGradient.addColorStop(0.45, base);
  baseGradient.addColorStop(1, visual.surface);
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  addSurfaceNoise(context, visual, random);
  if (visual.mode !== "snowball" && visual.mode !== "remnant") {
    drawContinents(context, visual, random);
  }
  drawIce(context, visual.iceCover, random);
  drawHeat(context, visual, random);
  drawClouds(context, visual.cloudCover, random);

  if (visual.mode === "impact") drawImpact(context);
  if (visual.mode === "present") drawCityLights(context, random);

  return canvas;
}

function colourBetween(from: string, to: string, mix: number): THREE.Color {
  return new THREE.Color(from).lerp(new THREE.Color(to), mix);
}

function setFallbackState(fallback: HTMLElement, state: TimelineState): void {
  fallback.style.setProperty("--fallback-base", state.active.visual.surface);
  fallback.style.setProperty("--fallback-sea", state.active.visual.ocean);
  fallback.style.setProperty("--fallback-land", state.active.visual.land);
  fallback.style.setProperty("--fallback-glow", state.active.visual.glow);
  fallback.style.opacity = String(state.active.visual.opacity);
}

function createFallbackController(fallback: HTMLElement): GlobeController {
  fallback.hidden = false;
  return {
    setState(state) {
      setFallbackState(fallback, state);
    },
    destroy() {},
  };
}

export function createGlobe(
  canvas: HTMLCanvasElement,
  fallback: HTMLElement,
): GlobeController {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    canvas.hidden = true;
    return createFallbackController(fallback);
  }

  fallback.hidden = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.z = 4.55;

  const geometry = new THREE.SphereGeometry(1, 80, 56);
  const textures = new Map<string, THREE.CanvasTexture>();
  const eraIndexes = new Map(TIMELINE.map((era, index) => [era.id, index]));

  const textureFor = (era: TimelineEra): THREE.CanvasTexture => {
    const cached = textures.get(era.id);
    if (cached) {
      textures.delete(era.id);
      textures.set(era.id, cached);
      return cached;
    }

    const index = eraIndexes.get(era.id) ?? 0;
    const texture = new THREE.CanvasTexture(createPlanetTexture(era.visual, index));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.set(era.id, texture);
    return texture;
  };

  const trimTextureCache = (keep: ReadonlySet<string>): void => {
    for (const [id, texture] of textures) {
      if (textures.size <= 6) return;
      if (keep.has(id)) continue;
      texture.dispose();
      textures.delete(id);
    }
  };

  const firstTexture = textureFor(TIMELINE[0]);

  const planetMaterial = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      mapFrom: { value: firstTexture },
      mapTo: { value: firstTexture },
      textureMix: { value: 0 },
      heat: { value: TIMELINE[0].visual.heat },
      globeOpacity: { value: 1 },
      rimColour: { value: new THREE.Color(TIMELINE[0].visual.glow) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;

      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D mapFrom;
      uniform sampler2D mapTo;
      uniform float textureMix;
      uniform float heat;
      uniform float globeOpacity;
      uniform vec3 rimColour;
      varying vec2 vUv;
      varying vec3 vViewNormal;

      void main() {
        vec4 fromColour = texture2D(mapFrom, vUv);
        vec4 toColour = texture2D(mapTo, vUv);
        vec3 surface = mix(fromColour.rgb, toColour.rgb, textureMix);
        vec3 normal = normalize(vViewNormal);
        vec3 lightDirection = normalize(vec3(-0.55, 0.3, 0.9));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float light = 0.19 + diffuse * 0.92;
        float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
        vec3 colour = surface * mix(light, 1.05, heat * 0.52);
        colour += rimColour * rim * (0.06 + heat * 0.12);
        gl_FragColor = vec4(colour, globeOpacity);
      }
    `,
  });

  const planet = new THREE.Mesh(geometry, planetMaterial);
  planet.rotation.z = -0.17;
  scene.add(planet);

  const atmosphereMaterial = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    uniforms: {
      atmosphereColour: {
        value: new THREE.Color(TIMELINE[0].visual.atmosphere),
      },
      atmosphereOpacity: { value: 0.34 },
    },
    vertexShader: `
      varying vec3 vViewNormal;

      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 atmosphereColour;
      uniform float atmosphereOpacity;
      varying vec3 vViewNormal;

      void main() {
        float edge = 1.0 - max(dot(normalize(vViewNormal), vec3(0.0, 0.0, 1.0)), 0.0);
        float alpha = smoothstep(0.15, 1.0, edge) * atmosphereOpacity;
        gl_FragColor = vec4(atmosphereColour, alpha);
      }
    `,
  });
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.045, 64, 48),
    atmosphereMaterial,
  );
  atmosphere.rotation.copy(planet.rotation);
  scene.add(atmosphere);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animationFrame = 0;
  let lastFrame = performance.now();

  const render = (now: number): void => {
    if (!reducedMotion.matches) {
      const elapsed = Math.min(now - lastFrame, 48);
      planet.rotation.y += elapsed * 0.000035;
      atmosphere.rotation.y = planet.rotation.y;
    }
    lastFrame = now;
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  };

  const startRendering = (): void => {
    if (animationFrame !== 0 || document.hidden) return;
    lastFrame = performance.now();
    animationFrame = window.requestAnimationFrame(render);
  };

  const stopRendering = (): void => {
    if (animationFrame === 0) return;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  const handleVisibility = (): void => {
    if (document.hidden) stopRendering();
    else startRendering();
  };

  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  document.addEventListener("visibilitychange", handleVisibility);
  resize();
  startRendering();

  return {
    setState(state) {
      const fromTexture = textureFor(state.from);
      const toTexture = textureFor(state.to);
      planetMaterial.uniforms.mapFrom.value = fromTexture;
      planetMaterial.uniforms.mapTo.value = toTexture;
      trimTextureCache(new Set([state.from.id, state.to.id]));
      planetMaterial.uniforms.textureMix.value = state.mix;
      planetMaterial.uniforms.heat.value =
        state.from.visual.heat +
        (state.to.visual.heat - state.from.visual.heat) * state.mix;
      planetMaterial.uniforms.globeOpacity.value =
        state.from.visual.opacity +
        (state.to.visual.opacity - state.from.visual.opacity) * state.mix;
      planetMaterial.uniforms.rimColour.value.copy(
        colourBetween(state.from.visual.glow, state.to.visual.glow, state.mix),
      );
      atmosphereMaterial.uniforms.atmosphereColour.value.copy(
        colourBetween(
          state.from.visual.atmosphere,
          state.to.visual.atmosphere,
          state.mix,
        ),
      );
      atmosphereMaterial.uniforms.atmosphereOpacity.value =
        (0.24 + state.from.visual.cloudCover * 0.26) * (1 - state.mix) +
        (0.24 + state.to.visual.cloudCover * 0.26) * state.mix;
    },
    destroy() {
      stopRendering();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      geometry.dispose();
      atmosphere.geometry.dispose();
      planetMaterial.dispose();
      atmosphereMaterial.dispose();
      for (const texture of textures.values()) texture.dispose();
      renderer.dispose();
    },
  };
}
