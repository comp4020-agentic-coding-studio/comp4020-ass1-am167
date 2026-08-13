// Listed rather than declared as a bare union so the renderer can prove it
// handles every mode at run time, not only at compile time.
export const PLANET_MODES = [
  "molten",
  "archean",
  "oxygen",
  "snowball",
  "paleozoic",
  "mesozoic",
  "impact",
  "ice-age",
  "temperate",
  "present",
  "dry",
  "red-giant",
  "remnant",
] as const;

export type PlanetMode = (typeof PLANET_MODES)[number];

export interface EraVisual {
  mode: PlanetMode;
  background: string;
  surface: string;
  ocean: string;
  land: string;
  detail: string;
  atmosphere: string;
  glow: string;
  cloudCover: number;
  iceCover: number;
  oceanCover: number;
  heat: number;
  sun: number;
  sunSize?: number;
  opacity: number;
}

export interface TimelineEra {
  id: string;
  scroll: number;
  millionYearsFromNow: number;
  date: string;
  shortDate: string;
  period: string;
  title: string;
  description: string;
  visual: EraVisual;
}

export interface TimelineState {
  from: TimelineEra;
  to: TimelineEra;
  active: TimelineEra;
  activeIndex: number;
  mix: number;
  millionYearsFromNow: number;
  progress: number;
}

