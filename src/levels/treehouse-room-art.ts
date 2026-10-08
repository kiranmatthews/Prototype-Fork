/** Each poster is its own image: replace the file or change only its entry here.
 * Keep URLs source-owned so editor imports cannot introduce external requests. */
export interface RoomArt { file: string; unlit?: boolean; cutout?: boolean; repeat?: boolean }
export const ROOM_ART: Record<string, RoomArt> = {
  'room-timber': { file: 'treehouse-room/timber.webp', repeat: true },
  'room-bark': { file: 'treehouse-room/bark.webp', repeat: true },
  'room-rug': { file: 'treehouse-room/rug.webp' },
  'room-poster-coast': { file: 'treehouse-room/posters/coast.webp' },
  'room-poster-canopy': { file: 'treehouse-room/posters/canopy.webp' },
  'room-poster-orbit': { file: 'treehouse-room/posters/orbit.webp' },
  'room-shore': { file: 'treehouse-room/mattes/shore.webp', unlit: true },
  'room-jungle': { file: 'treehouse-room/mattes/jungle.webp', unlit: true, cutout: true },
  'room-balustrade': { file: 'treehouse-room/mattes/balustrade.webp', unlit: true, cutout: true },
};
export const ROOM_TEXTURE_KINDS = Object.keys(ROOM_ART);
export function roomArt(kind: string | undefined): RoomArt | undefined {
  return kind && Object.prototype.hasOwnProperty.call(ROOM_ART, kind) ? ROOM_ART[kind] : undefined;
}

export interface RoomPoster {
  id: string; texture: string; p: [number, number, number];
  width: number; height: number; yaw: number; tilt: number;
}
/** Metres / degrees. Artwork uses the full 0–1 UV rectangle, never an atlas. */
export const ROOM_POSTERS: RoomPoster[] = [
  { id: 'coastal carve', texture: 'room-poster-coast', p: [-1.7, 3.55, -5.81], width: 1.48, height: 2.22, yaw: 0, tilt: -2 },
  { id: 'canopy air', texture: 'room-poster-canopy', p: [.05, 3.62, -5.80], width: 1.34, height: 2.01, yaw: 0, tilt: 2.5 },
  { id: 'orbital wheels', texture: 'room-poster-orbit', p: [5.88, 3.6, -2.4], width: 1.3, height: 1.95, yaw: -90, tilt: -3 },
  { id: 'workbench print', texture: 'room-poster-canopy', p: [-6.81, 3.45, .75], width: 1.2, height: 1.8, yaw: 90, tilt: 1.5 },
];
