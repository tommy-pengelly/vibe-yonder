// Demo social content for the Feed's Following + Community tabs.
//
// IMPORTANT: this is FABRICATED placeholder data — fake explorers, captions,
// grub counts, and collections — lifted from the design kit so the social home
// feels alive before the real Doc 3 backend (follows, grubs, public yonders,
// privacy/obfuscation) exists. Nothing here is persisted or networked. When the
// social backend lands, replace these arrays with real queries.
//
// On-brand: you share *places* + an obfuscated trace memento, never a route.
// "Grubs" are the one-tap kudos. No comments, no leaderboards.

export type DemoDest = { name: string; lat: number; lon: number };

export type DemoYonder = {
  id: string;
  who: string;
  handle: string;
  when: string;
  caption: string | null;
  area: string;
  walked: number;
  mins: number;
  places: number;
  yondered: number;
  trace: number;
  grubs: number;
  grubbed: boolean;
  /** Representative destination so "Yonder this" can start a real walk. */
  dest: DemoDest;
};

export type DemoMap = {
  id: string;
  name: string;
  who: string;
  places: number;
  yonderedBy: number;
  grubs: number;
  dots: number;
  grubbed: boolean;
  destinations: DemoDest[];
};

// Organic wander traces authored in a 100x100 box — decorative mementos, scaled
// into any thumbnail with edge-fade. Never a path to follow.
export const TRACES = [
  "M22 80 C 10 52 42 44 34 27 C 28 13 60 14 70 32 C 80 50 58 60 73 79 C 82 92 40 95 22 80 Z",
  "M16 84 C 42 76 30 50 56 47 C 80 44 68 22 86 16 C 92 13 96 26 90 33",
  "M26 78 C 12 60 32 44 23 29 C 17 19 42 14 53 27 C 67 42 49 58 67 65 C 83 72 69 89 49 84",
  "M18 70 C 36 67 27 43 49 39 C 71 35 57 17 81 21 C 93 23 86 45 73 51 C 59 58 73 72 54 81",
  "M20 30 C 44 26 36 52 58 56 C 82 60 70 84 50 82 C 30 80 40 58 24 52 C 12 47 14 36 28 34",
];

// Scatter patterns for collection (map) previews — places, no trace.
export const DOTS: Array<Array<[number, number]>> = [
  [[28, 34], [62, 26], [44, 58], [74, 64], [34, 76]],
  [[30, 40], [58, 36], [48, 66]],
  [[24, 30], [70, 34], [40, 50], [66, 70]],
];

export const FOLLOWING: DemoYonder[] = [
  {
    id: "fy1", who: "Maya", handle: "@mayawanders", when: "2h ago",
    caption: "Took the long way past the ponds. No idea where I was for a while — perfect.",
    area: "near Highgate Wood", walked: 2640, mins: 52, places: 3, yondered: 6.4,
    trace: 0, grubs: 14, grubbed: false,
    dest: { name: "Highgate Wood", lat: 51.5773, lon: -0.143 },
  },
  {
    id: "fy2", who: "Tomás", handle: "@tomonfoot", when: "5h ago",
    caption: null, area: "near Camden Lock", walked: 1180, mins: 26, places: 1, yondered: 2.1,
    trace: 1, grubs: 6, grubbed: false,
    dest: { name: "Camden Lock", lat: 51.5414, lon: -0.146 },
  },
  {
    id: "fy3", who: "Priya", handle: "@priyarambles", when: "Yesterday",
    caption: "Got gloriously lost between five pubs. Counted it as research.",
    area: "near Hampstead", walked: 4120, mins: 88, places: 5, yondered: 9.7,
    trace: 2, grubs: 31, grubbed: true,
    dest: { name: "The Holly Bush", lat: 51.5571, lon: -0.1791 },
  },
  {
    id: "fy4", who: "Idris", handle: "@idris.j", when: "2 days ago",
    caption: "Beelined it for once. Felt wrong.",
    area: "near Parliament Hill", walked: 1610, mins: 24, places: 1, yondered: 1.0,
    trace: 3, grubs: 3, grubbed: false,
    dest: { name: "Parliament Hill", lat: 51.5594, lon: -0.1503 },
  },
];

export const COMMUNITY_YONDERS: DemoYonder[] = [
  {
    id: "cy1", who: "Wren", handle: "@wren", when: "1h ago",
    caption: "Spiralled out from the market and let the side streets decide.",
    area: "near Borough", walked: 3380, mins: 71, places: 4, yondered: 8.2,
    trace: 4, grubs: 47, grubbed: false,
    dest: { name: "Borough Market", lat: 51.5055, lon: -0.0911 },
  },
  {
    id: "cy2", who: "Sol", handle: "@solseeker", when: "3h ago",
    caption: "Every dead end was a gift.",
    area: "near Greenwich", walked: 2210, mins: 49, places: 2, yondered: 5.5,
    trace: 0, grubs: 22, grubbed: false,
    dest: { name: "Greenwich Park", lat: 51.4769, lon: -0.0005 },
  },
];

export const COMMUNITY_MAPS: DemoMap[] = [
  {
    id: "cm1", name: "The pub crawl, slowly", who: "@priyarambles",
    places: 5, yonderedBy: 23, grubs: 38, dots: 0, grubbed: false,
    destinations: [
      { name: "The Spaniards Inn", lat: 51.5713, lon: -0.1779 },
      { name: "The Holly Bush", lat: 51.5571, lon: -0.1791 },
      { name: "The Flask", lat: 51.5707, lon: -0.1476 },
      { name: "The Southampton Arms", lat: 51.5556, lon: -0.1428 },
      { name: "The Bull & Last", lat: 51.5556, lon: -0.1481 },
    ],
  },
  {
    id: "cm2", name: "Hidden gardens of N6", who: "@mayawanders",
    places: 4, yonderedBy: 11, grubs: 17, dots: 2, grubbed: false,
    destinations: [
      { name: "Waterlow Park", lat: 51.5685, lon: -0.1417 },
      { name: "Highgate Cemetery", lat: 51.5669, lon: -0.1465 },
      { name: "Pond Square", lat: 51.5715, lon: -0.1472 },
      { name: "Lauderdale House", lat: 51.5697, lon: -0.1436 },
    ],
  },
  {
    id: "cm3", name: "Riverside detours", who: "@wren",
    places: 3, yonderedBy: 41, grubs: 52, dots: 1, grubbed: false,
    destinations: [
      { name: "Gabriel's Wharf", lat: 51.5081, lon: -0.1106 },
      { name: "Bankside", lat: 51.5076, lon: -0.0994 },
      { name: "Borough Market", lat: 51.5055, lon: -0.0911 },
    ],
  },
];

export function fmtYondered(v: number): string {
  return v >= 10 ? Math.round(v).toString() : v.toFixed(v >= 2 ? 1 : 2);
}