const CORE_TIMELINE: readonly TimelineEra[] = [
  {
    id: "formation",
    scroll: 0,
    millionYearsFromNow: -4540,
    date: "4.54 billion years ago",
    shortDate: "4.54 BYA",
    period: "Hadean Eon",
    title: "Earth begins in fire.",
    description:
      "Dust and rock collide until a planet takes shape. Impacts keep the young surface molten, glowing beneath an atmosphere of vapour and debris.",
    visual: {
      mode: "molten",
      background: "#120706",
      surface: "#32100c",
      ocean: "#4d160d",
      land: "#7a2513",
      detail: "#ffb247",
      atmosphere: "#ff784a",
      glow: "#ff6a32",
      cloudCover: 0.1,
      iceCover: 0,
      oceanCover: 0,
      heat: 1,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "first-oceans",
    scroll: 0.16,
    millionYearsFromNow: -3800,
    date: "3.8 billion years ago",
    shortDate: "3.8 BYA",
    period: "Archean Eon",
    title: "The first oceans settle.",
    description:
      "Steam condenses over black volcanic crust. In these steel-grey seas, simple cells begin a story that will eventually remake the entire planet.",
    visual: {
      mode: "archean",
      background: "#0d0b0a",
      surface: "#1b2021",
      ocean: "#263d45",
      land: "#25201b",
      detail: "#8e4f2d",
      atmosphere: "#d2874e",
      glow: "#b9683d",
      cloudCover: 0.22,
      iceCover: 0,
      oceanCover: 0.72,
      heat: 0.38,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "oxygen",
    scroll: 0.34,
    millionYearsFromNow: -2400,
    date: "2.4 billion years ago",
    shortDate: "2.4 BYA",
    period: "Great Oxidation Event",
    title: "Life changes the sky.",
    description:
      "Cyanobacteria release oxygen faster than oceans and rocks can absorb it. Rust settles out of the seas and the orange haze slowly clears toward blue.",
    visual: {
      mode: "oxygen",
      background: "#07101a",
      surface: "#172b32",
      ocean: "#264f61",
      land: "#6e3f2e",
      detail: "#c77a45",
      atmosphere: "#83b7cd",
      glow: "#67a8c5",
      cloudCover: 0.18,
      iceCover: 0.04,
      oceanCover: 0.74,
      heat: 0.12,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "snowball",
    scroll: 0.52,
    millionYearsFromNow: -700,
    date: "700 million years ago",
    shortDate: "700 MYA",
    period: "Cryogenian Period",
    title: "Ice locks the planet.",
    description:
      "Runaway cooling turns Earth almost entirely white. Ice reaches the tropics, reflecting sunlight and holding the world in a deep freeze.",
    visual: {
      mode: "snowball",
      background: "#09121d",
      surface: "#bccbd1",
      ocean: "#7798a7",
      land: "#d5dcda",
      detail: "#f4fbff",
      atmosphere: "#b9e3f3",
      glow: "#a8dff5",
      cloudCover: 0.3,
      iceCover: 0.96,
      oceanCover: 0.76,
      heat: 0,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "life-ashore",
    scroll: 0.64,
    millionYearsFromNow: -470,
    date: "470 million years ago",
    shortDate: "470 MYA",
    period: "Palaeozoic Era",
    title: "Green reaches the shore.",
    description:
      "Small plants edge out of the water and begin covering bare continents. The change starts as a thin coastal fringe, then spreads inland.",
    visual: {
      mode: "paleozoic",
      background: "#06111a",
      surface: "#173a46",
      ocean: "#14566d",
      land: "#755c3d",
      detail: "#557746",
      atmosphere: "#73b8d6",
      glow: "#53a9ce",
      cloudCover: 0.28,
      iceCover: 0.08,
      oceanCover: 0.7,
      heat: 0,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "dinosaurs",
    scroll: 0.78,
    millionYearsFromNow: -230,
    date: "230 million years ago",
    shortDate: "230 MYA",
    period: "Mesozoic Era",
    title: "A warmer, greener Earth.",
    description:
      "Dinosaurs rise as Pangaea breaks apart. Forests reach toward ice-free poles while the continents drift into more familiar shapes.",
    visual: {
      mode: "mesozoic",
      background: "#05111b",
      surface: "#103948",
      ocean: "#0f5874",
      land: "#466b3c",
      detail: "#83a85a",
      atmosphere: "#70bfe2",
      glow: "#3eacd7",
      cloudCover: 0.25,
      iceCover: 0,
      oceanCover: 0.68,
      heat: 0.05,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "impact",
    scroll: 0.87,
    millionYearsFromNow: -66,
    date: "66 million years ago",
    shortDate: "66 MYA",
    period: "K–Pg Boundary",
    title: "The sky goes dark.",
    description:
      "An asteroid strikes near today’s Yucatán Peninsula. Fire, dust and soot circle the globe, ending the age of non-avian dinosaurs.",
    visual: {
      mode: "impact",
      background: "#0c0909",
      surface: "#17262a",
      ocean: "#193c46",
      land: "#4a5031",
      detail: "#ffcf74",
      atmosphere: "#a27656",
      glow: "#e89445",
      cloudCover: 0.68,
      iceCover: 0.02,
      oceanCover: 0.7,
      heat: 0.2,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "ice-ages",
    scroll: 0.905,
    millionYearsFromNow: -2.6,
    date: "2.6 million years ago",
    shortDate: "2.6 MYA",
    period: "Quaternary Period",
    title: "The ice advances and retreats.",
    description:
      "Orbital cycles pulse great ice sheets across the north. Between them, a small upright species learns to read the changing world.",
    visual: {
      mode: "ice-age",
      background: "#04101c",
      surface: "#123b50",
      ocean: "#0c5b7d",
      land: "#5b6841",
      detail: "#d9eced",
      atmosphere: "#77c8ed",
      glow: "#49b9ed",
      cloudCover: 0.38,
      iceCover: 0.34,
      oceanCover: 0.71,
      heat: 0,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "present",
    scroll: 0.93,
    millionYearsFromNow: 0,
    date: "Now",
    shortDate: "NOW",
    period: "The present moment",
    title: "A thin human moment.",
    description:
      "Oceans, clouds, forests and polar ice make the blue marble we know. All of recorded history occupies less than a pixel of this journey.",
    visual: {
      mode: "present",
      background: "#030c18",
      surface: "#0c3d57",
      ocean: "#08628a",
      land: "#47754a",
      detail: "#a7c77b",
      atmosphere: "#78d4ff",
      glow: "#39bfff",
      cloudCover: 0.46,
      iceCover: 0.16,
      oceanCover: 0.71,
      heat: 0,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "last-ocean",
    scroll: 0.955,
    millionYearsFromNow: 1500,
    date: "1.5 billion years from now",
    shortDate: "+1.5 BY",
    period: "Possible moist greenhouse",
    title: "Water begins climbing into the sky.",
    description:
      "In warmer model pathways, a steadily brighter Sun pushes water vapour high into the atmosphere, where sunlight can split it and hydrogen can escape. The exact onset remains uncertain.",
    visual: {
      mode: "dry",
      background: "#160b07",
      surface: "#6a3c24",
      ocean: "#315963",
      land: "#9a6136",
      detail: "#d19354",
      atmosphere: "#d9a36c",
      glow: "#e8954c",
      cloudCover: 0.48,
      iceCover: 0,
      oceanCover: 0.46,
      heat: 0.5,
      sun: 0,
      opacity: 1,
    },
  },
  {
    id: "red-giant",
    scroll: 0.985,
    millionYearsFromNow: 5000,
    date: "About 5 billion years from now",
    shortDate: "+5 BY",
    period: "Late main-sequence Sun",
    title: "The Sun’s long middle age ends.",
    description:
      "The Sun approaches the end of core hydrogen fusion and begins evolving away from the main sequence. Earth has long been sterile, dry and intensely hot.",
    visual: {
      mode: "dry",
      background: "#1d0a06",
      surface: "#2d110d",
      ocean: "#37130d",
      land: "#5d1e11",
      detail: "#ff6b2d",
      atmosphere: "#ff6d3e",
      glow: "#ff4c22",
      cloudCover: 0,
      iceCover: 0,
      oceanCover: 0,
      heat: 0.82,
      sun: 0.05,
      opacity: 1,
    },
  },
  {
    id: "after-earth",
    scroll: 1,
    millionYearsFromNow: 8000,
    date: "Roughly 8 billion years from now",
    shortDate: "+8 BY",
    period: "White dwarf era",
    title: "A white dwarf inherits the system.",
    description:
      "The Sun sheds its outer layers and leaves a hot white-dwarf core. Earth is either absent or a scorched remnant in a wider orbit; present models cannot yet choose with certainty.",
    visual: {
      mode: "remnant",
      background: "#070708",
      surface: "#08090a",
      ocean: "#08090a",
      land: "#121416",
      detail: "#39424a",
      atmosphere: "#dcecff",
      glow: "#c9e5ff",
      cloudCover: 0,
      iceCover: 0,
      oceanCover: 0,
      heat: 0.08,
      sun: 0.5,
      sunSize: 0.07,
      opacity: 0.18,
    },
  },
];

function visualFrom(
  eraId: string,
  overrides: Partial<EraVisual> = {},
): EraVisual {
  const source = CORE_TIMELINE.find((era) => era.id === eraId);
  if (!source) throw new Error(`Unknown visual source: ${eraId}`);
  return { ...source.visual, ...overrides };
}

const ADDITIONAL_TIMELINE: readonly TimelineEra[] = [
  {
    id: "moon-impact",
    scroll: 0.035,
    millionYearsFromNow: -4510,
    date: "4.51 billion years ago",
    shortDate: "4.51 BYA",
    period: "Moon-forming impact",
    title: "Two young worlds collide.",
    description:
      "A Mars-sized body often called Theia strikes the young Earth. Ejected rock gathers in orbit and becomes the Moon, while Earth melts almost completely again.",
    visual: visualFrom("formation", {
      mode: "impact",
      detail: "#fff0a6",
      glow: "#ff9b3d",
      heat: 1,
    }),
  },
  {
    id: "first-crust",
    scroll: 0.08,
    millionYearsFromNow: -4400,
    date: "4.4 billion years ago",
    shortDate: "4.4 BYA",
    period: "Early Hadean",
    title: "A crust begins to hold.",
    description:
      "The magma ocean cools enough for dark rock to survive at the surface. Steam and volcanic gases gather above a world that is still violently active.",
    visual: visualFrom("first-oceans", {
      oceanCover: 0.18,
      heat: 0.72,
      surface: "#211916",
      ocean: "#292424",
    }),
  },
  {
    id: "heavy-bombardment",
    scroll: 0.12,
    millionYearsFromNow: -4100,
    date: "About 4.1 billion years ago",
    shortDate: "4.1 BYA",
    period: "Heavy bombardment",
    title: "Impacts keep rewriting the surface.",
    description:
      "Asteroids and comets strike far more often than they do today. Each large collision excavates the young crust and briefly turns parts of the planet incandescent.",
    visual: visualFrom("first-oceans", {
      mode: "impact",
      cloudCover: 0.38,
      detail: "#f4a454",
      glow: "#e96b31",
      heat: 0.5,
    }),
  },
  {
    id: "first-life",
    scroll: 0.22,
    millionYearsFromNow: -3700,
    date: "At least 3.7 billion years ago",
    shortDate: "3.7 BYA",
    period: "Earliest life",
    title: "Chemistry becomes biology.",
    description:
      "The oldest evidence points to microbial life in the oceans. It leaves no green continents or visible animals—only a quiet change at the scale of cells.",
    visual: visualFrom("first-oceans", {
      oceanCover: 0.78,
      cloudCover: 0.24,
      heat: 0.24,
    }),
  },
  {
    id: "photosynthesis",
    scroll: 0.29,
    millionYearsFromNow: -3000,
    date: "Around 3 billion years ago",
    shortDate: "3 BYA",
    period: "Oxygenic photosynthesis",
    title: "Microbes learn to split water.",
    description:
      "Cyanobacteria use sunlight and release oxygen. For hundreds of millions of years, iron and other chemical sinks consume almost every molecule they make.",
    visual: visualFrom("oxygen", {
      background: "#0d1012",
      ocean: "#244550",
      atmosphere: "#b08361",
      glow: "#9c7258",
    }),
  },
  {
    id: "eukaryotes",
    scroll: 0.405,
    millionYearsFromNow: -1800,
    date: "Around 1.8 billion years ago",
    shortDate: "1.8 BYA",
    period: "First eukaryotes",
    title: "Cells become more complex.",
    description:
      "Some cells now carry nuclei and specialised internal machinery. This new architecture will eventually make animals, plants and fungi possible.",
    visual: visualFrom("oxygen", {
      ocean: "#245668",
      atmosphere: "#7dafc4",
      cloudCover: 0.22,
    }),
  },
  {
    id: "rodinia",
    scroll: 0.465,
    millionYearsFromNow: -1000,
    date: "About 1 billion years ago",
    shortDate: "1 BYA",
    period: "Supercontinent Rodinia",
    title: "The continents assemble.",
    description:
      "Most land converges into Rodinia. Its bare rock interior sits far from ocean moisture; plants have not yet arrived to soften the view from space.",
    visual: visualFrom("oxygen", {
      land: "#7a604c",
      detail: "#a4775c",
      oceanCover: 0.6,
      cloudCover: 0.2,
    }),
  },
  {
    id: "ediacaran",
    scroll: 0.565,
    millionYearsFromNow: -575,
    date: "575 million years ago",
    shortDate: "575 MYA",
    period: "Ediacaran Period",
    title: "Large life leaves a trace.",
    description:
      "Soft-bodied organisms spread across seafloors after the great freezes. Their quilted forms are the first abundant complex life large enough to see without a microscope.",
    visual: visualFrom("life-ashore", {
      mode: "oxygen",
      land: "#755b4a",
      detail: "#95705b",
      iceCover: 0.12,
      cloudCover: 0.3,
    }),
  },
  {
    id: "cambrian",
    scroll: 0.605,
    millionYearsFromNow: -538.8,
    date: "538.8 million years ago",
    shortDate: "539 MYA",
    period: "Cambrian explosion",
    title: "Animal life diversifies.",
    description:
      "Oceans fill with new body plans, shells, eyes and active predators. The continents remain mostly barren even as life below the water becomes dramatically richer.",
    visual: visualFrom("life-ashore", {
      mode: "oxygen",
      land: "#8a6347",
      detail: "#b57e58",
      ocean: "#155c73",
      iceCover: 0.02,
    }),
  },
  {
    id: "ordovician-extinction",
    scroll: 0.66,
    millionYearsFromNow: -443.8,
    date: "443.8 million years ago",
    shortDate: "444 MYA",
    period: "End-Ordovician extinction",
    title: "A sudden freeze empties the seas.",
    description:
      "Rapid glaciation lowers sea level and destroys shallow marine habitats. Most life is still ocean-bound, so the cooling triggers one of the five largest mass extinctions.",
    visual: visualFrom("snowball", {
      iceCover: 0.48,
      ocean: "#315e72",
      surface: "#7f9499",
      cloudCover: 0.4,
    }),
  },
  {
    id: "first-forests",
    scroll: 0.68,
    millionYearsFromNow: -385,
    date: "385 million years ago",
    shortDate: "385 MYA",
    period: "First forests",
    title: "Trees transform the land.",
    description:
      "Rooted forests spread across floodplains, building deeper soils and pulling carbon from the air. For the first time, large green regions become visible from space.",
    visual: visualFrom("life-ashore", {
      land: "#5b6842",
      detail: "#3e7b43",
      cloudCover: 0.32,
    }),
  },
  {
    id: "tetrapods",
    scroll: 0.695,
    millionYearsFromNow: -375,
    date: "Around 375 million years ago",
    shortDate: "375 MYA",
    period: "First tetrapods",
    title: "Vertebrates step onto land.",
    description:
      "Fish with sturdy fins and lungs begin moving through shallow wetlands and onto shore. Their descendants will include every amphibian, reptile, bird and mammal.",
    visual: visualFrom("life-ashore", {
      detail: "#4c8545",
      cloudCover: 0.35,
    }),
  },
  {
    id: "devonian-extinction",
    scroll: 0.71,
    millionYearsFromNow: -372,
    date: "About 372 million years ago",
    shortDate: "372 MYA",
    period: "Late Devonian extinction",
    title: "The oceans lose their breath.",
    description:
      "Repeated crises spread oxygen-poor water through the seas. Reef systems collapse and extinction arrives in pulses rather than one clean catastrophe.",
    visual: visualFrom("life-ashore", {
      ocean: "#183d43",
      atmosphere: "#7b9d9f",
      cloudCover: 0.5,
      heat: 0.16,
    }),
  },
  {
    id: "carboniferous",
    scroll: 0.73,
    millionYearsFromNow: -320,
    date: "320 million years ago",
    shortDate: "320 MYA",
    period: "Carboniferous Period",
    title: "Vast forests raise the oxygen.",
    description:
      "Swamp forests cover the tropics and bury enormous stores of carbon. Atmospheric oxygen climbs, supporting giant insects and frequent wildfire.",
    visual: visualFrom("life-ashore", {
      land: "#315e36",
      detail: "#6d9d4a",
      cloudCover: 0.42,
      oceanCover: 0.66,
    }),
  },
  {
    id: "pangaea",
    scroll: 0.75,
    millionYearsFromNow: -299,
    date: "299 million years ago",
    shortDate: "299 MYA",
    period: "Pangaea",
    title: "One continent, one ocean.",
    description:
      "Earth’s major landmasses lock together into Pangaea, surrounded by Panthalassa. Its enormous interior becomes dry and sharply seasonal.",
    visual: visualFrom("dinosaurs", {
      mode: "dry",
      land: "#816044",
      detail: "#a77b4f",
      oceanCover: 0.55,
      heat: 0.18,
    }),
  },
  {
    id: "great-dying",
    scroll: 0.765,
    millionYearsFromNow: -251.9,
    date: "251.9 million years ago",
    shortDate: "252 MYA",
    period: "The Great Dying",
    title: "Life nearly disappears.",
    description:
      "Enormous eruptions in Siberia drive extreme warming, acid rain and oxygen loss in the oceans. The end-Permian extinction is the most severe known in Earth’s history.",
    visual: visualFrom("dinosaurs", {
      mode: "dry",
      background: "#170a06",
      ocean: "#313b35",
      land: "#70412c",
      detail: "#dd6f35",
      atmosphere: "#b86e45",
      glow: "#d65b2f",
      cloudCover: 0.56,
      heat: 0.62,
    }),
  },
  {
    id: "first-mammals",
    scroll: 0.792,
    millionYearsFromNow: -225,
    date: "Around 225 million years ago",
    shortDate: "225 MYA",
    period: "First mammaliaforms",
    title: "Mammals enter the shadows.",
    description:
      "Small, mostly nocturnal mammal relatives appear while dinosaurs dominate the daylight. Their warm bodies and specialised teeth prepare them for later opportunities.",
    visual: visualFrom("dinosaurs", {
      cloudCover: 0.28,
      detail: "#73924f",
    }),
  },
  {
    id: "triassic-extinction",
    scroll: 0.81,
    millionYearsFromNow: -201.4,
    date: "201.4 million years ago",
    shortDate: "201 MYA",
    period: "End-Triassic extinction",
    title: "Volcanic carbon resets the world.",
    description:
      "Eruptions as the Atlantic begins to open destabilise climate and ocean chemistry. Many competitors vanish, leaving dinosaurs to dominate the Jurassic.",
    visual: visualFrom("dinosaurs", {
      mode: "dry",
      atmosphere: "#b47d59",
      glow: "#b45b35",
      cloudCover: 0.48,
      heat: 0.42,
    }),
  },
  {
    id: "pangaea-breaks",
    scroll: 0.825,
    millionYearsFromNow: -180,
    date: "180 million years ago",
    shortDate: "180 MYA",
    period: "Jurassic Period",
    title: "Pangaea tears apart.",
    description:
      "Rifts widen into young oceans as the supercontinent separates. The moving fragments begin their long journey toward today’s map.",
    visual: visualFrom("dinosaurs", {
      oceanCover: 0.63,
      land: "#547144",
      detail: "#789b55",
    }),
  },
  {
    id: "first-birds",
    scroll: 0.84,
    millionYearsFromNow: -150,
    date: "Around 150 million years ago",
    shortDate: "150 MYA",
    period: "First birds",
    title: "Dinosaurs take to the air.",
    description:
      "Feathered theropods evolve powered flight. Birds are not replacements for dinosaurs—they are the dinosaur lineage that will survive to the present.",
    visual: visualFrom("dinosaurs", {
      atmosphere: "#7cc6e2",
      cloudCover: 0.3,
    }),
  },
  {
    id: "flowering-plants",
    scroll: 0.852,
    millionYearsFromNow: -140,
    date: "Around 140 million years ago",
    shortDate: "140 MYA",
    period: "Flowering plants",
    title: "Flowers remake the continents.",
    description:
      "Flowering plants diversify alongside insect pollinators. They spread rapidly through forests and open habitats, changing food webs on land.",
    visual: visualFrom("dinosaurs", {
      land: "#3e7040",
      detail: "#8eb15a",
      cloudCover: 0.34,
    }),
  },
  {
    id: "mammal-radiation",
    scroll: 0.882,
    millionYearsFromNow: -55,
    date: "55 million years ago",
    shortDate: "55 MYA",
    period: "Mammals diversify",
    title: "Mammals fill the open world.",
    description:
      "After the impact winter, surviving mammals rapidly branch into new forms. Forests host early primates while whales begin returning to the sea.",
    visual: visualFrom("ice-ages", {
      iceCover: 0,
      land: "#477a43",
      detail: "#84a85d",
      heat: 0.1,
    }),
  },
  {
    id: "antarctic-ice",
    scroll: 0.892,
    millionYearsFromNow: -34,
    date: "34 million years ago",
    shortDate: "34 MYA",
    period: "Antarctic glaciation",
    title: "A permanent ice cap returns.",
    description:
      "Earth cools enough for a large Antarctic ice sheet to persist. The planet shifts from a greenhouse climate toward the icehouse state we inhabit today.",
    visual: visualFrom("ice-ages", {
      iceCover: 0.2,
      cloudCover: 0.34,
    }),
  },
  {
    id: "first-hominins",
    scroll: 0.9,
    millionYearsFromNow: -7,
    date: "Around 7 million years ago",
    shortDate: "7 MYA",
    period: "First hominins",
    title: "One ape lineage diverges.",
    description:
      "In Africa, the lineage leading to humans separates from that leading to chimpanzees and bonobos. Several hominin species will later share the world at once.",
    visual: visualFrom("ice-ages", {
      iceCover: 0.24,
      land: "#5a7545",
    }),
  },
  {
    id: "homo-sapiens",
    scroll: 0.917,
    millionYearsFromNow: -0.3,
    date: "About 300,000 years ago",
    shortDate: "300 KYA",
    period: "Homo sapiens",
    title: "Our species appears.",
    description:
      "Early Homo sapiens live in Africa among other human species. Much later, their descendants spread across every continent except Antarctica.",
    visual: visualFrom("ice-ages", {
      iceCover: 0.28,
      cloudCover: 0.42,
    }),
  },
  {
    id: "agriculture",
    scroll: 0.927,
    millionYearsFromNow: -0.012,
    date: "About 12,000 years ago",
    shortDate: "12 KYA",
    period: "Agriculture",
    title: "People begin reshaping ecosystems.",
    description:
      "Communities in several regions domesticate plants and animals. Farms, settlements and eventually cities concentrate a new geological force: human activity.",
    visual: visualFrom("present", {
      mode: "ice-age",
      iceCover: 0.18,
      cloudCover: 0.44,
    }),
  },
  {
    id: "next-supercontinent",
    scroll: 0.942,
    millionYearsFromNow: 250,
    date: "About 250 million years from now",
    shortDate: "+250 MY",
    period: "Next supercontinent",
    title: "The continents meet again.",
    description:
      "Plate motion gathers today’s continents into another supercontinent. Models disagree on its exact shape, but its vast interior is likely to be hot and dry.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0.48,
      heat: 0.38,
      land: "#895231",
      detail: "#b0703f",
    }),
  },
  {
    id: "last-total-eclipse",
    scroll: 0.949,
    millionYearsFromNow: 600,
    date: "More than 600 million years from now",
    shortDate: "+600 MY",
    period: "The last total solar eclipse",
    title: "The Moon no longer covers the Sun.",
    description:
      "The Moon’s slow retreat finally makes its disc too small to hide the whole Sun. Annular eclipses continue, but the moving shadow of totality has left Earth forever.",
    visual: visualFrom("present", {
      mode: "temperate",
      oceanCover: 0.69,
      iceCover: 0.02,
      land: "#68744a",
      detail: "#9ca86b",
      heat: 0.22,
    }),
  },
  {
    id: "dynamo-fades",
    scroll: 0.965,
    millionYearsFromNow: 2500,
    date: "Perhaps 2.5 billion years from now",
    shortDate: "+2.5 BY",
    period: "Fading geodynamo",
    title: "The inner engine may falter.",
    description:
      "As Earth’s deep interior cools, its magnetic dynamo may eventually weaken or stop. The timing is uncertain, but the remaining atmosphere would face harsher solar erosion.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0.05,
      surface: "#784327",
      land: "#9c5a32",
      atmosphere: "#aa7555",
      cloudCover: 0.08,
      heat: 0.7,
    }),
  },
  {
    id: "runaway-greenhouse",
    scroll: 0.975,
    millionYearsFromNow: 3500,
    date: "Around 3.5 billion years from now",
    shortDate: "+3.5 BY",
    period: "Runaway greenhouse",
    title: "Earth becomes Venus-like.",
    description:
      "With surface water gone, a thick hot atmosphere hides the ground beneath bright cloud. Any remaining familiar conditions vanish well before the Sun becomes a giant.",
    visual: visualFrom("last-ocean", {
      mode: "dry",
      background: "#1d1007",
      surface: "#9d703a",
      land: "#b98445",
      detail: "#e2b467",
      atmosphere: "#f3d18a",
      glow: "#e9a24d",
      cloudCover: 0.72,
      heat: 0.78,
    }),
  },
];

const FUTURE_TIMELINE: readonly TimelineEra[] = [
  {
    id: "next-glacial-inception",
    scroll: 0.936,
    millionYearsFromNow: 0.05,
    date: "Around 50,000 years from now",
    shortDate: "+50 KY",
    period: "Model-dependent glacial inception",
    title: "Ice may begin advancing again.",
    description:
      "Under natural carbon-cycle conditions, a new northern glaciation could begin around this time. Additional long-lived human carbon emissions could postpone it by tens of thousands of years.",
    visual: visualFrom("ice-ages", {
      iceCover: 0.3,
      cloudCover: 0.4,
      land: "#5d6c46",
    }),
  },
  {
    id: "east-african-ocean",
    scroll: 0.939,
    millionYearsFromNow: 10,
    date: "Perhaps 10 million years from now",
    shortDate: "+10 MY",
    period: "Possible continental rifting",
    title: "A new ocean may open in Africa.",
    description:
      "If today’s East African extension continues, seawater could enter a widening rift and separate the Somali Plate from the rest of Africa. Rift systems can also stall, so this remains a scenario.",
    visual: visualFrom("present", {
      mode: "temperate",
      oceanCover: 0.72,
      land: "#587b4b",
      detail: "#9bb877",
      heat: 0.04,
    }),
  },
  {
    id: "mediterranean-closes",
    scroll: 0.941,
    millionYearsFromNow: 50,
    date: "About 50 million years from now",
    shortDate: "+50 MY",
    period: "Projected plate motion",
    title: "The Mediterranean closes.",
    description:
      "Projecting present plate motions brings Africa into Europe and Australia into Southeast Asia. A long mountain belt may replace the Mediterranean while the Atlantic continues to widen.",
    visual: visualFrom("present", {
      mode: "temperate",
      oceanCover: 0.68,
      land: "#657a45",
      detail: "#a6a15f",
      heat: 0.08,
    }),
  },
  {
    id: "plate-boundaries-reset",
    scroll: 0.943,
    millionYearsFromNow: 100,
    date: "Around 100 million years from now",
    shortDate: "+100 MY",
    period: "One tectonic scenario",
    title: "The ocean conveyor reorganises.",
    description:
      "Beyond about 50 million years, plate forecasts become scenarios rather than straight projections. New subduction zones may reverse the Atlantic’s growth and redirect whole continents.",
    visual: visualFrom("dinosaurs", {
      oceanCover: 0.66,
      heat: 0.14,
      land: "#5d7240",
    }),
  },
  {
    id: "atlantic-narrows",
    scroll: 0.945,
    millionYearsFromNow: 200,
    date: "Perhaps 200 million years from now",
    shortDate: "+200 MY",
    period: "Pangea Proxima scenario",
    title: "The Atlantic may begin to vanish.",
    description:
      "In the Pangea Proxima scenario, subduction consumes Atlantic seafloor and draws the Americas back toward Africa and Europe. Other supercontinent pathways close different oceans instead.",
    visual: visualFrom("dinosaurs", {
      oceanCover: 0.56,
      land: "#745d3c",
      detail: "#8e8751",
      heat: 0.25,
    }),
  },
  {
    id: "brighter-sun-500",
    scroll: 0.948,
    millionYearsFromNow: 500,
    date: "About 500 million years from now",
    shortDate: "+500 MY",
    period: "A steadily brightening Sun",
    title: "Sunlight is roughly five per cent stronger.",
    description:
      "The ageing Sun brightens by about one per cent every 110 million years. Faster rock weathering removes more carbon dioxide, while warmer climates squeeze ice and temperate habitats.",
    visual: visualFrom("present", {
      mode: "temperate",
      oceanCover: 0.69,
      iceCover: 0.01,
      land: "#70784a",
      detail: "#9c9b5f",
      heat: 0.2,
    }),
  },
  {
    id: "sun-ten-percent-brighter",
    scroll: 0.952,
    millionYearsFromNow: 1000,
    date: "About 1 billion years from now",
    shortDate: "+1 BY",
    period: "Late habitable Earth",
    title: "The Sun is about ten per cent brighter.",
    description:
      "Extra sunlight accelerates silicate weathering and pulls carbon dioxide from the air. Earth is warmer, its carbon-starved biosphere less productive, and its familiar climate increasingly fragile.",
    visual: visualFrom("last-ocean", {
      mode: "dry",
      oceanCover: 0.6,
      land: "#77704b",
      detail: "#8b8052",
      cloudCover: 0.38,
      heat: 0.34,
    }),
  },
  {
    id: "oxygen-collapse",
    scroll: 0.954,
    millionYearsFromNow: 1080,
    date: "Around 1.08 billion years from now",
    shortDate: "+1.08 BY",
    period: "Atmospheric deoxygenation",
    title: "The oxygen-rich sky collapses.",
    description:
      "One coupled climate–biogeochemistry model places the atmosphere’s fall below one per cent of today’s oxygen here, before major surface-water loss. The air may again resemble the Archean.",
    visual: visualFrom("first-oceans", {
      oceanCover: 0.58,
      land: "#746247",
      detail: "#8e6a48",
      atmosphere: "#bd895f",
      glow: "#c48152",
      cloudCover: 0.28,
      heat: 0.38,
    }),
  },
  {
    id: "c4-threshold",
    scroll: 0.956,
    millionYearsFromNow: 1350,
    date: "Around 1.35 billion years from now",
    shortDate: "+1.35 BY",
    period: "Conventional plant limit",
    title: "Most familiar photosynthesis fails.",
    description:
      "Under a strong-weathering model, carbon dioxide reaches the conventional lower limit for C4 plants. Newer work suggests CAM plants and aquatic vegetation could endure at much lower concentrations.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0.52,
      land: "#75684b",
      detail: "#77714e",
      cloudCover: 0.4,
      heat: 0.44,
    }),
  },
  {
    id: "plant-heat-limit",
    scroll: 0.959,
    millionYearsFromNow: 1680,
    date: "Around 1.68 billion years from now",
    shortDate: "+1.68 BY",
    period: "Upper biosphere estimate",
    title: "Most land plants exceed their heat limit.",
    description:
      "In a weak-weathering model, global conditions cross 323 kelvin—the study’s limit for most land plants. Cooler coasts, high ground and unusual metabolisms may hold on longer.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0.34,
      land: "#8a6443",
      detail: "#8d7950",
      cloudCover: 0.42,
      heat: 0.57,
    }),
  },
  {
    id: "last-vegetation",
    scroll: 0.961,
    millionYearsFromNow: 1840,
    date: "Around 1.84 billion years from now",
    shortDate: "+1.84 BY",
    period: "Possible final vegetation",
    title: "Green survives only at the margins.",
    description:
      "With carbon dioxide near one part per million, specially adapted CAM plants or aquatic vegetation using bicarbonate could mark the last photosynthetic refuges in a rapidly warming world.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0.2,
      land: "#91603c",
      detail: "#766843",
      atmosphere: "#d59a65",
      cloudCover: 0.32,
      heat: 0.64,
    }),
  },
  {
    id: "land-plants-end",
    scroll: 0.963,
    millionYearsFromNow: 1870,
    date: "Around 1.87 billion years from now",
    shortDate: "+1.87 BY",
    period: "Maximum vegetative lifetime",
    title: "The last land plants disappear.",
    description:
      "At the hot end of a recent three-dimensional climate model, surface conditions pass 338 kelvin and exceed the assumed limit for every land plant. Microbial life may still remain.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0.15,
      land: "#9b6038",
      detail: "#a27649",
      atmosphere: "#d79a64",
      cloudCover: 0.28,
      heat: 0.68,
    }),
  },
  {
    id: "oceans-lost",
    scroll: 0.966,
    millionYearsFromNow: 2000,
    date: "Roughly 2 billion years from now",
    shortDate: "+2 BY",
    period: "Ocean loss",
    title: "The blue planet turns brown.",
    description:
      "By the upper end of current estimates, sustained water loss strips away the open oceans. Brief lakes fed from the crust may remain, but Earth’s global water cycle is ending.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0.025,
      surface: "#744125",
      land: "#a36638",
      detail: "#c5864a",
      atmosphere: "#bd815a",
      cloudCover: 0.1,
      heat: 0.72,
    }),
  },
  {
    id: "last-microbial-refuges",
    scroll: 0.971,
    millionYearsFromNow: 2800,
    date: "As late as 2.8 billion years from now",
    shortDate: "+2.8 BY",
    period: "Last possible biospheres",
    title: "Life retreats into its final refuges.",
    description:
      "One astrobiology model allows heat-tolerant microbes to persist in high mountains, polar remnants and cold-trap caves until this point. Beyond them, Earth becomes biologically silent.",
    visual: visualFrom("last-ocean", {
      oceanCover: 0,
      surface: "#7b4226",
      land: "#985631",
      detail: "#c57a42",
      atmosphere: "#9d694e",
      cloudCover: 0.04,
      heat: 0.76,
    }),
  },
  {
    id: "dry-cinder",
    scroll: 0.978,
    millionYearsFromNow: 4500,
    date: "About 4.5 billion years from now",
    shortDate: "+4.5 BY",
    period: "Sterile Earth",
    title: "Only a scorched planet remains.",
    description:
      "Long after the last life, the brighter Sun illuminates a dry, chemically altered surface. The planet still turns, but weather and biology no longer soften its rock.",
    visual: visualFrom("red-giant", {
      mode: "dry",
      surface: "#552116",
      land: "#78301c",
      detail: "#c6532a",
      atmosphere: "#bf5b35",
      cloudCover: 0.06,
      heat: 0.86,
      sun: 0.04,
    }),
  },
  {
    id: "core-hydrogen-ends",
    scroll: 0.984,
    millionYearsFromNow: 5400,
    date: "About 5.4 billion years from now",
    shortDate: "+5.4 BY",
    period: "Sun leaves the main sequence",
    title: "Core hydrogen runs out.",
    description:
      "Fusion shifts into a shell around an inert helium core. The core contracts, the Sun’s outer layers expand, and the slow transition toward a red giant accelerates.",
    visual: visualFrom("red-giant", {
      mode: "red-giant",
      sun: 0.45,
      heat: 0.9,
      glow: "#ff5b28",
    }),
  },
  {
    id: "sun-swells",
    scroll: 0.989,
    millionYearsFromNow: 6000,
    date: "Roughly 6 billion years from now",
    shortDate: "+6 BY",
    period: "Red giant ascent",
    title: "The Sun swells across the sky.",
    description:
      "The Sun becomes a true red giant, engulfing Mercury and Venus while its luminosity surges. Whether Earth’s widening orbit stays ahead of the stellar envelope is still disputed.",
    visual: visualFrom("red-giant", {
      mode: "red-giant",
      sun: 0.82,
      heat: 0.98,
      glow: "#ff3f1d",
      opacity: 0.88,
    }),
  },
  {
    id: "helium-ignites",
    scroll: 0.993,
    millionYearsFromNow: 6700,
    date: "Around 6.7 billion years from now",
    shortDate: "+6.7 BY",
    period: "Helium ignition",
    title: "The giant briefly contracts.",
    description:
      "Helium ignites in the solar core. The Sun settles into a smaller, hotter helium-burning phase for a comparatively brief interval before exhausting that fuel too.",
    visual: visualFrom("red-giant", {
      mode: "red-giant",
      background: "#170806",
      sun: 0.6,
      heat: 0.9,
      glow: "#ff7a3d",
      atmosphere: "#ff9b61",
      opacity: 0.72,
    }),
  },
  {
    id: "second-giant-ascent",
    scroll: 0.996,
    millionYearsFromNow: 7200,
    date: "Roughly 7.2 billion years from now",
    shortDate: "+7.2 BY",
    period: "Asymptotic giant branch",
    title: "The Sun expands a second time.",
    description:
      "With core helium spent, alternating hydrogen- and helium-shell burning drives a larger, pulsating giant. Strong stellar winds begin carrying much of the Sun into space.",
    visual: visualFrom("red-giant", {
      mode: "red-giant",
      background: "#300603",
      sun: 1,
      heat: 1,
      glow: "#ff2f16",
      opacity: 0.58,
    }),
  },
  {
    id: "earth-fate-uncertain",
    scroll: 0.998,
    millionYearsFromNow: 7590,
    date: "Around 7.59 billion years from now",
    shortDate: "+7.59 BY",
    period: "Earth’s uncertain fate",
    title: "The models divide here.",
    description:
      "Earlier tidal calculations place Earth inside the giant Sun near this time. Updated 2026 tides and observed mass-loss proxies instead favour a scorched Earth surviving in an expanding orbit; uncertainty remains.",
    visual: visualFrom("after-earth", {
      mode: "remnant",
      background: "#170604",
      surface: "#1c0b08",
      land: "#35120c",
      detail: "#8d3521",
      atmosphere: "#ff6640",
      glow: "#ff351c",
      heat: 0.78,
      sun: 0.9,
      sunSize: 0.9,
      opacity: 0.38,
    }),
  },
];

