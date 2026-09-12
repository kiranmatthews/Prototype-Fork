import type { Player, PlayerAnimationClipHint } from './player';
import { JUMP_CHARGE_CLIP_ID } from './animation/jumpCharge';
import { RUN_STOP_CLIP_ID, RUN_MOVE_INTENT_INPUT, RUN_STOP_COAST_FRACTION } from './animation/runStop';
import {
  RigBinding,
  UNITY_CRAWL_CONTACT_ADAPTATION,
  UNITY_CROUCH_CRAWL_CLIP_IDS,
  UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP,
  UNITY_CROUCH_CRAWL_TIMING,
  CROUCH_CLIP_IDS,
  QUATERNIUS_CRAWL_PALMS,
  QUATERNIUS_LOW_POSE_OWNERSHIP,
  LOCOMOTION_WALK_BLEND_INPUT,
  LOCOMOTION_PHASE_MATCHED_IDLE,
  LOCOMOTION_STOP_BLEND_SECONDS,
  LOCOMOTION_START_BLEND_SECONDS,
  PLAYER_WALK_CLIP_ID,
  UNITY_ROPE_CLIP_IDS,
  UNITY_ROPE_TIMING,
  blendPoses,
  clipTimeAt,
  createProceduralMotionContext,
  sampleComposedClip,
  type AnimationClip,
  type AnimationSuiteDocument,
  type AnimationTrack,
  type ClipId,
  type ProceduralCompositionOrder,
  type ProceduralEvaluatorRegistry,
  type ProceduralMotionContext,
  type PoseBuffer,
} from './animation';

export const LAND_CLIP_ID = 'player.land';
export const PLAYER_TRANSITION_CLIP_IDS = [LAND_CLIP_ID, CROUCH_CLIP_IDS.enter, CROUCH_CLIP_IDS.exit, RUN_STOP_CLIP_ID] as const;
/** Routes allowed to opt into gameplay-phase scrubbing via clip metadata.
 * Manual Studio preview always remains ordinary saved-speed playback. */
export const ACTION_PROGRESS_TIMELINE_CLIP_IDS = [
  JUMP_CHARGE_CLIP_ID,
  'player.jump',
  'player.double-jump',
  'player.slide-jump',
  'player.fall',
  'player.rope-climb',
  'player.rope-release',
  'player.slam',
] as const;
/** Gameplay routes whose proven procedural presentation remains authoritative.
 * Their clips stay selectable for Studio/manual preview without double-writing
 * the live legacy pose. */
export const LEGACY_GAMEPLAY_PRESENTATION_CLIP_IDS = ['player.skate'] as const;

export const LAND_IMPACT_CROSSFADE_SECONDS = 0.06;
export const LAND_RUN_BLEND_START_SECONDS = 0.055;
export const LAND_RUN_BLEND_END_SECONDS = 0.28;
export const LAND_RUN_CANCEL_BLEND_SECONDS = 0.12;
export const LAND_RUN_LATE_BLEND_SECONDS = 0.12;
export const LOCOMOTION_BLEND_SECONDS = 0.14;

type RuntimeTransientKind = 'landing' | 'crouch-enter' | 'crouch-exit' | 'run-stop';

interface RuntimeTransient {
  readonly kind: RuntimeTransientKind;
  readonly clipId: ClipId;
}

interface LocomotionOutgoing {
  clip: AnimationClip;
  playbackSeconds: number;
  offset: number;
  rate: number;
  motion: ProceduralMotionContext;
}

export interface CharacterAnimationRuntimeOptions {
  /** Live multiplier layered on top of each clip's authored playbackSpeed. */
  playbackSpeedMultiplier?: number;
  /** Diagnostic override; null leaves selection to gameplay presentation state. */
  manualClipId?: ClipId | null;
  proceduralEvaluators?: ProceduralEvaluatorRegistry;
  enabled?: boolean;
}

export interface CharacterAnimationRuntimeDiagnostics {
  readonly enabled: boolean;
  readonly disposed: boolean;
  readonly requestedClipId: ClipId | null;
  readonly activeClipId: ClipId | null;
  readonly manualClipId: ClipId | null;
  readonly elapsedSeconds: number;
  readonly timelineTime: number | null;
  readonly authoredPlaybackSpeed: number | null;
  readonly playbackSpeedMultiplier: number;
  readonly landingOneShotActive: boolean;
  readonly transientClipId: ClipId | null;
  readonly idleRecoveryWeight: number;
  readonly idleRecoveryTimelineTime: number | null;
  readonly transitionBlendWeight: number | null;
  readonly authoredPoseApplied: boolean;
  readonly proceduralOrder: ProceduralCompositionOrder | null;
  readonly proceduralDriverCount: number;
  readonly motionContext: ProceduralMotionContext | null;
}

function finitePlaybackMultiplier(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value as number) : 1;
}

function trackHasKeys(track: AnimationTrack): boolean {
  return track.enabled !== false && track.keys.length > 0;
}

function normalizedPhase(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 1) + 1) % 1;
}

