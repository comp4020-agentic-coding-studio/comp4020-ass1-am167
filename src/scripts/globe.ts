import * as THREE from "three";

import { mixPlanetShading, planetShadingFor } from "./planet-shading";
import {
  HALO_FRAGMENT_SHADER,
  HALO_VERTEX_SHADER,
  PLANET_FRAGMENT_SHADER,
  PLANET_VERTEX_SHADER,
} from "./planet-shader";
import type { EraVisual, TimelineState } from "./timeline";
import { shouldLoadPresentTextures, TIMELINE } from "./timeline";

export interface GlobeController {
  setState: (state: TimelineState) => void;
  destroy: () => void;
}

// Low enough to keep a real terminator on the disc — the Sun a little to the
// left and only slightly in front of the planet, so roughly a third of what
// you see is night. Lighting the globe almost straight down the camera axis
// is what made the old version read as a flat painted circle.
const LIGHT_DIRECTION = new THREE.Vector3(-0.62, 0.27, 0.55).normalize();

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
  renderer.toneMappingExposure = 0.98;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.z = 4.55;

  // Detail comes from the fragment shader now, so the mesh only has to hold a
  // clean silhouette.
  const geometry = new THREE.SphereGeometry(1, 128, 96);
  const haloGeometry = new THREE.SphereGeometry(1, 48, 32);

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

  const planetRoot = new THREE.Group();
  planetRoot.rotation.z = -0.2;
  const planet = new THREE.Mesh(geometry, planetMaterial);
  planet.rotation.y = -0.72;
  planet.renderOrder = 0;
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.scale.setScalar(1.6);
  halo.renderOrder = 1;
  planetRoot.add(planet, halo);
  scene.add(planetRoot);

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

  const render = (now: number): void => {
    if (!reducedMotion.matches) {
      const elapsed = Math.min(now - lastFrame, 48);
      planet.rotation.y += elapsed * 0.00003;
      // Weather runs a little ahead of the ground beneath it.
      planetMaterial.uniforms.cloudDrift.value += elapsed * 0.0000075;
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
    updatePlanetCentre();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  document.addEventListener("visibilitychange", handleVisibility);
  resize();
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
    },
    destroy() {
      stopRendering();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      geometry.dispose();
      haloGeometry.dispose();
      planetMaterial.dispose();
      haloMaterial.dispose();
      if (referenceRequested) {
        dayMap.dispose();
        oceanMap.dispose();
        cloudMap.dispose();
        nightMap.dispose();
      }
      blankTexture.dispose();
      renderer.dispose();
    },
  };
}