const PRESENT_SCROLL = 0.58;

function balanceTimeline(eras: readonly TimelineEra[]): readonly TimelineEra[] {
  const ordered = [...eras].sort(
    (left, right) => left.millionYearsFromNow - right.millionYearsFromNow,
  );
  const presentIndex = ordered.findIndex((era) => era.id === "present");
  const futureCount = ordered.length - presentIndex - 1;

  if (presentIndex <= 0 || futureCount <= 0) {
    throw new Error("Timeline requires formation, present and future events");
  }

  return ordered.map((era, index) => {
    const scroll =
      index <= presentIndex
        ? PRESENT_SCROLL * (index / presentIndex)
        : PRESENT_SCROLL +
          (1 - PRESENT_SCROLL) * ((index - presentIndex) / futureCount);

    return { ...era, scroll };
  });
}

export const TIMELINE: readonly TimelineEra[] = balanceTimeline([
  ...CORE_TIMELINE,
  ...ADDITIONAL_TIMELINE,
  ...FUTURE_TIMELINE,
]);

// The spine of the story: the eras the meter offers as jump targets. The other
// fifty stops stay decorative ticks — sixty-two controls would put that many
// tab stops between the wordmark and the conclusion, and land them roughly
// eight pixels apart on a rail that is only ever a few hundred pixels tall.
export const MILESTONE_ERA_IDS: ReadonlySet<string> = new Set(
  CORE_TIMELINE.map((era) => era.id),
);

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

