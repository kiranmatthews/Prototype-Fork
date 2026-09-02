import type { Player, PlayerAnimationClipHint } from './player';
import {
  RigBinding,
  UNITY_CRAWL_CONTACT_ADAPTATION,
  UNITY_CROUCH_CRAWL_CLIP_IDS,
  UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP,
  UNITY_CROUCH_CRAWL_TIMING,
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
export const PACE_STOP_CLIP_ID = 'player.pace-stop';
export const PLAYER_TRANSITION_CLIP_IDS = [LAND_CLIP_ID, PACE_STOP_CLIP_ID] as const;
/** Routes allowed to opt into gameplay-phase scrubbing via clip metadata.
 * Manual Studio preview always remains ordinary saved-speed playback. */
export const ACTION_PROGRESS_TIMELINE_CLIP_IDS = [
  'player.jump',
  'player.double-jump',
  'player.fall',
  'player.rope-climb',
  'player.rope-release',
  'player.slam',
] as const;
/** Gameplay routes whose proven procedural presentation remains authoritative.
 * Their clips stay selectable for Studio/manual preview without double-writing
 * the live legacy pose. */
export const LEGACY_GAMEPLAY_PRESENTATION_CLIP_IDS = ['player.skate'] as const;

/** Ignore a stick tap or a nearly stationary authored run before pacing. */
export const PACE_STOP_MIN_RUN_SECONDS = 0.18;
export const PACE_STOP_MIN_PEAK_SPEED = 0.35;
/** Briefly preserve the outgoing stride so an arbitrary gait phase cannot pop. */
export const PACE_STOP_CROSSFADE_SECONDS = 0.12;
export const LAND_IMPACT_CROSSFADE_SECONDS = 0.06;
export const LAND_RUN_BLEND_START_SECONDS = 0.055;
export const LAND_RUN_BLEND_END_SECONDS = 0.28;
export const LAND_RUN_CANCEL_BLEND_SECONDS = 0.12;
export const LAND_RUN_LATE_BLEND_SECONDS = 0.12;

type RuntimeTransientKind = 'landing' | 'pace-stop';

interface RuntimeTransient {
  readonly kind: RuntimeTransientKind;
  readonly clipId: ClipId;
  readonly entryGaitPhase: number;
  readonly entrySpeed: number;
  readonly outgoingPose: PoseBuffer | null;
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
  readonly pacingOneShotActive: boolean;
  readonly transientClipId: ClipId | null;
  readonly transitionEntryGaitPhase: number | null;
  readonly transitionEntrySpeed: number | null;
  readonly transitionBlendWeight: number | null;
  readonly runQualificationSeconds: number;
  readonly runQualificationPeakSpeed: number;
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

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
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
]);

const AIRBORNE_CLIP_IDS = new Set<ClipId>([
  'player.jump',
  'player.double-jump',
  'player.fall',
]);