function smoothstep01(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function usesLegacyGameplayPresentation(id: ClipId): boolean {
  return (LEGACY_GAMEPLAY_PRESENTATION_CLIP_IDS as readonly ClipId[]).includes(id);
}

function usesActionProgressTimeline(clip: AnimationClip): boolean {
  return (ACTION_PROGRESS_TIMELINE_CLIP_IDS as readonly ClipId[]).includes(clip.id) &&
    clip.metadata?.progressSource === 'gameplay-actionProgress';
}

const ROPE_ATTACHED_CLIP_IDS = new Set<ClipId>([
  UNITY_ROPE_CLIP_IDS.hang,
  UNITY_ROPE_CLIP_IDS.climb,
]);

const CROUCH_CRAWL_CLIP_IDS = new Set<ClipId>([
  UNITY_CROUCH_CRAWL_CLIP_IDS.crouch,
  UNITY_CROUCH_CRAWL_CLIP_IDS.crawl,
  CROUCH_CLIP_IDS.enter,
  CROUCH_CLIP_IDS.exit,
]);

const AIRBORNE_CLIP_IDS = new Set<ClipId>([
  'player.jump',
  'player.double-jump',
  'player.slide-jump',
  'player.fall',
]);

function authoredSwitchBlendDuration(from: ClipId | null, to: ClipId): number {
  if (!from) return 0;
  if (from === JUMP_CHARGE_CLIP_ID || to === JUMP_CHARGE_CLIP_ID) return .10;
  if (to === RUN_STOP_CLIP_ID) return .10;
  if (from === RUN_STOP_CLIP_ID) return .12;
  if (to === 'player.death') return .12;
  if (from.startsWith('player.swim') || to.startsWith('player.swim')) return .3;
  if (to === LAND_CLIP_ID && AIRBORNE_CLIP_IDS.has(from)) {
    return LAND_IMPACT_CROSSFADE_SECONDS;
  }
  if ((to === 'player.jump' || to === 'player.fall') &&
      (AIRBORNE_CLIP_IDS.has(from) || from === 'player.idle' || from === 'player.run' || from === LAND_CLIP_ID)) {
    return 0.1;
  }
  if (from === LAND_CLIP_ID && to === 'player.idle') return LOCOMOTION_BLEND_SECONDS;
  if (ROPE_ATTACHED_CLIP_IDS.has(from) && ROPE_ATTACHED_CLIP_IDS.has(to)) {
    return UNITY_ROPE_TIMING.attachedBlend;
  }
  if (ROPE_ATTACHED_CLIP_IDS.has(from) && to === UNITY_ROPE_CLIP_IDS.release) {
    return UNITY_ROPE_TIMING.releaseBlend;
  }
  if (CROUCH_CRAWL_CLIP_IDS.has(from) || CROUCH_CRAWL_CLIP_IDS.has(to)) {
    return UNITY_CROUCH_CRAWL_TIMING.rapidBlend;
  }
  if (
    (from === 'player.idle' && to === 'player.run') ||
    (from === 'player.run' && to === 'player.idle')
  ) {
    return LOCOMOTION_BLEND_SECONDS;
  }
  return 0;
}

function clipVariantBlend(
  clip: AnimationClip,
): { clipId: ClipId; source: string } | null {
  const raw = clip.metadata?.variantBlend;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  return typeof value.clipId === 'string' && typeof value.source === 'string'
    ? { clipId: value.clipId, source: value.source }
    : null;
}

function withControlDefaults(
  pose: PoseBuffer,
  defaults: ReadonlyMap<string, number>,
): PoseBuffer {
  const scalars: Record<string, number> = {};
  for (const [id, value] of defaults) scalars[id] = pose.scalars[id] ?? value;
  for (const [id, value] of Object.entries(pose.scalars)) scalars[id] = value;
  return { joints: pose.joints, scalars };
}

/** Collapse historical joint aliases before blending so one semantic channel
 * cannot be represented twice and then win merely because it is canonical. */
function canonicalizePose(pose: PoseBuffer, binding: RigBinding): PoseBuffer {
  const joints: PoseBuffer['joints'] = {};
  const merge = (target: string, source: PoseBuffer['joints'][string]): void => {
    joints[target] = { ...joints[target], ...source };
  };
  const entries = Object.entries(pose.joints);
  // Match RigBinding.applyPose: historical aliases first, explicit canonical
  // channels second, so a transitional document containing both is stable.
  for (const [target, delta] of entries) {
    const canonical = binding.resolveJointId(target);
    if (canonical && canonical !== target) merge(canonical, delta);
  }
  for (const [target, delta] of entries) {
    const canonical = binding.resolveJointId(target);
    if (canonical && canonical === target) merge(canonical, delta);
  }
  return { joints, scalars: pose.scalars };
}

function clipTimingIsUsable(clip: AnimationClip): boolean {
  return (
    Number.isFinite(clip.duration) &&
    Number.isFinite(clip.playbackSpeed) &&
    clip.duration > 0 &&
    clip.playbackSpeed > 0 &&
    Number.isFinite(clip.range.start) &&
    Number.isFinite(clip.range.end) &&
    clip.range.start >= 0 &&
    clip.range.start < clip.range.end &&
    clip.range.end <= clip.duration
  );
}

/**
 * Final presentation layer for browser-authored player clips. Movement and
 * collision remain entirely in Player; this session only writes inside the
 * post-legacy overlay boundary exposed by PlayerAnimationBridge.
 */
export class CharacterAnimationRuntime {
  readonly binding: RigBinding;

  private animationDocument: AnimationSuiteDocument;
  private removeOverlay: (() => void) | null = null;
  private removeLowPoseOuterOwnership: (() => void) | null = null;
  private runtimeEnabled: boolean;
  private runtimeSpeed: number;
  private manualClipId: ClipId | null;
  private currentClipId: ClipId | null = null;
  private requestedClipId: ClipId | null = null;
  private elapsedSeconds = 0;
  /** Integrated live-speed clock; unlike wall time it does not jump after unfreezing. */
  private playbackSeconds = 0;
  /** Authored-range offset used for phase-continuous loop handoffs. */
  private playbackOffset = 0;
  private pendingRunHandoffOffset: number | null = null;
  private pendingIdleHandoffOffset: number | null = null;
  private recoveryIdle: { source: ClipId; offset: number; clock: number } | null = null;
  private recoveryIdleWeight = 0;
  private recoveryIdleTimelineTime: number | null = null;
  private landingRunBlendProgress = 0;
  private landingRunPreviousTime = 0;
  private landingRunEntryGaitPhase = 0;
  private landingRunClockOrigin = 0;
  private landingRunBlendDuration =
    LAND_RUN_BLEND_END_SECONDS - LAND_RUN_BLEND_START_SECONDS;
  private landingRunClockArmed = false;
  private timelineTime: number | null = null;
  private authoredPlaybackSpeed: number | null = null;
  private previousGrounded: boolean;
  private previousHint: ClipId;
  private previousMoveIntent = 0;
  private previousFootSpeed = 0;
  private runStopStartSpeed = 1;
  private runStopSettleElapsed = 0;
  private transient: RuntimeTransient | null = null;
  private lastSampledPose: PoseBuffer | null = null;
  private transitionBlendWeight: number | null = null;
  private switchOutgoingPose: PoseBuffer | null = null;
  private locomotionOutgoing: LocomotionOutgoing | null = null;
  private upperArmRestWeight = 1;
  private switchOutgoingUpperArmRestWeight = 1;
  private switchBlendDuration = 0;
  private switchBlendElapsed = 0;
  private switchOutgoingLowPoseOuterOwnership = 0;
  private crawlContactPhase: number | null = null;
  private crawlContactOwnership = 0;
  private switchOutgoingCrawlContactPhase: number | null = null;
  private switchOutgoingCrawlContactOwnership = 0;
  private crawlPalmWeight = 0;
  private switchOutgoingCrawlPalmWeight = 0;
  private readonly controlDefaults = new Map<string, number>();
  private poseApplied = false;
  private compositionOrder: ProceduralCompositionOrder | null = null;
  private proceduralDriverCount = 0;
  private motionContext: ProceduralMotionContext | null = null;
  private proceduralEvaluators: ProceduralEvaluatorRegistry | undefined;
  private disposed = false;
  private restartPending = false;

  constructor(
    private readonly player: Player,
    document: AnimationSuiteDocument,
    options: CharacterAnimationRuntimeOptions = {},
  ) {
    this.animationDocument = document;
    this.binding = RigBinding.fromSculptRuntime(player.animationRig.root);
    this.runtimeEnabled = options.enabled !== false;
    this.runtimeSpeed = finitePlaybackMultiplier(options.playbackSpeedMultiplier);
    this.manualClipId = options.manualClipId ?? null;
    this.proceduralEvaluators = options.proceduralEvaluators;
    const initialIntent = player.animationIntent;
    this.previousGrounded = initialIntent.motion.grounded;
    this.previousHint = initialIntent.clipId;
    for (const control of this.binding.definition.controls) {
      this.controlDefaults.set(control.id, control.defaultValue);
    }
    this.removeLowPoseOuterOwnership = player.setAuthoredLowPoseOuterOwnership(
      (deltaSeconds) => this.authoredLowPoseOuterOwnership(deltaSeconds),
    );
    this.removeOverlay = player.setAuthoredPoseOverlay((context) => {
      this.applyFrame(context.deltaSeconds, context.applyDeformations);
    });
  }

  get document(): AnimationSuiteDocument {
    return this.animationDocument;
  }

  get activeClipId(): ClipId | null {
    return this.currentClipId;
  }

  get manualClipOverride(): ClipId | null {
    return this.manualClipId;
  }

  get playbackSpeedMultiplier(): number {
    return this.runtimeSpeed;
  }

  get diagnostics(): CharacterAnimationRuntimeDiagnostics {
    const transient = this.transient;
    return {
      enabled: this.runtimeEnabled,
      disposed: this.disposed,
      requestedClipId: this.requestedClipId,
      activeClipId: this.currentClipId,
      manualClipId: this.manualClipId,
      elapsedSeconds: this.elapsedSeconds,
      timelineTime: this.timelineTime,
      authoredPlaybackSpeed: this.authoredPlaybackSpeed,
      playbackSpeedMultiplier: this.runtimeSpeed,
      landingOneShotActive: transient?.kind === 'landing',
      transientClipId: transient?.clipId ?? null,
      idleRecoveryWeight: this.recoveryIdleWeight,
      idleRecoveryTimelineTime: this.recoveryIdleTimelineTime,
      transitionBlendWeight: this.transitionBlendWeight,
      authoredPoseApplied: this.poseApplied,
      proceduralOrder: this.compositionOrder,
      proceduralDriverCount: this.proceduralDriverCount,
      motionContext: this.motionContext
        ? { ...this.motionContext, inputs: { ...this.motionContext.inputs } }
        : null,
    };
  }

  /** Replace the editor document without rebuilding or detaching the session. */
  setDocument(document: AnimationSuiteDocument): void {
    if (this.disposed) return;
    this.animationDocument = document;
    if (this.transient && !this.findPlayableClip(this.transient.clipId)) {
      this.cancelTransient();
    }
    if (this.currentClipId && !this.findPlayableClip(this.currentClipId)) {
      this.clearPlayback();
    }
  }

  /** Select any document clip for live diagnosis; null resumes state routing. */
  setManualClipOverride(clipId: ClipId | null, restart = true): void {
    if (this.disposed || this.manualClipId === clipId && !restart) return;
    this.manualClipId = clipId;
    // A diagnostic selection must not bank a gameplay transition that replays
    // seconds later when the override is released.
    this.cancelTransient();
    if (restart) this.restartPending = true;
  }

  /** A value of zero freezes the sampled pose; one uses the authored speed. */
  setPlaybackSpeedMultiplier(value: number): void {
    if (this.disposed) return;
    this.runtimeSpeed = finitePlaybackMultiplier(value);
  }

  setProceduralEvaluators(evaluators: ProceduralEvaluatorRegistry | undefined): void {
    if (!this.disposed) this.proceduralEvaluators = evaluators;
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed || this.runtimeEnabled === enabled) return;
    this.runtimeEnabled = enabled;
    this.restartPending = enabled;
    if (!enabled) {
      this.cancelTransient();
      this.clearPlayback();
    }
  }

  restart(): void {
    if (this.disposed) return;
    // Restart rewinds the active clip on the next overlay frame. Keep the
    // landing transient, but rewind its companion Run mix and clock with it so
    // editor/lab close cannot combine time zero with stale transition state.
    if (this.transient?.kind === 'landing') this.resetLandingRunBlend();
    else this.pendingRunHandoffOffset = null;
    this.restartPending = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeOverlay?.();
    this.removeOverlay = null;
    this.removeLowPoseOuterOwnership?.();
    this.removeLowPoseOuterOwnership = null;
    this.cancelTransient();
    this.clearPlayback();
  }

  private applyFrame(
    deltaSeconds: number,
    applyDeformations: (values: Readonly<Record<string, number>>) => void,
  ): void {
    if (this.disposed) return;
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const intent = this.player.animationIntent;
    const grounded = intent.motion.grounded;
    const justLanded = grounded && !this.previousGrounded;
    this.previousGrounded = grounded;
    const hint = intent.clipId;
    const recoveryHintChanged = this.manualClipId === null && this.currentClipId === LAND_CLIP_ID &&
      this.transient?.kind === 'landing' && hint !== this.previousHint &&
      (hint === 'player.run' || hint === 'player.idle') &&
      (this.previousHint === 'player.run' || this.previousHint === 'player.idle');
    if (recoveryHintChanged && this.lastSampledPose) {
      this.switchOutgoingPose = this.lastSampledPose;
      this.locomotionOutgoing = null;
      this.switchBlendDuration = .12;
      this.switchBlendElapsed = 0;
      this.switchOutgoingUpperArmRestWeight = this.upperArmRestWeight;
    }
    const moveIntent = intent.motion.inputs?.[RUN_MOVE_INTENT_INPUT] ?? 0;
    const releasedRun = this.previousMoveIntent > .05 && moveIntent <= .05 && this.previousFootSpeed >= .45;
    const releasedSpeed = this.previousFootSpeed;
    this.previousMoveIntent = moveIntent;
    this.previousFootSpeed = intent.motion.normalizedSpeed;
    const wasLow = this.previousHint === CROUCH_CLIP_IDS.idle || this.previousHint === CROUCH_CLIP_IDS.move;
    const isLow = hint === CROUCH_CLIP_IDS.idle || hint === CROUCH_CLIP_IDS.move;
    this.previousHint = hint;

    if (!this.runtimeEnabled) {
      this.requestedClipId = null;
      this.poseApplied = false;
      this.player.setAuthoredCrawlContactPhase(null);
      this.player.setAuthoredCrawlPalmWeight(0);
      this.player.setCharacterUpperArmRestAngleWeight(
        hint === 'player.idle' ? 1 : 0,
      );
      this.cancelTransient();
      return;
    }

    if (this.manualClipId === null) {
      const canSkid = grounded && (hint === 'player.run' || hint === 'player.idle') &&
        (intent.motion.inputs?.charge ?? 0) < .01;
      if (this.transient?.kind === 'run-stop' && (!canSkid || moveIntent > .05)) this.cancelTransient();
      // Enter/exit are presentation one-shots. A jump, slide, bail, or renewed
      // crouch interrupts them immediately; they never delay gameplay input.
      if ((this.transient?.kind === 'crouch-enter' && hint !== CROUCH_CLIP_IDS.idle) ||
          (this.transient?.kind === 'crouch-exit' && hint !== 'player.idle')) {
        this.cancelTransient();
      }
      // Landing has first refusal on the exact contact frame.
      if (justLanded && !this.currentClipId?.startsWith('player.swim') && hint !== 'player.bail' && hint !== 'player.death' && hint !== 'player.slam') {
        this.resetLandingRunBlend();
        this.transient = this.makeTransient('landing', LAND_CLIP_ID);
      } else if (this.transient?.kind === 'landing') {
        if (
          !grounded ||
          hint === 'player.bail' || hint === 'player.death' ||
          (hint !== 'player.run' && hint !== 'player.idle')
        ) {
          this.cancelTransient();
        }
      }
      if (hint === CROUCH_CLIP_IDS.idle && !wasLow &&
          this.findPlayableClip(hint)?.metadata?.outerPoseOwnership === QUATERNIUS_LOW_POSE_OWNERSHIP &&
          this.findPlayableClip(CROUCH_CLIP_IDS.enter)) {
        this.cancelTransient();
        this.transient = this.makeTransient('crouch-enter', CROUCH_CLIP_IDS.enter);
      } else if (!isLow && wasLow && grounded && hint === 'player.idle' &&
          this.currentClipId &&
          this.findPlayableClip(this.currentClipId)?.metadata?.outerPoseOwnership === QUATERNIUS_LOW_POSE_OWNERSHIP &&
          this.findPlayableClip(CROUCH_CLIP_IDS.exit)) {
        this.cancelTransient();
        this.transient = this.makeTransient('crouch-exit', CROUCH_CLIP_IDS.exit);
      }
      if (!justLanded && !this.transient && canSkid && releasedRun && this.findPlayableClip(RUN_STOP_CLIP_ID)) {
        this.transient = this.makeTransient('run-stop', RUN_STOP_CLIP_ID);
        this.runStopStartSpeed = Math.max(.001, releasedSpeed);
        this.runStopSettleElapsed = 0;
      }
    } else {
      this.cancelTransient();
    }

    let requested: ClipId =
      this.manualClipId ?? this.transient?.clipId ?? hint;
    let clip = this.findPlayableClip(requested);
    // The pre-animation-suite skate mount/stance already eases skatePose,
    // sidePose and deckPose, solves conventional knees/ankles, and plants the
    // measured soles. The later looping Skate Push starter absolute-wrote those
    // same channels on top and restarted at every mount. Preserve the older
    // live pose while keeping its clip available for explicit Studio preview.
    if (this.manualClipId === null && usesLegacyGameplayPresentation(requested)) {
      clip = null;
    }
    // Missing/placeholder transition clips must not hide a valid state clip.
    if (!clip && this.manualClipId === null && this.transient?.clipId === requested) {
      this.cancelTransient();
      requested = hint;
      clip = this.findPlayableClip(requested);
    }
    this.requestedClipId = requested;

    if (!clip) {
      this.player.setCharacterUpperArmRestAngleWeight(
        hint === 'player.idle' ? 1 : 0,
      );
      this.clearPlayback(false);
      return;
    }

    const previousClipId = this.currentClipId;
    const switched = previousClipId !== clip.id || this.restartPending;
    if (switched) {
      const idle = this.findPlayableClip('player.idle');
      const locomotionSwitch = this.manualClipId === null && !this.restartPending &&
        idle?.metadata?.locomotionTransition === LOCOMOTION_PHASE_MATCHED_IDLE &&
        ((clip.id === 'player.idle' && (previousClipId === 'player.run' || previousClipId === PLAYER_WALK_CLIP_ID || previousClipId === RUN_STOP_CLIP_ID)) ||
          (previousClipId === 'player.idle' && (clip.id === 'player.run' || clip.id === PLAYER_WALK_CLIP_ID)));
      const previousClip = previousClipId ? this.findPlayableClip(previousClipId) : null;
      // A steady outgoing loop keeps moving as it fades. If input reverses
      // during a fade, start from the last fully mixed pose instead: restarting
      // a raw source there would pop the entire skeleton back to that source.
      this.locomotionOutgoing = locomotionSwitch && !this.switchOutgoingPose && previousClip?.loop.mode === 'loop' && this.motionContext
        ? { clip: previousClip, playbackSeconds: this.playbackSeconds, offset: this.playbackOffset,
            rate: this.locomotionPlaybackScale(previousClip, this.motionContext), motion: this.motionContext }
        : null;
      const matchedOffset = locomotionSwitch && this.lastSampledPose
        ? this.closestLocomotionOffset(clip, this.lastSampledPose, intent.motion) : null;
      const runHandoffOffset =
        this.manualClipId === null &&
        previousClipId === LAND_CLIP_ID && clip.id === 'player.run'
          ? this.pendingRunHandoffOffset
          : null;
      const idleHandoffOffset = this.manualClipId === null && clip.id === 'player.idle' &&
        (previousClipId === LAND_CLIP_ID || previousClipId === RUN_STOP_CLIP_ID)
        ? this.pendingIdleHandoffOffset : null;
      const switchBlendDuration = this.manualClipId === null
        ? idleHandoffOffset !== null ? 0 : previousClipId === RUN_STOP_CLIP_ID ? .12 : locomotionSwitch
          ? clip.id === 'player.idle' ? LOCOMOTION_STOP_BLEND_SECONDS : LOCOMOTION_START_BLEND_SECONDS
          : authoredSwitchBlendDuration(previousClipId, clip.id)
        : 0;
      this.switchOutgoingPose = switchBlendDuration > 0 ? this.lastSampledPose : null;
      this.switchOutgoingUpperArmRestWeight = this.upperArmRestWeight;
      this.switchBlendDuration = switchBlendDuration;
      this.switchBlendElapsed = 0;
      this.switchOutgoingLowPoseOuterOwnership =
        switchBlendDuration > 0
          ? this.clipLowPoseOuterOwnership(
            previousClipId ? this.findPlayableClip(previousClipId) : null,
          )
          : 0;
      this.switchOutgoingCrawlContactPhase = switchBlendDuration > 0
        ? this.crawlContactPhase
        : null;
      this.switchOutgoingCrawlContactOwnership = switchBlendDuration > 0
        ? this.crawlContactOwnership
        : 0;
      this.switchOutgoingCrawlPalmWeight = switchBlendDuration > 0 ? this.crawlPalmWeight : 0;
      this.currentClipId = clip.id;
      this.elapsedSeconds = 0;
      this.playbackSeconds = 0;
      this.playbackOffset = idleHandoffOffset ?? runHandoffOffset ?? matchedOffset ?? 0;
      this.pendingRunHandoffOffset = null;
      this.pendingIdleHandoffOffset = null;
      this.restartPending = false;
    } else {
      this.elapsedSeconds += dt;
      this.playbackSeconds +=
        dt * this.runtimeSpeed * this.locomotionPlaybackScale(clip, intent.motion);
      if (!recoveryHintChanged) this.switchBlendElapsed += dt;
      if (this.locomotionOutgoing) this.locomotionOutgoing.playbackSeconds += dt * this.runtimeSpeed * this.locomotionOutgoing.rate;
    }

    let motion = this.motionForClip(clip, intent.motion);
    const gameplayProgressTimeline =
      this.manualClipId === null && usesActionProgressTimeline(clip);
    this.timelineTime = gameplayProgressTimeline
      ? clip.range.start +
        Math.min(1, Math.max(0, motion.actionProgress)) *
        (clip.range.end - clip.range.start)
      : clipTimeAt(clip, this.playbackSeconds, { offset: this.playbackOffset });
    if (this.manualClipId === null && this.transient?.kind === 'run-stop') {
      const span = Math.max(1e-6, clip.range.end - clip.range.start);
      const coasting = motion.normalizedSpeed > .005;
      if (!coasting) this.runStopSettleElapsed += dt * this.runtimeSpeed * clip.playbackSpeed;
      const phase = coasting
        ? RUN_STOP_COAST_FRACTION * Math.min(1, Math.max(0, 1 - motion.normalizedSpeed / this.runStopStartSpeed))
        : Math.min(1, RUN_STOP_COAST_FRACTION + this.runStopSettleElapsed / span);
      this.timelineTime = clip.range.start + span * phase;
      motion = { ...motion, actionProgress: phase };
    }
    const ownsCrawlContacts =
      clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl &&
      clip.metadata?.contactAdaptation === UNITY_CRAWL_CONTACT_ADAPTATION;
    const incomingCrawlContactPhase = ownsCrawlContacts
      ? normalizedPhase(
        (this.timelineTime - clip.range.start) /
        Math.max(1e-6, clip.range.end - clip.range.start),
      )
      : null;
    this.authoredPlaybackSpeed = clip.playbackSpeed;
    let pose = this.samplePoseAt(clip, this.timelineTime, motion, this.manualClipId === null);
    let landingRunBlendWeight = 0;
    let landingRunBlendInFlight = false;
    if (this.transient?.kind === 'landing' && clip.id === LAND_CLIP_ID) {
      const runClip = this.findPlayableClip('player.run');
      if (runClip) {
        // This clock intentionally continues beyond an edited Land range. The
        // pose clamps at that range's end, but a short valid clip must still be
        // able to finish its smooth handoff instead of popping or deadlocking.
        const landingTime = Math.max(0, this.playbackSeconds * clip.playbackSpeed);
        const landingDelta = Math.max(0, landingTime - this.landingRunPreviousTime);
        const runRequested = hint === 'player.run';
        if (runRequested && !this.landingRunClockArmed) {
          this.landingRunEntryGaitPhase = normalizedPhase(intent.motion.gaitPhase);
          this.landingRunClockOrigin = this.playbackSeconds;
          this.landingRunBlendDuration = Math.max(
            LAND_RUN_LATE_BLEND_SECONDS,
            LAND_RUN_BLEND_END_SECONDS -
              Math.max(LAND_RUN_BLEND_START_SECONDS, landingTime),
          );
          this.landingRunClockArmed = true;
        }
        if (runRequested) {
          const activeStart = Math.max(
            this.landingRunPreviousTime,
            LAND_RUN_BLEND_START_SECONDS,
          );
          const activeDelta = Math.max(0, landingTime - activeStart);
          this.landingRunBlendProgress = Math.min(
            1,
            this.landingRunBlendProgress +
              activeDelta / this.landingRunBlendDuration,
          );
        } else {
          this.landingRunBlendProgress = Math.max(
            0,
            this.landingRunBlendProgress - landingDelta / LAND_RUN_CANCEL_BLEND_SECONDS,
          );
          if (this.landingRunBlendProgress <= 0) {
            this.landingRunClockArmed = false;
            this.pendingRunHandoffOffset = null;
          }
        }
        this.landingRunPreviousTime = landingTime;
        landingRunBlendWeight = smoothstep01(this.landingRunBlendProgress);
        landingRunBlendInFlight =
          this.landingRunClockArmed && (runRequested || this.landingRunBlendProgress > 0);
        if (!landingRunBlendInFlight) {
          this.pendingRunHandoffOffset = null;
        } else {
          const runSpan = Math.max(1e-6, runClip.range.end - runClip.range.start);
          const leftStrike = runClip.markers.find((marker) =>
            marker.id.endsWith(':left-strike'))?.time ?? runClip.range.start;
          const runEntryOffset = this.landingRunEntryGaitPhase * runSpan +
            (leftStrike - runClip.range.start);
          const runTime = clipTimeAt(
            runClip,
            Math.max(0, this.playbackSeconds - this.landingRunClockOrigin),
            { offset: runEntryOffset },
          );
          const runPose = sampleComposedClip(runClip, runTime, motion, {
            evaluators: this.proceduralEvaluators,
          });
          pose = blendPoses(
            withControlDefaults(canonicalizePose(pose, this.binding), this.controlDefaults),
            withControlDefaults(canonicalizePose(runPose, this.binding), this.controlDefaults),
            landingRunBlendWeight,
          );
          this.pendingRunHandoffOffset = normalizedPhase(
            (runTime - runClip.range.start) / runSpan,
          ) * runSpan;
        }
      } else {
        this.resetLandingRunBlend();
        this.pendingRunHandoffOffset = null;
      }
    } else {
      this.pendingRunHandoffOffset = null;
    }
    // Return the limbs DURING the rebound/settle, not in a second fade once
    // the landing or skid has already finished. Root compression remains its
    // own channel until the last part of the bounce.
    this.recoveryIdleWeight = 0;
    this.recoveryIdleTimelineTime = null;
    if (this.manualClipId === null && hint === 'player.idle' &&
        (this.transient?.kind === 'landing' || this.transient?.kind === 'run-stop')) {
      pose = this.recoverIntoIdle(clip, pose, motion, dt);
    } else {
      this.recoveryIdle = null;
      this.pendingIdleHandoffOffset = null;
    }
    let contactTransitionWeight: number | null = null;
    if (this.switchOutgoingPose && this.switchBlendDuration > 0) {
      const weight = smoothstep01(this.switchBlendElapsed / this.switchBlendDuration);
      contactTransitionWeight = weight;
      const outgoing = this.locomotionOutgoing;
      const outgoingPose = outgoing
        ? this.samplePoseAt(outgoing.clip, clipTimeAt(outgoing.clip, outgoing.playbackSeconds, { offset: outgoing.offset }), outgoing.motion, true)
        : this.switchOutgoingPose;
      pose = blendPoses(
        withControlDefaults(
          canonicalizePose(outgoingPose, this.binding),
          this.controlDefaults,
        ),
        withControlDefaults(canonicalizePose(pose, this.binding), this.controlDefaults),
        weight,
      );
      this.transitionBlendWeight = weight;
      if (weight >= 1) {
        this.switchOutgoingPose = null;
        this.locomotionOutgoing = null;
        this.switchBlendDuration = 0;
        this.switchOutgoingLowPoseOuterOwnership = 0;
      }
    } else {
      this.transitionBlendWeight = null;
    }
    const incomingRestWeight = clip.id === 'player.idle' ? 1 : this.recoveryIdleWeight;
    this.upperArmRestWeight = this.transitionBlendWeight === null ? incomingRestWeight
      : this.switchOutgoingUpperArmRestWeight * (1 - this.transitionBlendWeight) + incomingRestWeight * this.transitionBlendWeight;
    this.player.setCharacterUpperArmRestAngleWeight(this.upperArmRestWeight);
    const incomingCrawlContactOwnership = ownsCrawlContacts ? 1 : 0;
    this.crawlContactOwnership = contactTransitionWeight === null
      ? incomingCrawlContactOwnership
      : this.switchOutgoingCrawlContactOwnership * (1 - contactTransitionWeight) +
        incomingCrawlContactOwnership * contactTransitionWeight;
    this.crawlContactPhase = incomingCrawlContactPhase ??
      this.switchOutgoingCrawlContactPhase;
    if (this.crawlContactOwnership <= 1e-6) this.crawlContactPhase = null;
    this.player.setAuthoredCrawlContactPhase(
      this.crawlContactPhase,
      this.crawlContactOwnership,
    );
    const incomingPalmWeight = clip.id === CROUCH_CLIP_IDS.move &&
      clip.metadata?.palmOrientation === QUATERNIUS_CRAWL_PALMS ? 1 : 0;
    this.crawlPalmWeight = contactTransitionWeight === null ? incomingPalmWeight
      : this.switchOutgoingCrawlPalmWeight * (1 - contactTransitionWeight) + incomingPalmWeight * contactTransitionWeight;
    this.player.setAuthoredCrawlPalmWeight(this.crawlPalmWeight);
    if (contactTransitionWeight !== null && contactTransitionWeight >= 1) {
      this.switchOutgoingCrawlContactPhase = null;
      this.switchOutgoingCrawlContactOwnership = 0;
    }
    this.binding.applyPose(pose, { resetUnspecified: false, strict: false });
    // Controls/deformation are intentionally last: endpoint translation starts
    // from the fully composed joint pose, and limbs never inherit parent scale.
    applyDeformations(pose.scalars);
    this.poseApplied = true;
    this.compositionOrder = clip.proceduralOrder;
    this.proceduralDriverCount = clip.proceduralDrivers.filter((driver) => driver.enabled !== false).length;
    this.motionContext = motion;
    this.lastSampledPose = pose;

    if (
      this.manualClipId === null &&
      this.transient?.clipId === clip.id &&
      (
        (
          this.transient.kind === 'landing' &&
          hint === 'player.run' &&
          landingRunBlendWeight >= 1
        ) ||
        ((this.transient.kind === 'run-stop'
          ? this.timelineTime >= clip.range.end - 1e-8
          : this.oneTraversalFinished(clip)) && !landingRunBlendInFlight)
      )
    ) {
      this.cancelTransient(false);
    }
  }

  private recoverIntoIdle(clip: AnimationClip, pose: PoseBuffer, motion: ProceduralMotionContext, dt: number): PoseBuffer {
    const idle = this.findPlayableClip('player.idle');
    if (!idle || this.timelineTime === null) return pose;
    if (this.recoveryIdle?.source !== clip.id) this.recoveryIdle = {
      source: clip.id, offset: this.closestLocomotionOffset(idle, pose, motion), clock: 0,
    };
    else this.recoveryIdle.clock += dt * this.runtimeSpeed;
    const span = Math.max(1e-6, clip.range.end - clip.range.start);
    const phase = Math.min(1, Math.max(0, (this.timelineTime - clip.range.start) / span));
    const isLand = clip.id === LAND_CLIP_ID;
    const start = isLand ? .075 / .45 : RUN_STOP_COAST_FRACTION;
    const end = isLand ? .30 / .45 : .60 / .65;
    const weight = Math.min(smoothstep01((phase - start) / (end - start)), smoothstep01(this.recoveryIdle.clock / .12));
    const idleTime = clipTimeAt(idle, this.recoveryIdle.clock, { offset: this.recoveryIdle.offset });
    const target = withControlDefaults(canonicalizePose(this.samplePoseAt(idle, idleTime, motion, true), this.binding), this.controlDefaults);
    const source = withControlDefaults(canonicalizePose(pose, this.binding), this.controlDefaults);
    const result = blendPoses(source, target, weight);
    const rootStart = isLand ? .20 / .45 : RUN_STOP_COAST_FRACTION;
    const rootWeight = smoothstep01((phase - rootStart) / (1 - rootStart));
    const root = blendPoses(source, target, Math.min(rootWeight, weight)).joints.root;
    if (root) result.joints.root = root;
    result.scalars = blendPoses(source, target, smoothstep01((phase - .8) / .2)).scalars;
    this.recoveryIdleWeight = weight;
    this.recoveryIdleTimelineTime = idleTime;
    if (phase >= 1 - 1e-8 && weight >= 1 - 1e-8) this.pendingIdleHandoffOffset = idleTime - idle.range.start;
    return result;
  }

  private samplePoseAt(clip: AnimationClip, time: number, motion: ProceduralMotionContext, includeVariant: boolean): PoseBuffer {
    const pose = sampleComposedClip(clip, time, motion, { evaluators: this.proceduralEvaluators });
    const variant = includeVariant ? clipVariantBlend(clip) ?? (clip.id === 'player.run'
      ? { clipId: PLAYER_WALK_CLIP_ID, source: LOCOMOTION_WALK_BLEND_INPUT } : null) : null;
    if (!variant) return pose;
    const alternate = this.findPlayableClip(variant.clipId);
    const weight = Math.min(1, Math.max(0, motion.inputs?.[variant.source] ?? 0));
    if (!alternate || weight <= 0) return pose;
    const phase = clip.id === 'player.run'
      ? normalizedPhase((time - clip.range.start) / Math.max(1e-6, clip.range.end - clip.range.start))
      : Math.min(1, Math.max(0, motion.actionProgress));
    const alternatePose = sampleComposedClip(alternate,
      alternate.range.start + phase * (alternate.range.end - alternate.range.start), motion,
      { evaluators: this.proceduralEvaluators });
    return blendPoses(withControlDefaults(canonicalizePose(pose, this.binding), this.controlDefaults),
      withControlDefaults(canonicalizePose(alternatePose, this.binding), this.controlDefaults), weight);
  }

  /** Choose a compatible incoming pose before the fade, using both arms and
   * legs. Matching the complete walk/run mixture avoids an elbow or knee
   * jumping to the opposite side of its cycle on a stop or quick restart. */
  private closestLocomotionOffset(clip: AnimationClip, outgoing: PoseBuffer, motion: ProceduralMotionContext): number {
    const previous = canonicalizePose(outgoing, this.binding);
    const span = clip.range.end - clip.range.start;
    let bestScore = Infinity, bestOffset = 0;
    for (let sample = 0; sample < 24; sample++) {
      const offset = sample / 24 * span;
      const pose = canonicalizePose(this.samplePoseAt(clip, clip.range.start + offset, motion, true), this.binding);
      let score = 0;
      for (const [id, delta] of Object.entries(previous.joints)) {
        const candidate = pose.joints[id];
        if (!candidate) continue;
        if (delta.quaternion && candidate.quaternion) {
          const q = delta.quaternion, r = candidate.quaternion;
          const dot = Math.abs(q[0]*r[0] + q[1]*r[1] + q[2]*r[2] + q[3]*r[3]);
          score += (/shoulder|elbow|hip|knee/.test(id) ? 2 : 1) * (1 - Math.min(1, dot));
        }
        if (delta.position && candidate.position) {
          for (let axis = 0; axis < 3; axis++) score += 2 * (delta.position[axis] - candidate.position[axis]) ** 2;
        }
      }
      if (score < bestScore) { bestScore = score; bestOffset = offset; }
    }
    return bestOffset;
  }

  private findPlayableClip(id: ClipId): AnimationClip | null {
    const clip = this.animationDocument.clips.find((candidate) => candidate.id === id);
    if (!clip || clip.rigId !== this.binding.definition.id || !clipTimingIsUsable(clip)) return null;
    const validJointIds = this.binding.joints;
    const hasJoint = (id: string): boolean => {
      const canonical = this.binding.resolveJointId(id);
      return canonical !== undefined && validJointIds.has(canonical);
    };
    const validControlIds = new Set(this.binding.definition.controls.map((control) => control.id));
    const hasUsableTrack = clip.tracks.some((track) => {
      if (!trackHasKeys(track)) return false;
      return track.kind === 'scalar'
        ? validControlIds.has(track.target)
        : hasJoint(track.target);
    });
    const hasUsableDriver = clip.proceduralDrivers.some((driver) => {
      if (driver.enabled === false) return false;
      const targetExists = driver.target.kind === 'scalar'
        ? validControlIds.has(driver.target.target)
        : hasJoint(driver.target.target);
      if (!targetExists || driver.type !== 'custom') return targetExists;
      if (this.proceduralEvaluators instanceof Map) {
        return this.proceduralEvaluators.has(driver.evaluatorId);
      }
      const registry = this.proceduralEvaluators as
        | Readonly<Record<string, unknown>>
        | undefined;
      return registry?.[driver.evaluatorId] !== undefined;
    });
    return hasUsableTrack || hasUsableDriver ? clip : null;
  }

  /** The legacy parent-level crawl shaping remains the safe fallback for a
   * missing, invalid, disabled, or preserved pre-Unity low-pose clip. */
  private clipLowPoseOuterOwnership(clip: AnimationClip | null): number {
    const ownership = clip?.metadata?.outerPoseOwnership;
    return ownership === UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP ||
      ownership === QUATERNIUS_LOW_POSE_OWNERSHIP ? 1 : 0;
  }

  /** Predict the ownership weight that applyFrame will use later in this same
   * visual step. Mixed Unity/legacy saved suites therefore hand parent shaping
   * across on the exact same smoothstep as their joint-pose crossfade. */
  private authoredLowPoseOuterOwnership(deltaSeconds: number): number {
    if (this.disposed || !this.runtimeEnabled) return 0;
    const requested = this.manualClipId ?? this.player.animationClipHint;
    if (!CROUCH_CRAWL_CLIP_IDS.has(requested)) return 0;
    const requestedClip = this.findPlayableClip(requested);
    const requestedOwnership = this.clipLowPoseOuterOwnership(requestedClip);
    if (!requestedClip) return 0;
    if (
      this.switchOutgoingPose &&
      this.switchBlendDuration > 0 &&
      this.currentClipId === requestedClip.id
    ) {
      const nextElapsed = this.switchBlendElapsed +
        (Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0);
      const weight = smoothstep01(nextElapsed / this.switchBlendDuration);
      return this.switchOutgoingLowPoseOuterOwnership * (1 - weight) +
        requestedOwnership * weight;
    }
    if (
      this.currentClipId &&
      this.currentClipId !== requestedClip.id &&
      CROUCH_CRAWL_CLIP_IDS.has(this.currentClipId)
    ) {
      // applyFrame has not observed this low-pose switch yet. Its first joint
      // blend sample is 100% outgoing, so preserve that clip's ownership too.
      return this.clipLowPoseOuterOwnership(this.findPlayableClip(this.currentClipId));
    }
    return requestedOwnership;
  }

  private motionForClip(
    clip: AnimationClip,
    gameplay: ProceduralMotionContext,
  ): ProceduralMotionContext {
    let actionProgress = gameplay.actionProgress;
    const transient = this.manualClipId === null && this.transient?.clipId === clip.id
      ? this.transient
      : null;
    if (transient) {
      const span = Math.max(clip.range.end - clip.range.start, 1e-9);
      actionProgress = Math.min(
        1,
        Math.max(0, this.playbackSeconds * clip.playbackSpeed / span),
      );
    }
    return createProceduralMotionContext({
      normalizedSpeed: gameplay.normalizedSpeed,
      gaitPhase: gameplay.gaitPhase,
      verticalVelocity: gameplay.verticalVelocity,
      grounded: gameplay.grounded,
      actionProgress,
      inputs: gameplay.inputs,
    });
  }

  /**
   * Walk and Jog share one normalized gait phase, but their authored cycles
   * are different lengths. Ease the Run clock toward Walk's native cadence as
   * Walk gains weight so neither source is time-stretched at its endpoint.
   */
  private locomotionPlaybackScale(
    clip: AnimationClip,
    motion: ProceduralMotionContext,
  ): number {
    if (this.manualClipId === null && clip.id === 'player.swim')
      return Math.max(.8, Math.min(1.5, motion.inputs?.swimCadence ?? 1));
    if (this.manualClipId !== null || clip.id !== 'player.run') return 1;
    const variant = clipVariantBlend(clip) ?? {
      clipId: PLAYER_WALK_CLIP_ID,
      source: LOCOMOTION_WALK_BLEND_INPUT,
    };
    const walk = this.findPlayableClip(variant.clipId);
    if (!walk) return 1;
    const weight = Math.min(1, Math.max(0, motion.inputs?.[variant.source] ?? 0));
    if (weight <= 0) return 1;
    const runSpan = Math.max(1e-6, clip.range.end - clip.range.start);
    const walkSpan = Math.max(1e-6, walk.range.end - walk.range.start);
    const nativeWalkScale =
      (walk.playbackSpeed * runSpan) /
      Math.max(1e-6, clip.playbackSpeed * walkSpan);
    return 1 + (nativeWalkScale - 1) * weight;
  }

  private makeTransient(
    kind: RuntimeTransientKind,
    clipId: ClipId,
  ): RuntimeTransient {
    return { kind, clipId };
  }

  private cancelTransient(clearBlend = true): void {
    const cancelledLanding = this.transient?.kind === 'landing';
    this.transient = null;
    if (cancelledLanding) this.resetLandingRunBlend(clearBlend);
    if (clearBlend) this.transitionBlendWeight = null;
    if (clearBlend) {
      this.recoveryIdle = null;
      this.pendingIdleHandoffOffset = null;
      this.recoveryIdleWeight = 0;
      this.recoveryIdleTimelineTime = null;
    }
  }

  private resetLandingRunBlend(clearHandoff = true): void {
    this.landingRunBlendProgress = 0;
    this.landingRunPreviousTime = 0;
    this.landingRunEntryGaitPhase = 0;
    this.landingRunClockOrigin = 0;
    this.landingRunBlendDuration =
      LAND_RUN_BLEND_END_SECONDS - LAND_RUN_BLEND_START_SECONDS;
    this.landingRunClockArmed = false;
    if (clearHandoff) this.pendingRunHandoffOffset = null;
  }

  private oneTraversalFinished(clip: AnimationClip): boolean {
    const authoredSpan = clip.range.end - clip.range.start;
    return clip.playbackSpeed > 0 && this.playbackSeconds * clip.playbackSpeed >= authoredSpan;
  }

  private clearPlayback(clearRequest = true): void {
    this.player.setAuthoredCrawlContactPhase(null);
    this.player.setAuthoredCrawlPalmWeight(0);
    this.crawlPalmWeight = 0;
    this.switchOutgoingCrawlPalmWeight = 0;
    this.currentClipId = null;
    if (clearRequest) this.requestedClipId = null;
    this.elapsedSeconds = 0;
    this.playbackSeconds = 0;
    this.playbackOffset = 0;
    this.pendingRunHandoffOffset = null;
    this.pendingIdleHandoffOffset = null;
    this.recoveryIdle = null;
    this.recoveryIdleWeight = 0;
    this.recoveryIdleTimelineTime = null;
    this.resetLandingRunBlend();
    this.timelineTime = null;
    this.authoredPlaybackSpeed = null;
    this.poseApplied = false;
    this.compositionOrder = null;
    this.proceduralDriverCount = 0;
    this.motionContext = null;
    this.lastSampledPose = null;
    this.transitionBlendWeight = null;
    this.switchOutgoingPose = null;
    this.locomotionOutgoing = null;
    this.switchBlendDuration = 0;
    this.switchBlendElapsed = 0;
    this.switchOutgoingLowPoseOuterOwnership = 0;
    this.crawlContactPhase = null;
    this.crawlContactOwnership = 0;
    this.switchOutgoingCrawlContactPhase = null;
    this.switchOutgoingCrawlContactOwnership = 0;
    this.restartPending = false;
  }
}

export function createCharacterAnimationRuntime(
  player: Player,
  document: AnimationSuiteDocument,
  options?: CharacterAnimationRuntimeOptions,
): CharacterAnimationRuntime {
  return new CharacterAnimationRuntime(player, document, options);
}

/** The gameplay-owned routes, useful for diagnostics and completeness tests. */
export const PLAYER_STATE_CLIP_IDS: readonly PlayerAnimationClipHint[] = [
  JUMP_CHARGE_CLIP_ID,
  'player.swim',
  'player.swim-idle',
  'player.idle',
  'player.run',
  'player.jump',
  'player.double-jump',
  'player.slide-jump',
  'player.fall',
  'player.crouch',
  'player.crawl',
  'player.slide',
  'player.skate',
  'player.grind',
  'player.grab',
  'player.hang',
  'player.climb',
  'player.rope',
  'player.rope-climb',
  'player.rope-release',
  'player.slam',
  'player.bail',
  'player.death',
  'player.spin',
];
