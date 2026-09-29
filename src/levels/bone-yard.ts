import type { CustomLevelData } from '../level';

/** Short, optional crash playground. Centre lane bypasses every impact bay. */
export const BONE_YARD_LEVEL: CustomLevelData = {
  v: 1, name: 'Bone Yard · Wipeout Playground', spawn: [0, .08, 4], killY: -18, sky: 'day',
  components: [
    { t: 'platform', p: [0, -.5, -31], s: [26, 1, 86], color: '#a7b7b4', tex: 'solid', edgeGrinding: false, nm: 'Runway and recovery floor' },
    { t: 'platform', p: [0, -.5, -97], s: [26, 1, 32], color: '#a7b7b4', tex: 'solid', edgeGrinding: false, nm: 'Finish apron' },
    { t: 'platform', p: [-10, -.5, -78], s: [6, 1, 8], color: '#e6bc66', tex: 'solid', edgeGrinding: false, nm: 'Pit bypass' },
    { t: 'checkpoint', p: [0, 0, -8], nm: 'Crash-bay checkpoint' },
    { t: 'speedpad', p: [-7, .015, -15], s: [4, .08, 5], speed: 25, cycle: 1.3, nm: 'Head-pop run-up' },
    { t: 'wall', p: [-7, 0, -29], s: [5, 3.2, .7], color: '#ef9278', tex: 'solid', nm: 'High impact · head pop' },
    { t: 'speedpad', p: [7, .015, -15], s: [4, .08, 5], speed: 25, cycle: 1.3, nm: 'Waist-split run-up' },
    { t: 'wall', p: [7, 0, -29], s: [5, .5, .6], color: '#e6bc66', tex: 'solid', nm: 'Low trip · legs stay behind' },
    { t: 'rail', p: [-7, .62, -55], len: 7, yaw: 90, nm: 'Low crossbar trip' },
    { t: 'rail', p: [7, 1.55, -55], len: 7, yaw: 90, nm: 'High clothesline' },
    { t: 'checkpoint', p: [0, 0, -65], nm: 'Pit checkpoint' },
    { t: 'pit', p: [3, -2, -78], s: [20, 1, 8], nm: 'Fatal scatter · bypass on left' },
    { t: 'gate', p: [0, 0, -106], nm: 'Finish' },
    { t: 'camnode', p: [0, 0, 10] },
    { t: 'camnode', p: [0, 0, -112] },
  ],
};
