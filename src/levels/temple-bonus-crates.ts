import type {BonusCourse} from './bonus-course-kit';

/** Keep the finite stack, switch bridge and timed stack as the room's tools.
 * All added deliveries stay one tier high, below the two 9 m reward gates. */
export function arrangeEmberReliquary(course:BonusCourse):void {
  const receiver=course.rooms[1].crates.find(c=>c.role==='receiver mystery')!;
  receiver.x=51.96;
  course.data.components.find(c=>c.nm===receiver.name)!.p[0]=receiver.x;
  for(const [name,x] of [['arrival',-4.5],['finite-exit',16],['refuge',78],['exit',87]] as const)
    for(let i=0;i<5;i++)course.data.components.push({t:'crate',p:[x+i*.96,0,0],
      kind:i===4?'mystery':'wood',nm:`Reliquary cargo / ${name} / ${i+1}`});
}
