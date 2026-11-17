import type { CustomComponent } from '../level';
import type { BonusCourse, BonusRoom } from './bonus-course-kit';

/** Canopy Cache: earn the gallery before spending its arrow, then harvest
 * wooden caps without destroying the permanent stepping stones. The narrow
 * side-view lane uses X/Y formations, never crates across its depth walls. */
export function arrangeCanopyCacheCrates(course: BonusCourse): void {
  const [upper, relay] = course.rooms;
  const add = (room: BonusRoom, role: string, x: number, y: number,
    kind: NonNullable<CustomComponent['kind']>) => {
    const name = `Room ${room.index + 1} ${room.pattern}: ${role}`;
    course.data.components.push({t:'crate',p:[x,y,0],kind,grp:2,nm:name});
    room.crates.push({role,x,y,kind,name});
  };
  // Replace the two isolated gallery rewards with supported 2-wide harvest
  // walls. Keep the approach edge clear for the held-arrow/double landing.
  const oldNames = new Set(upper.crates.filter(c=>c.role.startsWith('upper')).map(c=>c.name));
  course.data.components = course.data.components.filter(c=>!oldNames.has(c.nm ?? ''));
  upper.crates = upper.crates.filter(c=>!oldNames.has(c.name));
  const galleryY = upper.shelf!.y;
  add(upper,'upper life-wall left support',11.52,galleryY,'wood');
  add(upper,'upper life-wall right support',12.48,galleryY,'wood');
  add(upper,'upper life-wall harvest',11.52,galleryY+.96,'mystery');
  add(upper,'upper life',12.48,galleryY+.96,'life');
  add(upper,'upper cache left support',14.52,galleryY,'wood');
  add(upper,'upper cache right support',15.48,galleryY,'wood');
  add(upper,'upper cache middle reward',14.52,galleryY+.96,'mystery');
  add(upper,'upper mystery',15.48,galleryY+.96,'mystery');
  add(upper,'upper cache crown',14.52,galleryY+1.92,'wood');
  // Each steel/wood pair becomes a three-crate decision: remove both wooden
  // caps during the jump and retain the steel receiver. No new enemy or fuse
  // competes with the first bonus's conservation lesson.
  relay.anchors!.forEach((x,n)=>add(relay,`harvest cap ${n+1}`,x,1.92,'mystery'));
}
