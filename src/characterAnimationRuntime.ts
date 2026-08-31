import type { Player, PlayerAnimationClipHint } from './player';
import {
  RigBinding,
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
} from './animation';

const LAND_CLIP_ID = 'player.land';

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
  private runtimeEnabled: boolean;
  private runtimeSpeed: number;
  private manualClipId: ClipId | null;
  private currentClipId: ClipId | null = null;
  private requestedClipId: ClipId | null = null;
  private elapsedSeconds = 0;
  private timelineTime: number | null = null;
  private authoredPlaybackSpeed: number | null = null;
  private previousGrounded: boolean;
  private landingOneShot = false;
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
    this.previousGrounded = player.grounded;
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
      landingOneShotActive: this.landingOneShot,
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
    if (this.currentClipId && !this.findPlayableClip(this.currentClipId)) {
      this.clearPlayback();
    }
  }

  /** Select any document clip for live diagnosis; null resumes state routing. */
  setManualClipOverride(clipId: ClipId | null, restart = true): void {
    if (this.disposed || this.manualClipId === clipId && !restart) return;
    this.manualClipId = clipId;
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
    if (!enabled) this.clearPlayback();
  }

  restart(): void {
    if (!this.disposed) this.restartPending = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeOverlay?.();
    this.removeOverlay = null;
    this.clearPlayback();
  }

  private applyFrame(
    deltaSeconds: number,
    applyDeformations: (values: Readonly<Record<string, number>>) => void,
  ): void {
    if (this.disposed) return;
    const intent = this.player.animationIntent;
    const grounded = intent.motion.grounded;
    const justLanded = grounded && !this.previousGrounded;
    this.previousGrounded = grounded;
    const hint = intent.clipId;

    if (justLanded && hint !== 'player.bail') this.landingOneShot = true;
    if (!grounded || hint === 'player.bail') this.landingOneShot = false;

    if (!this.runtimeEnabled) {
      this.requestedClipId = null;
      this.poseApplied = false;
      return;
    }

    let requested: ClipId =
      this.manualClipId ?? (this.landingOneShot ? LAND_CLIP_ID : hint);
    let clip = this.findPlayableClip(requested);
    // Missing/placeholder landing clips must not hide a valid state clip.
    if (!clip && this.manualClipId === null && requested === LAND_CLIP_ID) {
      this.landingOneShot = false;
      requested = hint;
      clip = this.findPlayableClip(requested);
    }
    this.requestedClipId = requested;

    if (!clip) {
      this.clearPlayback(false);
      return;
    }

    const switched = this.currentClipId !== clip.id || this.restartPending;
    if (switched) {
      this.currentClipId = clip.id;
      this.elapsedSeconds = 0;
      this.restartPending = false;
    } else {
      const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
      this.elapsedSeconds += dt;
    }

    this.timelineTime = clipTimeAt(clip, this.elapsedSeconds, {
      runtimeSpeed: this.runtimeSpeed,
    });
    this.authoredPlaybackSpeed = clip.playbackSpeed;
    const motion = this.motionForClip(clip, intent.motion);
    const pose = sampleComposedClip(clip, this.timelineTime, motion, {
      evaluators: this.proceduralEvaluators,
    });
    this.binding.applyPose(pose, { resetUnspecified: false, strict: false });
    // Controls/deformation are intentionally last: endpoint translation starts
    // from the fully composed joint pose, and limbs never inherit parent scale.
    applyDeformations(pose.scalars);
    this.poseApplied = true;
    this.compositionOrder = clip.proceduralOrder;
    this.proceduralDriverCount = clip.proceduralDrivers.filter((driver) => driver.enabled !== false).length;
    this.motionContext = motion;

    if (
      this.manualClipId === null &&
      this.landingOneShot &&
      this.oneTraversalFinished(clip)
    ) {
      this.landingOneShot = false;
    }
  }

  private findPlayableClip(id: ClipId): AnimationClip | null {
    const clip = this.animationDocument.clips.find((candidate) => candidate.id === id);
    if (!clip || clip.rigId !== this.binding.definition.id || !clipTimingIsUsable(clip)) return null;
    const validJointIds = this.binding.joints;
    const validControlIds = new Set(this.binding.definition.controls.map((control) => control.id));
    const hasUsableTrack = clip.tracks.some((track) => {
      if (!trackHasKeys(track)) return false;
      return track.kind === 'scalar'
        ? validControlIds.has(track.target)
        : validJointIds.has(track.target);
    });
    const hasUsableDriver = clip.proceduralDrivers.some((driver) => {
      if (driver.enabled === false) return false;
      const targetExists = driver.target.kind === 'scalar'
        ? validControlIds.has(driver.target.target)
        : validJointIds.has(driver.target.target);
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

  private motionForClip(
    clip: AnimationClip,
    gameplay: ProceduralMotionContext,
  ): ProceduralMotionContext {
    let actionProgress = gameplay.actionProgress;
    if (this.manualClipId === null && this.landingOneShot && clip.id === LAND_CLIP_ID) {
      const span = Math.max(clip.range.end - clip.range.start, 1e-9);
      actionProgress = Math.min(
        1,
        Math.max(0, this.elapsedSeconds * clip.playbackSpeed * this.runtimeSpeed / span),
      );
    }
    return createProceduralMotionContext({
      normalizedSpeed: gameplay.normalizedSpeed,
      gaitPhase: gameplay.gaitPhase,
      verticalVelocity: gameplay.verticalVelocity,
      grounded: gameplay.grounded,
      actionProgress,
      inputs: { ...gameplay.inputs },
    });
  }

  private oneTraversalFinished(clip: AnimationClip): boolean {
    const authoredSpan = clip.range.end - clip.range.start;
    const effectiveSpeed = clip.playbackSpeed * this.runtimeSpeed;
    return effectiveSpeed > 0 && this.elapsedSeconds * effectiveSpeed >= authoredSpan;
  }

  private clearPlayback(clearRequest = true): void {
    this.currentClipId = null;
    if (clearRequest) this.requestedClipId = null;
    this.elapsedSeconds = 0;
    this.timelineTime = null;
    this.authoredPlaybackSpeed = null;
    this.poseApplied = false;
    this.compositionOrder = null;
    this.proceduralDriverCount = 0;
    this.motionContext = null;
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
  'player.slam',
  'player.bail',
  'player.spin',
];
