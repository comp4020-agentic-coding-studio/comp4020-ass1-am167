import type { EraVisual, PlanetMode } from "./timeline";

/**
 * What the planet fragment shader needs to know about an era, reduced to
 * scalars it can blend.
 *
 * The shader deliberately has no per-era branches. An era transition is a
 * point somewhere between two of these sets, so anything the surface reacts to
 * has to be a number that means the same thing at both ends and everywhere in
 * between. "Is this world molten" is therefore a 0-1 amount rather than a mode
 * name: it lets the Hadean cool into the Archean continuously instead of
 * snapping between two textures.
 */
export interface PlanetShading {
  /** Self-illuminated rock, from cold crust (0) to an open magma ocean (1). */
  molten: number;
  /** How strongly land greens where it is wet. Bare rock worlds sit at 0. */
  vegetation: number;
  /** Impact scarring written across the whole surface. */
  cratering: number;
  /** A single fresh impact scar and its ejecta. */
  impactFlash: number;
  /** Where ice grows: polar caps (0) through to a frozen globe (1). */
  globalIce: number;
  /** Limb glow: airless rock (0) to a thick, hazy shell (1). */
  atmosphere: number;
  /** Night-side city lights. */
  nightLights: number;
  /** Blend toward the photographic present-day maps. */
  referenceMap: number;
  /** How rough the sea is, which spreads and dims the Sun's reflection. */
  oceanRoughness: number;
}

export const PLANET_SHADING_KEYS = [
  "molten",
  "vegetation",
  "cratering",
  "impactFlash",
  "globalIce",
  "atmosphere",
  "nightLights",
  "referenceMap",
  "oceanRoughness",
] as const satisfies ReadonlyArray<keyof PlanetShading>;

type ModeShading = Omit<PlanetShading, "referenceMap" | "nightLights">;

// Recording every mode explicitly, rather than defaulting the ones nobody
// thought about, is the point: a new mode is a type error here instead of a
// planet that quietly renders as bare grey rock.
const BY_MODE: Record<PlanetMode, ModeShading> = {
  molten: {
    molten: 1,
    vegetation: 0,
    cratering: 0.45,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.92,
    oceanRoughness: 1,
  },
  archean: {
    // Still hot enough for the crust to glow in the deepest rifts.
    molten: 0.14,
    vegetation: 0,
    cratering: 0.18,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.8,
    oceanRoughness: 0.62,
  },
  oxygen: {
    molten: 0.04,
    // Life is still microbial and entirely marine: the land stays bare rock.
    vegetation: 0,
    cratering: 0.06,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.74,
    oceanRoughness: 0.5,
  },
  snowball: {
    molten: 0,
    vegetation: 0,
    cratering: 0,
    impactFlash: 0,
    globalIce: 1,
    atmosphere: 0.66,
    oceanRoughness: 0.2,
  },
  paleozoic: {
    molten: 0,
    // The first land plants are a coastal fringe, not a canopy.
    vegetation: 0.55,
    cratering: 0,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.72,
    oceanRoughness: 0.46,
  },
  mesozoic: {
    molten: 0,
    vegetation: 0.95,
    cratering: 0,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.72,
    oceanRoughness: 0.44,
  },
  impact: {
    molten: 0.2,
    vegetation: 0.45,
    cratering: 0.5,
    impactFlash: 1,
    globalIce: 0,
    atmosphere: 0.86,
    oceanRoughness: 0.6,
  },
  "ice-age": {
    molten: 0,
    vegetation: 0.8,
    cratering: 0,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.7,
    oceanRoughness: 0.42,
  },
  temperate: {
    molten: 0,
    vegetation: 1,
    cratering: 0,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.72,
    oceanRoughness: 0.4,
  },
  present: {
    molten: 0,
    vegetation: 1,
    cratering: 0,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.74,
    oceanRoughness: 0.38,
  },
  dry: {
    molten: 0,
    vegetation: 0,
    cratering: 0.12,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.62,
    oceanRoughness: 0.72,
  },
  "red-giant": {
    molten: 0.6,
    vegetation: 0,
    cratering: 0.3,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.5,
    oceanRoughness: 1,
  },
  remnant: {
    molten: 0,
    vegetation: 0,
    // Nothing has resurfaced this world for billions of years.
    cratering: 1,
    impactFlash: 0,
    globalIce: 0,
    atmosphere: 0.12,
    oceanRoughness: 1,
  },
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function planetShadingFor(visual: EraVisual): PlanetShading {
  const mode = BY_MODE[visual.mode];
  const isPresent = visual.mode === "present";

  return {
    // Heat is authored per era and moves within a mode, so let it push the
    // glow up without ever letting a cold-mode world light itself.
    molten: clamp01(Math.max(mode.molten, visual.heat * mode.molten * 1.4)),
    vegetation: clamp01(mode.vegetation),
    cratering: clamp01(mode.cratering),
    impactFlash: clamp01(mode.impactFlash),
    globalIce: clamp01(mode.globalIce),
    atmosphere: clamp01(mode.atmosphere),
    nightLights: isPresent ? 1 : 0,
    referenceMap: isPresent ? 1 : 0,
    oceanRoughness: clamp01(mode.oceanRoughness),
  };
}

export function mixPlanetShading(
  from: PlanetShading,
  to: PlanetShading,
  mix: number,
): PlanetShading {
  const amount = clamp01(mix);
  const blended = {} as Record<keyof PlanetShading, number>;
  for (const key of PLANET_SHADING_KEYS) {
    blended[key] = from[key] + (to[key] - from[key]) * amount;
  }
  return blended as PlanetShading;
}
