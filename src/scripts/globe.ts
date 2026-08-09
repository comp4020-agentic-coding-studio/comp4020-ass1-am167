import * as THREE from "three";

import type { EraVisual, TimelineEra, TimelineState } from "./timeline";
import { TIMELINE } from "./timeline";

export interface GlobeController {
  setState: (state: TimelineState) => void;
  destroy: () => void;
}

type Colour = readonly [number, number, number];

interface PlanetTextures {
  surface: THREE.Texture;
  ocean: THREE.Texture;
  clouds: THREE.Texture;
  owned: boolean;
}

interface SurfaceCanvases {
  colour: HTMLCanvasElement;
  ocean: HTMLCanvasElement;
}

const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 512;
const LIGHT_DIRECTION = new THREE.Vector3(-0.48, 0.34, 0.81).normalize();
const EARTH_DAY_URL = new URL("../assets/earth-day.jpg", import.meta.url).href;
const EARTH_SPECULAR_URL = new URL(
  "../assets/earth-specular.jpg",
  import.meta.url,
).href;
const EARTH_CLOUDS_URL = new URL("../assets/earth-clouds.png", import.meta.url).href;
const EARTH_LIGHTS_URL = new URL("../assets/earth-lights.png", import.meta.url).href;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function hash2d(x: number, y: number, seed: number): number {
  let value =
    Math.imul(x, 374761393) +
    Math.imul(y, 668265263) +
    Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicNoise(
  u: number,
  v: number,
  frequency: number,
  seed: number,
): number {
  const wrappedU = ((u % 1) + 1) % 1;
  const x = wrappedU * frequency;
  const y = v * frequency * 0.56;
  const x0 = Math.floor(x) % frequency;
  const x1 = (x0 + 1) % frequency;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;
  const blendX = smoothstep(0, 1, x - Math.floor(x));
  const blendY = smoothstep(0, 1, y - y0);
  const upper =
    hash2d(x0, y0, seed) * (1 - blendX) +
    hash2d(x1, y0, seed) * blendX;
  const lower =
    hash2d(x0, y1, seed) * (1 - blendX) +
    hash2d(x1, y1, seed) * blendX;
  return upper * (1 - blendY) + lower * blendY;
}

function fractalNoise(
  u: number,
  v: number,
  seed: number,
  octaves = 5,
  baseFrequency = 2,
): number {
  let frequency = baseFrequency;
  let amplitude = 0.56;
  let total = 0;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += periodicNoise(u, v, frequency, seed + octave * 1013) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / amplitudeTotal;
}

function ridgedNoise(u: number, v: number, frequency: number, seed: number): number {
  return 1 - Math.abs(periodicNoise(u, v, frequency, seed) * 2 - 1);
}

function hexToColour(hex: string): Colour {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function mixColour(from: Colour, to: Colour, amount: number): Colour {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

function scaleColour(colour: Colour, amount: number): Colour {
  return [
    clamp(colour[0] * amount),
    clamp(colour[1] * amount),
    clamp(colour[2] * amount),
  ];
}

function writeColour(
  data: Uint8ClampedArray,
  offset: number,
  colour: Colour,
  alpha: number,
): void {
  data[offset] = Math.round(clamp(colour[0]) * 255);
  data[offset + 1] = Math.round(clamp(colour[1]) * 255);
  data[offset + 2] = Math.round(clamp(colour[2]) * 255);
  data[offset + 3] = Math.round(clamp(alpha) * 255);
}

function craterRelief(
  u: number,
  v: number,
  craters: ReadonlyArray<readonly [number, number, number]>,
): number {
  let relief = 0;
  for (const [centreU, centreV, radius] of craters) {
    const deltaU = Math.min(
      Math.abs(u - centreU),
      1 - Math.abs(u - centreU),
    );
    const deltaV = v - centreV;
    const distance = Math.hypot(deltaU * Math.cos((v - 0.5) * Math.PI), deltaV);
    const relativeDistance = distance / radius;
    const rim = clamp(1 - Math.abs(relativeDistance - 1) * 8);
    const basin = clamp(1 - relativeDistance);
    relief += rim * 0.7 - basin * 0.38;
  }
  return clamp(relief, -0.5, 1);
}

function createCraters(
  visual: EraVisual,
  seed: number,
): ReadonlyArray<readonly [number, number, number]> {
  if (
    visual.mode !== "molten" &&
    visual.mode !== "impact" &&
    visual.mode !== "remnant"
  ) {
    return [];
  }

  const random = seededRandom(seed + 4703);
  return Array.from({ length: visual.mode === "remnant" ? 18 : 9 }, () => [
    random(),
    0.12 + random() * 0.76,
    0.008 + random() * 0.034,
  ] as const);
}

function terrainColour(
  visual: EraVisual,
  u: number,
  v: number,
  elevation: number,
  detail: number,
  fineDetail: number,
  microDetail: number,
  ridgeDetail: number,
  moisture: number,
  crater: number,
): { colour: Colour; ocean: number } {
  const ocean = hexToColour(visual.ocean);
  const land = hexToColour(visual.land);
  const surface = hexToColour(visual.surface);
  const detailColour = hexToColour(visual.detail);
  const atmosphere = hexToColour(visual.atmosphere);
  const latitude = Math.abs(v * 2 - 1);
  const hasOcean = visual.oceanCover > 0.025 && visual.mode !== "remnant";
  const threshold = 0.34 + visual.oceanCover * 0.32;
  const isOcean = hasOcean && elevation < threshold;
  const height = clamp((elevation - threshold) / 0.24);

  if (visual.mode === "molten") {
    const magmaFlow = fractalNoise(u + 0.07, v - 0.12, 13789, 5, 3);
    const turbulence = fractalNoise(u - 0.21, v + 0.17, 19031, 4, 11);
    const crustNoise = fractalNoise(u + 0.13, v + 0.05, 23003, 4, 5);
    const crust = smoothstep(
      0.49,
      0.69,
      crustNoise + (turbulence - 0.5) * 0.2,
    );
    const fineFissure =
      Math.pow(ridgedNoise(u + 0.17, v, 41, 11839), 24) * crust;
    const moltenAmount = smoothstep(
      0.25,
      0.82,
      magmaFlow * 0.64 + turbulence * 0.36,
    );
    const magma = mixColour(land, detailColour, moltenAmount * 0.82);
    const hotMagma = mixColour(detailColour, [1, 0.86, 0.3], turbulence * 0.58);
    let colour = mixColour(magma, hotMagma, smoothstep(0.64, 0.94, moltenAmount) * 0.74);
    const cooledRock = scaleColour(
      mixColour(surface, land, detail * 0.35),
      0.34 + turbulence * 0.25,
    );
    colour = mixColour(colour, cooledRock, crust * 0.88);
    colour = mixColour(colour, hotMagma, fineFissure * 0.62);
    colour = mixColour(
      colour,
      [1, 0.62, 0.14],
      Math.max(0, crater) * 0.14,
    );
    return {
      colour,
      ocean: 0,
    };
  }

  if (isOcean) {
    const depth = clamp((threshold - elevation) / 0.2);
    const deepOcean = mixColour(ocean, [0.008, 0.035, 0.075], 0.54);
    const coastalWater = mixColour(ocean, atmosphere, 0.12);
    let colour = mixColour(coastalWater, deepOcean, smoothstep(0.06, 0.94, depth));
    colour = scaleColour(
      colour,
      0.7 + detail * 0.16 + fineDetail * 0.1 + microDetail * 0.08,
    );
    return { colour, ocean: 1 };
  }

  const livingWorld = ["paleozoic", "mesozoic", "ice-age", "present"].includes(
    visual.mode,
  );
  const subtropicalDryness = smoothstep(0.22, 0.48, latitude) *
    (1 - smoothstep(0.48, 0.78, latitude));
  const vegetation = livingWorld
    ? clamp(moisture * 1.25 - subtropicalDryness * 0.28 - height * 0.16)
    : detail;
  const aridness = livingWorld
    ? clamp(subtropicalDryness * (1 - moisture) * 1.75)
    : 0;
  const forest = mixColour(land, detailColour, vegetation * 0.82);
  const desert = mixColour(land, [0.67, 0.48, 0.27], 0.5);
  const lowland = mixColour(forest, desert, aridness * 0.78);
  const mountain = mixColour(surface, [0.55, 0.48, 0.4], 0.34);
  const mountainAmount = smoothstep(
    0.24,
    0.9,
    height * 0.76 + ridgeDetail * height * 0.34 + Math.abs(fineDetail - 0.5) * 0.3,
  );
  let colour = mixColour(lowland, mountain, mountainAmount);
  colour = scaleColour(
    colour,
    0.59 +
      detail * 0.2 +
      fineDetail * 0.38 +
      microDetail * 0.3 +
      ridgeDetail * height * 0.05 +
      crater * 0.13,
  );

  if (visual.heat > 0.38 && visual.mode !== "archean") {
    const crack = Math.pow(ridgedNoise(u + 0.23, v, 19, 773), 20);
    colour = mixColour(colour, detailColour, crack * visual.heat * 0.68);
  }

  return { colour, ocean: 0 };
}

function applyIce(
  visual: EraVisual,
  colour: Colour,
  oceanAmount: number,
  latitude: number,
  iceNoise: number,
  microDetail: number,
  ridgeDetail: number,
): Colour {
  if (visual.iceCover <= 0) return colour;

  let iceAmount: number;
  if (visual.mode === "snowball") {
    iceAmount = smoothstep(
      0.28,
      0.74,
      visual.iceCover + (iceNoise - 0.5) * 0.46,
    );
  } else {
    const capStart = 1 - visual.iceCover * 0.9;
    iceAmount = smoothstep(
      capStart - 0.08,
      capStart + 0.05,
      latitude + (iceNoise - 0.5) * 0.11,
    );
  }

  const glacierBlue: Colour = oceanAmount > 0.5
    ? [0.43, 0.66, 0.77]
    : [0.58, 0.69, 0.7];
  let iceColour = mixColour(glacierBlue, [0.94, 0.975, 1], iceNoise * 0.62);
  iceColour = scaleColour(iceColour, 0.8 + microDetail * 0.28);
  if (visual.mode === "snowball") {
    iceColour = mixColour(iceColour, [0.34, 0.57, 0.68], ridgeDetail * 0.24);
  }
  const iceOpacity = visual.mode === "snowball"
    ? 0.72 + iceNoise * 0.2
    : 0.86 + iceNoise * 0.14;
  return mixColour(colour, iceColour, iceAmount * iceOpacity);
}

function createSurfaceCanvases(visual: EraVisual, index: number): SurfaceCanvases {
  const colourCanvas = document.createElement("canvas");
  colourCanvas.width = TEXTURE_WIDTH;
  colourCanvas.height = TEXTURE_HEIGHT;
  const oceanCanvas = document.createElement("canvas");
  oceanCanvas.width = TEXTURE_WIDTH;
  oceanCanvas.height = TEXTURE_HEIGHT;
  const colourContext = colourCanvas.getContext("2d");
  const oceanContext = oceanCanvas.getContext("2d");
  if (!colourContext || !oceanContext) {
    return { colour: colourCanvas, ocean: oceanCanvas };
  }

  const seed = 9187 + index * 7919;
  const craters = createCraters(visual, seed);
  const colourImage = colourContext.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const oceanImage = oceanContext.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const colourData = colourImage.data;
  const oceanData = oceanImage.data;

  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    const v = y / (TEXTURE_HEIGHT - 1);
    const latitude = Math.abs(v * 2 - 1);
    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const u = x / TEXTURE_WIDTH;
      const warpU = periodicNoise(u, v, 4, seed + 191) - 0.5;
      const warpV = periodicNoise(u, v, 5, seed + 383) - 0.5;
      const warpedU = u + warpU * 0.07;
      const warpedV = v + warpV * 0.055;
      const continents = fractalNoise(warpedU, warpedV, seed, 5, 3);
      const regionalDetail = fractalNoise(
        warpedU + 0.31,
        warpedV - 0.19,
        seed + 1597,
        4,
        7,
      );
      const fineDetail = fractalNoise(
        warpedU - 0.09,
        warpedV + 0.14,
        seed + 9209,
        3,
        23,
      );
      const ridgeDetail = Math.pow(
        ridgedNoise(warpedU + 0.19, warpedV - 0.11, 37, seed + 12071),
        6,
      );
      const microDetail = fractalNoise(
        warpedU + 0.27,
        warpedV - 0.08,
        seed + 15551,
        2,
        67,
      );
      const elevation =
        continents * 0.6 +
        regionalDetail * 0.34 +
        (fineDetail - 0.5) * 0.14 +
        ridgeDetail * 0.025 +
        Math.pow(latitude, 5) * 0.025;
      const moisture = fractalNoise(u - 0.17, v + 0.09, seed + 4001, 4, 5);
      const iceNoise = fractalNoise(u + 0.11, v, seed + 6803, 3, 7);
      const crater = craterRelief(u, v, craters);
      const terrain = terrainColour(
        visual,
        u,
        v,
        elevation,
        regionalDetail,
        fineDetail,
        microDetail,
        ridgeDetail,
        moisture,
        crater,
      );
      let colour = applyIce(
        visual,
        terrain.colour,
        terrain.ocean,
        latitude,
        iceNoise,
        microDetail,
        ridgeDetail,
      );

      if (visual.mode === "impact") {
        const deltaU = Math.min(Math.abs(u - 0.69), 1 - Math.abs(u - 0.69));
        const distance = Math.hypot(deltaU, (v - 0.43) * 0.9);
        const flash = 1 - smoothstep(0.006, 0.065, distance);
        colour = mixColour(colour, [1, 0.55, 0.12], flash * 0.92);
      }

      if (
        visual.mode === "present" &&
        terrain.ocean < 0.5 &&
        latitude < 0.72 &&
        heightFriendly(elevation, visual.oceanCover) &&
        hash2d(x, y, seed + 991) > 0.9986
      ) {
        colour = [1, 0.68, 0.26];
      }

      const offset = (y * TEXTURE_WIDTH + x) * 4;
      writeColour(colourData, offset, colour, 1);
      writeColour(
        oceanData,
        offset,
        [terrain.ocean, terrain.ocean, terrain.ocean],
        1,
      );
    }
  }

  colourContext.putImageData(colourImage, 0, 0);
  oceanContext.putImageData(oceanImage, 0, 0);
  return { colour: colourCanvas, ocean: oceanCanvas };
}

function heightFriendly(elevation: number, oceanCover: number): boolean {
  const threshold = 0.34 + oceanCover * 0.32;
  return elevation < threshold + 0.12;
}

function createCloudCanvas(visual: EraVisual, index: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context || visual.cloudCover <= 0) return canvas;

  const seed = 14479 + index * 6151;
  const image = context.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const data = image.data;
  const threshold = 0.69 - visual.cloudCover * 0.28;

  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    const v = y / (TEXTURE_HEIGHT - 1);
    const latitude = Math.abs(v * 2 - 1);
    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const u = x / TEXTURE_WIDTH;
      const wind = Math.sin(v * Math.PI * 12 + periodicNoise(u, v, 5, seed) * 5);
      const sweptU = u + wind * 0.019 + (v - 0.5) * 0.052;
      const broadCloud = fractalNoise(sweptU, v * 1.34, seed + 503, 5, 5);
      const wisps = fractalNoise(sweptU + 0.13, v * 2.1, seed + 2903, 4, 15);
      const belts = Math.abs(Math.sin((v + broadCloud * 0.035) * Math.PI * 9));
      const density = broadCloud * 0.56 + wisps * 0.35 + belts * 0.09;
      const polarFade = 1 - smoothstep(0.84, 1.03, latitude);
      const opacity =
        smoothstep(threshold, threshold + 0.13, density) *
        (0.25 + visual.cloudCover * 0.82) *
        polarFade;
      const shade = 0.78 + wisps * 0.22;
      const offset = (y * TEXTURE_WIDTH + x) * 4;
      writeColour(data, offset, [shade, shade * 0.99, 1], opacity);
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

function setFallbackState(fallback: HTMLElement, state: TimelineState): void {
  fallback.style.setProperty("--fallback-base", state.active.visual.surface);
  fallback.style.setProperty("--fallback-sea", state.active.visual.ocean);
  fallback.style.setProperty("--fallback-land", state.active.visual.land);
  fallback.style.setProperty("--fallback-detail", state.active.visual.detail);
  fallback.style.setProperty("--fallback-atmosphere", state.active.visual.atmosphere);
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

function atmosphereStrength(visual: EraVisual): number {
  if (visual.mode === "remnant") return 0.12;
  if (visual.mode === "red-giant") return 0.48;
  if (visual.mode === "molten") return 0.9;
  if (visual.mode === "archean") return 0.78;
  return 0.72;
}

function cityLightStrength(visual: EraVisual): number {
  return visual.mode === "present" ? 1 : 0;
}

function referenceMapStrength(visual: EraVisual): number {
  return visual.mode === "present" ? 1 : 0;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.z = 4.55;

  const geometry = new THREE.SphereGeometry(1, 112, 80);
  const textures = new Map<string, PlanetTextures>();
  const eraIndexes = new Map(TIMELINE.map((era, index) => [era.id, index]));
  const colours = new Map<string, THREE.Color>();

  const colourFor = (value: string): THREE.Color => {
    const cached = colours.get(value);
    if (cached) return cached;
    const colour = new THREE.Color(value);
    colours.set(value, colour);
    return colour;
  };

  const configureTexture = <TextureType extends THREE.Texture>(
    texture: TextureType,
    colourTexture: boolean,
  ): TextureType => {
    texture.colorSpace = colourTexture
      ? THREE.SRGBColorSpace
      : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  };

  const makeTexture = (
    source: HTMLCanvasElement,
    colourTexture = true,
  ): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(source);
    return configureTexture(texture, colourTexture);
  };

  const textureLoader = new THREE.TextureLoader();
  const referenceTextures: PlanetTextures = {
    surface: configureTexture(textureLoader.load(EARTH_DAY_URL), true),
    ocean: configureTexture(textureLoader.load(EARTH_SPECULAR_URL), false),
    clouds: configureTexture(textureLoader.load(EARTH_CLOUDS_URL), true),
    owned: false,
  };
  const earthLights = configureTexture(textureLoader.load(EARTH_LIGHTS_URL), true);

  const texturesFor = (era: TimelineEra): PlanetTextures => {
    const cached = textures.get(era.id);
    if (cached) {
      textures.delete(era.id);
      textures.set(era.id, cached);
      return cached;
    }

    const generated =
      era.visual.mode === "present"
        ? referenceTextures
        : (() => {
            const index = eraIndexes.get(era.id) ?? 0;
            const surfaceCanvases = createSurfaceCanvases(era.visual, index);
            return {
              surface: makeTexture(surfaceCanvases.colour),
              ocean: makeTexture(surfaceCanvases.ocean, false),
              clouds: makeTexture(createCloudCanvas(era.visual, index)),
              owned: true,
            };
          })();
    textures.set(era.id, generated);
    return generated;
  };

  const trimTextureCache = (keep: ReadonlySet<string>): void => {
    for (const [id, textureSet] of textures) {
      if (textures.size <= 6) return;
      if (keep.has(id)) continue;
      if (textureSet.owned) {
        textureSet.surface.dispose();
        textureSet.ocean.dispose();
        textureSet.clouds.dispose();
      }
      textures.delete(id);
    }
  };

  const firstTextures = texturesFor(TIMELINE[0]);
  const firstVisual = TIMELINE[0].visual;
  const surfaceMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    toneMapped: true,
    uniforms: {
      mapFrom: { value: firstTextures.surface },
      mapTo: { value: firstTextures.surface },
      oceanFrom: { value: firstTextures.ocean },
      oceanTo: { value: firstTextures.ocean },
      textureMix: { value: 0 },
      heat: { value: firstVisual.heat },
      globeOpacity: { value: firstVisual.opacity },
      cityLights: { value: cityLightStrength(firstVisual) },
      referenceFrom: { value: referenceMapStrength(firstVisual) },
      referenceTo: { value: referenceMapStrength(firstVisual) },
      nightMap: { value: earthLights },
      atmosphereFrom: { value: colourFor(firstVisual.atmosphere).clone() },
      atmosphereTo: { value: colourFor(firstVisual.atmosphere).clone() },
      lightDirection: { value: LIGHT_DIRECTION },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      void main() {
        vUv = uv;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D mapFrom;
      uniform sampler2D mapTo;
      uniform sampler2D oceanFrom;
      uniform sampler2D oceanTo;
      uniform float textureMix;
      uniform float heat;
      uniform float globeOpacity;
      uniform float cityLights;
      uniform float referenceFrom;
      uniform float referenceTo;
      uniform sampler2D nightMap;
      uniform vec3 atmosphereFrom;
      uniform vec3 atmosphereTo;
      uniform vec3 lightDirection;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 fromColour = texture2D(mapFrom, vUv);
        vec4 toColour = texture2D(mapTo, vUv);
        vec3 surface = mix(fromColour.rgb, toColour.rgb, textureMix);
        float ocean = mix(
          texture2D(oceanFrom, vUv).r,
          texture2D(oceanTo, vUv).r,
          textureMix
        );
        float referenceAmount = mix(referenceFrom, referenceTo, textureMix);
        float surfaceLuma = dot(surface, vec3(0.2126, 0.7152, 0.0722));
        vec2 surfaceSlope = clamp(
          vec2(dFdx(surfaceLuma), dFdy(surfaceLuma)) * 0.32,
          vec2(-0.045),
          vec2(0.045)
        );
        vec3 normal = normalize(
          vViewNormal + vec3(-surfaceSlope.x, surfaceSlope.y, 0.0) *
            0.75 * (1.0 - ocean * 0.7)
        );
        vec3 viewDirection = normalize(-vViewPosition);
        vec3 light = normalize(lightDirection);
        float lightAmount = dot(normal, light);
        float diffuse = smoothstep(-0.18, 0.55, lightAmount);
        float daylight = 0.29 + diffuse * 0.86;
        vec3 halfDirection = normalize(light + viewDirection);
        float specular = pow(max(dot(normal, halfDirection), 0.0), 260.0);
        specular *= ocean * smoothstep(0.0, 0.34, lightAmount) * (1.0 - heat * 0.78);
        float limb = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.35);
        vec3 atmosphere = mix(atmosphereFrom, atmosphereTo, textureMix);
        vec3 colour = surface * mix(daylight, 1.06, heat * 0.48);
        colour += vec3(0.82, 0.92, 1.0) * specular * 0.22;
        colour += atmosphere * limb * (0.08 + diffuse * 0.23);
        float night = 1.0 - smoothstep(-0.12, 0.17, lightAmount);
        vec3 nightLights = texture2D(nightMap, vUv).rgb;
        colour += nightLights * cityLights * referenceAmount * night * 2.1;
        gl_FragColor = vec4(colour, globeOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const cloudMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: true,
    uniforms: {
      mapFrom: { value: firstTextures.clouds },
      mapTo: { value: firstTextures.clouds },
      textureMix: { value: 0 },
      globeOpacity: { value: firstVisual.opacity },
      atmosphereFrom: { value: colourFor(firstVisual.atmosphere).clone() },
      atmosphereTo: { value: colourFor(firstVisual.atmosphere).clone() },
      lightDirection: { value: LIGHT_DIRECTION },
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
      uniform float globeOpacity;
      uniform vec3 atmosphereFrom;
      uniform vec3 atmosphereTo;
      uniform vec3 lightDirection;
      varying vec2 vUv;
      varying vec3 vViewNormal;

      void main() {
        vec4 fromCloud = texture2D(mapFrom, vUv);
        vec4 toCloud = texture2D(mapTo, vUv);
        vec4 cloud = mix(fromCloud, toCloud, textureMix);
        vec3 normal = normalize(vViewNormal);
        float daylight = 0.34 + smoothstep(-0.28, 0.62, dot(normal, normalize(lightDirection))) * 0.8;
        vec3 atmosphere = mix(atmosphereFrom, atmosphereTo, textureMix);
        vec3 tint = mix(vec3(0.9, 0.95, 1.0), atmosphere, 0.16);
        gl_FragColor = vec4(cloud.rgb * tint * daylight, cloud.a * globeOpacity * 0.84);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const atmosphereMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
    uniforms: {
      textureMix: { value: 0 },
      globeOpacity: { value: firstVisual.opacity },
      atmospherePresence: { value: atmosphereStrength(firstVisual) },
      atmosphereFrom: { value: colourFor(firstVisual.atmosphere).clone() },
      atmosphereTo: { value: colourFor(firstVisual.atmosphere).clone() },
    },
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float textureMix;
      uniform float globeOpacity;
      uniform float atmospherePresence;
      uniform vec3 atmosphereFrom;
      uniform vec3 atmosphereTo;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        float horizon = 1.0 - abs(dot(normalize(vViewNormal), viewDirection));
        float glow = pow(max(horizon, 0.0), 2.15);
        vec3 atmosphere = mix(atmosphereFrom, atmosphereTo, textureMix);
        gl_FragColor = vec4(atmosphere * (0.72 + glow * 0.5), glow * atmospherePresence * globeOpacity * 0.82);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const planetRoot = new THREE.Group();
  planetRoot.rotation.z = -0.2;
  const planet = new THREE.Mesh(geometry, surfaceMaterial);
  planet.rotation.y = -0.72;
  const clouds = new THREE.Mesh(geometry, cloudMaterial);
  clouds.scale.setScalar(1.012);
  clouds.rotation.y = -0.65;
  clouds.renderOrder = 2;
  const atmosphere = new THREE.Mesh(geometry, atmosphereMaterial);
  atmosphere.scale.setScalar(1.027);
  atmosphere.renderOrder = 3;
  planetRoot.add(planet, clouds, atmosphere);
  scene.add(planetRoot);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animationFrame = 0;
  let lastFrame = performance.now();

  const render = (now: number): void => {
    if (!reducedMotion.matches) {
      const elapsed = Math.min(now - lastFrame, 48);
      planet.rotation.y += elapsed * 0.00003;
      clouds.rotation.y += elapsed * 0.000038;
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
      const fromTextures = texturesFor(state.from);
      const toTextures = texturesFor(state.to);
      const atmosphereFrom = colourFor(state.from.visual.atmosphere);
      const atmosphereTo = colourFor(state.to.visual.atmosphere);
      const heat =
        state.from.visual.heat +
        (state.to.visual.heat - state.from.visual.heat) * state.mix;
      const opacity =
        state.from.visual.opacity +
        (state.to.visual.opacity - state.from.visual.opacity) * state.mix;
      const presence =
        atmosphereStrength(state.from.visual) +
        (atmosphereStrength(state.to.visual) - atmosphereStrength(state.from.visual)) *
          state.mix;
      const cityLights =
        cityLightStrength(state.from.visual) +
        (cityLightStrength(state.to.visual) - cityLightStrength(state.from.visual)) *
          state.mix;

      surfaceMaterial.uniforms.mapFrom.value = fromTextures.surface;
      surfaceMaterial.uniforms.mapTo.value = toTextures.surface;
      surfaceMaterial.uniforms.oceanFrom.value = fromTextures.ocean;
      surfaceMaterial.uniforms.oceanTo.value = toTextures.ocean;
      cloudMaterial.uniforms.mapFrom.value = fromTextures.clouds;
      cloudMaterial.uniforms.mapTo.value = toTextures.clouds;
      surfaceMaterial.uniforms.textureMix.value = state.mix;
      cloudMaterial.uniforms.textureMix.value = state.mix;
      atmosphereMaterial.uniforms.textureMix.value = state.mix;
      surfaceMaterial.uniforms.heat.value = heat;
      surfaceMaterial.uniforms.cityLights.value = cityLights;
      surfaceMaterial.uniforms.referenceFrom.value = referenceMapStrength(
        state.from.visual,
      );
      surfaceMaterial.uniforms.referenceTo.value = referenceMapStrength(
        state.to.visual,
      );
      surfaceMaterial.uniforms.globeOpacity.value = opacity;
      cloudMaterial.uniforms.globeOpacity.value = opacity;
      atmosphereMaterial.uniforms.globeOpacity.value = opacity;
      atmosphereMaterial.uniforms.atmospherePresence.value = presence;

      for (const material of [surfaceMaterial, cloudMaterial, atmosphereMaterial]) {
        material.uniforms.atmosphereFrom.value.copy(atmosphereFrom);
        material.uniforms.atmosphereTo.value.copy(atmosphereTo);
      }

      trimTextureCache(new Set([state.from.id, state.to.id]));
    },
    destroy() {
      stopRendering();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      geometry.dispose();
      surfaceMaterial.dispose();
      cloudMaterial.dispose();
      atmosphereMaterial.dispose();
      for (const textureSet of textures.values()) {
        if (textureSet.owned) {
          textureSet.surface.dispose();
          textureSet.ocean.dispose();
          textureSet.clouds.dispose();
        }
      }
      referenceTextures.surface.dispose();
      referenceTextures.ocean.dispose();
      referenceTextures.clouds.dispose();
      earthLights.dispose();
      renderer.dispose();
    },
  };
}