function authoredSwitchBlendDuration(from: ClipId | null, to: ClipId): number {
  if (!from) return 0;
  if (to === LAND_CLIP_ID && AIRBORNE_CLIP_IDS.has(from)) {
    return LAND_IMPACT_CROSSFADE_SECONDS;
  }
  if (ROPE_ATTACHED_CLIP_IDS.has(from) && ROPE_ATTACHED_CLIP_IDS.has(to)) {
    return UNITY_ROPE_TIMING.attachedBlend;
  }
  if (ROPE_ATTACHED_CLIP_IDS.has(from) && to === UNITY_ROPE_CLIP_IDS.release) {
    return UNITY_ROPE_TIMING.releaseBlend;
  }
  if (CROUCH_CRAWL_CLIP_IDS.has(from) || CROUCH_CRAWL_CLIP_IDS.has(to)) {
    return UNITY_CROUCH_CRAWL_TIMING.rapidBlend;
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
  private previousHint: PlayerAnimationClipHint;
  private transient: RuntimeTransient | null = null;
  private runQualificationSeconds = 0;
  private runQualificationPeakSpeed = 0;
  private lastRunGaitPhase = 0;
  private lastSampledPose: PoseBuffer | null = null;
  private transitionBlendWeight: number | null = null;
  private switchOutgoingPose: PoseBuffer | null = null;
  private switchBlendDuration = 0;
  private switchBlendElapsed = 0;
  private switchOutgoingLowPoseOuterOwnership = 0;
  private crawlContactPhase: number | null = null;
  private crawlContactOwnership = 0;
  private switchOutgoingCrawlContactPhase: number | null = null;
  private switchOutgoingCrawlContactOwnership = 0;
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
      pacingOneShotActive: transient?.kind === 'pace-stop',
      transientClipId: transient?.clipId ?? null,
      transitionEntryGaitPhase: transient?.entryGaitPhase ?? null,
      transitionEntrySpeed: transient?.entrySpeed ?? null,
      transitionBlendWeight: this.transitionBlendWeight,
      runQualificationSeconds: this.runQualificationSeconds,
      runQualificationPeakSpeed: this.runQualificationPeakSpeed,
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
    this.resetRunQualification();
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
      this.resetRunQualification();
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
    this.resetRunQualification();
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
    const previousHint = this.previousHint;
    this.previousGrounded = grounded;
    this.previousHint = intent.clipId;
    const hint = intent.clipId;

    if (!this.runtimeEnabled) {
      this.requestedClipId = null;
      this.poseApplied = false;
      this.player.setAuthoredCrawlContactPhase(null);
      this.cancelTransient();
      this.resetRunQualification();
      return;
    }

    if (this.manualClipId === null) {
      this.updateRunQualification(hint, previousHint, intent.motion, dt);
      // Landing has first refusal on the exact contact frame. This also avoids
      // an impossible run->idle edge winning over a fresh airborne transition.
      if (justLanded && hint !== 'player.bail' && hint !== 'player.slam') {
        this.resetLandingRunBlend();
        this.transient = this.makeTransient('landing', LAND_CLIP_ID, intent.motion);
      } else if (this.transient?.kind === 'landing') {
        if (
          !grounded ||
          hint === 'player.bail' ||
          (hint !== 'player.run' && hint !== 'player.idle')
        ) {
          this.cancelTransient();
        }
      } else if (this.transient?.kind === 'pace-stop') {
        // Pacing is an idle-bound flourish, never an action lock. Gameplay owns
        // the same frame in which any new state or renewed run is requested.
        if (!grounded || hint !== 'player.idle') this.cancelTransient();
      } else if (
        grounded &&
        previousHint === 'player.run' &&
        hint === 'player.idle' &&
        this.runQualificationSeconds >= PACE_STOP_MIN_RUN_SECONDS &&
        this.runQualificationPeakSpeed >= PACE_STOP_MIN_PEAK_SPEED
      ) {
        this.transient = {
          kind: 'pace-stop',
          clipId: PACE_STOP_CLIP_ID,
          entryGaitPhase: this.lastRunGaitPhase,
          // The last routed run frame is necessarily near the idle threshold;
          // peak speed preserves the momentum that this settle is reacting to.
          entrySpeed: this.runQualificationPeakSpeed,
          outgoingPose: this.currentClipId === 'player.run' ? this.lastSampledPose : null,
        };
      }
      if (hint !== 'player.run') this.resetRunQualification();
    } else {
      this.cancelTransient();
      this.resetRunQualification();
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
      this.clearPlayback(false);
      return;
    }

    const previousClipId = this.currentClipId;
    const switched = previousClipId !== clip.id || this.restartPending;
    if (switched) {
      const runHandoffOffset =
        this.manualClipId === null &&
        previousClipId === LAND_CLIP_ID && clip.id === 'player.run'
          ? this.pendingRunHandoffOffset
          : null;
      const switchBlendDuration = this.manualClipId === null
        ? authoredSwitchBlendDuration(previousClipId, clip.id)
        : 0;
      this.switchOutgoingPose = switchBlendDuration > 0 ? this.lastSampledPose : null;
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
      this.currentClipId = clip.id;
      this.elapsedSeconds = 0;
      this.playbackSeconds = 0;
      this.playbackOffset = runHandoffOffset ?? 0;
      this.pendingRunHandoffOffset = null;
      this.restartPending = false;
    } else {
      this.elapsedSeconds += dt;
      this.playbackSeconds += dt * this.runtimeSpeed;
      this.switchBlendElapsed += dt;
    }

    const motion = this.motionForClip(clip, intent.motion);
    const gameplayProgressTimeline =
      this.manualClipId === null && usesActionProgressTimeline(clip);
    this.timelineTime = gameplayProgressTimeline
      ? clip.range.start +
        Math.min(1, Math.max(0, motion.actionProgress)) *
        (clip.range.end - clip.range.start)
      : clipTimeAt(clip, this.playbackSeconds, { offset: this.playbackOffset });
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
    const sampledPose = sampleComposedClip(clip, this.timelineTime, motion, {
      evaluators: this.proceduralEvaluators,
    });
    let pose = sampledPose;
    let landingRunBlendWeight = 0;
    let landingRunBlendInFlight = false;
    const variant = this.manualClipId === null ? clipVariantBlend(clip) : null;
    if (variant) {
      const variantClip = this.findPlayableClip(variant.clipId);
      const weight = Math.min(1, Math.max(0, motion.inputs?.[variant.source] ?? 0));
      if (variantClip && weight > 0) {
        const phase = Math.min(1, Math.max(0, motion.actionProgress));
        const variantTime = variantClip.range.start +
          phase * (variantClip.range.end - variantClip.range.start);
        const variantPose = sampleComposedClip(variantClip, variantTime, motion, {
          evaluators: this.proceduralEvaluators,
        });
        pose = blendPoses(
          withControlDefaults(canonicalizePose(sampledPose, this.binding), this.controlDefaults),
          withControlDefaults(canonicalizePose(variantPose, this.binding), this.controlDefaults),
          weight,
        );
      }
    }
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
    let contactTransitionWeight: number | null = null;
    if (
      this.transient?.kind === 'pace-stop' &&
      clip.id === this.transient.clipId &&
      this.transient.outgoingPose
    ) {
      const authoredBlendTime =
        this.playbackSeconds * clip.playbackSpeed;
      const authoredBlendDuration = Math.min(
        PACE_STOP_CROSSFADE_SECONDS,
        clip.range.end - clip.range.start,
      );
      const weight = smoothstep01(authoredBlendTime / authoredBlendDuration);
      pose = blendPoses(
        withControlDefaults(
          canonicalizePose(this.transient.outgoingPose, this.binding),
          this.controlDefaults,
        ),
        withControlDefaults(canonicalizePose(sampledPose, this.binding), this.controlDefaults),
        weight,
      );
      this.transitionBlendWeight = weight;
    } else if (this.switchOutgoingPose && this.switchBlendDuration > 0) {
      const weight = smoothstep01(this.switchBlendElapsed / this.switchBlendDuration);
      contactTransitionWeight = weight;
      pose = blendPoses(
        withControlDefaults(
          canonicalizePose(this.switchOutgoingPose, this.binding),
          this.controlDefaults,
        ),
        withControlDefaults(canonicalizePose(pose, this.binding), this.controlDefaults),
        weight,
      );
      this.transitionBlendWeight = weight;
      if (weight >= 1) {
        this.switchOutgoingPose = null;
        this.switchBlendDuration = 0;
        this.switchOutgoingLowPoseOuterOwnership = 0;
      }
    } else {
      this.transitionBlendWeight = null;
    }
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
        (this.oneTraversalFinished(clip) && !landingRunBlendInFlight)
      )
    ) {
      this.cancelTransient(false);
    }
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
    return clip?.metadata?.outerPoseOwnership ===
      UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP ? 1 : 0;
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
      inputs: {
        ...gameplay.inputs,
        ...(transient ? {
          transitionEntryGaitPhase: transient.entryGaitPhase,
          transitionEntrySpeed: transient.entrySpeed,
        } : {}),
      },
    });
  }

  private makeTransient(
    kind: RuntimeTransientKind,
    clipId: ClipId,
    motion: ProceduralMotionContext,
  ): RuntimeTransient {
    return {
      kind,
      clipId,
      entryGaitPhase: normalizedPhase(motion.gaitPhase),
      entrySpeed: finiteNonNegative(motion.normalizedSpeed),
      outgoingPose: null,
    };
  }

  private updateRunQualification(
    hint: PlayerAnimationClipHint,
    previousHint: PlayerAnimationClipHint,
    motion: ProceduralMotionContext,
    deltaSeconds: number,
  ): void {
    if (hint !== 'player.run') return;
    if (previousHint !== 'player.run') this.resetRunQualification();
    const speed = finiteNonNegative(motion.normalizedSpeed);
    this.runQualificationSeconds += deltaSeconds;
    this.runQualificationPeakSpeed = Math.max(this.runQualificationPeakSpeed, speed);
    this.lastRunGaitPhase = normalizedPhase(motion.gaitPhase);
  }

  private resetRunQualification(): void {
    this.runQualificationSeconds = 0;
    this.runQualificationPeakSpeed = 0;
    this.lastRunGaitPhase = 0;
  }

  private cancelTransient(clearBlend = true): void {
    const cancelledLanding = this.transient?.kind === 'landing';
    this.transient = null;
    if (cancelledLanding) this.resetLandingRunBlend(clearBlend);
    if (clearBlend) this.transitionBlendWeight = null;
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
    this.currentClipId = null;
    if (clearRequest) this.requestedClipId = null;
    this.elapsedSeconds = 0;
    this.playbackSeconds = 0;
    this.playbackOffset = 0;
    this.pendingRunHandoffOffset = null;
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
  'player.idle',
  'player.run',
  'player.jump',
  'player.double-jump',
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
  'player.spin',
];
