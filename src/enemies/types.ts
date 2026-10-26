import type * as THREE from 'three';

export const ENEMY_KINDS = ['grunt','spiker','turtle','charger','hopper','floater','sentry','spinner','moa'] as const;
export type EnemyKind = typeof ENEMY_KINDS[number];
export const ENEMY_LEGS = ['frontLeft','frontRight','hindLeft','hindRight'] as const;
export type EnemyLeg = typeof ENEMY_LEGS[number];
export type EnemySegmentRole = 'torso' | 'frontUpperLeft' | 'frontUpperRight' |
  'frontLowerLeft' | 'frontLowerRight' | 'hindUpperLeft' | 'hindUpperRight' |
  'hindLowerLeft' | 'hindLowerRight';
export type EnemyNodeRole = EnemySegmentRole | 'head' | 'jaw' | 'tail' | 'base' |
  'pincerUpperLeft' | 'pincerUpperRight' | 'pincerLowerLeft' | 'pincerLowerRight' | 'pincerLeft' | 'pincerRight' |
  'rotor' | 'charge' | 'barrel' | 'blade0' | 'blade1' | 'blade2' | 'blade3' |
  'frontFootLeft' | 'frontFootRight' | 'hindFootLeft' | 'hindFootRight' | 'motionRoot';

export interface EnemyNodeBinding {
  /** Exact exported node name. An array supplies ordered alternatives. */
  name: string | readonly string[];
  /** Segment's LOCAL length axis, not a world-space direction. */
  lengthAxis?: 'x' | 'y' | 'z';
  /** LOCAL hinge axis for gait/head/recoil, defaults to x. */
  rotationAxis?: 'x' | 'y' | 'z';
  rotationSign?: number;
}
export type EnemyNodeMap = Partial<Record<EnemyNodeRole,string | EnemyNodeBinding>>;
export interface EnemyVisualOptions {
  /** Nightworks quarry crew; gameplay kind and takedown rules stay independent. */
  appearance?: "nightworks";
  /** Files are baked to metres, Y-up, forward +Z before runtime loading. */
  url?: string;
  /** Optional alternate carcass path; false for custom non-crab art/fixtures. */
  stompCarcassUrl?: string | false;
  mapping?: EnemyNodeMap;
  walkClip?: string;
  /** Source clip's authored travel speed, used for in-place playback speed. */
  walkSpeed?: number;
  /** Planted intervals sampled from the source walk, in normalized clip phase. */
  walkContacts?: Partial<Record<EnemyLeg, readonly (readonly [number, number])[]>>;
}
export interface EnemyAnimationFrame {
  kind?: EnemyKind;
  state: string;
  stateTime: number;
  time: number;
  /** Actual world travel speed; zero keeps a standing enemy from walking. */
  speed: number;
  verticalVelocity: number;
  grounded: boolean;
  alive: boolean;
  flung: boolean;
  /** Time since the most recent landing on an overturned turtle. */
  shellBounceTime?: number;
  /** Fixed local heading of the stomped face, captured at impact; never billboards. */
  crabCarcassYaw?: number;
  /** Nearby-player presentation only; never changes hitboxes or attack rules. */
  alert?: number;
  /** Locked world-space aim for articulated rooftop attacks. */
  attackTarget?: THREE.Vector3;
  /** Optional cycle [0,1); otherwise the active walk clip supplies the phase. */
  gaitPhase?: number;
  /** Authored locomotion clock, independent of imported walk clips. */
  locomotionTime?: number;
  /** Animation studio treadmill; gameplay uses actual world movement. */
  inPlace?: boolean;
  /** Current animated contacts are preserved through procedural deformation. */
  plantedFeet?: Partial<Record<EnemyLeg,boolean>>;
}
export interface EnemyVisualDiagnostics {
  kind: EnemyKind;
  status: 'loading' | 'ready' | 'error' | 'disposed';
  url: string;
  appearance?: "nightworks";
  carcass?: { url: string; status: "loading" | "ready" | "error" | "disposed"; error?: string };
  error?: string;
  clips: string[];
  activeClip: string | null;
  mappedNodes: Partial<Record<EnemyNodeRole,string>>;
  skinnedMeshes: number;
  meshes: number;
  animationTime: number;
  gaitPhase: number;
  gaitHz?: number;
  playbackRate?: number;
  plantedFeet?: Partial<Record<EnemyLeg,boolean>>;
  state: string;
}
export interface EnemyVisual {
  /** Gameplay owns world movement, facing, fling and visibility. Never scaled by animation. */
  group: THREE.Group;
  /** Gameplay-owned yaw at a sentry's authored bearing; other kinds use the root. */
  body: THREE.Group;
  /** Always settles. Inspect diagnostics.status to distinguish failed assets. */
  ready: Promise<void>;
  readonly diagnostics: EnemyVisualDiagnostics;
  /** Actual +Z barrel tip including aim/recoil; false until a barrel is loaded. */
  getMuzzlePosition(target:THREE.Vector3):boolean;
  getMouthPosition?(target:THREE.Vector3):boolean;
  /** Articulated melee tip, sampled after animation. */
  getAttackPosition?(target:THREE.Vector3):boolean;
  update(dt: number, frame: EnemyAnimationFrame): void;
  reset(): void;
  /** Detaches all borrowed render resources before releasing the asset lease. */
  dispose(): void;
}
