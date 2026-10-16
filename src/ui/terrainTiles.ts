// Visual identity per terrain tile (v0.3 palette + legacy engine aliases).
// The on-board tile shows only art (a 64px painterly tile from /public/tiles);
// the collapsible legend pairs each swatch with its name and rules blurb.
// Colours are CSS custom properties (see theme.css).
export interface TerrainTileVisual {
  glyph: string;
  label: string;
  /** CSS class suffix: tile-terrain-<cls> (semantic hook only). */
  cls: string;
  blurb: string;
  /** Tile art under /public/tiles (optional; `color` is the fallback). */
  tile?: string;
  /** Fallback colour (a CSS colour/var) if the tile image is missing. */
  color: string;
}

const V = (
  glyph: string,
  label: string,
  cls: string,
  blurb: string,
  tile: string | undefined,
  color: string,
): TerrainTileVisual => ({ glyph, label, cls, blurb, tile, color });

const WALL = V("🧱", "wall", "wall", "Blocks movement and sight.", "/tiles/rock_wall.png", "var(--terrain-wall)");
const ROCKS = V("🪨", "rocks", "rocks", "Earth source: earth techs +1.", "/tiles/rocky_terrain.png", "var(--terrain-rocks)");
const POND = V("💧", "pond", "pond", "Water source + difficult (2 to enter).", "/tiles/water.png", "var(--terrain-pond)");
const BLAZE = V("🔥", "blaze", "blaze", "Ignited woodland. Hazard: 1 damage on entry.", "/tiles/burning_forest.png", "var(--terrain-blaze)");
const ASH = V("🌋", "ash", "ash", "Fire source (burnt-out blaze).", "/tiles/ashes.png", "var(--terrain-ash)");
const ICE = V("🧊", "ice", "ice", "Difficult + counts as water source.", "/tiles/frozen_water.png", "var(--terrain-ice)");
const GRASS = V("🌾", "grass", "grass", "Cover −1 vs. ranged. Can be ignited.", "/tiles/plains_meadows.png", "var(--terrain-grass)");
const FOREST = V("🌲", "forest", "forest", "Dense. Can be ignited into blaze.", "/tiles/forest.png", "var(--terrain-forest)");
const ROAD = V("🛣", "road", "road", "Open road. Non-benders may travel here (later).", "/tiles/dirt_road.png", "var(--terrain-road)");
const PLAINS = V("", "plains", "plains", "Open ground.", "/tiles/plains_meadows.png", "var(--terrain-plains)");
// No smoke tile art was supplied; smoke keeps a plain fallback colour.
const SMOKE = V("💨", "smoke", "smoke", "Blocks sight, not movement. Disperses.", undefined, "var(--terrain-smoke)");

export const TERRAIN_TILE_VISUALS: Record<string, TerrainTileVisual> = {
  // v0.3 palette (rules doc + spec amendment)
  plains: PLAINS,
  grass: GRASS,
  road: ROAD,
  pond: POND,
  rocks: ROCKS,
  forest: FOREST,
  wall: WALL,
  ice: ICE,
  blaze: BLAZE,
  ash: ASH,
  smoke: SMOKE,
  // Legacy engine ids (content/terrain.ts) reuse the closest visual
  "rock-wall": WALL,
  rubble: { ...ROCKS, label: "rubble", blurb: "Difficult (2 to enter)." },
  "water-source": { ...POND, label: "water" },
  bonfire: { ...BLAZE, label: "fire" },
  "ember-field": { ...ASH, label: "embers", blurb: "Hazard: 1 at end of round." },
  cover: { ...GRASS, label: "cover" },
};

/** Ordered palette used by the collapsible terrain legend. */
export const TERRAIN_LEGEND: TerrainTileVisual[] = [
  PLAINS,
  GRASS,
  ROAD,
  POND,
  ROCKS,
  FOREST,
  WALL,
  ICE,
  BLAZE,
  ASH,
  SMOKE,
];

export function terrainVisual(terrainId: string): TerrainTileVisual | undefined {
  return TERRAIN_TILE_VISUALS[terrainId];
}
