/**
 * Takes recorded before the wall plant existed replay without it. An X pressed
 * in the air beside a wall was a double jump, a board eject or nothing at all
 * then, and it has to stay exactly that for the take to reproduce.
 */
let legacyReplay = false;
export function setLegacyWallPlantReplay(value: boolean): void { legacyReplay = value; }
export function legacyWallPlantReplay(): boolean { return legacyReplay; }
