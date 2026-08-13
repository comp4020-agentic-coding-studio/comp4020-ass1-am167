// The planet's surface is synthesised in the fragment shader rather than
// painted into a canvas on the CPU.
//
// The canvas version had three problems that all shared one cause. It cost
// half a second of blocked main thread every time an era came into view; it
// was capped at 1024x512 for a globe that covers about 1200 device pixels, so
// coastlines were soft and continents were mush; and an equirectangular map
// pinches at the poles and seams at the antimeridian. Sampling 3D noise at the
// sphere's own surface position removes all three: there is no map, so there
// is no resolution, no seam and no pole.
//
// Everything the surface reacts to arrives as a uniform that has already been
// blended between the two eras the scroll sits between (see planet-shading.ts),
// so this shader contains no per-era branches.

// Ashima Arts' simplex noise, unchanged apart from formatting. MIT licensed.
// https://github.com/ashima/webgl-noise
const SIMPLEX_NOISE = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(
      vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3))
    );
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(
      m * m,
      vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3))
    );
  }
`;

// Octave counts are baked into separate functions rather than passed in.
// GLSL ES 1.0 only guarantees constant loop bounds, and writing the cost out
// like this makes it obvious where a frame goes: every call below is a fixed,
// countable number of noise evaluations.
const NOISE_FIELDS = /* glsl */ `
  float fbm3(vec3 p) {
    return (
      snoise(p) * 0.5 +
      snoise(p * 2.03) * 0.25 +
      snoise(p * 4.12) * 0.125
    ) / 0.875;
  }

  float fbm4(vec3 p) {
    return (
      snoise(p) * 0.5 +
      snoise(p * 2.03) * 0.25 +
      snoise(p * 4.12) * 0.125 +
      snoise(p * 8.37) * 0.0625
    ) / 0.9375;
  }

  float fbm5(vec3 p) {
    return (
      snoise(p) * 0.5 +
      snoise(p * 2.03) * 0.25 +
      snoise(p * 4.12) * 0.125 +
      snoise(p * 8.37) * 0.0625 +
      snoise(p * 17.0) * 0.03125
    ) / 0.96875;
  }

  // Absolute-valued noise creases along its zero crossings, which is what
  // makes mountain ranges look like ranges instead of lumps.
  float ridged2(vec3 p) {
    return (
      (1.0 - abs(snoise(p))) * 0.5 +
      (1.0 - abs(snoise(p * 2.17))) * 0.25
    ) / 0.75;
  }

  float ridged3(vec3 p) {
    return (
      (1.0 - abs(snoise(p))) * 0.5 +
      (1.0 - abs(snoise(p * 2.17))) * 0.25 +
      (1.0 - abs(snoise(p * 4.71))) * 0.125
    ) / 0.875;
  }

  vec3 rotateY(vec3 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * v.x + s * v.z, v.y, c * v.z - s * v.x);
  }
