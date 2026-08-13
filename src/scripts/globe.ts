import * as THREE from "three";

import { mixPlanetShading, planetShadingFor } from "./planet-shading";
import {
  HALO_FRAGMENT_SHADER,
  HALO_VERTEX_SHADER,
  MOON_FRAGMENT_SHADER,
  MOON_VERTEX_SHADER,
  PLANET_FRAGMENT_SHADER,
  PLANET_VERTEX_SHADER,
} from "./planet-shader";
import {
  attachPerformanceProfiler,
  detachPerformanceProfiler,
} from "./performance-profiler";
import type { EraVisual, TimelineState } from "./timeline";
import {
  hasVisibleMoon,
  moonHeatFor,
  shouldLoadPresentTextures,
  TIMELINE,
} from "./timeline";

export interface GlobeController {
  setState: (state: TimelineState) => void;
  destroy: () => void;
}

// Low enough to keep a real terminator on the disc — the Sun a little to the
// left and only slightly in front of the planet, so roughly a third of what
// you see is night. Lighting the globe almost straight down the camera axis
// is what made the old version read as a flat painted circle.
const LIGHT_DIRECTION = new THREE.Vector3(-0.62, 0.27, 0.55).normalize();

// Roughly a 1280x1280 drawing buffer. Measured at about 4.3ms of GPU per
// megapixel for this shader, so this is the ceiling that keeps one frame of
// planet inside a 60Hz budget with room for the rest of the page.
const MAXIMUM_DRAWING_PIXELS = 1_250_000;

const CAMERA_FOV = 31;
const ORIGINAL_CAMERA_DISTANCE = 4.55;

// The canvas now reaches past .earth-wrap so it can contain the Moon, which
// sits outside the wrap's right edge. That would enlarge the planet along with
// it, so the camera pulls back to hold the globe at exactly the screen size it
// had when the canvas and the wrap were the same box. This is that size, as a
// fraction of the wrap's half-height — derived rather than typed in, so it
// stays correct if the field of view is ever retuned.
const GLOBE_RADIUS_IN_WRAP =
  1 /
  Math.sqrt(ORIGINAL_CAMERA_DISTANCE * ORIGINAL_CAMERA_DISTANCE - 1) /
  Math.tan((CAMERA_FOV * Math.PI) / 360);

const EARTH_DAY_URL = new URL("../assets/earth-day.jpg", import.meta.url).href;
const EARTH_SPECULAR_URL = new URL(
  "../assets/earth-specular.jpg",
  import.meta.url,
).href;
const EARTH_CLOUDS_URL = new URL("../assets/earth-clouds.png", import.meta.url).href;
const EARTH_LIGHTS_URL = new URL("../assets/earth-lights.png", import.meta.url).href;

const EARLIEST = TIMELINE[0].millionYearsFromNow;
const LATEST = TIMELINE[TIMELINE.length - 1].millionYearsFromNow;

