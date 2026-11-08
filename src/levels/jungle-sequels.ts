import { TEMPLE_OF_EMBERS_ROUTE } from './temple-of-embers';
export type { TempleRoute, TemplePipe, TempleGap, TempleRoom, TempleClimb, TempleVoid, TempleChapter, TempleSetPieces } from './temple-of-embers';

// Jungle Ruins' playable temple terrace is 11.5m high. Temple of Embers climbs
// four storeys above it; geometry and movement tuning are separate.
export const JUNGLE_ORIGINAL_TERRACE = 11.5;
/** Temple of Embers keeps the campaign's `jungle-terraces` id. */
export const JUNGLE_TERRACES_ROUTE = TEMPLE_OF_EMBERS_ROUTE;
export const JUNGLE_TERRACES_LEVEL = JUNGLE_TERRACES_ROUTE.data;
export const JUNGLE_SEQUEL_ROUTES = [JUNGLE_TERRACES_ROUTE] as const;
