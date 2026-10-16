// Map registry: every playable grid. The demo UI cycles through MAPS in order;
// the engine loads the selected grid at match start (see createTestMapTerrain).
import demoGrid from "./demo.grid.txt?raw";
import crossroadsGrid from "./crossroads.grid.txt?raw";
import emberwoodGrid from "./emberwood.grid.txt?raw";
import courtyardGrid from "./courtyard.grid.txt?raw";
import mirrorLakesGrid from "./mirror-lakes.grid.txt?raw";
import emberScarGrid from "./ember-scar.grid.txt?raw";

export interface GameMap {
  id: string;
  name: string;
  blurb: string;
  grid: string;
}

export const MAPS: GameMap[] = [
  {
    id: "demo",
    name: "Demo",
    blurb: "The original: vertical road, forest patch, ponds and walls. Deliberately not symmetric.",
    grid: demoGrid,
  },
  {
    id: "crossroads",
    name: "Crossroads",
    blurb: "Two roads cross at the center; ponds and rocks watch the corners. Fully symmetric.",
    grid: crossroadsGrid,
  },
  {
    id: "emberwood",
    name: "Emberwood",
    blurb: "A great forest split by a road. One spark and midfield burns. Symmetric.",
    grid: emberwoodGrid,
  },
  {
    id: "courtyard",
    name: "Courtyard",
    blurb: "A ruined walled courtyard around a forest heart. Tight and tactical. Symmetric.",
    grid: courtyardGrid,
  },
  {
    id: "mirror-lakes",
    name: "Mirror Lakes",
    blurb: "Twin lakes in 180° rotational symmetry. The water map.",
    grid: mirrorLakesGrid,
  },
  {
    id: "ember-scar",
    name: "Ember Scar",
    blurb: "An old burn scars midfield: pre-placed ash and rock outcrops. Symmetric.",
    grid: emberScarGrid,
  },
];

/** Look up a map by id; unknown ids fall back to the demo grid. */
export function getMap(id: string): GameMap {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