// The photographic day, ocean, cloud and night-light maps are the only assets
// the page cannot generate in the browser, and only one era ever shows them.
// Fetching them at load makes the deep past pay for a texture set it never
// displays, so the request waits until the present is this far ahead — close
// enough that the maps are decoded before the planet needs them, far enough
// that a visitor who never reaches the present never pays for them at all.
const PRESENT_TEXTURE_LEAD = 0.08;

const PRESENT_TEXTURE_SCROLL =
  TIMELINE.find((era) => era.visual.mode === "present")?.scroll ?? 0;

export function shouldLoadPresentTextures(progress: number): boolean {
  return clampFraction(progress) >= PRESENT_TEXTURE_SCROLL - PRESENT_TEXTURE_LEAD;
}

export function stateForScrollFraction(fraction: number): TimelineState {
  const progress = clampFraction(fraction);
  const lastIndex = TIMELINE.length - 1;

  if (progress === 1) {
    const last = TIMELINE[lastIndex];
    return {
      from: last,
      to: last,
      active: last,
      activeIndex: lastIndex,
      mix: 0,
      millionYearsFromNow: last.millionYearsFromNow,
      progress,
    };
  }

  const toIndex = TIMELINE.findIndex((era) => era.scroll > progress);
  const fromIndex = Math.max(0, toIndex - 1);
  const from = TIMELINE[fromIndex];
  const to = TIMELINE[toIndex];
  const segmentLength = to.scroll - from.scroll;
  const rawMix = segmentLength === 0 ? 0 : (progress - from.scroll) / segmentLength;
  const activeIndex = rawMix < 0.5 ? fromIndex : toIndex;

  return {
    from,
    to,
    active: TIMELINE[activeIndex],
    activeIndex,
    mix: smoothstep(rawMix),
    millionYearsFromNow:
      from.millionYearsFromNow +
      (to.millionYearsFromNow - from.millionYearsFromNow) * rawMix,
    progress,
  };
}

export function timeForScrollFraction(fraction: number): number {
  return stateForScrollFraction(fraction).millionYearsFromNow;
}

/**
 * Strength for the Moon's orange heated overlay.
 * Past eras use Earth heat (impact/molten glow). Future eras track the
 * expanding Sun — not climate `heat`, which rises billions of years earlier.
 * Scaled so +5.4 BY (core-hydrogen-ends, sun ≈ 0.45) is a clear visible start
 * above the CSS glow threshold (~0.58).
 */
export function moonHeatFor(era: TimelineEra): number {
  if (era.millionYearsFromNow < 0) {
    return era.visual.heat;
  }
  return Math.min(1, era.visual.sun * (0.75 / 0.45));
}
