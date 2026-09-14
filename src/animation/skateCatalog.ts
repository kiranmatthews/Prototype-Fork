import { DECK_TRICKS, GRAB_TRICKS, GRIND_TRICKS, LIP_CONTACTS } from '../skateTricks';
import { SPECIAL_TRICKS } from '../specialTricks';
import type { AnimationClip, AnimationSuiteDocument, RigDefinition } from './types';

export const SKATE_REVIEW_REVISION = 20;
export interface SkateReviewEntry {
  id: string;
  clipId: string;
  number: string;
  name: string;
  category: 'Basics' | 'Flips' | 'Grabs' | 'Grinds' | 'Lip stalls' | 'Specials';
  duration: number;
}
const basics = ['Skate idle', 'Rolling', 'Charge idle', 'Idle to charge', 'Ollie', 'Manual', 'Nose Manual', 'Wallride', 'Revert'];
export const SKATE_REVIEW_ENTRIES: readonly SkateReviewEntry[] = [
  ...basics.map(name => ({ id: `basic:${name}`, name, category: 'Basics' as const, duration: 3.2 })),
  ...DECK_TRICKS.map(t => ({ id: `flip:${t.kind}`, name: t.label, category: 'Flips' as const, duration: 2.4 })),
  ...GRAB_TRICKS.map(t => ({ id: `grab:${t.kind}`, name: t.label, category: 'Grabs' as const, duration: 3.2 })),
  ...Object.entries(GRIND_TRICKS).map(([id,t]) => ({ id: `grind:${id}`, name: t.label, category: 'Grinds' as const, duration: 4.2 })),
  ...Object.entries(LIP_CONTACTS).map(([id,t]) => ({ id: `lip:${id}`, name: t.label, category: 'Lip stalls' as const, duration: 3.2 })),
  ...SPECIAL_TRICKS.map(t => ({ id: `special:${t.id}`, name: t.label, category: 'Specials' as const, duration: 3.2 })),
  { id: 'basic:Skate mount', name: 'Skate mount', category: 'Basics' as const, duration: 3.2 },
  { id: 'grind:under', name: 'Under-rail hang', category: 'Grinds' as const, duration: 4.2 },
].map((entry, i) => ({ ...entry, number: `S${String(i + 1).padStart(2, '0')}`,
  clipId: `player.skate-study.${entry.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }));

export interface SkateReviewCatalog {
  revision: number;
  source: string;
  fps: number;
  clips: AnimationClip[];
  previousSignatures?: Record<string, string[]>;
}

/** Visibility is part of the capture, including the board appearing on mount. */
export function skateBoardVisibleAt(clip: AnimationClip, time: number): boolean {
  const events = clip.metadata?.boardVisibility;
  let visible = true;
  if (Array.isArray(events)) for (const event of events) {
    if (Array.isArray(event) && typeof event[0] === 'number' && event[0] <= time && typeof event[1] === 'boolean') visible = event[1];
  }
  return visible;
}

/** Compare source motion after the draft serializer has normalized quaternions
 * and reordered tracks. Names and playback speed remain user preferences. */
export function skateReviewSignature(clip: AnimationClip): string {
  const canonical = (value: unknown): unknown => {
    if (typeof value === 'number') return Math.round(value * 1e8) / 1e8;
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,canonical(v)]));
    return value;
  };
  const tracks = clip.tracks.map(track => ({ ...track, enabled: track.enabled !== false,
    keys: [...track.keys].sort((a,b) => a.time - b.time).map(key => {
      if (track.kind !== 'quaternion' || !Array.isArray(key.value)) return key;
      const q = key.value;
      const pivot = q.reduce((best,v,i) => Math.abs(v) > Math.abs(q[best]) ? i : best, 0);
      const divisor = Math.hypot(...q) * (q[pivot] < 0 ? -1 : 1);
      return { ...key, value: q.map(v => v / divisor) };
    }) })).sort((a,b) => a.id.localeCompare(b.id));
  const text = JSON.stringify(canonical({ duration: clip.duration, loop: clip.loop, range: clip.range, rootMotion: clip.rootMotion,
    tracks, proceduralOrder: clip.proceduralOrder, proceduralDrivers: clip.proceduralDrivers, markers: clip.markers, contacts: clip.contacts, events: clip.events }));
  let first = 2166136261, second = 5381;
  for (let i=0; i<text.length; i++) { first = Math.imul(first ^ text.charCodeAt(i), 16777619); second = Math.imul(second, 33) ^ text.charCodeAt(i); }
  return `${text.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

/** The legacy character root excludes the board and its presentation parent.
 * Include them in authoring bindings without changing gameplay ownership. */
export function withSkatePresentationRig(rig: RigDefinition): RigDefinition {
  if (rig.joints.some(joint => joint.id === 'skateBody')) return rig;
  return { ...rig, rootJointId: 'skateBody',
    ...(rig.humanoid ? { humanoid: { ...rig.humanoid, root: 'skateBody' } } : {}),
    joints: [
      { id: 'skateBody', name: 'Presentation / flight', nodeName: 'player-visual', parentId: null,
        rest: { position: [0,0,0], quaternion: [0,0,0,1], scale: [1.18,1.36,1.18] } },
      ...rig.joints.map(joint => joint.id === rig.rootJointId ? { ...joint, parentId: 'skateBody' } : joint),
      { id: 'skateBoardFrame', name: 'Board scale compensation', nodeName: 'skateboard-scale-compensation', parentId: 'skateBody',
        rest: { position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1] } },
      { id: 'skateBoard', name: 'Skateboard', nodeName: 'board', parentId: 'skateBoardFrame',
        rest: { position: [0,0,0], quaternion: [0,0,0,1], scale: [1/1.18,1/1.36,1/1.18] } },
    ] };
}
let pending: Promise<SkateReviewCatalog> | undefined;
export function loadSkateReviewCatalog(): Promise<SkateReviewCatalog> {
  return pending ??= fetch(`${import.meta.env.BASE_URL}animations/skate-review/catalog.json?revision=${SKATE_REVIEW_REVISION}`)
    .then(async response => {
      if (!response.ok) throw new Error(`Skate catalogue could not load (${response.status}).`);
      const data = await response.json() as SkateReviewCatalog;
      if (data.revision !== SKATE_REVIEW_REVISION || !Array.isArray(data.clips) ||
        SKATE_REVIEW_ENTRIES.some(entry => !data.clips.some(clip => clip.id === entry.clipId)))
        throw new Error('Skate catalogue is incomplete. Reload to get the latest build.');
      return data;
    }).catch(error => { pending = undefined; throw error; });
}

/** Study clips are opt-in authoring material. They do not take over gameplay.
 * Keep saved edits and deliberate deletions after the first import. */
export function addSkateReviewClips(document: AnimationSuiteDocument, catalog: SkateReviewCatalog): AnimationSuiteDocument {
  if (document.metadata?.skateReviewRevision === catalog.revision) return document;
  const ids = new Set(document.clips.map(clip => clip.id));
  const importedBefore = typeof document.metadata?.skateReviewRevision === 'number';
  const sources = new Map(catalog.clips.map(clip => [clip.id,clip]));
  const clips = document.clips.map(clip => {
    const replacement = sources.get(clip.id);
    if (!replacement) return clip;
    const name=(clip.id==='player.skate-study.special-the-900' && clip.name==='Skate · S39 · The 900' ||
      clip.id==='player.skate-study.special-kickflip-mctwist' && clip.name==='Skate · S38 · Kickflip McTwist')
      ? replacement.name : clip.name;
    if (!catalog.previousSignatures?.[clip.id]?.includes(skateReviewSignature(clip))) return name===clip.name?clip:{...clip,name};
    return { ...structuredClone(replacement), name, playbackSpeed: clip.playbackSpeed,
      metadata: { ...clip.metadata, ...replacement.metadata } };
  });
  return { ...document, clips: [...clips, ...catalog.clips.filter(clip => !ids.has(clip.id) &&
      !(importedBefore && catalog.previousSignatures?.[clip.id])).map(clip => structuredClone(clip))],
    metadata: { ...document.metadata, skateReviewRevision: catalog.revision } };
}