// Geological time drives continental drift directly, so eras a few million
// years apart barely move the map while billions of years rearrange it.
function tectonicPhase(millionYearsFromNow: number): number {
  const span = LATEST - EARLIEST || 1;
  return (millionYearsFromNow - EARLIEST) / span;
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

export function createGlobe(
  canvas: HTMLCanvasElement,
  fallback: HTMLElement,
  moonAnchor?: HTMLElement,
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  const performanceProfiler = attachPerformanceProfiler(renderer, canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.z = ORIGINAL_CAMERA_DISTANCE;

  // Detail comes from the fragment shader now, so the mesh only has to hold a
  // clean silhouette.
  const geometry = new THREE.SphereGeometry(1, 128, 96);
  const haloGeometry = new THREE.SphereGeometry(1, 48, 32);
  const moonGeometry = new THREE.SphereGeometry(1, 48, 32);

  const colours = new Map<string, THREE.Color>();
  const colourFor = (value: string): THREE.Color => {
    const cached = colours.get(value);
    if (cached) return cached;
    const colour = new THREE.Color(value);
    colours.set(value, colour);
    return colour;
  };

  const textureLoader = new THREE.TextureLoader();

  const configureTexture = (
    texture: THREE.Texture,
    colourTexture: boolean,
  ): THREE.Texture => {
    texture.colorSpace = colourTexture
      ? THREE.SRGBColorSpace
      : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  };

  // A 1x1 stand-in keeps every sampler bound. Each one is multiplied by
  // referenceMap, which is zero outside the present, so it is never visible.
  const blankCanvas = document.createElement("canvas");
  blankCanvas.width = 1;
  blankCanvas.height = 1;
  const blankTexture = configureTexture(new THREE.CanvasTexture(blankCanvas), true);

  let dayMap = blankTexture;
  let oceanMap = blankTexture;
  let cloudMap = blankTexture;
  let nightMap = blankTexture;
  let referenceRequested = false;

  // Deferred until the present is in reach. Until they decode, the present
  // renders procedurally like every other era, so a slow connection sees a
  // plausible Earth rather than an unlit sphere.
  const loadReferenceTextures = (): void => {
    if (referenceRequested) return;
    referenceRequested = true;

    dayMap = configureTexture(textureLoader.load(EARTH_DAY_URL), true);
    oceanMap = configureTexture(textureLoader.load(EARTH_SPECULAR_URL), false);
    cloudMap = configureTexture(textureLoader.load(EARTH_CLOUDS_URL), true);
    nightMap = configureTexture(textureLoader.load(EARTH_LIGHTS_URL), true);

    planetMaterial.uniforms.dayMap.value = dayMap;
    planetMaterial.uniforms.oceanMap.value = oceanMap;
    planetMaterial.uniforms.cloudMap.value = cloudMap;
    planetMaterial.uniforms.nightMap.value = nightMap;
  };

  const firstVisual: EraVisual = TIMELINE[0].visual;
  const firstShading = planetShadingFor(firstVisual);

  const planetMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    toneMapped: true,
    vertexShader: PLANET_VERTEX_SHADER,
    fragmentShader: PLANET_FRAGMENT_SHADER,
    uniforms: {
      lightDirection: { value: LIGHT_DIRECTION },
      oceanColour: { value: colourFor(firstVisual.ocean).clone() },
      landColour: { value: colourFor(firstVisual.land).clone() },
      rockColour: { value: colourFor(firstVisual.surface).clone() },
      detailColour: { value: colourFor(firstVisual.detail).clone() },
      atmosphereColour: { value: colourFor(firstVisual.atmosphere).clone() },
      oceanCover: { value: firstVisual.oceanCover },
      iceCover: { value: firstVisual.iceCover },
      cloudCover: { value: firstVisual.cloudCover },
      heat: { value: firstVisual.heat },
      globeOpacity: { value: firstVisual.opacity },
      molten: { value: firstShading.molten },
      vegetation: { value: firstShading.vegetation },
      cratering: { value: firstShading.cratering },
      impactFlash: { value: firstShading.impactFlash },
      globalIce: { value: firstShading.globalIce },
      atmosphereDensity: { value: firstShading.atmosphere },
      nightLights: { value: firstShading.nightLights },
      referenceMap: { value: firstShading.referenceMap },
      oceanRoughness: { value: firstShading.oceanRoughness },
      tectonic: { value: tectonicPhase(TIMELINE[0].millionYearsFromNow) },
      cloudDrift: { value: 0 },
      dayMap: { value: blankTexture },
      oceanMap: { value: blankTexture },
      cloudMap: { value: blankTexture },
      nightMap: { value: blankTexture },
    },
  });

  const haloMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
    vertexShader: HALO_VERTEX_SHADER,
    fragmentShader: HALO_FRAGMENT_SHADER,
    uniforms: {
      planetCentre: { value: new THREE.Vector3(0, 0, -camera.position.z) },
      lightDirection: { value: LIGHT_DIRECTION },
      atmosphereColour: { value: colourFor(firstVisual.atmosphere).clone() },
      atmosphereDensity: { value: firstShading.atmosphere },
      globeOpacity: { value: firstVisual.opacity },
      haloWidth: { value: 0.13 },
    },
  });

  const moonMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    toneMapped: true,
    vertexShader: MOON_VERTEX_SHADER,
    fragmentShader: MOON_FRAGMENT_SHADER,
    uniforms: {
      lightDirection: { value: LIGHT_DIRECTION },
      moonOpacity: { value: 0 },
      moonHeat: { value: moonHeatFor(TIMELINE[0]) },
    },
  });

  const planetRoot = new THREE.Group();
  planetRoot.rotation.z = -0.2;
  const planet = new THREE.Mesh(geometry, planetMaterial);
  planet.rotation.y = -0.72;
  planet.renderOrder = 0;
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  // Only has to be wide enough to contain the glow, which ends just past
  // 1.13 planet radii; every unit past that is shaded fragments thrown away.
  halo.scale.setScalar(1.2);
  halo.renderOrder = 1;
  planetRoot.add(planet, halo);
  scene.add(planetRoot);

  // Outside planetRoot: the Moon keeps its own orientation rather than being
  // dragged around by the planet's spin and axial tilt.
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moon.rotation.y = 0.6;
  moon.rotation.z = 0.12;
  moon.renderOrder = 2;
  moon.visible = false;
  scene.add(moon);

  // The Moon's place in the composition stays in CSS, on a hidden element that
  // still takes part in layout. Measuring that element and projecting it into
  // the scene means the three media queries that move and resize the Moon keep
  // working, and there are no screen-space constants duplicated here to drift
  // out of step with the stylesheet.
  const placeMoon = (canvasWidth: number, canvasHeight: number): void => {
    if (!moonAnchor) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const moonBounds = moonAnchor.getBoundingClientRect();
    if (moonBounds.width < 1 || canvasBounds.width < 1) return;

    const centreX =
      (moonBounds.left + moonBounds.width / 2 - canvasBounds.left) /
      canvasBounds.width;
    const centreY =
      (moonBounds.top + moonBounds.height / 2 - canvasBounds.top) /
      canvasBounds.height;

    const halfHeight =
      camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const halfWidth = halfHeight * (canvasWidth / canvasHeight);

    moon.position.set(
      (centreX * 2 - 1) * halfWidth,
      (1 - centreY * 2) * halfHeight,
      0,
    );
    moon.scale.setScalar(
      (moonBounds.width / canvasBounds.width) * halfWidth,
    );
  };

  const centreInView = new THREE.Vector3();
  const updatePlanetCentre = (): void => {
    camera.updateMatrixWorld();
    planetRoot.updateMatrixWorld();
    centreInView.setFromMatrixPosition(planetRoot.matrixWorld);
    centreInView.applyMatrix4(camera.matrixWorldInverse);
    haloMaterial.uniforms.planetCentre.value.copy(centreInView);
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animationFrame = 0;
  let lastFrame = performance.now();
  const drawScene = (): void => renderer.render(scene, camera);

  const render = (now: number): void => {
    if (!reducedMotion.matches) {
      const elapsed = Math.min(now - lastFrame, 48);
      planet.rotation.y += elapsed * 0.00003;
      // Weather runs a little ahead of the ground beneath it.
      planetMaterial.uniforms.cloudDrift.value += elapsed * 0.0000075;
    }
    lastFrame = now;
    if (performanceProfiler) performanceProfiler.render(now, drawScene);
    else drawScene();
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
    // Cost here is per fragment, and the globe is sized as a fraction of the
    // viewport, so a large display asks for the expensive shader over far more
    // pixels than a laptop does. Cap the drawing buffer so the worst case is
    // bounded: at ordinary window sizes this leaves the device ratio alone and
    // changes nothing, and past that it trades a little sharpness for a frame
    // rate the machine can actually hold.
    const budgetRatio = Math.sqrt(MAXIMUM_DRAWING_PIXELS / (width * height));
    const defaultRatio = Math.min(
      window.devicePixelRatio || 1,
      2,
      budgetRatio,
    );
    renderer.setPixelRatio(
      performanceProfiler?.drawingPixelRatio(width, height, defaultRatio) ??
        defaultRatio,
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    // Hold the globe at the screen size it had before the canvas was widened
    // to reach the Moon: pull the camera back by however much the canvas
    // overhangs .earth-wrap. Solved from the projected radius of a unit sphere
    // rather than a tuned constant, so it stays right at every breakpoint.
    const wrap = canvas.parentElement;
    const wrapHeight = wrap ? wrap.getBoundingClientRect().height : height;
    if (wrapHeight > 1) {
      const targetRadius = (GLOBE_RADIUS_IN_WRAP * wrapHeight) / height;
      const projected = targetRadius * Math.tan((CAMERA_FOV * Math.PI) / 360);
      camera.position.z = Math.sqrt(1 / (projected * projected) + 1);
    }

    camera.updateProjectionMatrix();
    updatePlanetCentre();
    placeMoon(width, height);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  // The Moon's box can change without the canvas changing — a breakpoint that
  // only moves the Moon, for instance — and then the drawn Moon would sit at
  // its old place until something else forced a resize.
  if (moonAnchor) resizeObserver.observe(moonAnchor);
  document.addEventListener("visibilitychange", handleVisibility);
  resize();
  performanceProfiler?.setActiveEra(TIMELINE[0].id);
  startRendering();

  const blendColour = (
    uniform: THREE.Color,
    from: string,
    to: string,
    mix: number,
  ): void => {
    uniform.copy(colourFor(from)).lerp(colourFor(to), mix);
  };

  const blend = (from: number, to: number, mix: number): number =>
    from + (to - from) * mix;

  return {
    setState(state) {
      performanceProfiler?.setActiveEra(state.active.id);
      // Start the photographic maps downloading a little before the present
      // arrives, so they are decoded by the time the blue marble is on screen.
      if (shouldLoadPresentTextures(state.progress)) loadReferenceTextures();

      const from = state.from.visual;
      const to = state.to.visual;
      const mix = state.mix;
      const shading = mixPlanetShading(
        planetShadingFor(from),
        planetShadingFor(to),
        mix,
      );

      const uniforms = planetMaterial.uniforms;
      blendColour(uniforms.oceanColour.value, from.ocean, to.ocean, mix);
      blendColour(uniforms.landColour.value, from.land, to.land, mix);
      blendColour(uniforms.rockColour.value, from.surface, to.surface, mix);
      blendColour(uniforms.detailColour.value, from.detail, to.detail, mix);
      blendColour(
        uniforms.atmosphereColour.value,
        from.atmosphere,
        to.atmosphere,
        mix,
      );

      uniforms.oceanCover.value = blend(from.oceanCover, to.oceanCover, mix);
      uniforms.iceCover.value = blend(from.iceCover, to.iceCover, mix);
      uniforms.cloudCover.value = blend(from.cloudCover, to.cloudCover, mix);
      uniforms.heat.value = blend(from.heat, to.heat, mix);
      uniforms.globeOpacity.value = blend(from.opacity, to.opacity, mix);
      uniforms.molten.value = shading.molten;
      uniforms.vegetation.value = shading.vegetation;
      uniforms.cratering.value = shading.cratering;
      uniforms.impactFlash.value = shading.impactFlash;
      uniforms.globalIce.value = shading.globalIce;
      uniforms.atmosphereDensity.value = shading.atmosphere;
      uniforms.nightLights.value = shading.nightLights;
      uniforms.referenceMap.value = shading.referenceMap;
      uniforms.oceanRoughness.value = shading.oceanRoughness;
      uniforms.tectonic.value = tectonicPhase(state.millionYearsFromNow);

      haloMaterial.uniforms.atmosphereColour.value.copy(
        uniforms.atmosphereColour.value,
      );
      haloMaterial.uniforms.atmosphereDensity.value = shading.atmosphere;
      haloMaterial.uniforms.globeOpacity.value = uniforms.globeOpacity.value;

      const moonPresence = blend(
        hasVisibleMoon(state.from) ? 1 : 0,
        hasVisibleMoon(state.to) ? 1 : 0,
        mix,
      );
      moonMaterial.uniforms.moonOpacity.value = moonPresence;
      moonMaterial.uniforms.moonHeat.value = blend(
        moonHeatFor(state.from),
        moonHeatFor(state.to),
        mix,
      );
      // Skipped entirely before the Moon-forming impact and after Earth is
      // gone, rather than drawn at zero alpha.
      moon.visible = moonPresence > 0.001;
    },
    destroy() {
      stopRendering();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      geometry.dispose();
      haloGeometry.dispose();
      moonGeometry.dispose();
      planetMaterial.dispose();
      haloMaterial.dispose();
      moonMaterial.dispose();
      if (referenceRequested) {
        dayMap.dispose();
        oceanMap.dispose();
        cloudMap.dispose();
        nightMap.dispose();
      }
      blankTexture.dispose();
      renderer.dispose();
      detachPerformanceProfiler(performanceProfiler);
    },
  };
}
