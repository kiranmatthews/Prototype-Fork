import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  ANIMATION_SUITE_SCHEMA,
  ANIMATION_SUITE_SCHEMA_VERSION,
  RIG_SCHEMA,
  RIG_SCHEMA_VERSION,
  createAnimationClip,
  createAnimationId,
  createAnimationSuiteDocument,
  createAnimationTrack,
  createIndexedDbDraftStore,
  createLocalDraftStore,
  createPlayerStarterAnimationSuite,
  createPreferredDraftStore,
  createProceduralDriver,
  createQuaternionKeyframe,
  createScalarKeyframe,
  createVectorKeyframe,
  duplicateClip,
  duplicateProceduralDriver,
  mirrorPose as mirrorPoseBuffer,
  parseAnimationSuite,
  removeClip,
  removeKeyframe,
  removeProceduralDriver,
  RigBinding,
  sampleComposedClip,
  sampleProceduralDriverValue,
  sampleProceduralPose,
  sampleQuaternionKeys,
  sampleScalarKeys,
  sampleVectorKeys,
  setActiveClip,
  stringifyAnimationSuite,
  bakeProceduralClip,
  upsertClip,
  upsertKeyframe,
  upsertProceduralDriver,
  upsertTrack,
  type AnimationDraftStore,
  type AsyncAnimationDraftStore,
  type AnimationClip,
  type AnimationContact,
  type AnimationEvent,
  type AnimationKeyframe,
  type AnimationMarker,
  type AnimationSuiteDocument,
  type AnimationTrack,
  type JointId,
  type JointPoseDelta,
  type KeyInterpolation,
  type PoseBuffer,
  type ProceduralDriverDefinition,
  type ProceduralDriverTarget,
  type ProceduralEvaluatorRegistry,
  type ProceduralMotionContext,
  type QuaternionKeyframe,
  type RigDefinition,
  type RigJointDefinition,
  type ScalarKeyframe,
  type TransformTrack,
  type Vec3Tuple,
  type VectorKeyframe,
} from './animation';
import { installAnimationStudioStyles } from './animationStudioStyles';
import {
  inferHumanoidIkChainDefinitions,
  resolveIkChains,
  solveResolvedIkChain,
  type IkChainDefinition,
  type IkSolveResult,
  type ResolvedIkChain,
} from './animation/ik';

const FRAME_RATE = 60;
const KEY_EPSILON = 1 / (FRAME_RATE * 4);
const DEFAULT_DURATION = 1;
const MIN_DURATION = 1 / FRAME_RATE;
const PLAYBACK_SPEED_MIN = 0.01;
const PLAYBACK_SPEED_MAX = 16;

type TransformMode = 'translate' | 'rotate' | 'scale';
type AuthoringMode = 'fk' | 'ik';
type TransformTrackKind = TransformTrack['kind'];
type AnnotationKind = 'marker' | 'contact' | 'event';

interface SelectedKey {
  trackId: string;
  keyId: string;
  component: number;
}

interface SelectedAnnotation {
  kind: AnnotationKind;
  id: string;
}

interface HistoryEntry {
  label: string;
  before: AnimationSuiteDocument;
  after: AnimationSuiteDocument;
}

interface Transaction {
  label: string;
  before: AnimationSuiteDocument;
}

interface CameraSnapshot {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  zoom: number;
  near: number;
  far: number;
}

interface TransformSnapshot {
  node: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface TimelineLane {
  id: string;
  label: string;
  kind: AnimationTrack['kind'] | AnnotationKind | 'procedural';
  track?: AnimationTrack;
  driver?: ProceduralDriverDefinition;
}

export interface AnimationStudioContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rigRoot: THREE.Object3D;
  onClose: () => void;
  /** Supplying a definition preserves stable semantic IDs from the runtime rig. */
  rigDefinition?: RigDefinition;
  /** Optional generic three-joint chains; humanoid arm/leg chains are inferred otherwise. */
  ikChains?: readonly IkChainDefinition[];
  /** A document is cloned on entry. When omitted, the local draft is restored. */
  document?: AnimationSuiteDocument;
  /** Override when several authoring suites use the same rig ID. */
  autosaveKey?: string;
  /** Receives sampled scalar/deformation controls after the joint pose is applied. */
  applyScalars?: (values: Readonly<Record<string, number>>) => void;
  /** Pure custom procedural evaluators registered by the runtime/tool host. */
  proceduralEvaluators?: ProceduralEvaluatorRegistry;
  /** Called after committed edits and undo/redo, never on every playback frame. */
  onDocumentChange?: (document: AnimationSuiteDocument) => void;
}

export interface AnimationStudioHandle {
  /** Advance deterministic preview playback. The host keeps its simulation frozen. */
  frame(dt: number): void;
  close(): void;
  getDocument(): AnimationSuiteDocument;
  setDocument(document: AnimationSuiteDocument): void;
  readonly diagnostics: AnimationStudioDiagnostics;
  readonly isOpen: boolean;
}

export interface AnimationStudioDiagnostics {
  getState(): {
    clipId?: string;
    clipName?: string;
    time: number;
    playing: boolean;
    playbackSpeed?: number;
    authoringMode: AuthoringMode;
    ikChainCount: number;
    proceduralDriverCount: number;
    selectedJointId?: string;
    trackCount: number;
    keyCount: number;
  };
  selectClip(clipId: string): boolean;
  seek(time: number): void;
  play(): void;
  pause(): void;
  setPlaybackSpeed(speed: number): void;
  rootElement(): HTMLElement;
}

/** Open the full-screen, runtime-agnostic animation authoring workspace. */
export function openAnimationStudio(ctx: AnimationStudioContext): AnimationStudioHandle {
  return new AnimationStudio(ctx);
}

function dom<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(label: string, title = label): HTMLButtonElement {
  const element = dom('button', 'ast-button', label);
  element.type = 'button';
  element.title = title;
  return element;
}

function input(type: string, className = 'ast-input'): HTMLInputElement {
  const element = dom('input', className);
  element.type = type;
  return element;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, className = ''): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (className) element.setAttribute('class', className);
  return element;
}

function cloneDocument(document: AnimationSuiteDocument): AnimationSuiteDocument {
  return structuredClone(document);
}

function documentsMatch(a: AnimationSuiteDocument, b: AnimationSuiteDocument): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function frameTime(time: number): number {
  return Math.round(time * FRAME_RATE) / FRAME_RATE;
}

function setNumberInput(element: HTMLInputElement, value: number, digits = 3): void {
  if (document.activeElement === element) return;
  element.value = Number(value.toFixed(digits)).toString();
}

function editableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element?.closest('input,textarea,select,[contenteditable=true]');
}

