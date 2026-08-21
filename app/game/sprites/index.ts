// The tank needs fifteen visually distinct creatures and the project ships art for
// two. Rather than fake it with emoji, everything is rasterised here at true pixel
// resolution (44×30 per creature) and blown up 4× with nearest sampling, so the
// result is honest chunky pixel art rather than a smooth vector shape pretending.

export { FISH_CELL, buildFishAtlas, speciesPortrait, type Atlas } from "./fishAtlas";
export { PROP_KEYS, buildPropAtlas, type PropKey, type PropAtlas } from "./props";
export { PLANT_VARIANTS, buildPlantAtlas, type PlantAtlas } from "./plants";
export { buildCursor, type CursorSprite } from "./cursor";
export { Pix, alpha, hex, mix, type RGBA } from "./raster";