`;

export const PLANET_VERTEX_SHADER = /* glsl */ `
  varying vec3 vSurface;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // Object space, so the terrain turns with the planet instead of swimming
    // across it.
    vSurface = normalize(position);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewNormal = normalize(normalMatrix * normal);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const PLANET_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 lightDirection;
  uniform vec3 oceanColour;
  uniform vec3 landColour;
  uniform vec3 rockColour;
  uniform vec3 detailColour;
  uniform vec3 atmosphereColour;

  uniform float oceanCover;
  uniform float iceCover;
  uniform float cloudCover;
  uniform float heat;
  uniform float globeOpacity;

  uniform float molten;
  uniform float vegetation;
  uniform float cratering;
  uniform float impactFlash;
  uniform float globalIce;
  uniform float atmosphereDensity;
  uniform float nightLights;
  uniform float referenceMap;
  uniform float oceanRoughness;

  uniform float tectonic;
  uniform float cloudDrift;

  uniform sampler2D dayMap;
  uniform sampler2D oceanMap;
  uniform sampler2D cloudMap;
  uniform sampler2D nightMap;

  varying vec3 vSurface;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  ${SIMPLEX_NOISE}
  ${NOISE_FIELDS}

  void main() {
    vec3 surfacePoint = normalize(vSurface);
    float latitude = abs(surfacePoint.y);

    // Roughly how much of the sphere one pixel covers. Detail finer than that
    // cannot be resolved and turns into shimmer as the planet turns, so the
    // highest-frequency terms are faded out where the surface is compressed —
    // mostly around the limb, and on high-density displays. This is a cheap
    // stand-in for the mip levels a texture would have given us for free.
    float pixelSpan = length(fwidth(surfacePoint));
    float fineDetail = 1.0 - smoothstep(0.006, 0.020, pixelSpan);

    // Every branch below tests a uniform, so all fragments in a draw take the
    // same path and none of this costs divergence. It matters because the
    // straight-line version evaluated all 45 noise fields on every pixel of
    // every era — magma networks and crater rims included, on worlds made of
    // neither, and the full procedural surface on the one era that replaces
    // it with a photograph.
    float sea = 0.0;
    float land = 0.0;
    float ranges = 0.0;
    float fissure = 0.0;
    float exposedMelt = 0.0;
    vec3 magma = vec3(0.0);
    vec3 albedo = vec3(0.0);

    if (referenceMap < 0.999) {
      // Continents drift because the noise domain is offset by geological
      // time rather than reseeded per era. Two eras a few million years apart
      // barely move; four billion years rearranges the map.
      vec3 drift = vec3(tectonic * 1.9, tectonic * 0.5, tectonic * -1.2);
      // Each warp component needs its own offset *and* its own frequency.
      // Offsetting one field along the diagonal gives three correlated
      // results, which warps the domain along one axis and marbles the globe.
      vec3 warp = vec3(
        snoise(surfacePoint * 1.7 + vec3(11.3, 4.1, 27.9)),
        snoise(surfacePoint * 2.1 + vec3(37.7, 19.2, 3.4)),
        snoise(surfacePoint * 1.9 + vec3(71.1, 52.6, 44.8))
      );
      vec3 terrainPoint = surfacePoint * 1.45 + drift + warp * 0.16;

      float continents = fbm5(terrainPoint);
      ranges = ridged3(terrainPoint * 2.6);
      float grain = fbm3(terrainPoint * 6.1);
      float elevation = continents + (ranges - 0.5) * 0.30 + grain * 0.16 * fineDetail;

      // Ranking the height into 0-1 lets oceanCover mean the fraction of the
      // globe under water directly, instead of a threshold that has to be
      // retuned whenever the noise changes.
      float rank = smoothstep(-0.72, 0.72, elevation);
      sea = 1.0 - smoothstep(oceanCover - 0.012, oceanCover + 0.018, rank);
      land = smoothstep(oceanCover, min(1.0, oceanCover + 0.40), rank);
      float depth = 1.0 - smoothstep(0.0, max(oceanCover, 0.001), rank);

      // ---- surface colour ------------------------------------------------
      float moisture = fbm3(terrainPoint * 2.2 + 9.0) * 0.5 + 0.5;
      float dryBand = smoothstep(0.13, 0.40, latitude) *
        (1.0 - smoothstep(0.40, 0.72, latitude));
      float green = clamp(
        vegetation * (moisture * 1.55 - dryBand * 0.45 - land * 0.16),
        0.0,
        1.0
      );

      vec3 lowland = mix(landColour, detailColour, green * 0.92);
      vec3 arid = mix(landColour, vec3(0.64, 0.47, 0.28), 0.55);
      lowland = mix(
        lowland,
        arid,
        clamp(dryBand * (1.0 - moisture) * 1.7 * (1.0 - green), 0.0, 1.0)
      );

      vec3 mountain = mix(rockColour, vec3(0.50, 0.46, 0.42), 0.32);
      // Mountains need high ground *and* a crease in the ridge field. Keying
      // them off height alone turns every continental interior into one pale
      // plateau, which is what buries the land under grey.
      float alpine = smoothstep(0.50, 0.92, land) * smoothstep(0.44, 0.80, ranges);
      vec3 ground = mix(lowland, mountain, alpine);
      ground = mix(
        ground,
        vec3(0.90, 0.94, 0.97),
        smoothstep(0.74, 0.97, land) * alpine * vegetation * 0.8
      );
      ground *= 0.86 + grain * 0.20 * fineDetail + ranges * 0.08;

      vec3 deepWater = mix(oceanColour, vec3(0.006, 0.026, 0.062), 0.66);
      vec3 shelfWater = mix(oceanColour, atmosphereColour, 0.30);
      vec3 water = mix(shelfWater, deepWater, smoothstep(0.04, 0.86, depth));

      albedo = mix(ground, water, sea);

      // Cratered worlds: bright rims, dark floors, no resurfacing.
      if (cratering > 0.004) {
        float craterField = pow(ridged2(surfacePoint * 7.3 + 3.1), 7.0) * fineDetail;
        float craterBasin = smoothstep(
          0.25,
          0.75,
          fbm3(surfacePoint * 6.4 + 19.0) * 0.5 + 0.5
        );
        vec3 cratered = mix(rockColour, landColour, 0.45);
        cratered = mix(cratered * 0.62, cratered * 1.5, craterField);
        cratered = mix(cratered, cratered * 0.55, craterBasin * 0.5);
        albedo = mix(albedo, cratered, cratering * 0.85);
      }

      // Molten worlds: a mostly-solid crust broken by an incandescent
      // network. The crust has to be genuinely dark for this to read as
      // molten rock — lighting bright orange from every direction just gives
      // a beige ball, because a filmic tone curve desaturates anything that
      // bright.
      if (molten > 0.004) {
        float flow = fbm4(terrainPoint * 2.4 + 31.0) * 0.5 + 0.5;
        fissure = pow(ridged3(terrainPoint * 5.2), 6.0) * fineDetail;
        float crust = smoothstep(
          0.18,
          0.56,
          fbm4(terrainPoint * 3.1 + 53.0) * 0.5 + 0.5
        );
        magma = mix(vec3(0.90, 0.13, 0.02), vec3(1.0, 0.55, 0.10), flow);
        vec3 cooled = mix(rockColour, landColour, 0.45) * (0.07 + flow * 0.12);
        vec3 lava = mix(magma, cooled, crust);
        lava = mix(lava, vec3(1.0, 0.80, 0.34), fissure * 0.8);
        albedo = mix(albedo, lava, molten);
        // How much of this fragment is open melt rather than crust.
        exposedMelt = molten * max(1.0 - crust, fissure);
      }

      // Ice: polar caps that reach further as iceCover grows, or the whole
      // globe once globalIce takes over during the snowball.
      if (iceCover > 0.004) {
        float iceGrain = fbm3(surfacePoint * 4.4 + 5.0) * 0.5 + 0.5;
        float capEdge = 1.0 - iceCover * 1.18;
        float caps = smoothstep(
          capEdge - 0.10,
          capEdge + 0.07,
          latitude + (iceGrain - 0.5) * 0.17
        );
        float sheet = smoothstep(0.22, 0.60, iceCover + (iceGrain - 0.5) * 0.48);
        float frozen = mix(caps, max(caps, sheet), globalIce) * (1.0 - molten);
        vec3 iceColour = mix(
          mix(vec3(0.55, 0.67, 0.71), vec3(0.42, 0.64, 0.76), sea),
          vec3(0.95, 0.98, 1.0),
          iceGrain * 0.66
        );
        albedo = mix(albedo, iceColour, frozen * 0.92);
      }

      // A single fresh impact scar, with ejecta thrown out around it.
      if (impactFlash > 0.004) {
        float scar = 1.0 - smoothstep(
          0.05,
          0.30,
          distance(surfacePoint, normalize(vec3(0.62, 0.34, 0.71)))
        );
        albedo = mix(albedo, vec3(1.0, 0.52, 0.13), impactFlash * pow(scar, 2.4) * 0.85);
      }
    }

    // ---- the photographic present ---------------------------------------
    vec3 photograph = texture2D(dayMap, vUv).rgb;
    float photographSea = texture2D(oceanMap, vUv).r;
    albedo = mix(albedo, photograph, referenceMap);
    float ocean = mix(sea, photographSea, referenceMap);

    // ---- relief ---------------------------------------------------------
    // Shading the height field rather than the albedo means mountains catch
    // the light and coastlines stay flat, instead of every colour edge
    // embossing itself. Deliberately built from land and ranges, both of
    // which vary smoothly: rank steps hard at the shoreline and would emboss
    // every coast into a cliff.
    vec3 view = normalize(-vViewPosition);
    // Faded out against the photographic maps: those continents are the real
    // ones and already carry their own shading, so lighting them with relief
    // invented by the noise embosses terrain that is not there.
    float relief = land * (0.70 + ranges * 0.30) * (1.0 - ocean) *
      (1.0 - referenceMap);

    // Screen-space derivatives blow up where the surface turns edge-on,
    // because one pixel there spans an enormous stretch of ground. Left
    // alone that smears the terrain into ribbons around the limb, so fade
    // the bump out as the surface stops facing us.
    float facing = max(dot(vViewNormal, view), 0.0);
    float bumpFade = smoothstep(0.10, 0.42, facing);
    vec2 slope = clamp(
      vec2(dFdx(relief), dFdy(relief)) * 5.5,
      vec2(-0.42),
      vec2(0.42)
    );
    vec3 normal = normalize(
      vViewNormal + vec3(-slope.x, slope.y, 0.0) * bumpFade
    );

    // ---- light ----------------------------------------------------------
    vec3 light = normalize(lightDirection);
    float incidence = dot(normal, light);
    float day = smoothstep(-0.07, 0.24, incidence);
    // Sunlight reddens as it grazes the terminator and travels through more
    // air. This narrow warm band is most of what sells a lit sphere.
    float terminator = smoothstep(-0.26, 0.04, incidence) *
      (1.0 - smoothstep(0.02, 0.42, incidence));

    vec3 sunlight = vec3(1.0, 0.955, 0.90);
    // Glowing rock is its own light source; adding a full sunlit term on top
    // of the emission below is what flattens a magma ocean into a beige ball.
    vec3 colour = albedo * sunlight * day * 1.18 * (1.0 - molten * 0.52);
    colour += albedo * atmosphereColour * day * 0.11 * atmosphereDensity;
    colour += albedo * vec3(1.0, 0.45, 0.19) * terminator * 0.34;
    // Never fully black: starlight and the rest of the sky reach the night.
    colour += albedo * vec3(0.05, 0.07, 0.11) * 0.30;

    // Sun glint. Rough seas spread the reflection into a wide sheen; calm
    // ones concentrate it into the small bright disc you actually see.
    float roughness = mix(0.055, 0.46, oceanRoughness);
    float glintPower = 2.0 / (roughness * roughness) - 2.0;
    vec3 halfway = normalize(light + view);
    float glint = pow(max(dot(normal, halfway), 0.0), glintPower);
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(normal, view), 0.0), 5.0);
    colour += sunlight * glint * ocean * smoothstep(0.0, 0.28, incidence) *
      (1.0 - heat * 0.8) * (0.25 + fresnel) * 1.1;

    // Molten rock lights itself, so it survives into the night side. Only the
    // open melt glows; the crust between it stays dark, which is what gives
    // the surface its contrast.
    colour += magma * exposedMelt * 0.8;
    colour += vec3(1.0, 0.72, 0.26) * fissure * molten * 1.0;

    // City lights. The source map has a noisy near-black floor that turns into
    // blue-grey blocks the moment it is amplified, so take it as a brightness
    // and gate the floor away rather than adding its colour directly. Sodium
    // and LED lighting is warm anyway, which the raw map does not capture.
    float night = 1.0 - smoothstep(-0.16, 0.07, incidence);
    vec3 lampSample = texture2D(nightMap, vUv).rgb;
    float lamps = smoothstep(0.14, 0.58, max(max(lampSample.r, lampSample.g), lampSample.b));
    colour += vec3(1.0, 0.80, 0.48) * lamps * nightLights * referenceMap * night * 1.7;

    // ---- clouds ---------------------------------------------------------
    // Skipped on airless worlds and on the present, which has a real cloud
    // photograph — nine noise evaluations either way.
    float proceduralCloud = 0.0;
    if (cloudCover > 0.004 && referenceMap < 0.999) {
      vec3 cloudPoint = rotateY(surfacePoint, cloudDrift) * 2.3;
      float cloudBase = fbm5(cloudPoint) * 0.5 + 0.5;
      float wisps = fbm4(cloudPoint * 2.7 + 13.0) * 0.5 + 0.5;
      float bands = abs(sin((surfacePoint.y + cloudBase * 0.12) * 7.0));
      float density = cloudBase * 0.58 + wisps * 0.33 + bands * 0.09;
      // density averages about 0.51 with a fairly tight spread, so the useful
      // range of thresholds is narrow and sits just above that: a little too
      // low and the whole planet roofs over.
      float threshold = 0.62 - cloudCover * 0.22;
      proceduralCloud = smoothstep(threshold, threshold + 0.12, density) *
        clamp(cloudCover * 1.7, 0.0, 0.95) *
        (1.0 - smoothstep(0.88, 1.02, latitude));
    }
    // The cloud map is a white palette with the deck carried in alpha, so the
    // mask is .a — .r is white everywhere and would roof the whole sky over.
    //
    // The drift offset must not be wrapped with fract(). The texture already
    // repeats in hardware, and fract() puts a step in the coordinate that the
    // sampler reads as an enormous derivative, so it drops to the smallest mip
    // for that column and draws a blurred seam straight down the planet.
    float photographCloud = texture2D(
      cloudMap,
      vec2(vUv.x + cloudDrift * 0.04, vUv.y)
    ).a;
    float cloud = mix(proceduralCloud, photographCloud, referenceMap);
    cloud = clamp(cloud, 0.0, 1.0);

    // Cloud shadow first, then the cloud deck over the top of it.
    colour *= 1.0 - cloud * 0.34 * day;
    // Steam and ash take the colour of the sky they hang in, so a Hadean
    // world gets orange cloud rather than the white deck Earth has today.
    vec3 cloudBody = mix(vec3(1.0, 0.99, 0.98), atmosphereColour, 0.16 + heat * 0.44);
    vec3 cloudColour = cloudBody * (day * 1.12 + 0.05) * (1.0 - heat * 0.34);
    cloudColour += vec3(1.0, 0.52, 0.28) * terminator * 0.42;
    colour = mix(colour, cloudColour, cloud * (0.45 + day * 0.55));

    // ---- air over the disc ----------------------------------------------
    // Scattering thickens toward the limb, and only where the Sun reaches it.
    float limb = pow(1.0 - max(dot(normal, view), 0.0), 3.2);
    float limbLight = smoothstep(-0.32, 0.30, incidence);
    colour += atmosphereColour * limb * limbLight * atmosphereDensity * 0.62;
    colour += vec3(1.0, 0.48, 0.22) * limb * terminator * atmosphereDensity * 0.30;

    gl_FragColor = vec4(colour, globeOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const MOON_VERTEX_SHADER = /* glsl */ `
  varying vec3 vSurface;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  void main() {
    vSurface = normalize(position);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewNormal = normalize(normalMatrix * normal);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

// The Moon is lit by the same uniform as the planet, which is the whole point
// of moving it out of CSS: a gradient can imply a light source but it cannot
// agree with one. What it must *not* share is the soft terminator — the Moon
// has no atmosphere to scatter light around its own limb, so its day/night
// line is nearly a hard edge, and that contrast is most of what makes the two
// read as different kinds of body rather than two shaded circles.
export const MOON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 lightDirection;
  uniform float moonOpacity;
  uniform float moonHeat;

  varying vec3 vSurface;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  ${SIMPLEX_NOISE}
  ${NOISE_FIELDS}

  void main() {
    vec3 surfacePoint = normalize(vSurface);

    // The Moon is only ever a few dozen pixels across, so its detail sits much
    // closer to the resolution limit than the planet's and needs a wider fade
    // to stop the crater field boiling into speckle.
    float pixelSpan = length(fwidth(surfacePoint));
    float fineDetail = 1.0 - smoothstep(0.010, 0.075, pixelSpan);

    // Maria: the dark basalt plains that cover one face and almost none of
    // the other, which is why the Moon looks blotchy rather than evenly
    // speckled.
    float maria = smoothstep(0.44, 0.78, fbm3(surfacePoint * 1.6 + 4.0) * 0.5 + 0.5);
    // Deliberately coarse. The Moon is about ninety pixels across here, so a
    // real crater is one or two pixels wide — drawing that field honestly
    // just produces static, and static is what the eye notices. These are
    // basin-scale features, which is the largest thing that actually resolves.
    float basins = pow(ridged2(surfacePoint * 2.6 + 1.0), 2.5);
    float dust = fbm3(surfacePoint * 5.0) * 0.5 + 0.5;

    // Lunar rock is genuinely dark — about the reflectance of worn asphalt.
    // It only looks white because it is normally seen against a night sky,
    // and here it sits beside an Earth that reflects three times as much, so
    // painting it bright grey makes it read as a lamp rather than a rock.
    vec3 highland = vec3(0.42, 0.405, 0.375);
    vec3 mare = vec3(0.20, 0.195, 0.19);
    vec3 albedo = mix(highland, mare, maria * 0.85);
    albedo *= 0.88 + dust * 0.20 * fineDetail;
    albedo = mix(albedo, albedo * 1.20, basins * 0.5 * fineDetail);

    float relief = basins * 0.55 + (1.0 - maria) * 0.28;
    vec3 view = normalize(-vViewPosition);
    float facing = max(dot(vViewNormal, view), 0.0);
    float bumpFade = smoothstep(0.10, 0.42, facing);
    vec2 slope = clamp(
      vec2(dFdx(relief), dFdy(relief)) * 2.6,
      vec2(-0.30),
      vec2(0.30)
    );
    vec3 normal = normalize(vViewNormal + vec3(-slope.x, slope.y, 0.0) * bumpFade);

    vec3 light = normalize(lightDirection);
    float incidence = dot(normal, light);
    // Sharper than Earth, which has no air to scatter light past its own
    // limb — but not arbitrarily sharp: screen-space derivatives are computed
    // per 2x2 quad, so a hard ramp over a bumped normal staircases into
    // visible blocks along the terminator.
    float day = smoothstep(-0.05, 0.15, incidence);
    vec3 colour = albedo * vec3(1.0, 0.985, 0.96) * day * 1.32;
    // Earthshine. The planet next door is a bright blue light source, which is
    // why the dark part of a crescent Moon is visible at all.
    colour += albedo * vec3(0.10, 0.13, 0.20) * 0.55;

    // Heated by the expanding Sun, on the same threshold the CSS version used.
    //
    // Tinting the lit surface orange is not enough, for two reasons that both
    // bite here. It pushes the channels past 1.0, where a filmic tone curve
    // desaturates them straight back to cream; and by this point the Moon is
    // seen against the red giant's own disc, so a warm surface has nothing to
    // contrast with. Hot rock has to be dark rock with light coming out of it.
    float heatGlow = clamp((moonHeat - 0.58) * 1.9, 0.0, 1.0);
    vec3 scorchedRock = mix(vec3(0.15, 0.09, 0.07), vec3(0.28, 0.17, 0.13), dust);
    colour = mix(colour, scorchedRock * (0.30 + day * 0.85), heatGlow);

    // Incandescence, pooling in the maria — they are the low basalt plains, so
    // they are where melt would collect — and threading along the basin rims.
    // Added rather than mixed, and independent of the daylight term, so it
    // survives on to the night side: that is the difference between a lit
    // Moon and a hot one.
    vec3 ember = mix(vec3(0.95, 0.19, 0.03), vec3(1.0, 0.60, 0.15), dust);
    float embers = heatGlow * (0.14 + maria * 0.52 + pow(basins, 2.0) * 0.45);
    colour += ember * embers * 0.95;

    gl_FragColor = vec4(colour, moonOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const HALO_VERTEX_SHADER = /* glsl */ `
  varying vec3 vViewPosition;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

// The halo is drawn on an oversized proxy sphere, but its shape comes from
// ray geometry rather than from that mesh: for each fragment we work out how
// far the view ray passes from the planet's centre. That anchors the glow to
// the planet's own edge and lets it fall off smoothly outward, instead of
// ringing the proxy sphere's silhouette with a hard grey band.
export const HALO_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 planetCentre;
  uniform vec3 lightDirection;
  uniform vec3 atmosphereColour;
  uniform float atmosphereDensity;
  uniform float globeOpacity;
  uniform float haloWidth;

  varying vec3 vViewPosition;

  void main() {
    vec3 ray = normalize(vViewPosition);
    float along = dot(planetCentre, ray);
    vec3 closest = ray * along;
    // Distance from the planet's centre to the view ray, in planet radii.
    float missDistance = length(closest - planetCentre);

    float outer = 1.0 + haloWidth;
    float falloff = 1.0 - smoothstep(1.0, outer, missDistance);
    falloff = pow(falloff, 2.6);
    // Hide the part of the shell that lies over the planet itself; the disc
    // gets its own scattering from the surface shader.
    falloff *= smoothstep(0.988, 1.02, missDistance);

    vec3 limbNormal = normalize(closest - planetCentre);
    vec3 light = normalize(lightDirection);
    float incidence = dot(limbNormal, light);
    float lit = smoothstep(-0.42, 0.26, incidence);
    float terminator = smoothstep(-0.34, 0.02, incidence) *
      (1.0 - smoothstep(0.0, 0.46, incidence));

    vec3 tint = mix(atmosphereColour, vec3(1.0, 0.55, 0.28), terminator * 0.55);
    float alpha = falloff * lit * atmosphereDensity * globeOpacity;

    gl_FragColor = vec4(tint * (0.85 + lit * 0.5), alpha * 0.9);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