function localStorageAvailable(): boolean {
  try {
    const probe = '__sol_animation_studio_probe__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function uniqueName(base: string, existing: Iterable<string>): string {
  const names = new Set(existing);
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function isRenderable(object: THREE.Object3D): boolean {
  const candidate = object as THREE.Object3D & {
    isMesh?: boolean;
    isLine?: boolean;
    isPoints?: boolean;
    isSprite?: boolean;
    isLight?: boolean;
    isCamera?: boolean;
  };
  return !!(
    candidate.isMesh || candidate.isLine || candidate.isPoints || candidate.isSprite ||
    candidate.isLight || candidate.isCamera
  );
}

function stableJointId(node: THREE.Object3D, parentId: string | null, used: Set<string>): string {
  const explicit = typeof node.userData.jointId === 'string' ? node.userData.jointId : '';
  const source = explicit || node.name || (parentId ? `${parentId}.joint` : 'root');
  const slug = source
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .replace(/[^a-zA-Z0-9_.-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase() || 'joint';
  let id = slug;
  let suffix = 2;
  while (used.has(id)) {
    id = `${slug}.${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function inferMirrorId(id: string, ids: ReadonlySet<string>): string | undefined {
  const variants: Array<[RegExp, string]> = [
    [/(^|[._-])left($|[._-])/i, '$1right$2'],
    [/(^|[._-])right($|[._-])/i, '$1left$2'],
    [/(^|[._-])l($|[._-])/i, '$1r$2'],
    [/(^|[._-])r($|[._-])/i, '$1l$2'],
  ];
  for (const [pattern, replacement] of variants) {
    const candidate = id.replace(pattern, replacement);
    if (candidate !== id && ids.has(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Conservative fallback for procedural rigs that have not published a formal
 * RigDefinition yet. Groups/Bones become joints; renderable children remain
 * attached geometry. Supplying a semantic definition is still preferable.
 */
function inferRig(root: THREE.Object3D): { definition: RigDefinition; nodes: Map<JointId, THREE.Object3D> } {
  const nodes = new Map<JointId, THREE.Object3D>();
  const joints: RigJointDefinition[] = [];
  const used = new Set<string>();

  const visit = (node: THREE.Object3D, parentId: string | null): void => {
    if (node !== root && isRenderable(node)) return;
    const id = stableJointId(node, parentId, used);
    nodes.set(id, node);
    joints.push({
      id,
      nodeName: node.name || id,
      name: node.name || id,
      parentId,
      rest: {
        position: node.position.toArray() as Vec3Tuple,
        quaternion: node.quaternion.toArray() as [number, number, number, number],
        scale: node.scale.toArray() as Vec3Tuple,
      },
      tags: (node as THREE.Bone).isBone ? ['bone'] : ['control'],
    });
    for (const child of node.children) visit(child, id);
  };
  visit(root, null);

  const ids = new Set(joints.map((joint) => joint.id));
  const pairs: [string, string][] = [];
  const paired = new Set<string>();
  for (const joint of joints) {
    const mirrorId = inferMirrorId(joint.id, ids);
    if (!mirrorId) continue;
    joint.mirrorId = mirrorId;
    if (!paired.has(joint.id) && !paired.has(mirrorId)) {
      pairs.push([joint.id, mirrorId]);
      paired.add(joint.id);
      paired.add(mirrorId);
    }
  }

  const definition: RigDefinition = {
    schema: RIG_SCHEMA,
    version: RIG_SCHEMA_VERSION,
    id: `runtime-${root.name || 'character'}`.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-'),
    name: root.name ? `${root.name} Runtime Rig` : 'Runtime Character Rig',
    rootJointId: joints[0]?.id ?? 'root',
    coordinateSystem: {
      handedness: 'right',
      up: 'Y',
      localForward: '-Z',
      units: 'metres',
    },
    joints,
    sockets: [],
    controls: [],
  };
  if (pairs.length > 0) definition.mirror = { axis: 'x', jointPairs: pairs };
  return { definition, nodes };
}

function bindRig(definition: RigDefinition, root: THREE.Object3D): Map<JointId, THREE.Object3D> {
  const byName = new Map<string, THREE.Object3D[]>();
  root.traverse((node) => {
    const list = byName.get(node.name);
    if (list) list.push(node);
    else byName.set(node.name, [node]);
  });
  const nodes = new Map<JointId, THREE.Object3D>();
  for (const joint of definition.joints) {
    const explicit = root.getObjectByProperty('uuid', joint.nodeName);
    const named = byName.get(joint.nodeName)?.[0];
    const tagged = root.getObjectByProperty('userData.jointId', joint.id);
    const node = explicit ?? tagged ?? named;
    if (node) nodes.set(joint.id, node);
  }
  return nodes;
}

function makeInitialDocument(rig: RigDefinition): AnimationSuiteDocument {
  if (rig.id === 'player-procedural-v1') return createPlayerStarterAnimationSuite(rig);
  const clip = createAnimationClip({ name: 'Idle', rigId: rig.id, duration: DEFAULT_DURATION });
  return createAnimationSuiteDocument({
    id: `${rig.id}-animation-suite`,
    name: `${rig.name} Animations`,
    rigs: [rig],
    clips: [clip],
    activeClipId: clip.id,
  });
}

function createIkHandle(kind: 'target' | 'pole'): THREE.Group {
  const group = new THREE.Group();
  group.name = `animation-ik-${kind}`;
  const color = kind === 'target' ? 0x61ddff : 0xffd16a;
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.82,
    depthTest: false,
    depthWrite: false,
    wireframe: true,
  });
  const core = kind === 'target'
    ? new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 7), material)
    : new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), material);
  core.renderOrder = 95;
  core.userData.ikHandle = kind;
  group.add(core);
  if (kind === 'target') {
    for (const rotation of [[Math.PI / 2, 0, 0], [0, Math.PI / 2, 0], [0, 0, 0]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 24), material.clone());
      ring.rotation.set(rotation[0], rotation[1], rotation[2]);
      ring.renderOrder = 95;
      ring.userData.ikHandle = kind;
      group.add(ring);
    }
  }
  group.visible = false;
  return group;
}

function createIkGuide(): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(30).fill(0), 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x61ddff,
    transparent: true,
    opacity: 0.5,
    depthTest: false,
    depthWrite: false,
  });
  const guide = new THREE.LineSegments(geometry, material);
  guide.name = 'animation-ik-guide';
  guide.renderOrder = 92;
  guide.frustumCulled = false;
  guide.visible = false;
  return guide;
}

function disposeObjectGeometry(root: THREE.Object3D): void {
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    renderable.geometry?.dispose();
    const material = renderable.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
}

class AnimationStudio implements AnimationStudioHandle {
  private readonly root = dom('div', 'ast-root');
  private readonly rig: RigDefinition;
  private readonly jointNodes: Map<JointId, THREE.Object3D>;
  private readonly binding: RigBinding | undefined;
  private readonly ikChains: ResolvedIkChain[];
  private selectedIkChainId: string | undefined;
  private lastIkResult: IkSolveResult | undefined;
  private animationDocument: AnimationSuiteDocument;
  private readonly storageKey: string;
  private readonly legacyStorageKey: string;
  private readonly draftStore: AnimationDraftStore | undefined;
  private readonly preferredDraftStore: AsyncAnimationDraftStore | undefined;
  private readonly draftDocumentId: string;
  private editRevision = 0;
  private storageTimer: number | undefined;
  private toastTimer: number | undefined;
  private cancelActiveDrag: (() => void) | undefined;
  private open = true;
  private playing = false;
  private playbackDirection: 1 | -1 = 1;
  private playTime = 0;
  private needsSample = true;
  private autoKey = true;
  private authoringMode: AuthoringMode = 'fk';
  private transformMode: TransformMode = 'rotate';
  private selectedJointId: JointId | undefined;
  private selectedKey: SelectedKey | undefined;
  private selectedAnnotation: SelectedAnnotation | undefined;
  private selectedTrackId: string | undefined;
  private selectedDriverId: string | undefined;
  private motionContext: ProceduralMotionContext = {
    normalizedSpeed: 0.5,
    gaitPhase: 0,
    verticalVelocity: 0,
    grounded: true,
    actionProgress: 0,
  };
  private proceduralBakeFps = FRAME_RATE;
  private currentScalars: Record<string, number> = {};
  private collapsedJoints = new Set<JointId>();
  private onionEnabled = false;
  private onionStep = 2 / FRAME_RATE;
  private onionDirty = true;
  private transaction: Transaction | undefined;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private readonly restoreTransforms: TransformSnapshot[] = [];

  private readonly orbit: OrbitControls;
  private readonly transform: TransformControls;
  private readonly ikTargetTransform: TransformControls;
  private readonly ikPoleTransform: TransformControls;
  private readonly cameraSnapshot: CameraSnapshot;
  private readonly grid = new THREE.GridHelper(8, 32, 0x506079, 0x273143);
  private readonly axes = new THREE.AxesHelper(0.35);
  private readonly onionBefore = new THREE.Group();
  private readonly onionAfter = new THREE.Group();
  private readonly ikTargetHandle = createIkHandle('target');
  private readonly ikPoleHandle = createIkHandle('pole');
  private readonly ikGuide = createIkGuide();

  private clipSelect!: HTMLSelectElement;
  private clipNameInput!: HTMLInputElement;
  private durationInput!: HTMLInputElement;
  private speedSlider!: HTMLInputElement;
  private speedInput!: HTMLInputElement;
  private loopButton!: HTMLButtonElement;
  private loopModeSelect!: HTMLSelectElement;
  private loopStartInput!: HTMLInputElement;
  private loopEndInput!: HTMLInputElement;
  private playButton!: HTMLButtonElement;
  private autoKeyButton!: HTMLButtonElement;
  private undoButton!: HTMLButtonElement;
  private redoButton!: HTMLButtonElement;
  private scrubInput!: HTMLInputElement;
  private timeInput!: HTMLInputElement;
  private timeLabel!: HTMLElement;
  private jointTree!: HTMLElement;
  private jointFilter!: HTMLInputElement;
  private inspector!: HTMLElement;
  private driverList!: HTMLElement;
  private proceduralInspector!: HTMLElement;
  private proceduralGraphHost: HTMLElement | undefined;
  private curveSection!: HTMLElement;
  private timelineLabels!: HTMLElement;
  private timelineCanvas!: HTMLElement;
  private sheet!: HTMLElement;
  private playhead!: HTMLElement;
  private toastElement!: HTMLElement;
  private transformInputs: HTMLInputElement[][] = [];
  private scalarInputs = new Map<string, { slider: HTMLInputElement; exact: HTMLInputElement }>();
  private keyInterpolationSelect!: HTMLSelectElement;
  private inTangentInput!: HTMLInputElement;
  private outTangentInput!: HTMLInputElement;
  private ikStatusElement: HTMLElement | undefined;
  private ikTargetInputs: HTMLInputElement[] = [];
  private ikPoleInputs: HTMLInputElement[] = [];
  readonly diagnostics: AnimationStudioDiagnostics;

  constructor(private readonly ctx: AnimationStudioContext) {
    installAnimationStudioStyles();
    document.body.classList.add('animation-studio-open');

    const inferred = inferRig(ctx.rigRoot);
    let binding: RigBinding | undefined;
    try {
      binding = ctx.rigDefinition
        ? RigBinding.fromDefinition(ctx.rigRoot, ctx.rigDefinition, { strict: false })
        : RigBinding.fromSculptRuntime(ctx.rigRoot, { strict: false });
    } catch {
      // The fallback inferred rig keeps the studio useful for an arbitrary
      // procedural hierarchy while that character publishes semantic metadata.
    }
    this.binding = binding;
    this.rig = binding?.definition ?? ctx.rigDefinition ?? inferred.definition;
    this.jointNodes = binding ? new Map(binding.joints) : ctx.rigDefinition ? bindRig(this.rig, ctx.rigRoot) : inferred.nodes;
    const socketNodes = binding
      ? new Map(binding.sockets)
      : new Map(this.rig.sockets.flatMap((socket) => {
          const node = ctx.rigRoot.getObjectByName(socket.nodeName);
          return node ? [[socket.id, node] as const] : [];
        }));
    const ikRig = {
      root: binding?.root ?? ctx.rigRoot,
      definition: this.rig,
      joints: this.jointNodes,
      sockets: socketNodes,
    };
    const ikDefinitions = ctx.ikChains ?? inferHumanoidIkChainDefinitions(this.rig);
    this.ikChains = resolveIkChains(ikDefinitions, ikRig);
    this.selectedIkChainId = this.ikChains[0]?.id;
    const starterDocument = makeInitialDocument(this.rig);
    this.draftDocumentId = starterDocument.id;
    this.legacyStorageKey = `solProtoAnimationSuite:${this.rig.id}`;
    let draftStore: AnimationDraftStore | undefined;
    if (!ctx.autosaveKey && localStorageAvailable()) {
      try {
        draftStore = createLocalDraftStore();
      } catch {
        // Private browsing or storage policy can disable drafts without
        // disabling the editor itself.
      }
    }
    this.draftStore = draftStore;
    let preferredDraftStore: AsyncAnimationDraftStore | undefined;
    try {
      preferredDraftStore = draftStore
        ? createPreferredDraftStore({ fallback: draftStore })
        : createIndexedDbDraftStore();
    } catch {
      // In-memory editing/export remains available when browser persistence is disabled.
    }
    this.preferredDraftStore = preferredDraftStore;
    this.storageKey = ctx.autosaveKey ?? draftStore?.keyFor(starterDocument.id) ?? `solProtoAnimationDraft:${starterDocument.id}`;
    this.animationDocument = this.loadInitialDocument(ctx.document, starterDocument);
    // Saved clips are durable, but the live character owns the current rig
    // contract. Refresh an older embedded definition with the same stable rig
    // ID so newly added humanoid bones, roles, aliases, and retarget poses are
    // available immediately without discarding any authored animation.
    this.ensureRigAndClip();
    this.selectedJointId = this.rig.rootJointId;
    this.diagnostics = {
      getState: () => {
        const clip = this.activeClip();
        return {
          ...(clip ? { clipId: clip.id, clipName: clip.name, playbackSpeed: clip.playbackSpeed } : {}),
          time: this.playTime,
          playing: this.playing,
          authoringMode: this.authoringMode,
          ikChainCount: this.ikChains.length,
          proceduralDriverCount: clip?.proceduralDrivers.length ?? 0,
          ...(this.selectedJointId ? { selectedJointId: this.selectedJointId } : {}),
          trackCount: clip?.tracks.length ?? 0,
          keyCount: clip?.tracks.reduce((sum, track) => sum + track.keys.length, 0) ?? 0,
        };
      },
      selectClip: (clipId) => {
        if (!this.animationDocument.clips.some((clip) => clip.id === clipId)) return false;
        this.selectClip(clipId);
        return true;
      },
      seek: (time) => this.seek(time),
      play: () => {
        if (!this.playing) this.togglePlayback();
      },
      pause: () => this.pausePlayback(),
      setPlaybackSpeed: (speed) => this.setPlaybackSpeed(speed),
      rootElement: () => this.root,
    };

    ctx.rigRoot.traverse((node) => {
      this.restoreTransforms.push({
        node,
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
        scale: node.scale.clone(),
      });
    });

    this.cameraSnapshot = {
      position: ctx.camera.position.clone(),
      quaternion: ctx.camera.quaternion.clone(),
      zoom: ctx.camera.zoom,
      near: ctx.camera.near,
      far: ctx.camera.far,
    };
    this.orbit = new OrbitControls(ctx.camera, ctx.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.screenSpacePanning = true;

    this.transform = new TransformControls(ctx.camera, ctx.renderer.domElement);
    this.transform.setMode(this.transformMode);
    this.transform.setSpace('local');
    this.transform.setSize(0.72);
    ctx.scene.add(this.transform);
    this.transform.addEventListener('dragging-changed', (event) => {
      this.orbit.enabled = !event.value;
    });
    this.transform.addEventListener('mouseDown', () => {
      this.pausePlayback();
      this.beginTransaction('Transform joint');
    });
    this.transform.addEventListener('objectChange', () => this.onTransformChanged());
    this.transform.addEventListener('mouseUp', () => this.finishTransformTransaction());

    this.ikTargetTransform = this.createIkTransformControl(this.ikTargetHandle, 'Move IK target');
    this.ikPoleTransform = this.createIkTransformControl(this.ikPoleHandle, 'Move IK pole');
    this.ikTargetTransform.visible = false;
    this.ikPoleTransform.visible = false;

    this.grid.position.copy(ctx.rigRoot.getWorldPosition(new THREE.Vector3()));
    this.grid.position.y = new THREE.Box3().setFromObject(ctx.rigRoot).min.y;
    this.grid.material.opacity = 0.28;
    this.grid.material.transparent = true;
    this.axes.position.copy(this.grid.position);
    this.axes.renderOrder = 20;
    this.onionBefore.name = 'animation-onion-before';
    this.onionAfter.name = 'animation-onion-after';
    ctx.scene.add(
      this.grid,
      this.axes,
      this.onionBefore,
      this.onionAfter,
      this.ikTargetHandle,
      this.ikPoleHandle,
      this.ikGuide,
      this.ikTargetTransform,
      this.ikPoleTransform,
    );

    this.frameCamera();
    this.buildInterface();
    document.body.appendChild(this.root);
    this.bindKeyboard();
    this.selectJoint(this.selectedJointId);
    this.refreshAll();
    this.seek(this.activeClip()?.range.start ?? 0);
    void this.restorePreferredDraft();
  }

  get isOpen(): boolean {
    return this.open;
  }

  getDocument(): AnimationSuiteDocument {
    return cloneDocument(this.animationDocument);
  }

  setDocument(document: AnimationSuiteDocument): void {
    this.commitMutation('Replace animation suite', () => {
      this.animationDocument = cloneDocument(document);
      this.ensureRigAndClip();
    });
    this.refreshAll();
    this.seek(this.activeClip()?.range.start ?? 0);
  }

  frame(dt: number): void {
    if (!this.open) return;
    const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const clip = this.activeClip();
    if (this.playing && clip) {
      this.advancePlayback(safeDt, clip);
      this.needsSample = true;
    }
    if (this.needsSample) this.sampleCurrentPose();
    if (this.onionEnabled && this.onionDirty) this.updateOnionSkin();
    this.orbit.update();
    this.syncTimeUi();
  }

  close(): void {
    if (!this.open) return;
    this.cancelActiveDrag?.();
    this.open = false;
    this.cancelTransaction();
    this.saveDraftNow();
    if (this.storageTimer !== undefined) window.clearTimeout(this.storageTimer);
    if (this.toastTimer !== undefined) window.clearTimeout(this.toastTimer);
    this.transform.detach();
    this.transform.dispose();
    this.ikTargetTransform.detach();
    this.ikTargetTransform.dispose();
    this.ikPoleTransform.detach();
    this.ikPoleTransform.dispose();
    this.orbit.dispose();
    this.ctx.scene.remove(
      this.transform,
      this.grid,
      this.axes,
      this.onionBefore,
      this.onionAfter,
      this.ikTargetHandle,
      this.ikPoleHandle,
      this.ikGuide,
      this.ikTargetTransform,
      this.ikPoleTransform,
    );
    this.disposeOnionGroup(this.onionBefore);
    this.disposeOnionGroup(this.onionAfter);
    disposeObjectGeometry(this.ikTargetHandle);
    disposeObjectGeometry(this.ikPoleHandle);
    this.ikGuide.geometry.dispose();
    if (Array.isArray(this.ikGuide.material)) this.ikGuide.material.forEach((material) => material.dispose());
    else this.ikGuide.material.dispose();
    this.grid.geometry.dispose();
    if (Array.isArray(this.grid.material)) this.grid.material.forEach((material) => material.dispose());
    else this.grid.material.dispose();
    this.axes.geometry.dispose();
    if (Array.isArray(this.axes.material)) this.axes.material.forEach((material) => material.dispose());
    else this.axes.material.dispose();
    for (const snapshot of this.restoreTransforms) {
      snapshot.node.position.copy(snapshot.position);
      snapshot.node.quaternion.copy(snapshot.quaternion);
      snapshot.node.scale.copy(snapshot.scale);
    }
    this.ctx.camera.position.copy(this.cameraSnapshot.position);
    this.ctx.camera.quaternion.copy(this.cameraSnapshot.quaternion);
    this.ctx.camera.zoom = this.cameraSnapshot.zoom;
    this.ctx.camera.near = this.cameraSnapshot.near;
    this.ctx.camera.far = this.cameraSnapshot.far;
    this.ctx.camera.updateProjectionMatrix();
    this.root.remove();
    document.body.classList.remove('animation-studio-open');
    window.removeEventListener('keydown', this.onKeyDown);
    this.ctx.onClose();
  }

  private buildInterface(): void {
    const topbar = dom('div', 'ast-topbar');
    const left = dom('aside', 'ast-panel ast-left');
    const right = dom('aside', 'ast-panel ast-right');
    const timeline = dom('section', 'ast-timeline');
    this.root.append(topbar, left, right, timeline);

    this.buildTopbar(topbar);
    this.buildClipPanel(left);
    this.buildDriverListPanel(left);
    this.buildJointPanel(left);
    this.buildInspectorPanel(right);
    this.buildProceduralInspectorPanel(right);
    this.buildCurvePanel(right);
    this.buildTimeline(timeline);

    this.toastElement = dom('div', 'ast-toast');
    this.root.appendChild(this.toastElement);
  }

  private buildTopbar(parent: HTMLElement): void {
    parent.appendChild(dom('div', 'ast-brand', 'ANIMATION STUDIO'));

    this.undoButton = button('↶', 'Undo (Ctrl/Cmd+Z)');
    this.redoButton = button('↷', 'Redo (Ctrl/Cmd+Shift+Z)');
    this.undoButton.onclick = () => this.undo();
    this.redoButton.onclick = () => this.redo();
    parent.append(this.undoButton, this.redoButton, dom('div', 'ast-divider'));

    for (const [mode, label, shortcut] of [
      ['translate', 'Move', 'W'],
      ['rotate', 'Rotate', 'E'],
      ['scale', 'Scale', 'R'],
    ] as const) {
      const modeButton = button(label, `${label} selected joint (${shortcut})`);
      modeButton.classList.add('ast-wide');
      modeButton.dataset.transformMode = mode;
      modeButton.onclick = () => this.setTransformMode(mode);
      parent.appendChild(modeButton);
    }
    const ikButton = button('IK', 'Pose a declared or inferred three-joint chain (I)');
    ikButton.dataset.authoringMode = 'ik';
    ikButton.onclick = () => this.enterIkMode();
    parent.appendChild(ikButton);

    parent.appendChild(dom('div', 'ast-divider'));
    this.autoKeyButton = button('● Auto key', 'Key the edited transform at the playhead');
    this.autoKeyButton.onclick = () => {
      this.autoKey = !this.autoKey;
      this.refreshToolbar();
    };
    const setKeyButton = button('◆ Set key', 'Key position, rotation and scale (S)');
    setKeyButton.onclick = () => {
      if (this.authoringMode === 'ik') this.setIkKeys(true);
      else this.setKeyForSelected(false, true);
    };
    const deleteKeyButton = button('◇ Delete key', 'Delete selected/current transform keys');
    deleteKeyButton.onclick = () => this.deleteCurrentKeys();
    parent.append(this.autoKeyButton, setKeyButton, deleteKeyButton);

    const mirrorButton = button('⇄ Mirror', 'Mirror the current pose across the rig symmetry axis');
    mirrorButton.onclick = () => this.mirrorPose();
    const onionButton = button('◉ Onion', 'Show previous and next joint poses');
    onionButton.dataset.onionButton = 'true';
    onionButton.onclick = () => {
      this.onionEnabled = !this.onionEnabled;
      this.onionBefore.visible = this.onionEnabled;
      this.onionAfter.visible = this.onionEnabled;
      this.onionDirty = true;
      this.refreshToolbar();
    };
    parent.append(mirrorButton, onionButton);

    parent.appendChild(dom('div', 'ast-spacer'));
    const importButton = button('Import', 'Import animation-suite JSON');
    const exportButton = button('Export', 'Copy or download animation-suite JSON');
    importButton.onclick = () => this.openImportModal();
    exportButton.onclick = () => this.openExportModal();
    const closeButton = button('×', 'Close Animation Studio');
    closeButton.classList.add('ast-icon');
    closeButton.onclick = () => this.close();
    parent.append(importButton, exportButton, closeButton);
  }

  private buildClipPanel(parent: HTMLElement): void {
    const section = dom('section', 'ast-section');
    section.appendChild(this.sectionTitle('Animations'));

    const selectRow = dom('div', 'ast-field');
    this.clipSelect = dom('select', 'ast-select ast-grow');
    this.clipSelect.setAttribute('aria-label', 'Selected animation');
    this.clipSelect.onchange = () => this.selectClip(this.clipSelect.value);
    selectRow.appendChild(this.clipSelect);
    section.appendChild(selectRow);

    const buttons = dom('div', 'ast-button-row');
    const createButton = button('+ New');
    const duplicateButton = button('Duplicate');
    const deleteButton = button('Delete');
    deleteButton.classList.add('ast-danger');
    createButton.onclick = () => this.createClip();
    duplicateButton.onclick = () => this.duplicateActiveClip();
    deleteButton.onclick = () => this.deleteActiveClip();
    buttons.append(createButton, duplicateButton, deleteButton);
    section.appendChild(buttons);

    this.clipNameInput = input('text');
    this.clipNameInput.onchange = () => {
      const name = this.clipNameInput.value.trim();
      if (!name) return this.refreshClipPanel();
      this.updateActiveClip('Rename animation', (clip) => ({ ...clip, name }));
    };
    section.appendChild(this.field('Name', this.clipNameInput));

    this.durationInput = input('number');
    this.durationInput.min = String(MIN_DURATION);
    this.durationInput.step = String(1 / FRAME_RATE);
    this.durationInput.onchange = () => {
      const clip = this.activeClip();
      if (!clip) return;
      const duration = Math.max(MIN_DURATION, finite(this.durationInput.value, clip.duration));
      this.updateActiveClip('Change animation duration', (candidate) => {
        const range = { ...candidate.range };
        if (Math.abs(range.end - candidate.duration) <= KEY_EPSILON) range.end = duration;
        range.start = clamp(range.start, 0, duration);
        range.end = clamp(Math.max(range.start, range.end), range.start, duration);
        return { ...candidate, duration, range };
      });
      this.seek(Math.min(this.playTime, duration));
    };
    section.appendChild(this.field('Duration', this.durationInput));

    this.speedSlider = input('range');
    this.speedSlider.min = '0.1';
    this.speedSlider.max = '3';
    this.speedSlider.step = '0.05';
    this.speedInput = input('number');
    this.speedInput.min = String(PLAYBACK_SPEED_MIN);
    this.speedInput.max = String(PLAYBACK_SPEED_MAX);
    this.speedInput.step = '0.05';
    const speedControls = dom('div', 'ast-button-row ast-grow');
    this.speedSlider.classList.add('ast-grow');
    speedControls.append(this.speedSlider, this.speedInput);
    section.appendChild(this.field('Speed', speedControls));
    const setSpeed = (raw: string): void => {
      const clip = this.activeClip();
      if (!clip) return;
      const speed = clamp(finite(raw, clip.playbackSpeed), PLAYBACK_SPEED_MIN, PLAYBACK_SPEED_MAX);
      this.replaceActiveClip({ ...clip, playbackSpeed: speed });
      this.speedSlider.value = String(clamp(speed, 0.1, 3));
      setNumberInput(this.speedInput, speed, 2);
    };
    this.speedSlider.addEventListener('pointerdown', () => this.beginTransaction('Change playback speed'));
    this.speedSlider.onfocus = () => {
      if (!this.transaction) this.beginTransaction('Change playback speed');
    };
    this.speedSlider.addEventListener('input', () => setSpeed(this.speedSlider.value));
    this.speedSlider.addEventListener('change', () => this.commitTransaction());
    this.speedSlider.onblur = () => this.commitTransaction();
    this.speedInput.onfocus = () => this.beginTransaction('Change playback speed');
    this.speedInput.oninput = () => setSpeed(this.speedInput.value);
    this.speedInput.onchange = () => this.commitTransaction();
    this.speedInput.onblur = () => this.commitTransaction();

    this.loopButton = button('LOOP');
    this.loopButton.onclick = () => {
      this.updateActiveClip('Toggle loop', (clip) => ({
        ...clip,
        loop: { ...clip.loop, mode: clip.loop.mode === 'once' ? 'loop' : 'once' },
      }));
    };
    this.loopModeSelect = dom('select', 'ast-select ast-grow');
    for (const [value, label] of [
      ['once', 'Once'],
      ['loop', 'Loop'],
      ['ping-pong', 'Ping-pong'],
    ]) {
      const option = dom('option', '', label);
      option.value = value;
      this.loopModeSelect.appendChild(option);
    }
    this.loopModeSelect.onchange = () => {
      const mode = this.loopModeSelect.value as AnimationClip['loop']['mode'];
      this.updateActiveClip('Change loop mode', (clip) => ({ ...clip, loop: { ...clip.loop, mode } }));
    };
    const loopRow = dom('div', 'ast-button-row ast-grow');
    loopRow.append(this.loopButton, this.loopModeSelect);
    section.appendChild(this.field('Playback', loopRow));

    this.loopStartInput = input('number');
    this.loopEndInput = input('number');
    for (const element of [this.loopStartInput, this.loopEndInput]) {
      element.min = '0';
      element.step = String(1 / FRAME_RATE);
    }
    const rangeRow = dom('div', 'ast-button-row ast-grow');
    rangeRow.append(this.loopStartInput, dom('span', '', '–'), this.loopEndInput);
    section.appendChild(this.field('Loop range', rangeRow));
    this.loopStartInput.onchange = () => this.updateLoopRange('start', this.loopStartInput.value);
    this.loopEndInput.onchange = () => this.updateLoopRange('end', this.loopEndInput.value);

    const seamless = input('checkbox');
    seamless.onchange = () => {
      this.updateActiveClip('Toggle seamless loop', (clip) => ({
        ...clip,
        loop: { ...clip.loop, seamless: seamless.checked },
      }));
    };
    seamless.dataset.seamless = 'true';
    const seamlessLabel = dom('label', 'ast-check');
    seamlessLabel.append(seamless, dom('span', '', 'Seamless endpoints'));
    section.appendChild(seamlessLabel);

    parent.appendChild(section);
  }

  private buildJointPanel(parent: HTMLElement): void {
    const section = dom('section', 'ast-section');
    const title = this.sectionTitle('Rig joints');
    const count = dom('span', '', String(this.rig.joints.length));
    title.appendChild(count);
    section.appendChild(title);
    this.jointFilter = input('search', 'ast-input ast-joint-filter');
    this.jointFilter.placeholder = 'Filter joints…';
    this.jointFilter.oninput = () => this.refreshJointTree();
    this.jointTree = dom('div');
    section.append(this.jointFilter, this.jointTree);
    parent.appendChild(section);
  }

  private buildDriverListPanel(parent: HTMLElement): void {
    const section = dom('section', 'ast-section');
    section.appendChild(this.sectionTitle('Procedural drivers'));
    this.driverList = dom('div');
    const buttons = dom('div', 'ast-button-row');
    const add = button('+ Driver');
    const duplicate = button('Duplicate');
    const remove = button('Delete');
    remove.classList.add('ast-danger');
    add.onclick = () => this.addProceduralDriver();
    duplicate.onclick = () => this.duplicateSelectedDriver();
    remove.onclick = () => this.deleteSelectedDriver();
    buttons.append(add, duplicate, remove);
    section.append(this.driverList, buttons);
    parent.appendChild(section);
  }

  private buildInspectorPanel(parent: HTMLElement): void {
    this.inspector = dom('section', 'ast-section');
    parent.appendChild(this.inspector);
  }

  private buildProceduralInspectorPanel(parent: HTMLElement): void {
    this.proceduralInspector = dom('section', 'ast-section');
    parent.appendChild(this.proceduralInspector);
  }

  private buildCurvePanel(parent: HTMLElement): void {
    this.curveSection = dom('section', 'ast-section');
    parent.appendChild(this.curveSection);
  }

  private buildTimeline(parent: HTMLElement): void {
    const timebar = dom('div', 'ast-timebar');
    this.playButton = button('▶', 'Play/pause (Space)');
    const stopButton = button('■', 'Stop and return to range start');
    const previousButton = button('‹', 'Previous frame');
    const nextButton = button('›', 'Next frame');
    this.playButton.classList.add('ast-icon');
    stopButton.classList.add('ast-icon');
    previousButton.classList.add('ast-icon');
    nextButton.classList.add('ast-icon');
    this.playButton.onclick = () => this.togglePlayback();
    stopButton.onclick = () => this.stopPlayback();
    previousButton.onclick = () => this.stepFrame(-1);
    nextButton.onclick = () => this.stepFrame(1);

    this.timeInput = input('number', 'ast-input ast-timecode');
    this.timeInput.step = String(1 / FRAME_RATE);
    this.timeInput.min = '0';
    this.timeInput.onchange = () => this.seek(finite(this.timeInput.value, this.playTime));
    this.timeLabel = dom('span', 'ast-status');
    this.scrubInput = input('range', 'ast-scrub');
    this.scrubInput.min = '0';
    this.scrubInput.step = String(1 / FRAME_RATE);
    this.scrubInput.addEventListener('pointerdown', () => this.pausePlayback());
    this.scrubInput.oninput = () => this.seek(finite(this.scrubInput.value, this.playTime));

    const markerButton = button('+ Marker');
    const contactButton = button('+ Contact');
    const eventButton = button('+ Event');
    markerButton.onclick = () => this.addAnnotation('marker');
    contactButton.onclick = () => this.addAnnotation('contact');
    eventButton.onclick = () => this.addAnnotation('event');
    timebar.append(
      this.playButton,
      stopButton,
      previousButton,
      nextButton,
      this.timeInput,
      this.timeLabel,
      this.scrubInput,
      markerButton,
      contactButton,
      eventButton,
    );

    const wrap = dom('div', 'ast-sheet-wrap');
    this.sheet = dom('div', 'ast-sheet');
    this.timelineLabels = dom('div', 'ast-sheet-labels');
    this.timelineCanvas = dom('div', 'ast-sheet-canvas');
    this.playhead = dom('div', 'ast-playhead');
    this.timelineCanvas.appendChild(this.playhead);
    this.sheet.append(this.timelineLabels, this.timelineCanvas);
    wrap.appendChild(this.sheet);
    parent.append(timebar, wrap);

    this.timelineCanvas.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.ast-key')) return;
      this.pausePlayback();
      this.seek(this.timeFromPointer(event, this.timelineCanvas));
    });
    this.timelineCanvas.addEventListener('dblclick', (event) => {
      if ((event.target as HTMLElement).closest('.ast-key')) return;
      this.seek(this.timeFromPointer(event, this.timelineCanvas));
      this.setKeyForSelected(true, true);
    });
  }

  private sectionTitle(text: string): HTMLElement {
    const title = dom('div', 'ast-section-title');
    title.appendChild(dom('span', '', text));
    return title;
  }

  private field(label: string, control: HTMLElement): HTMLElement {
    const row = dom('div', 'ast-field');
    row.append(dom('label', '', label), control);
    return row;
  }

  private loadInitialDocument(
    supplied: AnimationSuiteDocument | undefined,
    starter: AnimationSuiteDocument,
  ): AnimationSuiteDocument {
    if (supplied) return cloneDocument(supplied);
    try {
      const draft = this.draftStore?.load(this.draftDocumentId);
      if (draft) return draft;
    } catch {
      // Fall through to the compatibility reader and then the starter suite.
    }
    if (localStorageAvailable()) {
      try {
        const raw = localStorage.getItem(this.storageKey) ?? localStorage.getItem(this.legacyStorageKey);
        if (raw) {
          const candidate = JSON.parse(raw) as Partial<AnimationSuiteDocument>;
          if (
            candidate.schema === ANIMATION_SUITE_SCHEMA &&
            candidate.version === ANIMATION_SUITE_SCHEMA_VERSION &&
            Array.isArray(candidate.rigs) &&
            Array.isArray(candidate.clips)
          ) return parseAnimationSuite(candidate);
        }
      } catch {
        // A corrupt local draft must never prevent opening the studio.
      }
    }
    return starter;
  }

  private ensureRigAndClip(): void {
    const hasLiveRig = this.animationDocument.rigs.some((candidate) => candidate.id === this.rig.id);
    this.animationDocument = {
      ...this.animationDocument,
      rigs: hasLiveRig
        ? this.animationDocument.rigs.map((candidate) => candidate.id === this.rig.id ? this.rig : candidate)
        : [...this.animationDocument.rigs, this.rig],
    };
    this.ensureActiveClip();
  }

  private ensureActiveClip(): void {
    let active = this.animationDocument.clips.find((clip) => clip.id === this.animationDocument.activeClipId);
    if (!active) active = this.animationDocument.clips.find((clip) => clip.rigId === this.rig.id);
    if (!active && this.animationDocument.clips.length > 0) active = this.animationDocument.clips[0];
    if (!active) {
      active = createAnimationClip({ rigId: this.rig.id, duration: DEFAULT_DURATION, name: 'Idle' });
      this.animationDocument = upsertClip(this.animationDocument, active);
    }
    this.animationDocument = setActiveClip(this.animationDocument, active.id);
  }

  private activeClip(): AnimationClip | undefined {
    return this.animationDocument.clips.find((clip) => clip.id === this.animationDocument.activeClipId);
  }

  private replaceActiveClip(clip: AnimationClip): void {
    this.animationDocument = upsertClip(this.animationDocument, clip);
    this.needsSample = true;
    this.onionDirty = true;
  }

  private updateActiveClip(label: string, update: (clip: AnimationClip) => AnimationClip): void {
    const clip = this.activeClip();
    if (!clip) return;
    this.commitMutation(label, () => this.replaceActiveClip(update(clip)));
    this.refreshAll();
  }

  private commitMutation(label: string, mutate: () => void): void {
    if (this.transaction) {
      mutate();
      return;
    }
    const before = cloneDocument(this.animationDocument);
    mutate();
    const after = cloneDocument(this.animationDocument);
    if (documentsMatch(before, after)) return;
    this.pushHistory({ label, before, after });
    this.didCommit();
  }

  private beginTransaction(label: string): void {
    if (this.transaction) this.commitTransaction();
    this.transaction = { label, before: cloneDocument(this.animationDocument) };
  }

  private commitTransaction(): void {
    const transaction = this.transaction;
    if (!transaction) return;
    this.transaction = undefined;
    const after = cloneDocument(this.animationDocument);
    if (documentsMatch(transaction.before, after)) return;
    this.pushHistory({ label: transaction.label, before: transaction.before, after });
    this.didCommit();
  }

  private cancelTransaction(): void {
    if (!this.transaction) return;
    this.animationDocument = cloneDocument(this.transaction.before);
    this.transaction = undefined;
    this.needsSample = true;
    this.onionDirty = true;
    this.refreshAll();
  }

  private pushHistory(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
    this.refreshToolbar();
  }

  private undo(): void {
    this.cancelTransaction();
    const entry = this.undoStack.pop();
    if (!entry) return;
    this.redoStack.push(entry);
    this.animationDocument = cloneDocument(entry.before);
    this.ensureActiveClip();
    this.needsSample = true;
    this.onionDirty = true;
    this.refreshAll();
    this.didCommit();
    this.toast(`Undo: ${entry.label}`);
  }

  private redo(): void {
    this.cancelTransaction();
    const entry = this.redoStack.pop();
    if (!entry) return;
    this.undoStack.push(entry);
    this.animationDocument = cloneDocument(entry.after);
    this.ensureActiveClip();
    this.needsSample = true;
    this.onionDirty = true;
    this.refreshAll();
    this.didCommit();
    this.toast(`Redo: ${entry.label}`);
  }

  private didCommit(): void {
    this.editRevision += 1;
    this.scheduleAutosave();
    this.ctx.onDocumentChange?.(cloneDocument(this.animationDocument));
    this.refreshToolbar();
  }

  private scheduleAutosave(): void {
    if (!this.preferredDraftStore && !localStorageAvailable()) return;
    if (this.storageTimer !== undefined) window.clearTimeout(this.storageTimer);
    this.storageTimer = window.setTimeout(() => {
      this.storageTimer = undefined;
      this.saveDraftNow();
    }, 350);
  }

  private saveDraftNow(): void {
    const snapshot = cloneDocument(this.animationDocument);
    let localSaved = false;
    if (localStorageAvailable()) {
      try {
        if (this.draftStore && snapshot.id === this.draftDocumentId) {
          this.animationDocument = this.draftStore.save(snapshot);
        } else {
          localStorage.setItem(this.storageKey, stringifyAnimationSuite(snapshot));
        }
        localSaved = true;
      } catch {
        // Dense animation documents can exceed localStorage; IndexedDB still gets a chance below.
      }
    }
    if (this.preferredDraftStore) {
      void this.preferredDraftStore.save(snapshot).catch(() => {
        if (!localSaved) this.toast('Autosave unavailable');
      });
    } else if (!localSaved) {
      this.toast('Autosave unavailable');
    }
  }

  private async restorePreferredDraft(): Promise<void> {
    if (!this.preferredDraftStore) return;
    const revision = this.editRevision;
    try {
      const draft = await this.preferredDraftStore.load(this.draftDocumentId);
      if (!draft || !this.open || revision !== this.editRevision || documentsMatch(draft, this.animationDocument)) return;
      this.animationDocument = draft;
      this.ensureRigAndClip();
      this.playTime = this.activeClip()?.range.start ?? 0;
      this.needsSample = true;
      this.onionDirty = true;
      this.refreshAll();
      this.ctx.onDocumentChange?.(cloneDocument(this.animationDocument));
      this.toast('Restored animation draft');
    } catch {
      // The preferred store already attempts localStorage; a failure here is
      // intentionally non-fatal and the in-memory starter suite remains live.
    }
  }

  private createClip(): void {
    const name = uniqueName('New Animation', this.animationDocument.clips.map((clip) => clip.name));
    const clip = createAnimationClip({ rigId: this.rig.id, duration: DEFAULT_DURATION, name });
    this.commitMutation('Create animation', () => {
      this.animationDocument = setActiveClip(upsertClip(this.animationDocument, clip), clip.id);
    });
    this.playing = false;
    this.selectedKey = undefined;
    this.selectedTrackId = undefined;
    this.selectedDriverId = clip.proceduralDrivers[0]?.id;
    this.playTime = clip.range.start;
    this.refreshAll();
    this.needsSample = true;
  }

  private duplicateActiveClip(): void {
    const source = this.activeClip();
    if (!source) return;
    const name = uniqueName(`${source.name} Copy`, this.animationDocument.clips.map((clip) => clip.name));
    const copy = duplicateClip(source, createAnimationId('clip'), name);
    this.commitMutation('Duplicate animation', () => {
      this.animationDocument = setActiveClip(upsertClip(this.animationDocument, copy), copy.id);
    });
    this.playing = false;
    this.selectedKey = undefined;
    this.selectedTrackId = undefined;
    this.selectedDriverId = copy.proceduralDrivers[0]?.id;
    this.playTime = copy.range.start;
    this.refreshAll();
  }

  private deleteActiveClip(): void {
    const clip = this.activeClip();
    if (!clip) return;
    if (!window.confirm(`Delete animation “${clip.name}”? This can be undone.`)) return;
    this.commitMutation('Delete animation', () => {
      this.animationDocument = removeClip(this.animationDocument, clip.id);
      this.ensureActiveClip();
    });
    this.playing = false;
    this.selectedKey = undefined;
    this.selectedTrackId = undefined;
    this.selectedDriverId = this.activeClip()?.proceduralDrivers[0]?.id;
    this.playTime = this.activeClip()?.range.start ?? 0;
    this.refreshAll();
  }

  private activeProceduralDriver(): ProceduralDriverDefinition | undefined {
    const drivers = this.activeClip()?.proceduralDrivers ?? [];
    return drivers.find((driver) => driver.id === this.selectedDriverId) ?? drivers[0];
  }

  private addProceduralDriver(): void {
    const clip = this.activeClip();
    if (!clip) return;
    const target: ProceduralDriverTarget = {
      kind: 'quaternion',
      target: this.selectedJointId ?? this.rig.rootJointId,
      axis: [1, 0, 0],
    };
    const name = uniqueName('Oscillator', clip.proceduralDrivers.map((driver) => driver.name ?? driver.id));
    const order = clip.proceduralDrivers.reduce((max, driver) => Math.max(max, driver.order), -1) + 1;
    const driver = createProceduralDriver('oscillator', target, {
      name,
      order,
      amplitude: 0.1,
      frequency: 1,
    });
    this.commitMutation('Add procedural driver', () => {
      this.replaceActiveClip(upsertProceduralDriver(clip, driver));
    });
    this.selectedDriverId = driver.id;
    this.selectedTrackId = undefined;
    this.refreshAll();
  }

  private duplicateSelectedDriver(): void {
    const clip = this.activeClip();
    const source = this.activeProceduralDriver();
    if (!clip || !source) return;
    const name = uniqueName(
      `${source.name ?? source.type} Copy`,
      clip.proceduralDrivers.map((driver) => driver.name ?? driver.id),
    );
    const duplicate = {
      ...duplicateProceduralDriver(source, createAnimationId('driver'), name),
      order: clip.proceduralDrivers.reduce((max, driver) => Math.max(max, driver.order), -1) + 1,
    } as ProceduralDriverDefinition;
    this.commitMutation('Duplicate procedural driver', () => {
      this.replaceActiveClip(upsertProceduralDriver(clip, duplicate));
    });
    this.selectedDriverId = duplicate.id;
    this.refreshAll();
  }

  private deleteSelectedDriver(): void {
    const clip = this.activeClip();
    const driver = this.activeProceduralDriver();
    if (!clip || !driver) return;
    this.commitMutation('Delete procedural driver', () => {
      this.replaceActiveClip(removeProceduralDriver(clip, driver.id));
    });
    this.selectedDriverId = this.activeClip()?.proceduralDrivers[0]?.id;
    this.refreshAll();
  }

  private refreshDriverList(): void {
    if (!this.driverList) return;
    const clip = this.activeClip();
    this.driverList.replaceChildren();
    if (!clip || clip.proceduralDrivers.length === 0) {
      this.driverList.appendChild(dom('div', 'ast-hint', 'No procedural motion yet. Keyframes remain available as correction layers.'));
      return;
    }
    if (!clip.proceduralDrivers.some((driver) => driver.id === this.selectedDriverId)) {
      this.selectedDriverId = clip.proceduralDrivers[0].id;
    }
    for (const driver of [...clip.proceduralDrivers].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
      const row = dom('div', 'ast-button-row');
      const enabled = input('checkbox');
      enabled.checked = driver.enabled !== false;
      enabled.title = `Enable ${driver.name ?? driver.type}`;
      enabled.onchange = () => this.updateProceduralDriver('Toggle procedural driver', driver.id, (candidate) => ({
        ...candidate,
        enabled: enabled.checked,
      }));
      const choose = button(driver.name ?? driver.type);
      choose.classList.add('ast-grow');
      choose.classList.toggle('ast-active', driver.id === this.selectedDriverId);
      choose.title = `${driver.type} → ${this.proceduralTargetLabel(driver.target)}`;
      choose.onclick = () => {
        this.selectedDriverId = driver.id;
        this.selectedTrackId = undefined;
        this.selectedKey = undefined;
        this.refreshDriverList();
        this.refreshProceduralInspector();
        this.refreshTimeline();
      };
      row.append(enabled, choose);
      this.driverList.appendChild(row);
    }
  }

  private proceduralTargetLabel(target: ProceduralDriverTarget): string {
    if (target.kind === 'quaternion') {
      const axis = target.axis;
      const component = Math.abs(axis[0]) >= Math.abs(axis[1]) && Math.abs(axis[0]) >= Math.abs(axis[2])
        ? 'X'
        : Math.abs(axis[1]) >= Math.abs(axis[2]) ? 'Y' : 'Z';
      return `${target.target}.${component} rotation`;
    }
    return `${target.target}${target.kind === 'scalar' ? '' : `.${target.component}`} ${target.kind}`;
  }

  private updateProceduralDriver(
    label: string,
    driverId: string,
    update: (driver: ProceduralDriverDefinition) => ProceduralDriverDefinition,
  ): void {
    const clip = this.activeClip();
    const driver = clip?.proceduralDrivers.find((candidate) => candidate.id === driverId);
    if (!clip || !driver) return;
    this.commitMutation(label, () => {
      this.replaceActiveClip(upsertProceduralDriver(clip, update(driver)));
    });
    this.needsSample = true;
    this.onionDirty = true;
    this.refreshDriverList();
    this.refreshProceduralInspector();
    this.refreshTimeline();
  }

  private refreshProceduralInspector(): void {
    if (!this.proceduralInspector) return;
    this.proceduralInspector.replaceChildren();
    this.proceduralInspector.appendChild(this.sectionTitle('Procedural authoring'));
    const clip = this.activeClip();
    if (!clip) return;

    const order = dom('select', 'ast-select ast-grow');
    for (const [value, label] of [
      ['procedural-then-keyed', 'Procedural base → keyed corrections'],
      ['keyed-then-procedural', 'Keyed base → procedural layer'],
    ] as const) {
      const option = dom('option', '', label);
      option.value = value;
      order.appendChild(option);
    }
    order.value = clip.proceduralOrder;
    order.onchange = () => this.updateActiveClip('Change procedural composition', (candidate) => ({
      ...candidate,
      proceduralOrder: order.value as AnimationClip['proceduralOrder'],
    }));
    this.proceduralInspector.appendChild(this.field('Composition', order));

    const driver = this.activeProceduralDriver();
    if (!driver) {
      this.proceduralInspector.appendChild(dom('div', 'ast-hint', 'Add a driver to layer generated motion beneath editable correction keys.'));
      this.buildMotionContextControls(this.proceduralInspector);
      return;
    }

    const name = input('text');
    name.value = driver.name ?? driver.type;
    name.onchange = () => this.updateProceduralDriver('Rename procedural driver', driver.id, (candidate) => ({
      ...candidate,
      name: name.value.trim() || candidate.type,
    }));
    this.proceduralInspector.appendChild(this.field('Name', name));

    const type = dom('select', 'ast-select ast-grow');
    for (const value of ['oscillator', 'pulse', 'envelope', 'noise', 'response', 'custom'] as const) {
      const option = dom('option', '', value);
      option.value = value;
      type.appendChild(option);
    }
    type.value = driver.type;
    type.onchange = () => this.changeProceduralDriverType(driver, type.value as ProceduralDriverDefinition['type']);
    this.proceduralInspector.appendChild(this.field('Type', type));

    const targetKind = dom('select', 'ast-select ast-grow');
    for (const [value, label] of [
      ['position', 'Joint position'],
      ['quaternion', 'Joint rotation'],
      ['scale', 'Joint scale'],
      ['scalar', 'Deformation control'],
    ] as const) {
      const option = dom('option', '', label);
      option.value = value;
      targetKind.appendChild(option);
    }
    targetKind.value = driver.target.kind;
    targetKind.onchange = () => this.changeProceduralTargetKind(driver, targetKind.value as ProceduralDriverTarget['kind']);
    this.proceduralInspector.appendChild(this.field('Target type', targetKind));

    const target = dom('select', 'ast-select ast-grow');
    const targetOptions = driver.target.kind === 'scalar'
      ? this.rig.controls.map((control) => [control.id, control.name ?? control.id] as const)
      : this.rig.joints.map((joint) => [joint.id, joint.name ?? joint.id] as const);
    for (const [id, label] of targetOptions) {
      const option = dom('option', '', label);
      option.value = id;
      target.appendChild(option);
    }
    target.value = driver.target.target;
    target.onchange = () => this.updateProceduralDriver('Change procedural target', driver.id, (candidate) => ({
      ...candidate,
      target: { ...candidate.target, target: target.value } as ProceduralDriverTarget,
    }));
    this.proceduralInspector.appendChild(this.field('Target', target));

    if (driver.target.kind !== 'scalar') {
      const component = dom('select', 'ast-select ast-grow');
      for (const value of ['x', 'y', 'z'] as const) {
        const option = dom('option', '', value.toUpperCase());
        option.value = value;
        component.appendChild(option);
      }
      component.value = driver.target.kind === 'quaternion'
        ? this.dominantAxis(driver.target.axis)
        : driver.target.component;
      component.onchange = () => this.updateProceduralDriver('Change procedural component', driver.id, (candidate) => {
        const axis = component.value as 'x' | 'y' | 'z';
        const nextTarget: ProceduralDriverTarget = candidate.target.kind === 'quaternion'
          ? { ...candidate.target, axis: axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1] }
          : candidate.target.kind === 'scalar' ? candidate.target : { ...candidate.target, component: axis };
        return { ...candidate, target: nextTarget };
      });
      this.proceduralInspector.appendChild(this.field(driver.target.kind === 'quaternion' ? 'Axis' : 'Component', component));
    }

    const blend = dom('select', 'ast-select ast-grow');
    for (const value of ['additive', 'override', 'multiply'] as const) {
      const option = dom('option', '', value);
      option.value = value;
      blend.appendChild(option);
    }
    blend.value = driver.blend;
    blend.onchange = () => this.updateProceduralDriver('Change procedural blend', driver.id, (candidate) => ({
      ...candidate,
      blend: blend.value as ProceduralDriverDefinition['blend'],
    }));
    this.proceduralInspector.appendChild(this.field('Blend', blend));

    const source = input('text');
    source.setAttribute('list', 'ast-procedural-sources');
    source.value = driver.source;
    const sourceList = dom('datalist');
    sourceList.id = 'ast-procedural-sources';
    for (const value of ['time', 'normalizedSpeed', 'gaitPhase', 'verticalVelocity', 'grounded', 'actionProgress']) {
      const option = dom('option');
      option.value = value;
      sourceList.appendChild(option);
    }
    source.onchange = () => this.updateProceduralDriver('Change procedural source', driver.id, (candidate) => ({
      ...candidate,
      source: source.value.trim() || 'time',
    }));
    this.proceduralInspector.append(sourceList, this.field('Source', source));

    for (const [property, label, step] of [
      ['order', 'Order', 1],
      ['amplitude', 'Amplitude', 0.01],
      ['frequency', 'Frequency', 0.01],
      ['phase', 'Phase', 0.01],
      ['bias', 'Bias', 0.01],
      ['seed', 'Seed', 1],
    ] as const) {
      this.proceduralInspector.appendChild(this.driverNumberField(driver, property, label, step));
    }
    this.buildDriverClampFields(this.proceduralInspector, driver);
    this.buildDriverTypeFields(this.proceduralInspector, driver);
    this.buildProceduralVisualization(this.proceduralInspector, driver);
    this.buildMotionContextControls(this.proceduralInspector);
    this.buildBakeControls(this.proceduralInspector);
  }

  private dominantAxis(axis: readonly [number, number, number]): 'x' | 'y' | 'z' {
    if (Math.abs(axis[0]) >= Math.abs(axis[1]) && Math.abs(axis[0]) >= Math.abs(axis[2])) return 'x';
    return Math.abs(axis[1]) >= Math.abs(axis[2]) ? 'y' : 'z';
  }

  private driverNumberField(
    driver: ProceduralDriverDefinition,
    property: 'order' | 'amplitude' | 'frequency' | 'phase' | 'bias' | 'seed',
    label: string,
    step: number,
  ): HTMLElement {
    const value = input('number');
    value.step = String(step);
    value.value = String(driver[property]);
    value.onchange = () => this.updateProceduralDriver(`Change ${label.toLowerCase()}`, driver.id, (candidate) => ({
      ...candidate,
      [property]: property === 'order' || property === 'seed'
        ? Math.round(finite(value.value, candidate[property]))
        : finite(value.value, candidate[property]),
    }));
    return this.field(label, value);
  }

  private buildDriverClampFields(parent: HTMLElement, driver: ProceduralDriverDefinition): void {
    const minimum = input('number');
    const maximum = input('number');
    minimum.step = maximum.step = '0.01';
    minimum.placeholder = 'min';
    maximum.placeholder = 'max';
    if (driver.clamp) {
      minimum.value = String(driver.clamp[0]);
      maximum.value = String(driver.clamp[1]);
    }
    const controls = dom('div', 'ast-button-row ast-grow');
    const clear = button('Auto');
    controls.append(minimum, maximum, clear);
    const update = (): void => {
      const min = Number(minimum.value);
      const max = Number(maximum.value);
      if (!Number.isFinite(min) || !Number.isFinite(max)) return;
      this.updateProceduralDriver('Change procedural clamp', driver.id, (candidate) => ({
        ...candidate,
        clamp: min <= max ? [min, max] : [max, min],
      }));
    };
    minimum.onchange = update;
    maximum.onchange = update;
    clear.onclick = () => this.updateProceduralDriver('Clear procedural clamp', driver.id, (candidate) => {
      const next = { ...candidate } as ProceduralDriverDefinition;
      delete next.clamp;
      return next;
    });
    parent.appendChild(this.field('Clamp', controls));
  }

  private changeProceduralDriverType(
    driver: ProceduralDriverDefinition,
    type: ProceduralDriverDefinition['type'],
  ): void {
    const replacement = {
      ...createProceduralDriver(type, driver.target, {
        id: driver.id,
        name: driver.name,
        order: driver.order,
        blend: driver.blend,
        source: driver.source,
        amplitude: driver.amplitude,
        frequency: driver.frequency,
        phase: driver.phase,
        bias: driver.bias,
        seed: driver.seed,
        ...(driver.clamp ? { clamp: [...driver.clamp] as [number, number] } : {}),
      }),
      ...(driver.enabled === undefined ? {} : { enabled: driver.enabled }),
    } as ProceduralDriverDefinition;
    this.updateProceduralDriver('Change procedural driver type', driver.id, () => replacement);
  }

  private changeProceduralTargetKind(
    driver: ProceduralDriverDefinition,
    kind: ProceduralDriverTarget['kind'],
  ): void {
    let target: ProceduralDriverTarget;
    if (kind === 'scalar') {
      const control = this.rig.controls[0];
      if (!control) {
        this.toast('This rig does not declare scalar deformation controls');
        this.refreshProceduralInspector();
        return;
      }
      target = { kind, target: control.id };
    } else {
      const existingJoint = driver.target.kind === 'scalar' ? undefined : driver.target.target;
      const targetId = existingJoint && this.jointNodes.has(existingJoint)
        ? existingJoint
        : this.selectedJointId ?? this.rig.rootJointId;
      target = kind === 'quaternion'
        ? { kind, target: targetId, axis: [1, 0, 0] }
        : { kind, target: targetId, component: 'x' };
    }
    this.updateProceduralDriver('Change procedural target type', driver.id, (candidate) => ({ ...candidate, target }));
  }

  private buildDriverTypeFields(parent: HTMLElement, driver: ProceduralDriverDefinition): void {
    const numberField = (
      label: string,
      value: number,
      update: (candidate: ProceduralDriverDefinition, value: number) => ProceduralDriverDefinition,
      step = 0.01,
    ): void => {
      const control = input('number');
      control.step = String(step);
      control.value = String(value);
      control.onchange = () => this.updateProceduralDriver(
        `Change ${label.toLowerCase()}`,
        driver.id,
        (candidate) => update(candidate, finite(control.value, value)),
      );
      parent.appendChild(this.field(label, control));
    };
    if (driver.type === 'oscillator') {
      const waveform = dom('select', 'ast-select ast-grow');
      for (const value of ['sine', 'triangle', 'saw'] as const) {
        const option = dom('option', '', value);
        option.value = value;
        waveform.appendChild(option);
      }
      waveform.value = driver.waveform;
      waveform.onchange = () => this.updateProceduralDriver('Change waveform', driver.id, (candidate) => candidate.type === 'oscillator'
        ? { ...candidate, waveform: waveform.value as typeof candidate.waveform }
        : candidate);
      parent.appendChild(this.field('Waveform', waveform));
    } else if (driver.type === 'pulse') {
      numberField('Duty cycle', driver.dutyCycle, (candidate, value) => candidate.type === 'pulse'
        ? { ...candidate, dutyCycle: clamp(value, 0, 1) } : candidate);
      numberField('Smoothing', driver.smoothing ?? 0, (candidate, value) => candidate.type === 'pulse'
        ? { ...candidate, smoothing: clamp(value, 0, 0.5) } : candidate);
    } else if (driver.type === 'envelope') {
      numberField('Attack', driver.attack, (candidate, value) => candidate.type === 'envelope'
        ? { ...candidate, attack: Math.max(0, value) } : candidate);
      numberField('Hold', driver.hold, (candidate, value) => candidate.type === 'envelope'
        ? { ...candidate, hold: Math.max(0, value) } : candidate);
      numberField('Release', driver.release, (candidate, value) => candidate.type === 'envelope'
        ? { ...candidate, release: Math.max(0, value) } : candidate);
      const loop = input('checkbox');
      loop.checked = driver.loop;
      loop.onchange = () => this.updateProceduralDriver('Toggle envelope loop', driver.id, (candidate) => candidate.type === 'envelope'
        ? { ...candidate, loop: loop.checked } : candidate);
      const label = dom('label', 'ast-check');
      label.append(loop, dom('span', '', 'Loop envelope'));
      parent.appendChild(label);
    } else if (driver.type === 'noise') {
      const interpolation = dom('select', 'ast-select ast-grow');
      for (const value of ['step', 'smooth'] as const) {
        const option = dom('option', '', value);
        option.value = value;
        interpolation.appendChild(option);
      }
      interpolation.value = driver.interpolation;
      interpolation.onchange = () => this.updateProceduralDriver('Change noise interpolation', driver.id, (candidate) => candidate.type === 'noise'
        ? { ...candidate, interpolation: interpolation.value as typeof candidate.interpolation } : candidate);
      parent.appendChild(this.field('Noise', interpolation));
    } else if (driver.type === 'response') {
      numberField('Input min', driver.inputRange[0], (candidate, value) => candidate.type === 'response'
        ? { ...candidate, inputRange: [value, candidate.inputRange[1]] } : candidate);
      numberField('Input max', driver.inputRange[1], (candidate, value) => candidate.type === 'response'
        ? { ...candidate, inputRange: [candidate.inputRange[0], value] } : candidate);
      const curve = dom('select', 'ast-select ast-grow');
      for (const value of ['step', 'linear', 'smoothstep', 'smootherstep'] as const) {
        const option = dom('option', '', value);
        option.value = value;
        curve.appendChild(option);
      }
      curve.value = driver.curve;
      curve.onchange = () => this.updateProceduralDriver('Change response curve', driver.id, (candidate) => candidate.type === 'response'
        ? { ...candidate, curve: curve.value as typeof candidate.curve } : candidate);
      parent.appendChild(this.field('Response', curve));
      const extrapolate = input('checkbox');
      extrapolate.checked = driver.extrapolate ?? false;
      extrapolate.onchange = () => this.updateProceduralDriver('Toggle response extrapolation', driver.id, (candidate) => candidate.type === 'response'
        ? { ...candidate, extrapolate: extrapolate.checked } : candidate);
      const label = dom('label', 'ast-check');
      label.append(extrapolate, dom('span', '', 'Extrapolate response'));
      parent.appendChild(label);
    } else if (driver.type === 'custom') {
      const evaluator = input('text');
      evaluator.value = driver.evaluatorId;
      evaluator.placeholder = 'runtime evaluator ID';
      evaluator.onchange = () => this.updateProceduralDriver('Change custom evaluator', driver.id, (candidate) => candidate.type === 'custom'
        ? { ...candidate, evaluatorId: evaluator.value.trim() || 'unassigned' } : candidate);
      parent.appendChild(this.field('Evaluator', evaluator));
      const params = dom('textarea', 'ast-textarea');
      params.style.height = '84px';
      params.placeholder = '{ "stiffness": 0.5 }';
      params.value = JSON.stringify(driver.params ?? {}, null, 2);
      params.onchange = () => {
        try {
          const parsed = JSON.parse(params.value) as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Params must be a JSON object');
          this.updateProceduralDriver('Change custom evaluator params', driver.id, (candidate) => candidate.type === 'custom'
            ? { ...candidate, params: parsed as NonNullable<typeof candidate.params> } : candidate);
        } catch (error) {
          this.toast(error instanceof Error ? error.message : 'Invalid custom params JSON');
          params.value = JSON.stringify(driver.params ?? {}, null, 2);
        }
      };
      parent.appendChild(this.field('Params', params));
    }
  }

  private buildMotionContextControls(parent: HTMLElement): void {
    parent.appendChild(this.sectionTitle('Motion context preview'));
    const addSlider = (
      label: string,
      property: 'normalizedSpeed' | 'gaitPhase' | 'verticalVelocity' | 'actionProgress',
      min: number,
      max: number,
      step: number,
    ): void => {
      const slider = input('range');
      slider.min = String(min);
      slider.max = String(max);
      slider.step = String(step);
      slider.value = String(this.motionContext[property]);
      slider.classList.add('ast-grow');
      const exact = input('number');
      exact.min = slider.min;
      exact.max = slider.max;
      exact.step = slider.step;
      exact.value = slider.value;
      const controls = dom('div', 'ast-button-row ast-grow');
      controls.append(slider, exact);
      const update = (raw: string): void => {
        const value = clamp(finite(raw, this.motionContext[property]), min, max);
        this.motionContext = { ...this.motionContext, [property]: value };
        slider.value = String(value);
        exact.value = String(value);
        this.needsSample = true;
        this.refreshProceduralVisualizationOnly();
        this.refreshTimeline();
      };
      slider.oninput = () => update(slider.value);
      exact.oninput = () => update(exact.value);
      parent.appendChild(this.field(label, controls));
    };
    addSlider('Speed', 'normalizedSpeed', 0, 1, 0.01);
    addSlider('Gait phase', 'gaitPhase', 0, 1, 0.01);
    addSlider('Vertical', 'verticalVelocity', -30, 30, 0.1);
    addSlider('Action', 'actionProgress', 0, 1, 0.01);
    const grounded = input('checkbox');
    grounded.checked = this.motionContext.grounded;
    grounded.onchange = () => {
      this.motionContext = { ...this.motionContext, grounded: grounded.checked };
      this.needsSample = true;
      this.refreshProceduralVisualizationOnly();
      this.refreshTimeline();
    };
    const label = dom('label', 'ast-check');
    label.append(grounded, dom('span', '', 'Grounded'));
    parent.appendChild(label);
  }

  private buildProceduralVisualization(parent: HTMLElement, driver: ProceduralDriverDefinition): void {
    parent.appendChild(this.sectionTitle('Generated result'));
    this.proceduralGraphHost = dom('div', 'ast-curve-wrap');
    this.proceduralGraphHost.dataset.driverId = driver.id;
    parent.appendChild(this.proceduralGraphHost);
    this.refreshProceduralVisualizationOnly();
  }

  private refreshProceduralVisualizationOnly(): void {
    const host = this.proceduralGraphHost;
    const clip = this.activeClip();
    const driver = this.activeProceduralDriver();
    if (!host || !clip || !driver || host.dataset.driverId !== driver.id) return;
    host.replaceChildren();
    const graph = svg('svg', 'ast-curve');
    graph.setAttribute('viewBox', '0 0 300 160');
    graph.setAttribute('preserveAspectRatio', 'none');
    host.appendChild(graph);
    const samples: Array<{ time: number; value: number }> = [];
    let issue = '';
    const count = Math.max(60, Math.ceil(clip.duration * 30));
    for (let index = 0; index <= count; index += 1) {
      const time = clip.duration * index / count;
      const result = sampleProceduralDriverValue(driver, time, this.motionContext, {
        evaluators: this.ctx.proceduralEvaluators,
      });
      if (result.value !== undefined) samples.push({ time, value: result.value });
      if (result.issue) issue = result.issue.message;
    }
    if (samples.length === 0) {
      const message = dom('div', 'ast-hint', issue || 'Driver is disabled or has no registered evaluator.');
      host.appendChild(message);
      return;
    }
    let min = Math.min(...samples.map((sample) => sample.value), 0);
    let max = Math.max(...samples.map((sample) => sample.value), 0);
    if (Math.abs(max - min) < 1e-8) {
      min -= 0.5;
      max += 0.5;
    } else {
      const padding = (max - min) * 0.12;
      min -= padding;
      max += padding;
    }
    const x = (time: number): number => 8 + time / Math.max(clip.duration, MIN_DURATION) * 284;
    const y = (value: number): number => 8 + (1 - (value - min) / (max - min)) * 136;
    for (let index = 0; index <= 4; index += 1) {
      const line = svg('line', 'ast-curve-grid');
      line.setAttribute('x1', '8');
      line.setAttribute('x2', '292');
      line.setAttribute('y1', String(8 + index * 34));
      line.setAttribute('y2', String(8 + index * 34));
      graph.appendChild(line);
    }
    const path = svg('path', 'ast-curve-path');
    path.setAttribute('d', samples.map((sample, index) => `${index ? 'L' : 'M'} ${x(sample.time).toFixed(2)} ${y(sample.value).toFixed(2)}`).join(' '));
    graph.appendChild(path);
    const current = sampleProceduralDriverValue(driver, this.playTime, this.motionContext, {
      evaluators: this.ctx.proceduralEvaluators,
    });
    if (current.value !== undefined) {
      const point = svg('circle', 'ast-curve-point ast-selected');
      point.setAttribute('cx', String(x(this.playTime)));
      point.setAttribute('cy', String(y(current.value)));
      point.setAttribute('r', '4');
      graph.appendChild(point);
      const status = dom('div', 'ast-hint', `Current output: ${current.value.toFixed(4)}`);
      host.appendChild(status);
    }
  }

  private drawProceduralTimelineLane(
    lane: HTMLElement,
    driver: ProceduralDriverDefinition,
    clip: AnimationClip,
  ): void {
    const graph = svg('svg', 'ast-driver-wave');
    graph.setAttribute('viewBox', '0 0 300 21');
    graph.setAttribute('preserveAspectRatio', 'none');
    const samples: number[] = [];
    for (let index = 0; index <= 60; index += 1) {
      const time = clip.duration * index / 60;
      const result = sampleProceduralDriverValue(driver, time, this.motionContext, {
        evaluators: this.ctx.proceduralEvaluators,
      });
      samples.push(result.value ?? 0);
    }
    let min = Math.min(...samples);
    let max = Math.max(...samples);
    if (Math.abs(max - min) < 1e-8) {
      min -= 1;
      max += 1;
    }
    const path = svg('path');
    path.setAttribute('d', samples.map((value, index) => {
      const x = index / 60 * 300;
      const y = 2 + (1 - (value - min) / (max - min)) * 17;
      return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' '));
    graph.appendChild(path);
    lane.appendChild(graph);
  }

  private buildBakeControls(parent: HTMLElement): void {
    parent.appendChild(this.sectionTitle('Bake to editable keys'));
    const fps = input('number');
    fps.min = '1';
    fps.max = '240';
    fps.step = '1';
    fps.value = String(this.proceduralBakeFps);
    fps.onchange = () => {
      this.proceduralBakeFps = Math.round(clamp(finite(fps.value, FRAME_RATE), 1, 240));
      fps.value = String(this.proceduralBakeFps);
    };
    parent.appendChild(this.field('FPS', fps));
    const buttons = dom('div', 'ast-button-row');
    const selected = button('Bake Driver');
    const all = button('Bake All Procedural');
    selected.onclick = () => this.bakeSelectedProceduralDriver();
    all.onclick = () => this.bakeAllProceduralDrivers();
    buttons.append(selected, all);
    parent.appendChild(buttons);
    parent.appendChild(dom(
      'div',
      'ast-hint',
      'Bakes over the loop range at fixed FPS. “All” creates a separate editable clip so the procedural source remains intact.',
    ));
  }

  private proceduralBakeContext(_time: number, normalizedTime: number): ProceduralMotionContext {
    return {
      ...this.motionContext,
      gaitPhase: (this.motionContext.gaitPhase + normalizedTime) % 1,
      actionProgress: clamp(this.motionContext.actionProgress + normalizedTime, 0, 1),
    };
  }

  private bakeSelectedProceduralDriver(): void {
    const clip = this.activeClip();
    const driver = this.activeProceduralDriver();
    if (!clip || !driver) return;
    this.commitMutation('Bake procedural driver', () => {
      const baked = bakeProceduralClip(clip, {
        fps: this.proceduralBakeFps,
        start: clip.range.start,
        end: clip.range.end,
        context: (time, normalized) => this.proceduralBakeContext(time, normalized),
        evaluators: this.ctx.proceduralEvaluators,
        id: clip.id,
        name: clip.name,
        driverIds: [driver.id],
      });
      this.replaceActiveClip(baked);
    });
    this.selectedDriverId = this.activeClip()?.proceduralDrivers[0]?.id;
    this.selectedTrackId = this.activeClip()?.tracks[0]?.id;
    this.selectedKey = undefined;
    this.needsSample = true;
    this.refreshAll();
    this.toast(`Baked ${driver.name ?? driver.type} at ${this.proceduralBakeFps} FPS`);
  }

  private bakeAllProceduralDrivers(): void {
    const clip = this.activeClip();
    if (!clip || clip.proceduralDrivers.length === 0) return;
    const id = createAnimationId('clip');
    const name = uniqueName(`${clip.name} Baked`, this.animationDocument.clips.map((candidate) => candidate.name));
    let baked: AnimationClip | undefined;
    this.commitMutation('Bake all procedural drivers', () => {
      baked = bakeProceduralClip(clip, {
        fps: this.proceduralBakeFps,
        start: clip.range.start,
        end: clip.range.end,
        context: (time, normalized) => this.proceduralBakeContext(time, normalized),
        evaluators: this.ctx.proceduralEvaluators,
        id,
        name,
      });
      this.animationDocument = setActiveClip(upsertClip(this.animationDocument, baked), id);
    });
    if (!baked) return;
    this.playing = false;
    this.playTime = baked.range.start;
    this.selectedDriverId = undefined;
    this.selectedTrackId = baked.tracks[0]?.id;
    this.selectedKey = undefined;
    this.needsSample = true;
    this.refreshAll();
    this.toast(`Created ${baked.name} at ${this.proceduralBakeFps} FPS`);
  }

  private selectClip(clipId: string): void {
    const clip = this.animationDocument.clips.find((candidate) => candidate.id === clipId);
    if (!clip) return;
    this.animationDocument = setActiveClip(this.animationDocument, clip.id);
    this.playing = false;
    this.playbackDirection = 1;
    this.playTime = clip.range.start;
    this.selectedKey = undefined;
    this.selectedTrackId = undefined;
    this.selectedDriverId = clip.proceduralDrivers[0]?.id;
    this.selectedAnnotation = undefined;
    this.needsSample = true;
    this.onionDirty = true;
    this.scheduleAutosave();
    this.refreshAll();
  }

  private setPlaybackSpeed(value: number): void {
    const speed = clamp(Number.isFinite(value) ? value : 1, PLAYBACK_SPEED_MIN, PLAYBACK_SPEED_MAX);
    this.updateActiveClip('Change playback speed', (clip) => ({ ...clip, playbackSpeed: speed }));
  }

  private updateLoopRange(edge: 'start' | 'end', raw: string): void {
    const clip = this.activeClip();
    if (!clip) return;
    const value = clamp(finite(raw, clip.range[edge]), 0, clip.duration);
    this.updateActiveClip('Change loop range', (candidate) => {
      const range = { ...candidate.range, [edge]: value };
      if (edge === 'start') range.start = Math.min(range.start, range.end);
      else range.end = Math.max(range.start, range.end);
      return { ...candidate, range };
    });
    const active = this.activeClip();
    if (active) this.seek(clamp(this.playTime, active.range.start, active.range.end));
  }

  private togglePlayback(): void {
    const clip = this.activeClip();
    if (!clip) return;
    if (this.playing) {
      this.pausePlayback();
      return;
    }
    if (clip.loop.mode === 'once' && this.playTime >= clip.range.end - 1e-8) {
      this.playTime = clip.range.start;
    }
    this.playing = true;
    this.playbackDirection = 1;
    this.refreshToolbar();
  }

  private pausePlayback(): void {
    if (!this.playing) return;
    this.playing = false;
    this.refreshToolbar();
  }

  private stopPlayback(): void {
    this.playing = false;
    this.playbackDirection = 1;
    this.seek(this.activeClip()?.range.start ?? 0);
    this.refreshToolbar();
  }

  private stepFrame(direction: -1 | 1): void {
    this.pausePlayback();
    this.seek(this.playTime + direction / FRAME_RATE);
  }

  private seek(time: number): void {
    const clip = this.activeClip();
    if (!clip) {
      this.playTime = 0;
      return;
    }
    this.playTime = clamp(Number.isFinite(time) ? time : clip.range.start, 0, clip.duration);
    this.needsSample = true;
    this.onionDirty = true;
    this.syncTimeUi();
  }

  private advancePlayback(dt: number, clip: AnimationClip): void {
    const start = clip.range.start;
    const end = clip.range.end;
    const span = end - start;
    if (span <= 1e-9 || clip.playbackSpeed <= 0) {
      this.playTime = start;
      return;
    }
    let next = this.playTime + dt * clip.playbackSpeed * this.playbackDirection;
    if (clip.loop.mode === 'once') {
      if (next >= end) {
        next = end;
        this.playing = false;
      } else if (next <= start) {
        next = start;
        this.playing = false;
      }
    } else if (clip.loop.mode === 'ping-pong') {
      while (next > end || next < start) {
        if (next > end) {
          next = end - (next - end);
          this.playbackDirection = -1;
        } else if (next < start) {
          next = start + (start - next);
          this.playbackDirection = 1;
        }
      }
    } else {
      next = start + (((next - start) % span) + span) % span;
    }
    this.playTime = next;
  }

  private sampleCurrentPose(): void {
    const clip = this.activeClip();
    if (!clip) return;
    const pose = this.sampleAuthoredPose(clip, this.playTime);
    this.applyPose(pose);
    this.needsSample = false;
    this.onionDirty = true;
    if (this.authoringMode === 'ik' && !this.ikTargetTransform.dragging && !this.ikPoleTransform.dragging) {
      this.positionIkHelpersFromPose();
    }
    this.refreshInspectorValues();
  }

  private sampleAuthoredPose(clip: AnimationClip, time: number): PoseBuffer {
    return sampleComposedClip(clip, time, this.motionContext, {
      evaluators: this.ctx.proceduralEvaluators,
    });
  }

  private applyPose(pose: PoseBuffer): void {
    if (this.binding) {
      this.binding.applyPose(pose, { resetUnspecified: true, strict: false });
    } else {
      for (const joint of this.rig.joints) {
        const node = this.jointNodes.get(joint.id);
        if (!node) continue;
        const delta = pose.joints[joint.id];
        node.position.set(
          joint.rest.position[0] + (delta?.position?.[0] ?? 0),
          joint.rest.position[1] + (delta?.position?.[1] ?? 0),
          joint.rest.position[2] + (delta?.position?.[2] ?? 0),
        );
        node.quaternion.fromArray(joint.rest.quaternion);
        if (delta?.quaternion) node.quaternion.multiply(new THREE.Quaternion().fromArray(delta.quaternion));
        node.quaternion.normalize();
        node.scale.set(
          joint.rest.scale[0] * (delta?.scale?.[0] ?? 1),
          joint.rest.scale[1] * (delta?.scale?.[1] ?? 1),
          joint.rest.scale[2] * (delta?.scale?.[2] ?? 1),
        );
      }
    }
    this.ctx.rigRoot.updateMatrixWorld(true);
    const scalars = Object.fromEntries(this.rig.controls.map((control) => [control.id, control.defaultValue]));
    Object.assign(scalars, pose.scalars);
    this.currentScalars = scalars;
    this.ctx.applyScalars?.(scalars);
    this.refreshScalarValues();
  }

  private capturePose(jointIds?: Iterable<JointId>): PoseBuffer {
    if (this.binding) return this.binding.capturePose(jointIds);
    const pose: PoseBuffer = { joints: {}, scalars: {} };
    const ids = jointIds ? [...jointIds] : this.rig.joints.map((joint) => joint.id);
    for (const id of ids) {
      const joint = this.rig.joints.find((candidate) => candidate.id === id);
      const node = this.jointNodes.get(id);
      if (!joint || !node) continue;
      const inverseRest = new THREE.Quaternion().fromArray(joint.rest.quaternion).invert();
      const deltaQuaternion = inverseRest.multiply(node.quaternion).normalize();
      pose.joints[id] = {
        position: [
          node.position.x - joint.rest.position[0],
          node.position.y - joint.rest.position[1],
          node.position.z - joint.rest.position[2],
        ],
        quaternion: deltaQuaternion.toArray() as [number, number, number, number],
        scale: [
          joint.rest.scale[0] === 0 ? 1 : node.scale.x / joint.rest.scale[0],
          joint.rest.scale[1] === 0 ? 1 : node.scale.y / joint.rest.scale[1],
          joint.rest.scale[2] === 0 ? 1 : node.scale.z / joint.rest.scale[2],
        ],
      };
    }
    return pose;
  }

  /** Convert the live composed result back into authored correction keys. */
  private captureKeyPose(jointIds: Iterable<JointId>): PoseBuffer {
    const ids = [...jointIds];
    const total = this.capturePose(ids);
    const clip = this.activeClip();
    if (!clip || clip.proceduralOrder !== 'procedural-then-keyed' || clip.proceduralDrivers.length === 0) return total;
    const procedural = sampleProceduralPose(clip, this.playTime, this.motionContext, {
      evaluators: this.ctx.proceduralEvaluators,
    });
    const result: PoseBuffer = { joints: {}, scalars: { ...total.scalars } };
    for (const id of ids) {
      const composed = total.joints[id];
      if (!composed) continue;
      const base = procedural.joints[id];
      const correction: JointPoseDelta = {};
      if (composed.position) {
        const position = base?.position ?? [0, 0, 0];
        correction.position = [
          composed.position[0] - position[0],
          composed.position[1] - position[1],
          composed.position[2] - position[2],
        ];
      }
      if (composed.quaternion) {
        const baseQuaternion = new THREE.Quaternion().fromArray(base?.quaternion ?? [0, 0, 0, 1]).normalize();
        const totalQuaternion = new THREE.Quaternion().fromArray(composed.quaternion).normalize();
        correction.quaternion = baseQuaternion.invert().multiply(totalQuaternion).normalize().toArray() as [number, number, number, number];
      }
      if (composed.scale) {
        const scale = base?.scale ?? [1, 1, 1];
        correction.scale = [
          Math.abs(scale[0]) < 1e-8 ? composed.scale[0] : composed.scale[0] / scale[0],
          Math.abs(scale[1]) < 1e-8 ? composed.scale[1] : composed.scale[1] / scale[1],
          Math.abs(scale[2]) < 1e-8 ? composed.scale[2] : composed.scale[2] / scale[2],
        ];
      }
      result.joints[id] = correction;
    }
    return result;
  }

  private frameCamera(): void {
    const box = new THREE.Box3().setFromObject(this.ctx.rigRoot);
    if (box.isEmpty()) box.setFromCenterAndSize(this.ctx.rigRoot.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(1, 2, 1));
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(0.5, box.getSize(new THREE.Vector3()).length());
    const distance = size / (2 * Math.tan(THREE.MathUtils.degToRad(this.ctx.camera.fov) / 2)) * 1.3;
    this.orbit.target.copy(center);
    // The active rider faces world -Z at rest. Start from a readable front
    // three-quarter authoring view; orbit remains completely free afterwards.
    this.ctx.camera.position.copy(center).add(new THREE.Vector3(0.68, 0.28, -1).normalize().multiplyScalar(distance));
    this.ctx.camera.near = Math.max(0.005, distance / 200);
    this.ctx.camera.far = Math.max(100, distance * 30);
    this.ctx.camera.lookAt(center);
    this.ctx.camera.updateProjectionMatrix();
    this.orbit.update();
  }

  private createIkTransformControl(handle: THREE.Object3D, label: string): TransformControls {
    const control = new TransformControls(this.ctx.camera, this.ctx.renderer.domElement);
    control.setMode('translate');
    control.setSpace('world');
    control.setSize(0.58);
    control.attach(handle);
    control.addEventListener('dragging-changed', (event) => {
      this.orbit.enabled = !event.value;
    });
    control.addEventListener('mouseDown', () => {
      this.pausePlayback();
      this.beginTransaction(label);
    });
    control.addEventListener('objectChange', () => this.onIkHandleChanged());
    control.addEventListener('mouseUp', () => this.finishIkTransaction());
    return control;
  }

  private activeIkChain(): ResolvedIkChain | undefined {
    return this.ikChains.find((chain) => chain.id === this.selectedIkChainId) ?? this.ikChains[0];
  }

  private enterIkMode(): void {
    if (this.ikChains.length === 0) {
      this.toast('No valid three-joint IK chains are declared or inferable');
      return;
    }
    this.authoringMode = 'ik';
    this.pausePlayback();
    this.transform.detach();
    this.transform.visible = false;
    this.transform.enabled = false;
    this.setIkHelpersVisible(true);
    this.positionIkHelpersFromPose();
    this.refreshToolbar();
    this.refreshInspector();
  }

  private setIkHelpersVisible(visible: boolean): void {
    this.ikTargetHandle.visible = visible;
    this.ikPoleHandle.visible = visible;
    this.ikGuide.visible = visible;
    this.ikTargetTransform.visible = visible;
    this.ikTargetTransform.enabled = visible;
    this.ikPoleTransform.visible = visible;
    this.ikPoleTransform.enabled = visible;
    if (!visible) {
      this.transform.visible = true;
      this.transform.enabled = true;
    }
  }

  private positionIkHelpersFromPose(): void {
    const chain = this.activeIkChain();
    if (!chain) return;
    this.ctx.rigRoot.updateMatrixWorld(true);
    const root = chain.root.getWorldPosition(new THREE.Vector3());
    const mid = chain.mid.getWorldPosition(new THREE.Vector3());
    const end = chain.effector.getWorldPosition(new THREE.Vector3());
    const axis = end.clone().sub(root);
    const reach = Math.max(
      root.distanceTo(mid) + mid.distanceTo(end),
      0.2,
    );
    let bend = mid.clone().sub(root);
    if (axis.lengthSq() > 1e-10) {
      const direction = axis.clone().normalize();
      bend.addScaledVector(direction, -bend.dot(direction));
    }
    if (bend.lengthSq() <= 1e-10) {
      bend.fromArray(chain.defaultPoleDirection ?? [0, 0, 1]);
      bend.transformDirection(this.ctx.rigRoot.matrixWorld);
    }
    if (bend.lengthSq() <= 1e-10) bend.set(0, 0, 1);
    bend.normalize();
    chain.target.copy(end);
    chain.pole.copy(root).addScaledVector(bend, reach);
    this.ikTargetHandle.position.copy(chain.target);
    this.ikPoleHandle.position.copy(chain.pole);
    this.lastIkResult = undefined;
    this.updateIkGuide();
    this.refreshIkVectorInputs();
    this.updateIkStatus();
  }

  private onIkHandleChanged(): void {
    if (this.authoringMode !== 'ik') return;
    const chain = this.activeIkChain();
    if (!chain) return;
    chain.target.copy(this.ikTargetHandle.position);
    chain.pole.copy(this.ikPoleHandle.position);
    this.lastIkResult = solveResolvedIkChain(chain, {
      maxAngularStepRadians: Math.PI,
      tolerance: 0.002,
    });
    this.ctx.rigRoot.updateMatrixWorld(true);
    if (this.autoKey && this.lastIkResult.status !== 'invalid' && this.lastIkResult.status !== 'degenerate') {
      this.writeIkRotationKeys();
    }
    this.needsSample = false;
    this.onionDirty = true;
    this.updateIkGuide();
    this.refreshIkVectorInputs();
    this.updateIkStatus();
  }

  private finishIkTransaction(): void {
    this.commitTransaction();
    this.refreshJointTree();
    this.refreshTimeline();
    this.refreshCurve();
    this.updateIkStatus();
  }

  private setIkKeys(recordHistory: boolean): void {
    if (!this.activeIkChain()) return;
    const run = (): void => this.writeIkRotationKeys();
    if (recordHistory) this.commitMutation('Set IK keys', run);
    else run();
    this.onionDirty = true;
    this.refreshJointTree();
    this.refreshTimeline();
    this.refreshCurve();
    if (recordHistory) this.toast(`IK keys set at ${Math.round(this.playTime * FRAME_RATE)}f`);
  }

  private writeIkRotationKeys(): void {
    const chain = this.activeIkChain();
    let clip = this.activeClip();
    if (!chain || !clip) return;
    const jointIds = [chain.rootId, chain.midId, chain.endId];
    const pose = this.captureKeyPose(jointIds);
    for (const jointId of jointIds) {
      const quaternion = pose.joints[jointId]?.quaternion;
      if (!quaternion) continue;
      const written = this.writeTransformKey(clip, jointId, 'quaternion', quaternion);
      clip = written.clip;
      this.selectedTrackId = written.trackId;
      this.selectedKey = { trackId: written.trackId, keyId: written.keyId, component: 0 };
    }
    this.replaceActiveClip(clip);
  }

  private updateIkGuide(): void {
    const chain = this.activeIkChain();
    if (!chain) return;
    this.ctx.rigRoot.updateMatrixWorld(true);
    const root = chain.root.getWorldPosition(new THREE.Vector3());
    const mid = chain.mid.getWorldPosition(new THREE.Vector3());
    const end = chain.effector.getWorldPosition(new THREE.Vector3());
    const points = [
      root, mid,
      mid, end,
      end, this.ikTargetHandle.position,
      root, this.ikPoleHandle.position,
      mid, this.ikPoleHandle.position,
    ];
    const attribute = this.ikGuide.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let index = 0; index < points.length; index += 1) {
      attribute.setXYZ(index, points[index].x, points[index].y, points[index].z);
    }
    attribute.needsUpdate = true;
    this.ikGuide.geometry.computeBoundingSphere();
  }

  private updateIkStatus(): void {
    if (!this.ikStatusElement) return;
    const result = this.lastIkResult;
    if (!result) {
      this.ikStatusElement.textContent = 'Ready — drag the cyan target or gold pole helper.';
      this.ikStatusElement.classList.remove('ast-warn');
      return;
    }
    this.ikStatusElement.textContent = result.message
      ? `${result.status}: ${result.message}`
      : `${result.status} · error ${result.error.toFixed(result.error < 0.01 ? 4 : 3)} units${result.clamped ? ' · constrained' : ''}`;
    this.ikStatusElement.classList.toggle('ast-warn', !result.reached);
  }

  private setTransformMode(mode: TransformMode): void {
    this.authoringMode = 'fk';
    this.transformMode = mode;
    this.transform.setMode(mode);
    this.transform.setSpace('local');
    this.setIkHelpersVisible(false);
    const selected = this.selectedJointId ? this.jointNodes.get(this.selectedJointId) : undefined;
    if (selected) this.transform.attach(selected);
    this.refreshToolbar();
    this.refreshInspector();
  }

  private refreshAll(): void {
    this.refreshToolbar();
    this.refreshClipPanel();
    this.refreshDriverList();
    this.refreshJointTree();
    this.refreshInspector();
    this.refreshProceduralInspector();
    this.refreshTimeline();
    this.refreshCurve();
    this.syncTimeUi();
  }

  private refreshToolbar(): void {
    if (!this.undoButton) return;
    this.undoButton.disabled = this.undoStack.length === 0;
    this.redoButton.disabled = this.redoStack.length === 0;
    const undoEntry = this.undoStack[this.undoStack.length - 1];
    const redoEntry = this.redoStack[this.redoStack.length - 1];
    this.undoButton.title = undoEntry ? `Undo ${undoEntry.label} (Ctrl/Cmd+Z)` : 'Nothing to undo';
    this.redoButton.title = redoEntry ? `Redo ${redoEntry.label} (Ctrl/Cmd+Shift+Z)` : 'Nothing to redo';
    this.playButton?.classList.toggle('ast-active', this.playing);
    if (this.playButton) this.playButton.textContent = this.playing ? '❚❚' : '▶';
    this.autoKeyButton?.classList.toggle('ast-active', this.autoKey);
    this.root.querySelectorAll<HTMLElement>('[data-transform-mode]').forEach((element) => {
      element.classList.toggle(
        'ast-active',
        this.authoringMode === 'fk' && element.dataset.transformMode === this.transformMode,
      );
    });
    this.root.querySelector<HTMLElement>('[data-authoring-mode=ik]')
      ?.classList.toggle('ast-active', this.authoringMode === 'ik');
    this.root.querySelector<HTMLElement>('[data-onion-button]')?.classList.toggle('ast-active', this.onionEnabled);
  }

  private refreshClipPanel(): void {
    const clip = this.activeClip();
    const current = clip?.id ?? '';
    this.clipSelect.replaceChildren();
    for (const candidate of this.animationDocument.clips) {
      const option = dom('option', '', candidate.name);
      option.value = candidate.id;
      this.clipSelect.appendChild(option);
    }
    this.clipSelect.value = current;
    if (!clip) return;
    if (document.activeElement !== this.clipNameInput) this.clipNameInput.value = clip.name;
    setNumberInput(this.durationInput, clip.duration);
    this.speedSlider.value = String(clamp(clip.playbackSpeed, 0.1, 3));
    setNumberInput(this.speedInput, clip.playbackSpeed, 2);
    this.loopButton.classList.toggle('ast-active', clip.loop.mode !== 'once');
    this.loopModeSelect.value = clip.loop.mode;
    setNumberInput(this.loopStartInput, clip.range.start);
    setNumberInput(this.loopEndInput, clip.range.end);
    this.loopStartInput.max = String(clip.duration);
    this.loopEndInput.max = String(clip.duration);
    const seamless = this.root.querySelector<HTMLInputElement>('[data-seamless]');
    if (seamless) seamless.checked = clip.loop.seamless;
    this.scrubInput.max = String(clip.duration);
    this.timeInput.max = String(clip.duration);
  }

  private syncTimeUi(): void {
    if (!this.timeInput) return;
    setNumberInput(this.timeInput, this.playTime, 4);
    this.scrubInput.value = String(this.playTime);
    const clip = this.activeClip();
    this.timeLabel.textContent = `${Math.round(this.playTime * FRAME_RATE)}f / ${Math.round((clip?.duration ?? 0) * FRAME_RATE)}f`;
    const duration = clip?.duration ?? 1;
    this.playhead.style.left = `${clamp(this.playTime / Math.max(duration, MIN_DURATION), 0, 1) * 100}%`;
  }

  private refreshJointTree(): void {
    if (!this.jointTree) return;
    const clip = this.activeClip();
    const filter = this.jointFilter.value.trim().toLocaleLowerCase();
    const children = new Map<JointId | null, RigJointDefinition[]>();
    for (const joint of this.rig.joints) {
      const list = children.get(joint.parentId) ?? [];
      list.push(joint);
      children.set(joint.parentId, list);
    }
    const matches = (joint: RigJointDefinition): boolean => {
      if (!filter) return true;
      if (`${joint.id} ${joint.name ?? ''} ${joint.nodeName}`.toLocaleLowerCase().includes(filter)) return true;
      return (children.get(joint.id) ?? []).some(matches);
    };
    const hasKey = (jointId: JointId): boolean => clip?.tracks.some(
      (track) => track.target === jointId && track.keys.some((key) => Math.abs(key.time - this.playTime) <= KEY_EPSILON),
    ) ?? false;

    const list = dom('ul', 'ast-tree');
    const render = (joint: RigJointDefinition, depth: number): HTMLLIElement | undefined => {
      if (!matches(joint)) return undefined;
      const item = dom('li');
      const row = dom('button', 'ast-tree-button') as HTMLButtonElement;
      row.type = 'button';
      row.style.paddingLeft = `${5 + depth * 13}px`;
      row.classList.toggle('ast-selected', joint.id === this.selectedJointId);
      const descendants = children.get(joint.id) ?? [];
      const twist = dom('span', 'ast-tree-twist', descendants.length ? (this.collapsedJoints.has(joint.id) ? '▸' : '▾') : '·');
      twist.onclick = (event) => {
        if (!descendants.length) return;
        event.stopPropagation();
        if (this.collapsedJoints.has(joint.id)) this.collapsedJoints.delete(joint.id);
        else this.collapsedJoints.add(joint.id);
        this.refreshJointTree();
      };
      row.append(twist, dom('span', 'ast-tree-name', joint.name ?? joint.id));
      if (hasKey(joint.id)) row.appendChild(dom('span', 'ast-tree-keyed'));
      row.onclick = () => this.selectJoint(joint.id);
      item.appendChild(row);
      if (!this.collapsedJoints.has(joint.id) || filter) {
        const nested = dom('ul');
        for (const child of descendants) {
          const childItem = render(child, depth + 1);
          if (childItem) nested.appendChild(childItem);
        }
        if (nested.childElementCount > 0) item.appendChild(nested);
      }
      return item;
    };
    const roots = this.rig.joints.filter((joint) => joint.parentId === null || !this.rig.joints.some((p) => p.id === joint.parentId));
    for (const joint of roots) {
      const item = render(joint, 0);
      if (item) list.appendChild(item);
    }
    this.jointTree.replaceChildren(list);
  }

  private selectJoint(jointId: JointId | undefined): void {
    this.selectedJointId = jointId;
    const node = jointId ? this.jointNodes.get(jointId) : undefined;
    if (this.authoringMode === 'fk' && node) this.transform.attach(node);
    else if (this.authoringMode === 'fk') this.transform.detach();
    const clip = this.activeClip();
    const relevant = clip?.tracks.find((track) => track.target === jointId);
    if (relevant) this.selectedTrackId = relevant.id;
    this.selectedKey = undefined;
    this.selectedAnnotation = undefined;
    this.refreshJointTree();
    this.refreshInspector();
    this.refreshTimeline();
    this.refreshCurve();
  }

  private refreshInspector(): void {
    if (!this.inspector) return;
    this.inspector.replaceChildren();
    this.scalarInputs.clear();
    if (this.authoringMode === 'ik') {
      this.transformInputs = [];
      this.buildIkInspector(this.inspector);
      if (this.rig.controls.length > 0) this.buildScalarControls(this.inspector);
      if (this.selectedAnnotation) this.buildAnnotationInspector(this.inspector, this.selectedAnnotation);
      return;
    }
    const joint = this.rig.joints.find((candidate) => candidate.id === this.selectedJointId);
    const node = joint ? this.jointNodes.get(joint.id) : undefined;
    const title = this.sectionTitle(joint?.name ?? 'Transform');
    if (joint) title.appendChild(dom('span', '', joint.id));
    this.inspector.appendChild(title);

    if (joint && node) {
      const note = dom('div', 'ast-hint', 'Local FK transform. Rotation is shown in XYZ degrees.');
      this.inspector.appendChild(note);
      this.transformInputs = [];
      const labels: Array<[string, TransformMode]> = [
        ['P', 'translate'],
        ['R', 'rotate'],
        ['S', 'scale'],
      ];
      for (let rowIndex = 0; rowIndex < labels.length; rowIndex += 1) {
        const [label, mode] = labels[rowIndex];
        const row = dom('div', 'ast-vector');
        row.appendChild(dom('span', '', label));
        const fields: HTMLInputElement[] = [];
        for (let axis = 0; axis < 3; axis += 1) {
          const valueInput = input('number');
          valueInput.step = mode === 'rotate' ? '0.1' : '0.001';
          valueInput.classList.add(axis === 0 ? 'ast-axis-x' : axis === 1 ? 'ast-axis-y' : 'ast-axis-z');
          valueInput.setAttribute('aria-label', `${mode} ${'XYZ'[axis]}`);
          valueInput.onchange = () => this.applyNumericTransform(mode, axis, finite(valueInput.value, 0));
          fields.push(valueInput);
          row.appendChild(valueInput);
        }
        this.transformInputs.push(fields);
        this.inspector.appendChild(row);
      }
      const setKey = button('◆ Key transform');
      const reset = button('Reset to rest');
      setKey.onclick = () => this.setKeyForSelected(false, true);
      reset.onclick = () => this.resetSelectedJoint();
      const row = dom('div', 'ast-button-row');
      row.append(setKey, reset);
      this.inspector.appendChild(row);
      this.refreshInspectorValues();
    } else {
      this.transformInputs = [];
      this.inspector.appendChild(dom('div', 'ast-hint', 'Select a bound joint to pose it.'));
    }

    if (this.rig.controls.length > 0) this.buildScalarControls(this.inspector);
    if (this.selectedAnnotation) this.buildAnnotationInspector(this.inspector, this.selectedAnnotation);
  }

  private buildIkInspector(parent: HTMLElement): void {
    parent.appendChild(this.sectionTitle('Inverse kinematics'));
    if (this.ikChains.length === 0) {
      this.ikStatusElement = undefined;
      parent.appendChild(dom('div', 'ast-hint', 'No declared or semantic shoulder/elbow/wrist or hip/knee/ankle chain could be resolved.'));
      return;
    }
    const chain = this.activeIkChain();
    if (!chain) return;
    const select = dom('select', 'ast-select ast-grow');
    for (const candidate of this.ikChains) {
      const option = dom('option', '', candidate.name);
      option.value = candidate.id;
      select.appendChild(option);
    }
    select.value = chain.id;
    select.onchange = () => {
      this.selectedIkChainId = select.value;
      const active = this.activeIkChain();
      if (active) this.selectedJointId = active.rootId;
      this.positionIkHelpersFromPose();
      this.refreshJointTree();
      this.refreshInspector();
    };
    parent.appendChild(this.field('Chain', select));
    parent.appendChild(dom(
      'div',
      'ast-hint',
      `${chain.rootId} → ${chain.midId} → ${chain.endId}${chain.effectorSocketId ? ` · ${chain.effectorSocketId}` : ''}`,
    ));

    parent.appendChild(this.ikVectorField('Target', this.ikTargetHandle, 'IK target'));
    parent.appendChild(this.ikVectorField('Pole', this.ikPoleHandle, 'IK pole'));
    this.ikStatusElement = dom('div', 'ast-ik-status');
    parent.appendChild(this.ikStatusElement);
    this.updateIkStatus();

    const buttons = dom('div', 'ast-button-row');
    const setKeys = button('◆ Set IK keys');
    const reset = button('Reset helpers');
    setKeys.onclick = () => this.setIkKeys(true);
    reset.onclick = () => {
      this.needsSample = true;
      this.sampleCurrentPose();
      this.positionIkHelpersFromPose();
      this.refreshInspector();
    };
    buttons.append(setKeys, reset);
    parent.appendChild(buttons);
    parent.appendChild(dom(
      'div',
      'ast-hint',
      'Both viewport gizmos translate in world space. Cyan moves the end effector; gold controls bend direction. Esc cancels a drag.',
    ));
  }

  private ikVectorField(label: string, handle: THREE.Object3D, transactionLabel: string): HTMLElement {
    const row = dom('div', 'ast-vector');
    const fields: HTMLInputElement[] = [];
    row.appendChild(dom('span', '', label === 'Target' ? 'T' : 'P'));
    for (let axis = 0; axis < 3; axis += 1) {
      const value = input('number');
      value.step = '0.001';
      value.value = String(handle.position.getComponent(axis));
      value.classList.add(axis === 0 ? 'ast-axis-x' : axis === 1 ? 'ast-axis-y' : 'ast-axis-z');
      value.setAttribute('aria-label', `${label} ${'XYZ'[axis]}`);
      value.onchange = () => {
        const next = finite(value.value, handle.position.getComponent(axis));
        this.commitMutation(`Move ${transactionLabel}`, () => {
          handle.position.setComponent(axis, next);
          this.onIkHandleChanged();
        });
        this.refreshInspector();
        this.refreshTimeline();
        this.refreshCurve();
      };
      fields.push(value);
      row.appendChild(value);
    }
    if (handle === this.ikTargetHandle) this.ikTargetInputs = fields;
    else this.ikPoleInputs = fields;
    return row;
  }

  private refreshIkVectorInputs(): void {
    for (let axis = 0; axis < 3; axis += 1) {
      const target = this.ikTargetInputs[axis];
      const pole = this.ikPoleInputs[axis];
      if (target) setNumberInput(target, this.ikTargetHandle.position.getComponent(axis), 4);
      if (pole) setNumberInput(pole, this.ikPoleHandle.position.getComponent(axis), 4);
    }
  }

  private refreshInspectorValues(): void {
    if (this.transformInputs.length !== 3 || !this.selectedJointId) return;
    const node = this.jointNodes.get(this.selectedJointId);
    if (!node) return;
    const euler = new THREE.Euler().setFromQuaternion(node.quaternion, 'XYZ');
    const values = [
      [node.position.x, node.position.y, node.position.z],
      [THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z)],
      [node.scale.x, node.scale.y, node.scale.z],
    ];
    for (let row = 0; row < 3; row += 1) {
      for (let axis = 0; axis < 3; axis += 1) setNumberInput(this.transformInputs[row][axis], values[row][axis], row === 1 ? 2 : 4);
    }
  }

  private applyNumericTransform(mode: TransformMode, axis: number, value: number): void {
    if (!this.selectedJointId) return;
    const node = this.jointNodes.get(this.selectedJointId);
    if (!node) return;
    this.commitMutation(`Edit ${mode}`, () => {
      if (mode === 'translate') node.position.setComponent(axis, value);
      else if (mode === 'scale') node.scale.setComponent(axis, Math.max(0.001, value));
      else {
        const euler = new THREE.Euler().setFromQuaternion(node.quaternion, 'XYZ');
        const radians = THREE.MathUtils.degToRad(value);
        if (axis === 0) euler.x = radians;
        else if (axis === 1) euler.y = radians;
        else euler.z = radians;
        node.quaternion.setFromEuler(euler).normalize();
      }
      node.updateMatrix();
      this.ctx.rigRoot.updateMatrixWorld(true);
      if (this.autoKey) this.writeSelectedJointKeys(true);
    });
    this.onionDirty = true;
    this.refreshInspectorValues();
    this.refreshTimeline();
    this.refreshCurve();
    this.refreshJointTree();
  }

  private resetSelectedJoint(): void {
    if (!this.selectedJointId) return;
    const joint = this.rig.joints.find((candidate) => candidate.id === this.selectedJointId);
    const node = this.jointNodes.get(this.selectedJointId);
    if (!joint || !node) return;
    this.commitMutation('Reset joint to rest', () => {
      node.position.fromArray(joint.rest.position);
      node.quaternion.fromArray(joint.rest.quaternion);
      node.scale.fromArray(joint.rest.scale);
      if (this.autoKey) this.writeSelectedJointKeys(false);
    });
    this.onionDirty = true;
    this.refreshAll();
  }

  private buildScalarControls(parent: HTMLElement): void {
    parent.appendChild(this.sectionTitle('Deformation controls'));
    for (const control of this.rig.controls) {
      const value = this.currentScalars[control.id] ?? control.defaultValue;
      const slider = input('range');
      slider.min = String(control.min ?? 0.5);
      slider.max = String(control.max ?? 1.5);
      slider.step = '0.01';
      slider.value = String(value);
      const exact = input('number');
      exact.min = slider.min;
      exact.max = slider.max;
      exact.step = '0.01';
      exact.value = String(value);
      const controls = dom('div', 'ast-button-row ast-grow');
      const keyButton = button('◆', `Key ${control.name ?? control.id} at the playhead`);
      keyButton.classList.add('ast-icon');
      slider.classList.add('ast-grow');
      controls.append(slider, exact, keyButton);
      this.scalarInputs.set(control.id, { slider, exact });
      parent.appendChild(this.field(control.name ?? control.id, controls));
      const setValue = (raw: string, record: boolean): void => {
        const next = clamp(finite(raw, value), control.min ?? -100, control.max ?? 100);
        this.currentScalars[control.id] = next;
        slider.value = String(next);
        exact.value = String(next);
        this.ctx.applyScalars?.(this.currentScalars);
        if (this.autoKey) this.setScalarKey(control.id, next, record);
      };
      slider.addEventListener('pointerdown', () => {
        this.pausePlayback();
        this.beginTransaction(`Edit ${control.name ?? control.id}`);
      });
      slider.onfocus = () => {
        this.pausePlayback();
        if (!this.transaction) this.beginTransaction(`Edit ${control.name ?? control.id}`);
      };
      slider.oninput = () => setValue(slider.value, false);
      slider.onchange = () => this.commitTransaction();
      slider.onblur = () => this.commitTransaction();
      exact.onfocus = () => {
        this.pausePlayback();
        this.beginTransaction(`Edit ${control.name ?? control.id}`);
      };
      exact.oninput = () => setValue(exact.value, false);
      exact.onchange = () => this.commitTransaction();
      exact.onblur = () => this.commitTransaction();
      keyButton.onclick = () => this.setScalarKey(control.id, this.currentScalars[control.id] ?? control.defaultValue, true);
    }
  }

  private refreshScalarValues(): void {
    for (const control of this.rig.controls) {
      const fields = this.scalarInputs.get(control.id);
      if (!fields) continue;
      const value = this.currentScalars[control.id] ?? control.defaultValue;
      if (document.activeElement !== fields.slider) fields.slider.value = String(value);
      setNumberInput(fields.exact, value, 4);
    }
  }

  private onTransformChanged(): void {
    this.refreshInspectorValues();
    if (this.autoKey) this.writeSelectedJointKeys(true);
    this.onionDirty = true;
  }

  private finishTransformTransaction(): void {
    this.commitTransaction();
    this.refreshJointTree();
    this.refreshTimeline();
    this.refreshCurve();
  }

  private setKeyForSelected(modeOnly: boolean, recordHistory: boolean): void {
    if (!this.selectedJointId) return;
    const run = (): void => this.writeSelectedJointKeys(modeOnly);
    if (recordHistory) this.commitMutation(modeOnly ? 'Set transform key' : 'Set pose key', run);
    else run();
    this.onionDirty = true;
    if (recordHistory) this.toast(`Key set at ${Math.round(this.playTime * FRAME_RATE)}f`);
    this.refreshJointTree();
    this.refreshTimeline();
    this.refreshCurve();
  }

  private writeSelectedJointKeys(modeOnly: boolean): void {
    if (!this.selectedJointId) return;
    const delta = this.captureKeyPose([this.selectedJointId]).joints[this.selectedJointId];
    const clip = this.activeClip();
    if (!delta || !clip) return;
    const kinds: TransformTrackKind[] = modeOnly
      ? [this.transformMode === 'translate' ? 'position' : this.transformMode === 'rotate' ? 'quaternion' : 'scale']
      : ['position', 'quaternion', 'scale'];
    let next = clip;
    for (const kind of kinds) {
      const value = kind === 'position' ? delta.position : kind === 'quaternion' ? delta.quaternion : delta.scale;
      if (!value) continue;
      const written = this.writeTransformKey(next, this.selectedJointId, kind, value);
      next = written.clip;
      this.selectedTrackId = written.trackId;
      this.selectedKey = { trackId: written.trackId, keyId: written.keyId, component: 0 };
    }
    this.replaceActiveClip(next);
  }

  private writeTransformKey(
    source: AnimationClip,
    target: JointId,
    kind: TransformTrackKind,
    value: Vec3Tuple | [number, number, number, number],
  ): { clip: AnimationClip; trackId: string; keyId: string } {
    let clip = source;
    let track = clip.tracks.find((candidate) => candidate.kind === kind && candidate.target === target) as TransformTrack | undefined;
    if (!track) {
      track = createAnimationTrack(kind, target) as TransformTrack;
      clip = upsertTrack(clip, track);
    }
    const existing = track.keys.find((key) => Math.abs(key.time - this.playTime) <= KEY_EPSILON);
    const id = existing?.id ?? createAnimationId('key');
    const interpolation = existing?.interpolation ?? 'cubic';
    const key = kind === 'quaternion'
      ? createQuaternionKeyframe(this.playTime, value as [number, number, number, number], interpolation, id)
      : createVectorKeyframe(this.playTime, value as Vec3Tuple, interpolation, id);
    clip = upsertKeyframe(clip, track.id, key);
    return { clip, trackId: track.id, keyId: id };
  }

  private setScalarKey(controlId: string, value: number, recordHistory: boolean): void {
    const run = (): void => {
      let clip = this.activeClip();
      if (!clip) return;
      let track = clip.tracks.find((candidate) => candidate.kind === 'scalar' && candidate.target === controlId);
      if (!track) {
        track = createAnimationTrack('scalar', controlId);
        clip = upsertTrack(clip, track);
      }
      const existing = track.keys.find((key) => Math.abs(key.time - this.playTime) <= KEY_EPSILON);
      const key = createScalarKeyframe(
        this.playTime,
        value,
        existing?.interpolation ?? 'cubic',
        existing?.id ?? createAnimationId('key'),
      );
      clip = upsertKeyframe(clip, track.id, key);
      this.replaceActiveClip(clip);
      this.selectedTrackId = track.id;
      this.selectedKey = { trackId: track.id, keyId: key.id, component: 0 };
    };
    if (recordHistory) this.commitMutation(`Key ${controlId}`, run);
    else run();
    this.refreshTimeline();
    this.refreshCurve();
  }

  private deleteCurrentKeys(): void {
    const clip = this.activeClip();
    if (!clip) return;
    this.commitMutation('Delete key', () => {
      let next = clip;
      if (this.selectedKey) {
        next = removeKeyframe(next, this.selectedKey.trackId, this.selectedKey.keyId);
      } else if (this.selectedJointId) {
        for (const track of next.tracks.filter((candidate) => candidate.target === this.selectedJointId)) {
          for (const key of track.keys.filter((candidate) => Math.abs(candidate.time - this.playTime) <= KEY_EPSILON)) {
            next = removeKeyframe(next, track.id, key.id);
          }
        }
      }
      this.replaceActiveClip(next);
    });
    this.selectedKey = undefined;
    this.needsSample = true;
    this.refreshAll();
  }

  private timelineLanes(clip: AnimationClip): TimelineLane[] {
    const kindLabel: Record<AnimationTrack['kind'], string> = {
      position: 'Position',
      quaternion: 'Rotation',
      scale: 'Scale',
      scalar: 'Control',
    };
    const jointName = new Map(this.rig.joints.map((joint) => [joint.id, joint.name ?? joint.id]));
    const controlName = new Map(this.rig.controls.map((control) => [control.id, control.name ?? control.id]));
    const tracks = [...clip.tracks].sort((a, b) => {
      const aSelected = a.target === this.selectedJointId ? 0 : 1;
      const bSelected = b.target === this.selectedJointId ? 0 : 1;
      return aSelected - bSelected || a.target.localeCompare(b.target) || a.kind.localeCompare(b.kind);
    });
    const lanes: TimelineLane[] = tracks.map((track) => ({
      id: track.id,
      label: `${track.kind === 'scalar' ? controlName.get(track.target) ?? track.target : jointName.get(track.target) ?? track.target} · ${kindLabel[track.kind]}`,
      kind: track.kind,
      track,
    }));
    for (const driver of [...clip.proceduralDrivers].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
      lanes.push({
        id: `procedural.${driver.id}`,
        label: `ƒ ${driver.name ?? driver.type} · ${this.proceduralTargetLabel(driver.target)}`,
        kind: 'procedural',
        driver,
      });
    }
    lanes.push(
      { id: 'annotations.markers', label: 'Markers', kind: 'marker' },
      { id: 'annotations.contacts', label: 'Contacts', kind: 'contact' },
      { id: 'annotations.events', label: 'Events', kind: 'event' },
    );
    return lanes;
  }

  private refreshTimeline(): void {
    if (!this.timelineCanvas) return;
    const clip = this.activeClip();
    if (!clip) return;
    const lanes = this.timelineLanes(clip);
    const laneHeight = 25;
    const height = Math.max(lanes.length * laneHeight, 175);
    this.timelineLabels.style.height = `${height}px`;
    this.timelineCanvas.style.height = `${height}px`;
    this.sheet.style.height = `${height}px`;
    this.timelineLabels.replaceChildren();
    this.timelineCanvas.replaceChildren();

    for (const [index, lane] of lanes.entries()) {
      const selected = lane.track?.id === this.selectedTrackId || lane.driver?.id === this.selectedDriverId ||
        (this.selectedAnnotation?.kind === lane.kind && !lane.track);
      const label = dom('div', 'ast-lane-label', lane.label);
      label.classList.toggle('ast-selected', selected);
      label.title = lane.label;
      label.onclick = () => {
        if (lane.driver) {
          this.selectedDriverId = lane.driver.id;
          this.selectedTrackId = undefined;
          this.selectedKey = undefined;
          this.selectedAnnotation = undefined;
          this.refreshDriverList();
          this.refreshProceduralInspector();
          this.refreshTimeline();
        } else if (lane.track) {
          this.selectedKey = undefined;
          if (lane.track.kind !== 'scalar') {
            this.selectJoint(lane.track.target);
            this.selectedTrackId = lane.track.id;
            this.refreshTimeline();
            this.refreshCurve();
          }
          else {
            this.selectedTrackId = lane.track.id;
            this.selectedAnnotation = undefined;
            this.refreshTimeline();
            this.refreshCurve();
          }
        } else {
          this.selectedTrackId = undefined;
          this.selectedKey = undefined;
          this.refreshTimeline();
          this.refreshCurve();
        }
      };
      this.timelineLabels.appendChild(label);

      const laneElement = dom('div', 'ast-lane');
      laneElement.style.top = `${index * laneHeight}px`;
      laneElement.dataset.laneId = lane.id;
      this.timelineCanvas.appendChild(laneElement);

      if (lane.track) {
        for (const key of lane.track.keys) {
          const keyElement = this.timelineKeyElement(key.time, index, 'key');
          keyElement.title = `${lane.label} · ${key.time.toFixed(3)}s`;
          keyElement.classList.toggle('ast-selected', this.selectedKey?.trackId === lane.track.id && this.selectedKey.keyId === key.id);
          keyElement.onpointerdown = (event) => this.beginKeyDrag(event, lane.track!, key.id);
          this.timelineCanvas.appendChild(keyElement);
        }
      } else if (lane.driver) {
        this.drawProceduralTimelineLane(laneElement, lane.driver, clip);
      } else if (lane.kind === 'marker') {
        for (const marker of clip.markers) {
          const element = this.timelineKeyElement(marker.time, index, 'marker');
          element.style.background = marker.color ?? '';
          element.title = `${marker.name} · ${marker.time.toFixed(3)}s`;
          element.classList.toggle('ast-selected', this.selectedAnnotation?.kind === 'marker' && this.selectedAnnotation.id === marker.id);
          element.onpointerdown = (event) => this.beginAnnotationDrag(event, 'marker', marker.id);
          this.timelineCanvas.appendChild(element);
        }
      } else if (lane.kind === 'contact') {
        for (const contact of clip.contacts) {
          const span = dom('div', 'ast-loop-range');
          span.style.left = `${this.timePercent(contact.start, clip)}%`;
          span.style.width = `${Math.max(0.25, this.timePercent(contact.end - contact.start, clip))}%`;
          span.style.top = `${index * laneHeight + 5}px`;
          span.style.bottom = 'auto';
          span.style.height = '15px';
          this.timelineCanvas.appendChild(span);
          const element = this.timelineKeyElement(contact.start, index, 'contact');
          element.title = `${contact.effector} ${contact.mode} · ${contact.start.toFixed(3)}–${contact.end.toFixed(3)}s`;
          element.classList.toggle('ast-selected', this.selectedAnnotation?.kind === 'contact' && this.selectedAnnotation.id === contact.id);
          element.onpointerdown = (event) => this.beginAnnotationDrag(event, 'contact', contact.id);
          this.timelineCanvas.appendChild(element);
        }
      } else if (lane.kind === 'event') {
        for (const event of clip.events) {
          const element = this.timelineKeyElement(event.time, index, 'event');
          element.title = `${event.name} · ${event.time.toFixed(3)}s`;
          element.classList.toggle('ast-selected', this.selectedAnnotation?.kind === 'event' && this.selectedAnnotation.id === event.id);
          element.onpointerdown = (pointer) => this.beginAnnotationDrag(pointer, 'event', event.id);
          this.timelineCanvas.appendChild(element);
        }
      }
    }

    const duration = Math.max(clip.duration, MIN_DURATION);
    const interval = duration <= 2 ? 0.1 : duration <= 6 ? 0.5 : duration <= 20 ? 1 : 5;
    const majorEvery = duration <= 2 ? 5 : duration <= 6 ? 2 : duration <= 20 ? 5 : 2;
    for (let index = 0, time = 0; time <= duration + interval * 0.25; index += 1, time = index * interval) {
      const tick = dom('div', 'ast-tick', index % majorEvery === 0 ? `${time.toFixed(time < 10 && interval < 1 ? 1 : 0)}s` : '');
      tick.classList.toggle('ast-major', index % majorEvery === 0);
      tick.style.left = `${this.timePercent(time, clip)}%`;
      this.timelineCanvas.appendChild(tick);
    }
    const loopRange = dom('div', 'ast-loop-range');
    loopRange.style.left = `${this.timePercent(clip.range.start, clip)}%`;
    loopRange.style.width = `${this.timePercent(clip.range.end - clip.range.start, clip)}%`;
    this.timelineCanvas.appendChild(loopRange);
    this.timelineCanvas.appendChild(this.playhead);
    this.syncTimeUi();
  }

  private timelineKeyElement(time: number, laneIndex: number, kind: 'key' | AnnotationKind): HTMLElement {
    const clip = this.activeClip();
    const element = dom('div', `ast-key${kind === 'key' ? '' : ` ast-${kind}`}`);
    element.style.left = `${this.timePercent(time, clip)}%`;
    element.style.top = `${laneIndex * 25}px`;
    return element;
  }

  private timePercent(time: number, clip = this.activeClip()): number {
    return clamp(time / Math.max(clip?.duration ?? 1, MIN_DURATION), 0, 1) * 100;
  }

  private timeFromPointer(event: PointerEvent | MouseEvent, element: HTMLElement): number {
    const clip = this.activeClip();
    if (!clip) return 0;
    const rect = element.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const raw = ratio * clip.duration;
    return event.altKey ? raw : frameTime(raw);
  }

  private beginKeyDrag(event: PointerEvent, track: AnimationTrack, keyId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.pausePlayback();
    const key = track.keys.find((candidate) => candidate.id === keyId);
    if (!key) return;
    this.selectedTrackId = track.id;
    this.selectedKey = { trackId: track.id, keyId, component: this.selectedKey?.component ?? 0 };
    this.selectedAnnotation = undefined;
    this.seek(key.time);
    this.beginTransaction('Move key');

    const move = (pointer: PointerEvent): void => {
      const time = this.timeFromPointer(pointer, this.timelineCanvas);
      const clip = this.activeClip();
      const currentTrack = clip?.tracks.find((candidate) => candidate.id === track.id);
      const currentKey = currentTrack?.keys.find((candidate) => candidate.id === keyId);
      if (!clip || !currentTrack || !currentKey) return;
      const moved = { ...currentKey, time } as AnimationKeyframe;
      this.replaceActiveClip(upsertKeyframe(clip, track.id, moved));
      this.playTime = time;
      this.needsSample = true;
      this.refreshTimeline();
      this.refreshCurve();
    };
    const finish = (cancel: boolean): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.cancelActiveDrag = undefined;
      if (cancel) this.cancelTransaction();
      else this.commitTransaction();
      this.refreshAll();
    };
    const up = (): void => finish(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    this.cancelActiveDrag = () => finish(true);
    this.refreshTimeline();
    this.refreshCurve();
  }

  private beginAnnotationDrag(event: PointerEvent, kind: AnnotationKind, id: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.pausePlayback();
    const originalTime = this.annotationTime(kind, id);
    if (originalTime === undefined) return;
    const originalContact = kind === 'contact' ? this.activeClip()?.contacts.find((entry) => entry.id === id) : undefined;
    const contactDuration = originalContact ? originalContact.end - originalContact.start : 0;
    this.selectedAnnotation = { kind, id };
    this.selectedKey = undefined;
    this.selectedTrackId = undefined;
    this.seek(originalTime);
    this.beginTransaction(`Move ${kind}`);

    const move = (pointer: PointerEvent): void => {
      const time = this.timeFromPointer(pointer, this.timelineCanvas);
      this.replaceAnnotation(kind, id, (entry) => {
        if (kind === 'contact') {
          const contact = entry as AnimationContact;
          const maxStart = Math.max(0, (this.activeClip()?.duration ?? time) - contactDuration);
          const start = Math.min(time, maxStart);
          return { ...contact, start, end: start + contactDuration };
        }
        return { ...entry, time };
      });
      this.playTime = time;
      this.needsSample = true;
      this.refreshTimeline();
      this.refreshInspector();
    };
    const finish = (cancel: boolean): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.cancelActiveDrag = undefined;
      if (cancel) this.cancelTransaction();
      else this.commitTransaction();
      this.refreshAll();
    };
    const up = (): void => finish(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    this.cancelActiveDrag = () => finish(true);
    this.refreshTimeline();
    this.refreshInspector();
  }

  private addAnnotation(kind: AnnotationKind): void {
    const clip = this.activeClip();
    if (!clip) return;
    const id = createAnimationId(kind);
    this.commitMutation(`Add ${kind}`, () => {
      if (kind === 'marker') {
        const marker: AnimationMarker = {
          id,
          time: this.playTime,
          name: uniqueName('Marker', clip.markers.map((entry) => entry.name)),
          color: '#ffd16a',
        };
        this.replaceActiveClip({ ...clip, markers: [...clip.markers, marker] });
      } else if (kind === 'contact') {
        const effector = this.rig.sockets[0]?.id ?? this.selectedJointId ?? 'effector';
        const contact: AnimationContact = {
          id,
          start: this.playTime,
          end: Math.min(clip.duration, this.playTime + 0.15),
          effector,
          mode: 'plant',
          weight: 1,
        };
        this.replaceActiveClip({ ...clip, contacts: [...clip.contacts, contact] });
      } else {
        const event: AnimationEvent = {
          id,
          time: this.playTime,
          name: uniqueName('Event', clip.events.map((entry) => entry.name)),
        };
        this.replaceActiveClip({ ...clip, events: [...clip.events, event] });
      }
    });
    this.selectedAnnotation = { kind, id };
    this.selectedKey = undefined;
    this.selectedTrackId = undefined;
    this.refreshTimeline();
    this.refreshInspector();
  }

  private annotationTime(kind: AnnotationKind, id: string): number | undefined {
    const clip = this.activeClip();
    if (kind === 'marker') return clip?.markers.find((entry) => entry.id === id)?.time;
    if (kind === 'contact') return clip?.contacts.find((entry) => entry.id === id)?.start;
    return clip?.events.find((entry) => entry.id === id)?.time;
  }

  private replaceAnnotation(
    kind: AnnotationKind,
    id: string,
    update: (entry: AnimationMarker | AnimationContact | AnimationEvent) => AnimationMarker | AnimationContact | AnimationEvent,
  ): void {
    const clip = this.activeClip();
    if (!clip) return;
    if (kind === 'marker') {
      const markers = clip.markers.map((entry) => entry.id === id ? update(entry) as AnimationMarker : entry);
      this.replaceActiveClip({ ...clip, markers });
    } else if (kind === 'contact') {
      const contacts = clip.contacts.map((entry) => entry.id === id ? update(entry) as AnimationContact : entry);
      this.replaceActiveClip({ ...clip, contacts });
    } else {
      const events = clip.events.map((entry) => entry.id === id ? update(entry) as AnimationEvent : entry);
      this.replaceActiveClip({ ...clip, events });
    }
  }

  private mutateAnnotation(
    label: string,
    selection: SelectedAnnotation,
    update: (entry: AnimationMarker | AnimationContact | AnimationEvent) => AnimationMarker | AnimationContact | AnimationEvent,
  ): void {
    this.commitMutation(label, () => this.replaceAnnotation(selection.kind, selection.id, update));
    this.refreshTimeline();
    this.refreshInspector();
  }

  private deleteAnnotation(selection: SelectedAnnotation): void {
    const clip = this.activeClip();
    if (!clip) return;
    this.commitMutation(`Delete ${selection.kind}`, () => {
      if (selection.kind === 'marker') {
        this.replaceActiveClip({ ...clip, markers: clip.markers.filter((entry) => entry.id !== selection.id) });
      } else if (selection.kind === 'contact') {
        this.replaceActiveClip({ ...clip, contacts: clip.contacts.filter((entry) => entry.id !== selection.id) });
      } else {
        this.replaceActiveClip({ ...clip, events: clip.events.filter((entry) => entry.id !== selection.id) });
      }
    });
    this.selectedAnnotation = undefined;
    this.refreshTimeline();
    this.refreshInspector();
  }

  private buildAnnotationInspector(parent: HTMLElement, selection: SelectedAnnotation): void {
    const clip = this.activeClip();
    if (!clip) return;
    parent.appendChild(this.sectionTitle(`${selection.kind} properties`));
    if (selection.kind === 'marker') {
      const marker = clip.markers.find((entry) => entry.id === selection.id);
      if (!marker) return;
      const name = input('text');
      name.value = marker.name;
      name.onchange = () => this.mutateAnnotation('Rename marker', selection, (entry) => ({ ...entry as AnimationMarker, name: name.value.trim() || marker.name }));
      const time = input('number');
      time.value = String(marker.time);
      time.step = String(1 / FRAME_RATE);
      time.onchange = () => this.mutateAnnotation('Move marker', selection, (entry) => ({
        ...entry as AnimationMarker,
        time: clamp(finite(time.value, marker.time), 0, clip.duration),
      }));
      const color = input('color');
      color.value = marker.color ?? '#ffd16a';
      color.onchange = () => this.mutateAnnotation('Change marker color', selection, (entry) => ({ ...entry as AnimationMarker, color: color.value }));
      parent.append(this.field('Name', name), this.field('Time', time), this.field('Color', color));
    } else if (selection.kind === 'event') {
      const event = clip.events.find((entry) => entry.id === selection.id);
      if (!event) return;
      const name = input('text');
      name.value = event.name;
      name.onchange = () => this.mutateAnnotation('Rename event', selection, (entry) => ({ ...entry as AnimationEvent, name: name.value.trim() || event.name }));
      const time = input('number');
      time.value = String(event.time);
      time.step = String(1 / FRAME_RATE);
      time.onchange = () => this.mutateAnnotation('Move event', selection, (entry) => ({
        ...entry as AnimationEvent,
        time: clamp(finite(time.value, event.time), 0, clip.duration),
      }));
      const payload = input('text');
      payload.placeholder = 'JSON payload (optional)';
      payload.value = event.payload === undefined ? '' : JSON.stringify(event.payload);
      payload.onchange = () => {
        try {
          const value = payload.value.trim() ? JSON.parse(payload.value) as AnimationEvent['payload'] : undefined;
          this.mutateAnnotation('Edit event payload', selection, (entry) => {
            const next = { ...entry as AnimationEvent };
            if (value === undefined) delete next.payload;
            else next.payload = value;
            return next;
          });
        } catch {
          this.toast('Event payload is not valid JSON');
          payload.value = event.payload === undefined ? '' : JSON.stringify(event.payload);
        }
      };
      parent.append(this.field('Name', name), this.field('Time', time), this.field('Payload', payload));
    } else {
      const contact = clip.contacts.find((entry) => entry.id === selection.id);
      if (!contact) return;
      const effector = input('text');
      effector.value = contact.effector;
      effector.setAttribute('list', 'ast-effectors');
      const datalist = dom('datalist');
      datalist.id = 'ast-effectors';
      for (const socket of this.rig.sockets) {
        const option = dom('option');
        option.value = socket.id;
        datalist.appendChild(option);
      }
      effector.onchange = () => this.mutateAnnotation('Change contact effector', selection, (entry) => ({
        ...entry as AnimationContact,
        effector: effector.value.trim() || contact.effector,
      }));
      const mode = dom('select', 'ast-select ast-grow');
      for (const value of ['plant', 'grip', 'custom'] as const) {
        const option = dom('option', '', value);
        option.value = value;
        mode.appendChild(option);
      }
      mode.value = contact.mode;
      mode.onchange = () => this.mutateAnnotation('Change contact mode', selection, (entry) => ({
        ...entry as AnimationContact,
        mode: mode.value as AnimationContact['mode'],
      }));
      const start = input('number');
      const end = input('number');
      const weight = input('number');
      start.value = String(contact.start);
      end.value = String(contact.end);
      weight.value = String(contact.weight ?? 1);
      start.step = end.step = String(1 / FRAME_RATE);
      weight.step = '0.05';
      const setBounds = (): void => this.mutateAnnotation('Edit contact range', selection, (entry) => {
        const old = entry as AnimationContact;
        const nextStart = clamp(finite(start.value, old.start), 0, clip.duration);
        const nextEnd = clamp(finite(end.value, old.end), nextStart, clip.duration);
        return { ...old, start: nextStart, end: nextEnd };
      });
      start.onchange = setBounds;
      end.onchange = setBounds;
      weight.onchange = () => this.mutateAnnotation('Edit contact weight', selection, (entry) => ({
        ...entry as AnimationContact,
        weight: clamp(finite(weight.value, contact.weight ?? 1), 0, 1),
      }));
      parent.append(
        datalist,
        this.field('Effector', effector),
        this.field('Mode', mode),
        this.field('Start', start),
        this.field('End', end),
        this.field('Weight', weight),
      );
    }
    const remove = button(`Delete ${selection.kind}`);
    remove.classList.add('ast-danger');
    remove.onclick = () => this.deleteAnnotation(selection);
    parent.appendChild(remove);
  }

  private refreshCurve(): void {
    if (!this.curveSection) return;
    this.curveSection.replaceChildren();
    this.curveSection.appendChild(this.sectionTitle('Curve editor'));
    const clip = this.activeClip();
    if (!clip || clip.tracks.length === 0) {
      this.curveSection.appendChild(dom('div', 'ast-hint', 'Set a key to create an editable channel.'));
      return;
    }
    let track = clip.tracks.find((candidate) => candidate.id === this.selectedTrackId);
    if (!track) track = clip.tracks.find((candidate) => candidate.target === this.selectedJointId) ?? clip.tracks[0];
    this.selectedTrackId = track.id;

    const trackSelect = dom('select', 'ast-select ast-grow');
    for (const candidate of clip.tracks) {
      const option = dom('option', '', this.trackDisplayName(candidate));
      option.value = candidate.id;
      trackSelect.appendChild(option);
    }
    trackSelect.value = track.id;
    trackSelect.onchange = () => {
      this.selectedTrackId = trackSelect.value;
      this.selectedKey = undefined;
      this.refreshTimeline();
      this.refreshCurve();
    };
    this.curveSection.appendChild(this.field('Channel', trackSelect));

    const componentCount = track.kind === 'scalar' ? 1 : track.kind === 'quaternion' ? 4 : 3;
    let component = this.selectedKey?.trackId === track.id ? this.selectedKey.component : 0;
    component = clamp(component, 0, componentCount - 1);
    const componentSelect = dom('select', 'ast-select ast-grow');
    const componentNames = track.kind === 'quaternion' ? ['Qx', 'Qy', 'Qz', 'Qw'] : track.kind === 'scalar' ? ['Value'] : ['X', 'Y', 'Z'];
    for (let index = 0; index < componentCount; index += 1) {
      const option = dom('option', '', componentNames[index]);
      option.value = String(index);
      componentSelect.appendChild(option);
    }
    componentSelect.value = String(component);
    componentSelect.onchange = () => {
      const next = Number(componentSelect.value);
      if (this.selectedKey?.trackId === track!.id) this.selectedKey.component = next;
      else {
        const closest = this.closestKey(track!, this.playTime);
        if (closest) this.selectedKey = { trackId: track!.id, keyId: closest.id, component: next };
      }
      this.refreshCurve();
    };
    this.curveSection.appendChild(this.field('Component', componentSelect));

    const curveWrap = dom('div', 'ast-curve-wrap');
    const graph = svg('svg', 'ast-curve');
    graph.setAttribute('viewBox', '0 0 300 160');
    graph.setAttribute('preserveAspectRatio', 'none');
    curveWrap.appendChild(graph);
    this.curveSection.appendChild(curveWrap);
    const range = this.curveValueRange(track, component);
    this.drawCurveGraph(graph, clip, track, component, range);

    const selected = this.selectedKey?.trackId === track.id
      ? track.keys.find((key) => key.id === this.selectedKey?.keyId)
      : undefined;
    if (selected) this.buildKeyInspector(this.curveSection, track, selected, component);
    else this.curveSection.appendChild(dom('div', 'ast-hint', 'Select a diamond to edit its value and tangents.'));
  }

  private trackDisplayName(track: AnimationTrack): string {
    if (track.name) return track.name;
    if (track.kind === 'scalar') {
      const control = this.rig.controls.find((candidate) => candidate.id === track.target);
      return `${control?.name ?? track.target} · Control`;
    }
    const joint = this.rig.joints.find((candidate) => candidate.id === track.target);
    const kind = track.kind === 'position' ? 'Position' : track.kind === 'quaternion' ? 'Rotation' : 'Scale';
    return `${joint?.name ?? track.target} · ${kind}`;
  }

  private closestKey(track: AnimationTrack, time: number): AnimationKeyframe | undefined {
    return track.keys.reduce<AnimationKeyframe | undefined>((best, key) => {
      if (!best) return key;
      return Math.abs(key.time - time) < Math.abs(best.time - time) ? key : best;
    }, undefined);
  }

  private keyComponentValue(key: AnimationKeyframe, component: number): number {
    return typeof key.value === 'number' ? key.value : key.value[component] ?? 0;
  }

  private curveValueRange(track: AnimationTrack, component: number): { min: number; max: number } {
    const values = track.keys.map((key) => this.keyComponentValue(key, component));
    if (track.kind === 'scale') values.push(1);
    else values.push(0);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (Math.abs(max - min) < 1e-6) {
      const padding = Math.max(0.25, Math.abs(max) * 0.25);
      min -= padding;
      max += padding;
    } else {
      const padding = (max - min) * 0.16;
      min -= padding;
      max += padding;
    }
    return { min, max };
  }

  private drawCurveGraph(
    graph: SVGSVGElement,
    clip: AnimationClip,
    track: AnimationTrack,
    component: number,
    range: { min: number; max: number },
  ): void {
    const padX = 8;
    const padY = 9;
    const width = 300 - padX * 2;
    const height = 160 - padY * 2;
    const x = (time: number): number => padX + clamp(time / Math.max(clip.duration, MIN_DURATION), 0, 1) * width;
    const y = (value: number): number => padY + (1 - clamp((value - range.min) / (range.max - range.min), 0, 1)) * height;
    for (let index = 0; index <= 4; index += 1) {
      const vertical = svg('line', 'ast-curve-grid');
      vertical.setAttribute('x1', String(padX + width * index / 4));
      vertical.setAttribute('x2', String(padX + width * index / 4));
      vertical.setAttribute('y1', String(padY));
      vertical.setAttribute('y2', String(padY + height));
      graph.appendChild(vertical);
      const horizontal = svg('line', 'ast-curve-grid');
      horizontal.setAttribute('x1', String(padX));
      horizontal.setAttribute('x2', String(padX + width));
      horizontal.setAttribute('y1', String(padY + height * index / 4));
      horizontal.setAttribute('y2', String(padY + height * index / 4));
      graph.appendChild(horizontal);
    }
    if (range.min <= 0 && range.max >= 0) {
      const zero = svg('line', 'ast-curve-zero');
      zero.setAttribute('x1', String(padX));
      zero.setAttribute('x2', String(padX + width));
      zero.setAttribute('y1', String(y(0)));
      zero.setAttribute('y2', String(y(0)));
      graph.appendChild(zero);
    }
    if (track.keys.length > 0) {
      const samples = Math.max(40, Math.ceil(clip.duration * FRAME_RATE));
      let data = '';
      for (let index = 0; index <= samples; index += 1) {
        const time = clip.duration * index / samples;
        const value = this.sampleTrackComponent(track, time, component);
        if (value === undefined) continue;
        data += `${data ? ' L' : 'M'} ${x(time).toFixed(2)} ${y(value).toFixed(2)}`;
      }
      const path = svg('path', 'ast-curve-path');
      path.setAttribute('d', data);
      graph.appendChild(path);
    }
    for (const key of track.keys) {
      const point = svg('circle', 'ast-curve-point');
      point.setAttribute('cx', String(x(key.time)));
      point.setAttribute('cy', String(y(this.keyComponentValue(key, component))));
      point.setAttribute('r', '4.5');
      point.classList.toggle('ast-selected', this.selectedKey?.trackId === track.id && this.selectedKey.keyId === key.id);
      point.addEventListener('pointerdown', (event) => this.beginCurveKeyDrag(event, track, key.id, component, range));
      graph.appendChild(point);
    }
  }

  private sampleTrackComponent(track: AnimationTrack, time: number, component: number): number | undefined {
    if (track.kind === 'scalar') return sampleScalarKeys(track.keys, time);
    if (track.kind === 'quaternion') return sampleQuaternionKeys(track.keys, time)?.[component];
    return sampleVectorKeys(track.keys, time)?.[component];
  }

  private beginCurveKeyDrag(
    event: PointerEvent,
    track: AnimationTrack,
    keyId: string,
    component: number,
    range: { min: number; max: number },
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.pausePlayback();
    this.selectedTrackId = track.id;
    this.selectedKey = { trackId: track.id, keyId, component };
    this.selectedAnnotation = undefined;
    this.beginTransaction('Edit curve key');
    const graph = event.currentTarget instanceof SVGElement ? event.currentTarget.ownerSVGElement : null;
    if (!graph) return;

    const move = (pointer: PointerEvent): void => {
      const rect = graph.getBoundingClientRect();
      const xRatio = clamp((pointer.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const yRatio = clamp((pointer.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      const clip = this.activeClip();
      const currentTrack = clip?.tracks.find((candidate) => candidate.id === track.id);
      const currentKey = currentTrack?.keys.find((candidate) => candidate.id === keyId);
      if (!clip || !currentTrack || !currentKey) return;
      const rawTime = xRatio * clip.duration;
      const time = pointer.altKey ? rawTime : frameTime(rawTime);
      const value = range.max - yRatio * (range.max - range.min);
      const moved = this.withKeyComponent(currentKey, component, value, time);
      this.replaceActiveClip(upsertKeyframe(clip, track.id, moved));
      this.playTime = time;
      this.needsSample = true;
      this.refreshTimeline();
      this.refreshCurve();
    };
    const finish = (cancel: boolean): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.cancelActiveDrag = undefined;
      if (cancel) this.cancelTransaction();
      else this.commitTransaction();
      this.refreshAll();
    };
    const up = (): void => finish(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    this.cancelActiveDrag = () => finish(true);
    this.refreshCurve();
  }

  private withKeyComponent(
    key: AnimationKeyframe,
    component: number,
    value: number,
    time = key.time,
  ): AnimationKeyframe {
    if (typeof key.value === 'number') return { ...(key as ScalarKeyframe), time, value };
    const tuple = [...key.value];
    tuple[component] = value;
    if (tuple.length === 4) {
      const quaternion = new THREE.Quaternion(tuple[0], tuple[1], tuple[2], tuple[3]).normalize();
      return { ...key, time, value: quaternion.toArray() as [number, number, number, number] } as QuaternionKeyframe;
    }
    return { ...key, time, value: tuple as Vec3Tuple } as VectorKeyframe;
  }

  private buildKeyInspector(parent: HTMLElement, track: AnimationTrack, key: AnimationKeyframe, component: number): void {
    parent.appendChild(this.sectionTitle('Selected key'));
    const time = input('number');
    time.step = String(1 / FRAME_RATE);
    time.value = String(key.time);
    time.onchange = () => this.updateSelectedKey('Move key', (candidate) => ({
      ...candidate,
      time: clamp(finite(time.value, candidate.time), 0, this.activeClip()?.duration ?? candidate.time),
    } as AnimationKeyframe));
    const value = input('number');
    value.step = '0.001';
    value.value = String(this.keyComponentValue(key, component));
    value.onchange = () => this.updateSelectedKey('Edit key value', (candidate) => this.withKeyComponent(
      candidate,
      component,
      finite(value.value, this.keyComponentValue(candidate, component)),
    ));
    parent.append(this.field('Time', time), this.field('Value', value));

    this.keyInterpolationSelect = dom('select', 'ast-select ast-grow');
    for (const [mode, label] of [
      ['step', 'Stepped'],
      ['linear', 'Linear'],
      ['cubic', 'Smooth / cubic'],
    ] as const) {
      const option = dom('option', '', label);
      option.value = mode;
      this.keyInterpolationSelect.appendChild(option);
    }
    this.keyInterpolationSelect.value = key.interpolation;
    this.keyInterpolationSelect.onchange = () => this.updateSelectedKey('Change tangent mode', (candidate) => ({
      ...candidate,
      interpolation: this.keyInterpolationSelect.value as KeyInterpolation,
    } as AnimationKeyframe));
    parent.appendChild(this.field('Tangent', this.keyInterpolationSelect));

    this.inTangentInput = input('number');
    this.outTangentInput = input('number');
    this.inTangentInput.step = this.outTangentInput.step = '0.01';
    const supportsTangents = track.kind !== 'quaternion';
    this.inTangentInput.disabled = this.outTangentInput.disabled = !supportsTangents;
    this.inTangentInput.placeholder = this.outTangentInput.placeholder = supportsTangents ? 'Auto' : 'n/a';
    if (supportsTangents) {
      const vectorKey = key as ScalarKeyframe | VectorKeyframe;
      const inValue = typeof vectorKey.inTangent === 'number' ? vectorKey.inTangent : vectorKey.inTangent?.[component];
      const outValue = typeof vectorKey.outTangent === 'number' ? vectorKey.outTangent : vectorKey.outTangent?.[component];
      if (inValue !== undefined) this.inTangentInput.value = String(inValue);
      if (outValue !== undefined) this.outTangentInput.value = String(outValue);
      this.inTangentInput.onchange = () => this.setSelectedTangent('in', this.inTangentInput.value, component);
      this.outTangentInput.onchange = () => this.setSelectedTangent('out', this.outTangentInput.value, component);
    }
    parent.append(this.field('In slope', this.inTangentInput), this.field('Out slope', this.outTangentInput));
    if (supportsTangents) {
      const auto = button('Auto tangents');
      auto.onclick = () => this.updateSelectedKey('Use automatic tangents', (candidate) => {
        const next = { ...candidate } as ScalarKeyframe | VectorKeyframe;
        delete next.inTangent;
        delete next.outTangent;
        return next;
      });
      parent.appendChild(auto);
    }
  }

  private updateSelectedKey(label: string, update: (key: AnimationKeyframe) => AnimationKeyframe): void {
    const selected = this.selectedKey;
    const clip = this.activeClip();
    const track = clip?.tracks.find((candidate) => candidate.id === selected?.trackId);
    const key = track?.keys.find((candidate) => candidate.id === selected?.keyId);
    if (!clip || !track || !key) return;
    this.commitMutation(label, () => this.replaceActiveClip(upsertKeyframe(clip, track.id, update(key))));
    this.needsSample = true;
    this.onionDirty = true;
    this.refreshTimeline();
    this.refreshCurve();
  }

  private setSelectedTangent(edge: 'in' | 'out', raw: string, component: number): void {
    const parsed = Number(raw);
    this.updateSelectedKey('Edit key tangent', (key) => {
      if (typeof key.value === 'number') {
        const next = { ...key } as ScalarKeyframe;
        if (Number.isFinite(parsed)) {
          if (edge === 'in') next.inTangent = parsed;
          else next.outTangent = parsed;
        } else if (edge === 'in') delete next.inTangent;
        else delete next.outTangent;
        return next;
      }
      if (key.value.length === 4) return key;
      const next = { ...key } as VectorKeyframe;
      const property = edge === 'in' ? 'inTangent' : 'outTangent';
      if (!Number.isFinite(parsed)) {
        delete next[property];
        return next;
      }
      const tangent = [...(next[property] ?? [0, 0, 0])] as Vec3Tuple;
      tangent[component] = parsed;
      next[property] = tangent;
      return next;
    });
  }

  private mirrorPose(): void {
    const clip = this.activeClip();
    if (!clip) return;
    const captured = this.capturePose();
    captured.scalars = { ...this.currentScalars };
    const mirrored = mirrorPoseBuffer(captured, this.rig);
    this.applyPose(mirrored);
    const correction = this.captureKeyPose(Object.keys(mirrored.joints));
    this.commitMutation('Mirror pose', () => {
      let next = clip;
      for (const [jointId, delta] of Object.entries(correction.joints)) {
        for (const kind of ['position', 'quaternion', 'scale'] as const) {
          const value = delta[kind];
          if (!value) continue;
          next = this.writeTransformKey(next, jointId, kind, value).clip;
        }
      }
      for (const [controlId, value] of Object.entries(mirrored.scalars)) {
        let track = next.tracks.find((candidate) => candidate.kind === 'scalar' && candidate.target === controlId);
        if (!track) {
          track = createAnimationTrack('scalar', controlId);
          next = upsertTrack(next, track);
        }
        const existing = track.keys.find((key) => Math.abs(key.time - this.playTime) <= KEY_EPSILON);
        next = upsertKeyframe(next, track.id, createScalarKeyframe(
          this.playTime,
          value,
          existing?.interpolation ?? 'cubic',
          existing?.id ?? createAnimationId('key'),
        ));
      }
      this.replaceActiveClip(next);
    });
    this.needsSample = false;
    this.onionDirty = true;
    this.refreshAll();
    this.toast('Pose mirrored and keyed');
  }

  private updateOnionSkin(): void {
    const clip = this.activeClip();
    if (!clip || !this.onionEnabled) return;
    const beforeTime = clamp(this.playTime - this.onionStep, clip.range.start, clip.range.end);
    const afterTime = clamp(this.playTime + this.onionStep, clip.range.start, clip.range.end);
    this.applyPose(this.sampleAuthoredPose(clip, beforeTime));
    const before = this.captureJointWorldPositions();
    this.applyPose(this.sampleAuthoredPose(clip, afterTime));
    const after = this.captureJointWorldPositions();
    this.populateOnionGroup(this.onionBefore, before, 0x61ddff);
    this.populateOnionGroup(this.onionAfter, after, 0xff75d1);
    const current = this.sampleAuthoredPose(clip, this.playTime);
    this.applyPose(current);
    this.onionDirty = false;
    this.refreshInspectorValues();
  }

  private captureJointWorldPositions(): Map<JointId, THREE.Vector3> {
    this.ctx.rigRoot.updateMatrixWorld(true);
    const positions = new Map<JointId, THREE.Vector3>();
    for (const [id, node] of this.jointNodes) positions.set(id, node.getWorldPosition(new THREE.Vector3()));
    return positions;
  }

  private populateOnionGroup(group: THREE.Group, positions: ReadonlyMap<JointId, THREE.Vector3>, color: number): void {
    this.disposeOnionGroup(group);
    const points: number[] = [];
    for (const position of positions.values()) points.push(position.x, position.y, position.z);
    if (points.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const material = new THREE.PointsMaterial({ color, size: 0.035, sizeAttenuation: true, depthWrite: false, transparent: true, opacity: 0.72 });
      const cloud = new THREE.Points(geometry, material);
      cloud.renderOrder = 50;
      group.add(cloud);
    }
    const lines: number[] = [];
    for (const joint of this.rig.joints) {
      if (!joint.parentId) continue;
      const from = positions.get(joint.parentId);
      const to = positions.get(joint.id);
      if (!from || !to) continue;
      lines.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
    if (lines.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
      const material = new THREE.LineBasicMaterial({ color, depthWrite: false, transparent: true, opacity: 0.44 });
      const skeleton = new THREE.LineSegments(geometry, material);
      skeleton.renderOrder = 49;
      group.add(skeleton);
    }
  }

  private disposeOnionGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      const renderable = child as THREE.Points | THREE.LineSegments;
      renderable.geometry?.dispose();
      const material = renderable.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    }
  }

  private openImportModal(): void {
    const modal = this.createModal('Import animation suite');
    const textarea = dom('textarea', 'ast-textarea');
    textarea.placeholder = 'Paste sol-animation-suite JSON here…';
    const controls = dom('div', 'ast-button-row');
    const fileButton = button('Choose JSON file');
    const importButton = button('Import');
    importButton.classList.add('ast-primary');
    const cancel = button('Cancel');
    const file = input('file');
    file.accept = 'application/json,.json';
    file.style.display = 'none';
    fileButton.onclick = () => file.click();
    file.onchange = () => {
      const selected = file.files?.[0];
      if (!selected) return;
      void selected.text().then((text) => { textarea.value = text; });
    };
    importButton.onclick = () => {
      try {
        const parsed = parseAnimationSuite(textarea.value);
        this.commitMutation('Import animation suite', () => {
          this.animationDocument = cloneDocument(parsed);
          this.ensureRigAndClip();
        });
        this.playing = false;
        this.playTime = this.activeClip()?.range.start ?? 0;
        this.selectedKey = undefined;
        this.selectedTrackId = undefined;
        this.selectedAnnotation = undefined;
        this.needsSample = true;
        this.removeModal(modal);
        this.refreshAll();
        this.toast(`Imported ${parsed.clips.length} animation${parsed.clips.length === 1 ? '' : 's'}`);
      } catch (error) {
        this.toast(error instanceof Error ? error.message : 'Import failed');
      }
    };
    cancel.onclick = () => this.removeModal(modal);
    controls.append(fileButton, importButton, cancel, file);
    modal.querySelector('.ast-modal')?.append(textarea, controls);
    textarea.focus();
  }

  private openExportModal(): void {
    const modal = this.createModal('Export animation suite');
    const textarea = dom('textarea', 'ast-textarea');
    textarea.value = stringifyAnimationSuite(this.animationDocument);
    textarea.readOnly = true;
    const controls = dom('div', 'ast-button-row');
    const copy = button('Copy JSON');
    const download = button('Download .json');
    const close = button('Close');
    copy.onclick = () => {
      void navigator.clipboard?.writeText(textarea.value).then(
        () => this.toast('Animation JSON copied'),
        () => {
          textarea.select();
          this.toast('Select and copy the JSON');
        },
      );
    };
    download.onclick = () => {
      const blob = new Blob([textarea.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = dom('a');
      anchor.href = url;
      anchor.download = `${this.animationDocument.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'animation-suite'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    };
    close.onclick = () => this.removeModal(modal);
    controls.append(copy, download, close);
    modal.querySelector('.ast-modal')?.append(textarea, controls);
  }

  private createModal(title: string): HTMLElement {
    this.root.querySelector('.ast-modal-backdrop')?.remove();
    const backdrop = dom('div', 'ast-modal-backdrop');
    const modal = dom('div', 'ast-modal');
    modal.appendChild(this.sectionTitle(title));
    backdrop.appendChild(modal);
    backdrop.onpointerdown = (event) => {
      if (event.target === backdrop) this.removeModal(backdrop);
    };
    this.root.appendChild(backdrop);
    return backdrop;
  }

  private removeModal(modal: HTMLElement): void {
    modal.remove();
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (command && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.cancelActiveDrag) {
        this.cancelActiveDrag();
      } else if (this.ikTargetTransform.dragging || this.ikPoleTransform.dragging) {
        if (this.ikTargetTransform.dragging) this.ikTargetTransform.reset();
        if (this.ikPoleTransform.dragging) this.ikPoleTransform.reset();
        this.cancelTransaction();
        this.needsSample = true;
        this.onionDirty = true;
      } else if (this.transform.dragging) {
        this.transform.reset();
        this.cancelTransaction();
      } else if (this.transaction) {
        this.cancelTransaction();
      } else {
        const modal = this.root.querySelector<HTMLElement>('.ast-modal-backdrop');
        if (modal) modal.remove();
        else this.close();
      }
      return;
    }
    if (editableTarget(event.target)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      this.togglePlayback();
    } else if (event.key.toLowerCase() === 'w') {
      event.preventDefault();
      this.setTransformMode('translate');
    } else if (event.key.toLowerCase() === 'e') {
      event.preventDefault();
      this.setTransformMode('rotate');
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.setTransformMode('scale');
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      this.enterIkMode();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (this.authoringMode === 'ik') this.setIkKeys(true);
      else this.setKeyForSelected(false, true);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (this.selectedAnnotation) this.deleteAnnotation(this.selectedAnnotation);
      else this.deleteCurrentKeys();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.stepFrame(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepFrame(1);
    }
  };

  private toast(message: string): void {
    if (!this.toastElement) return;
    this.toastElement.textContent = message;
    this.toastElement.classList.add('ast-show');
    if (this.toastTimer !== undefined) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastElement.classList.remove('ast-show'), 1900);
  }
}
