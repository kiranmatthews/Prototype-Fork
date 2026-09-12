import { paintMenuBackdrop, paintMenuPanel } from './menuTheme';
// Cached Canvas2D mirror for the game-owned modal UI.
//
// GameFlowUI remains the only interaction/accessibility owner. This surface
// receives an immutable snapshot made from that semantic DOM's known geometry,
// paints it into one canvas, and composites one fullscreen quad at the pre-CRT
// insertion point. No DOM screenshotting, foreignObject, or debug UI enters the
// render path.

import { paintSilverSecondaryText } from "./secondaryText";
import * as THREE from "three";
import { trackPresentationImage } from "./presentationLoading";
import { loadRooAtlases, RooAtlasPainter, layoutRooAtlas, type RooAtlasStyle } from './roo-type/atlas';
import { ROO_ATLAS_METRICS } from './roo-type/atlas-metrics';
import { getRooAppearance, ROO_APPEARANCE_EVENT, rooLightPosition } from './roo-type/settings';
import { rooMenuText, rooMenuPalette } from './roo-type/menu';

export type GameFlowSurfaceScreen =
  | "launch"
  | "new-slots"
  | "load-slots"
  | "confirm-new"
  | "save-load"
  | "confirm-save"
  | "confirm-load"
  | "confirm-quit-main"
  | "confirm-level-select"
  | "pause"
  | "level-select"
  | "progress"
  | "options"
  | "trick-guide"
  | "gameover"
  | "results";

export interface GameFlowSurfaceSize {
  width: number;
  height: number;
}

export interface GameFlowSurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  clip?: {x:number;y:number;width:number;height:number};
}

interface GameFlowSurfaceFont {
  family: string;
  size: number;
  weight: string;
  lineHeight: number;
  color: string;
  align: "left" | "center" | "right";
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
  letterSpacing: number;
}

export interface GameFlowSurfaceText {
  text: string;
  rect: GameFlowSurfaceRect;
  font: GameFlowSurfaceFont;
  wrap: boolean;
  silver?: boolean;
  pngFilter?: string;
  rooPalette?:'bonus'|'counter';
}

export interface GameFlowSurfaceButton {
  rooPalette?:'bonus'|'counter';
  rect: GameFlowSurfaceRect;
  kind: "action" | "slot" | "toggle" | "close" | "level" | "hint";
  label: string;
  valueLabel: string;
  color: string;
  valueColor: string;
  pngFilter?: string;
  stacked?: boolean;
  opacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  selected: boolean;
  disabled: boolean;
  danger: boolean;
  launch?: boolean;
}

export interface GameFlowSurfaceProgress {
  track: GameFlowSurfaceRect;
  fill: GameFlowSurfaceRect;
}

export interface GameFlowSurfaceThumbnail {
  rect: GameFlowSurfaceRect;
  source: HTMLCanvasElement | HTMLImageElement | null;
  opacity?: number;
}

export interface GameFlowSurfaceRenderState {
  visible: boolean;
  screen: GameFlowSurfaceScreen | null;
  sourceWidth: number;
  sourceHeight: number;
  cards: readonly GameFlowSurfaceRect[];
  blocks: readonly GameFlowSurfaceRect[];
  buttons: readonly GameFlowSurfaceButton[];
  texts: readonly GameFlowSurfaceText[];
  progress: GameFlowSurfaceProgress | null;
  thumbnail: GameFlowSurfaceThumbnail | null;
  slotPreviews?: readonly GameFlowSurfaceThumbnail[];
  sockets?: readonly {rect: GameFlowSurfaceRect; kind:string}[];
  maskFallback: (GameFlowSurfaceRect & { opacity: number }) | null;
}

export interface GameFlowSurfaceDomSource {
  root: HTMLElement;
  panel: HTMLElement;
  buttons: readonly HTMLButtonElement[];
  screen: GameFlowSurfaceScreen | null;
  transitionActive: boolean;
  thumbnail: HTMLCanvasElement | null;
  thumbnailCaptured: boolean;
  maskReady: boolean;
}

export interface GameFlowSurfaceDiagnostics {
  active: boolean;
  resident: boolean;
  dirty: boolean;
  width: number;
  height: number;
  screen: GameFlowSurfaceScreen | null;
  revision: number;
  paintedRevision: number;
  canvasFrames: number;
  textureUploads: number;
  textureReallocations: number;
  compositeDraws: number;
  primitiveCount: number;
  releaseCount: number;
  lastCanvasMs: number;
  disposed: boolean;
}

interface GameFlowSurfaceResources {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  geometry: THREE.PlaneGeometry;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
}

const TEXT_SELECTOR = [
  '.game-trick-intro, .game-trick-pager > span, .game-trick-content p, .game-trick-content h3:not([data-guide-prompt]), .game-trick-content th, .game-trick-content td:not([data-guide-prompt])',
  ".game-control-hint .secondary-silver",
  ".game-level-text",
  ".game-eyebrow",
  ".game-logo > span",
  ".game-logo > strong",
  ".game-input-hint",
  ".game-panel-title",
  ".game-panel-subtitle",
  ".game-save-status",
  ".game-operation-status",
  ".game-slot-number",
  ".game-slot-detail",
  ".game-slot-date",
  '.game-slot-level',
  '.game-slot-empty',
  ".game-preview-name",
  ".game-progress-head h2",
  ".game-progress-head strong",
  ".game-progress-grid span",
  ".game-progress-grid strong",
  ".game-progress-grid small",
  ".game-progress-cleared",
  ".game-progress-island-name",
  ".game-progress-level-name",
  ".game-progress-level-rewards",
  ".game-progress-level-time",
  ".game-over-title",
  ".game-over-question",
  ".game-results-title",
  ".game-results-tally span",
  ".game-results-tally strong",
].join(",");

const PREVIOUS_VIEWPORT = new THREE.Vector4();
const PREVIOUS_SCISSOR = new THREE.Vector4();

function finiteDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

/** Match the HUD's render target: never downsample menu type to a 1080p intermediate. */
export function gameFlowRasterSize(width: number, height: number): GameFlowSurfaceSize {
  return { width: finiteDimension(width), height: finiteDimension(height) };
}

function finiteCssNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** getComputedStyle normally returns rgb()/rgba(); strip only its alpha. */
function opaqueCssColor(value: string, fallback: string): string {
  if (!/^rgba?\(/i.test(value)) return value || fallback;
  const components = value.match(/-?(?:\d+\.?\d*|\.\d+)%?/g);
  if (!components || components.length < 3) return fallback;
  return `rgb(${components[0]} ${components[1]} ${components[2]})`;
}

function cssColorAlpha(value: string): number {
  if (!/^rgba?\(/i.test(value)) return 1;
  const components = value.match(/-?(?:\d+\.?\d*|\.\d+)%?/g);
  const raw = components?.[3];
  if (!raw) return 1;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 1;
  return clamp01(raw.endsWith("%") ? parsed / 100 : parsed);
}

function stableButtonColor(
  button: HTMLButtonElement,
  computedColor: string,
): string {
  if (button.disabled) return opaqueCssColor(computedColor, "#462416");
  const selected = button.classList.contains("selected");
  const gameOver = button.closest(".game-over-actions") !== null;
  // These are discrete authored states. Reading their transitioning computed
  // color would cache an arbitrary in-between frame until the next input.
  if (gameOver) return selected ? "#ff9b20" : "#ffffff";
  if (button.closest(".game-launch-card")) return selected ? "#ffe786" : "#fff4d6";
  if (button.classList.contains("danger")) return "#9a281b";
  if (selected) return "#f05a20";
  return "#63230e";
}

function rectFrom(
  element: Element,
  origin: Readonly<{ left: number; top: number }>,
): GameFlowSurfaceRect | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  let left = -Infinity, top = -Infinity, right = Infinity, bottom = Infinity;
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
    if (/(hidden|auto|scroll|clip)/.test(style.overflowX)) { left = Math.max(left,bounds.left); right = Math.min(right,bounds.right); }
    if (/(hidden|auto|scroll|clip)/.test(style.overflowY)) { top = Math.max(top,bounds.top); bottom = Math.min(bottom,bounds.bottom); }
  }
  if (rect.right <= left || rect.left >= right || rect.bottom <= top || rect.top >= bottom) return null;
  const clipped = Number.isFinite(left) || Number.isFinite(top);
  return Object.freeze({
    x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height,
    ...(clipped ? {clip: {x:Math.max(left,0)-origin.left, y:Math.max(top,0)-origin.top,
      width:Math.min(right,window.innerWidth)-Math.max(left,0), height:Math.min(bottom,window.innerHeight)-Math.max(top,0)}} : {}),
  });
}

function effectiveOpacity(element: HTMLElement, panel: HTMLElement): number {
  let opacity = 1;
  let node: HTMLElement | null = element;
  // Deliberately stop before the panel. setPreCrtComposited makes that control
  // plane transparent, but its children are precisely what this mirror paints.
  while (node && node !== panel) {
    opacity *= clamp01(finiteCssNumber(getComputedStyle(node).opacity, 1));
    node = node.parentElement;
  }
  return opacity;
}

function textAlign(value: string): "left" | "center" | "right" {
  if (value === "center") return "center";
  if (value === "right" || value === "end") return "right";
  return "left";
}

function immutableArray<T extends object>(values: T[]): readonly T[] {
  for (const value of values) Object.freeze(value);
  return Object.freeze(values);
}

/**
 * Read only the known game-flow subtree and freeze a small render description.
 * Debug/editor DOM is outside `panel` and cannot enter this snapshot.
 */
export function snapshotGameFlowSurface(
  source: Readonly<GameFlowSurfaceDomSource>,
): GameFlowSurfaceRenderState {
  const rootRect = source.root.getBoundingClientRect();
  const sourceWidth = Math.max(1, rootRect.width || window.innerWidth || 1);
  const sourceHeight = Math.max(1, rootRect.height || window.innerHeight || 1);
  const origin = {
    left: Number.isFinite(rootRect.left) ? rootRect.left : 0,
    top: Number.isFinite(rootRect.top) ? rootRect.top : 0,
  };
  const visible =
    source.screen !== null && !source.transitionActive && !source.root.hidden;
  if (!visible) {
    return Object.freeze({
      visible: false,
      screen: source.screen,
      sourceWidth,
      sourceHeight,
      cards: Object.freeze([]),
      blocks: Object.freeze([]),
      buttons: Object.freeze([]),
      texts: Object.freeze([]),
      progress: null,
      thumbnail: null,
      maskFallback: null,
    });
  }

  const cards = Array.from(source.panel.querySelectorAll<HTMLElement>(".timber-card"))
    .map((node) => rectFrom(node, origin))
    .filter((rect): rect is GameFlowSurfaceRect => rect !== null);
  const blocks = Array.from(
    source.panel.querySelectorAll<HTMLElement>(".game-results-tally > div, .game-level-reward"),
  )
    .map((node) => rectFrom(node, origin))
    .filter((rect): rect is GameFlowSurfaceRect => rect !== null);

  const texts: GameFlowSurfaceText[] = [];
  for (const node of source.panel.querySelectorAll<HTMLElement>(TEXT_SELECTOR)) {
    // The semantic label owns its text; PNG/SVG decoration is not another label.
    if (node.closest("[data-roo-menu], .roo-menu-art, .roo-menu-source")) continue;
    const silver = node.classList.contains("secondary-silver");
    const text = ((silver ? node.firstChild?.textContent : node.textContent) ?? "").replace(/\s+/g, " ").trim();
    const measuredRect = rectFrom(node, origin);
    // Roo's Canvas2D middle baseline has a taller ascender than its CSS line
    // box. Keep the menu logo aligned with its CSS layout after rasterisation.
    const launchEyebrow = node.matches(".game-launch-card .game-eyebrow");
    const logoRow = node.matches(".game-logo > span, .game-logo > strong");
    const rect = measuredRect && (launchEyebrow || logoRow)
      ? Object.freeze({
          ...measuredRect,
          y:
            measuredRect.y +
            sourceHeight * (launchEyebrow ? -0.012 : 0.012),
        })
      : measuredRect;
    if (!text || !rect) continue;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const size = finiteCssNumber(style.fontSize, 16);
    const strokeWidth = finiteCssNumber(
      style.getPropertyValue("-webkit-text-stroke-width"),
      0,
    );
    const disabledSlot = node.closest<HTMLButtonElement>(
      ".game-save-slot:disabled",
    );
    let opacity = effectiveOpacity(node, source.panel);
    if (disabledSlot) {
      const disabledStyle = getComputedStyle(disabledSlot);
      // New CSS expresses disabled state with element opacity. Retain support
      // for the old rgba color rule without multiplying the two representations.
      const localOpacity = clamp01(finiteCssNumber(disabledStyle.opacity, 1));
      if (localOpacity >= 0.999)
        opacity *= cssColorAlpha(disabledStyle.color);
    }
    const font: GameFlowSurfaceFont = Object.freeze({
      family: style.fontFamily || "Roo, Impact, sans-serif",
      size,
      weight: style.fontWeight || "400",
      lineHeight: finiteCssNumber(style.lineHeight, size * 1.15),
      color: disabledSlot
        ? opaqueCssColor(style.color, "#63230e")
        : style.color || "#fff7d6",
      align: textAlign(style.textAlign),
      opacity,
      strokeColor:
        style.getPropertyValue("-webkit-text-stroke-color") || "transparent",
      strokeWidth,
      letterSpacing: finiteCssNumber(style.letterSpacing, 0),
    });
    texts.push(
      Object.freeze({
        text,
        silver,
        rooPalette:rooMenuPalette(node),
        pngFilter:style.getPropertyValue("--menu-png-colour-filter").trim()||undefined,
        rect,
        font,
        wrap:
          node.classList.contains("game-panel-subtitle") ||
          node.classList.contains("game-input-hint") || node.classList.contains("game-level-text") ||
          node.matches('.game-trick-intro, .game-trick-content p, .game-trick-content td, .game-slot-level'),
      }),
    );
  }

  const buttons: GameFlowSurfaceButton[] = [];
  for (const button of source.buttons) {
    if (!source.panel.contains(button)) continue;
    const rect = rectFrom(button, origin);
    if (!rect) continue;
    const style = getComputedStyle(button);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const levelRow = button.classList.contains('game-level-row');
    const toggle = button.classList.contains("game-toggle");
    const slot = button.classList.contains("game-save-slot");
    const value = levelRow ? button.querySelector<HTMLElement>(".game-level-mark") : toggle ? button.querySelector<HTMLElement>(":scope > strong") : null;
    const label = levelRow ? button.querySelector<HTMLElement>(".game-level-label") : toggle ? button.querySelector<HTMLElement>(":scope > span") : null;
    const selected = button.classList.contains("selected");
    const disabled = button.disabled;
    const danger = button.classList.contains("danger");
    const localOpacity = clamp01(finiteCssNumber(style.opacity, 1));
    let opacity = effectiveOpacity(button, source.panel);
    if (disabled && localOpacity >= 0.999)
      opacity *= cssColorAlpha(style.color);
    buttons.push(
      Object.freeze({
        rect,
        kind: button.classList.contains("game-control-hint") ? "hint" : levelRow ? "level" : button.classList.contains("game-map-close") ? "close" : slot ? "slot" : toggle ? "toggle" : "action",
        launch: source.screen === "launch",
        rooPalette:rooMenuPalette(button),
        pngFilter:style.getPropertyValue("--menu-png-colour-filter").trim()||undefined,
        label: slot
          ? ""
          : ((label?.textContent ?? button.textContent) || "")
              .replace(/\s+/g, " ")
              .trim(),
        valueLabel: (value?.textContent ?? "").trim(),
        stacked: toggle && style.flexDirection === "column",
        color: levelRow || button.closest(".game-progress-ledger, .game-level-header") ? style.color : stableButtonColor(button, style.color),
        valueColor: value
          ? disabled
            ? opaqueCssColor(getComputedStyle(value).color, "#462416")
            : button.classList.contains("toggle-off")
              ? "#a52f1c"
              : "#218d3c"
          : stableButtonColor(button, style.color),
        opacity,
        fontFamily: style.fontFamily || "Roo, Impact, sans-serif",
        fontSize: finiteCssNumber(style.fontSize, 28),
        fontWeight: style.fontWeight || "400",
        selected,
        disabled,
        danger,
      }),
    );
  }

  const progressTrack = source.panel.querySelector<HTMLElement>(".game-progress-bar");
  const progressFill = progressTrack?.querySelector<HTMLElement>(":scope > span");
  const trackRect = progressTrack ? rectFrom(progressTrack, origin) : null;
  const fillRect = progressFill ? rectFrom(progressFill, origin) : null;
  const progress = trackRect && fillRect
    ? Object.freeze({ track: trackRect, fill: fillRect })
    : null;

  const preview = source.panel.querySelector<HTMLImageElement>(".game-level-preview");
  const image = preview ?? source.thumbnail;
  const thumbnailRect = image
    ? rectFrom(image, origin)
    : null;
  const thumbnail = image && thumbnailRect
    ? Object.freeze({
        rect: thumbnailRect,
        source: preview ? (preview.complete && preview.naturalWidth ? preview : null) : source.thumbnailCaptured ? source.thumbnail : null,
      })
    : null;

  const maskNode = source.panel.querySelector<HTMLElement>(
    ".game-over-mask-fallback",
  );
  const maskRect = maskNode ? rectFrom(maskNode, origin) : null;
  const maskFallback = maskRect && !source.maskReady
    ? Object.freeze({
        ...maskRect,
        opacity: maskNode
          ? effectiveOpacity(maskNode, source.panel)
          : 1,
      })
    : null;

  return Object.freeze({
    visible: true,
    screen: source.screen,
    sourceWidth,
    sourceHeight,
    sockets: [...source.panel.querySelectorAll<HTMLElement>('.game-reward-slot[data-earned="false"]')].map(host => ({rect:rectFrom(host,origin),kind:host.dataset.reward!})).filter((item): item is {rect:GameFlowSurfaceRect;kind:string} => !!item.rect),
    cards: immutableArray(cards),
    blocks: immutableArray(blocks),
    buttons: immutableArray(buttons),
    texts: immutableArray(texts),
    progress,
    thumbnail,
    slotPreviews: [...source.panel.querySelectorAll<HTMLElement>('.game-slot-preview,.game-slot-empty')].flatMap(image => {
      const rect = rectFrom(image, origin);
      return rect ? [{rect, source:image instanceof HTMLImageElement && image.complete && image.naturalWidth ? image : null,
        opacity:effectiveOpacity(image, source.panel)}] : [];
    }),
    maskFallback,
  });
}

/** One lazy Canvas2D texture and one fullscreen quad, reused for every screen. */
export class GameFlowSurface {
  private resources: GameFlowSurfaceResources | null = null;
  private state: GameFlowSurfaceRenderState | null = null;
  private dirty = true;
  private revision = 1;
  private paintedRevision = 0;
  private hasPixels = false;
  private screen: GameFlowSurfaceScreen | null = null;
  private canvasFrames = 0;
  private textureUploads = 0;
  private textureReallocations = 0;
  private compositeDraws = 0;
  private primitiveCount = 0;
  private releaseCount = 0;
  private lastCanvasMs = 0;
  private disposed = false;
  private maskImage: HTMLImageElement | null = null;
  private maskImageReady = false;
  private readonly rooAtlas=new RooAtlasPainter();
  private lightPhase=NaN;
  private readonly appearanceChanged=()=>{this.invalidate();this.onAsyncInvalidate();};

  constructor(
    private readonly readState: () => GameFlowSurfaceRenderState,
    private readonly onAsyncInvalidate: () => void = () => {},
  ) {
    window.addEventListener(ROO_APPEARANCE_EVENT,this.appearanceChanged);
    void loadRooAtlases().then(()=>{if(!this.disposed)this.appearanceChanged();});
  }

  get diagnostics(): GameFlowSurfaceDiagnostics {
    const canvas = this.resources?.canvas;
    return {
      active: !!canvas && canvas.width > 1 && canvas.height > 1 && this.hasPixels,
      resident: this.resources !== null,
      dirty: this.dirty,
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
      screen: this.screen,
      revision: this.revision,
      paintedRevision: this.paintedRevision,
      canvasFrames: this.canvasFrames,
      textureUploads: this.textureUploads,
      textureReallocations: this.textureReallocations,
      compositeDraws: this.compositeDraws,
      primitiveCount: this.primitiveCount,
      releaseCount: this.releaseCount,
      lastCanvasMs: this.lastCanvasMs,
      disposed: this.disposed,
    };
  }

  invalidate(): void {
    if (this.disposed) return;
    this.dirty = true;
    this.state = null;
    this.revision++;
  }

  /**
   * Paint only on a dirty revision/size change, then submit the cached quad.
   * `target` is normally CoastPost's completed pre-CRT colour buffer.
   */
  drawPreCrt(
    renderer: THREE.WebGLRenderer,
    inputSize: Readonly<GameFlowSurfaceSize>,
    target: THREE.WebGLRenderTarget | null = renderer.getRenderTarget(),
  ): boolean {
    if (this.disposed) return false;
    const targetWidth = finiteDimension(inputSize.width);
    const targetHeight = finiteDimension(inputSize.height);
    // Null-target viewports use CSS units in Three.js, but the texture needs
    // physical pixels. Render-target inputs are already expressed in pixels.
    const pixelRatio = target === null ? renderer.getPixelRatio() : 1;
    const raster = gameFlowRasterSize(targetWidth * pixelRatio, targetHeight * pixelRatio);
    const state = this.state ?? this.readState();
    this.state = state;
    this.screen = state.screen;
    if (!state.visible) {
      this.hasPixels = false;
      return false;
    }

    const resources = this.ensureResources();
    const resized = this.ensureSize(resources, raster.width, raster.height);
    const phase=Math.round(rooLightPosition()*64);
    if (this.dirty || resized || phase!==this.lightPhase) {this.paint(resources, state, raster.width, raster.height);this.lightPhase=phase;}
    if (!this.hasPixels) return false;
    return this.composite(
      resources,
      renderer,
      { width: targetWidth, height: targetHeight },
      target,
    );
  }

  /** Release full-size canvas/GPU storage while retaining one tiny reusable shell. */
  deactivate(): void {
    const resources = this.resources;
    this.state = null;
    this.screen = null;
    this.hasPixels = false;
    this.dirty = true;
    if (!resources || (resources.canvas.width === 1 && resources.canvas.height === 1))
      return;
    resources.texture.dispose();
    resources.canvas.width = 1;
    resources.canvas.height = 1;
    this.releaseCount++;
  }

  dispose(): void {
    if (this.disposed) return;
    this.deactivate();
    this.disposed = true;
    this.rooAtlas.dispose();window.removeEventListener(ROO_APPEARANCE_EVENT,this.appearanceChanged);
    if (this.maskImage) {
      this.maskImage.onload = null;
      this.maskImage.onerror = null;
      this.maskImage = null;
    }
    const resources = this.resources;
    if (!resources) return;
    resources.texture.dispose();
    resources.material.dispose();
    resources.geometry.dispose();
    resources.scene.clear();
    this.resources = null;
  }

  private ensureResources(): GameFlowSurfaceResources {
    if (this.resources) return this.resources;
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Game-flow surface requires Canvas2D");
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = "GameFlow.PreCRT.Canvas";
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    const material = new THREE.MeshBasicMaterial({
      name: "GameFlow.PreCRT.Composite",
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 0.5;
    this.resources = { canvas, context, texture, material, geometry, scene, camera };
    return this.resources;
  }

  private ensureSize(
    resources: GameFlowSurfaceResources,
    width: number,
    height: number,
  ): boolean {
    if (resources.canvas.width === width && resources.canvas.height === height)
      return false;
    // WebGL2 CanvasTexture storage is immutable after upload. Dispose the old
    // allocation before resizing so portrait/large menu storage cannot linger.
    resources.texture.dispose();
    resources.canvas.width = width;
    resources.canvas.height = height;
    this.textureReallocations++;
    return true;
  }

  private paint(
    resources: GameFlowSurfaceResources,
    state: GameFlowSurfaceRenderState,
    width: number,
    height: number,
  ): void {
    const started = performance.now();
    const ctx = resources.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowColor = "transparent";
    ctx.clearRect(0, 0, width, height);
    this.primitiveCount = 0;
    ctx.save();
    ctx.scale(width / state.sourceWidth, height / state.sourceHeight);
    this.paintBackdrop(ctx, state.screen, state.sourceWidth, state.sourceHeight);
    const clipped = (rect: GameFlowSurfaceRect, paint: () => void) => {
      ctx.save(); if (rect.clip) { const c=rect.clip;ctx.beginPath();ctx.rect(c.x,c.y,c.width,c.height);ctx.clip(); } paint();ctx.restore();
    };
    for (const card of state.cards) clipped(card, () => this.paintCard(ctx, card));
    for (const block of state.blocks) clipped(block, () => this.paintBlock(ctx, block));
    for (const button of state.buttons) clipped(button.rect, () => this.paintButton(ctx, button));
    for (const socket of state.sockets ?? []) clipped(socket.rect, () => this.paintSocket(ctx, socket.rect, socket.kind));
    if (state.progress) this.paintProgress(ctx, state.progress);
    if (state.thumbnail) this.paintThumbnail(ctx, state.thumbnail);
    for (const preview of state.slotPreviews ?? []) clipped(preview.rect, () => this.paintThumbnail(ctx, preview));
    if (state.maskFallback) this.paintMask(ctx, state.maskFallback);
    for (const text of state.texts) clipped(text.rect, () => {
      if (text.silver) { paintSilverSecondaryText(ctx,text.text,text.rect.x,text.rect.y,text.font.size); this.primitiveCount++; }
      else this.paintText(ctx, text);
    });
    ctx.restore();
    this.hasPixels = this.primitiveCount > 0;
    resources.texture.needsUpdate = true;
    this.textureUploads++;
    this.canvasFrames++;
    this.paintedRevision = this.revision;
    this.lastCanvasMs = performance.now() - started;
    this.dirty = false;
  }

  private paintSocket(ctx: CanvasRenderingContext2D, rect: GameFlowSurfaceRect, kind: string): void {
    ctx.save(); ctx.translate(rect.x+rect.width/2, rect.y+rect.height/2);
    const unit = Math.min(rect.width,rect.height) * .008; ctx.scale(unit,unit);
    const path = new Path2D();
    if (kind === 'crystal') { path.moveTo(0,-45); path.lineTo(23,-22); path.lineTo(19,18); path.lineTo(0,46); path.lineTo(-19,18); path.lineTo(-23,-22);path.closePath(); }
    else if (kind === 'medal') path.arc(0,0,35,0,Math.PI*2);
    else if (kind === 'cup') { path.moveTo(-30,-40);path.lineTo(30,-40);path.quadraticCurveTo(28,4,7,12);path.lineTo(7,28);path.lineTo(28,28);path.lineTo(28,42);path.lineTo(-28,42);path.lineTo(-28,28);path.lineTo(-7,28);path.lineTo(-7,12);path.quadraticCurveTo(-28,4,-30,-40);path.closePath(); }
    else { path.moveTo(-40,-16);path.lineTo(-24,-36);path.lineTo(24,-36);path.lineTo(40,-16);path.lineTo(0,42);path.closePath(); }
    ctx.translate(0,2);ctx.strokeStyle='#99b6b344';ctx.lineWidth=5;ctx.stroke(path);ctx.translate(0,-2);
    const fill=ctx.createLinearGradient(0,-45,0,45);fill.addColorStop(0,'#020a12');fill.addColorStop(1,'#1b3e49');ctx.fillStyle=fill;ctx.fill(path);
    ctx.strokeStyle='#01070c';ctx.lineWidth=2;ctx.stroke(path);ctx.restore();this.primitiveCount++;
  }

  private paintBackdrop(
    ctx: CanvasRenderingContext2D,
    screen: GameFlowSurfaceScreen | null,
    width: number,
    height: number,
  ): void {
    // Home shows the authored vortex directly; legibility artwork is separate.
    if (screen === "launch") return;
    ctx.save();
    if (screen === "results") {
      const beside = width > 760 && height > 560 || width / height > 1.3;
      const shade = ctx.createLinearGradient(0, 0, beside ? width : 0, beside ? 0 : height);
      shade.addColorStop(0, '#02070f55'); shade.addColorStop(.4, '#02070f77');
      shade.addColorStop(1, '#02070ff7'); ctx.fillStyle=shade; ctx.fillRect(0,0,width,height);
    } else paintMenuBackdrop(ctx, width, height, ['level-select','progress','trick-guide'].includes(screen ?? ''));
    ctx.restore();
    this.primitiveCount++;
  }

  private paintCard(ctx: CanvasRenderingContext2D, rect: GameFlowSurfaceRect): void {
    paintMenuPanel(ctx, rect);
    this.primitiveCount++;
  }

  private paintBlock(ctx: CanvasRenderingContext2D, rect: GameFlowSurfaceRect): void {
    ctx.save();
    roundedRect(ctx, rect, 8);
    ctx.fillStyle = "#06131c";
    ctx.fill();
    ctx.strokeStyle = "#36505a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    this.primitiveCount++;
  }

  private paintButton(
    ctx: CanvasRenderingContext2D,
    button: GameFlowSurfaceButton,
  ): void {
    const { rect } = button;
    const png=(text:string,x:number,y:number,style:RooAtlasStyle)=>{
      ctx.save();ctx.filter=button.pngFilter??'none';
      const drawn=this.rooAtlas.draw(ctx,text,x,y,button.pngFilter?{...style,lightPosition:0}:style);
      ctx.restore();return drawn;
    };
    ctx.save();
    // One captured element opacity drives action/toggle text or the slot's
    // compound background. Slot child text receives that ancestor opacity in
    // its own snapshot, so rgba color alpha is never multiplied a second time.
    ctx.globalAlpha = button.opacity;
    if (button.kind === 'hint') {
      ctx.restore(); this.primitiveCount++;return;
    }
    if (button.kind === "close") {
      roundedRect(ctx, rect, 10);
      ctx.fillStyle = button.selected ? "#36515d" : "#243138"; ctx.fill();
      ctx.strokeStyle = "#e5e0cd"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff7da"; ctx.font = "700 30px Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("X", rect.x + rect.width / 2, rect.y + rect.height / 2);
      ctx.restore(); this.primitiveCount++; return;
    }
    if (button.kind === "level") {
      roundedRect(ctx, rect, 7);
      const gradient=ctx.createLinearGradient(0,rect.y,0,rect.y+rect.height);gradient.addColorStop(0,'#17323e');gradient.addColorStop(1,'#0a1c27');ctx.fillStyle=gradient;
      ctx.fill();ctx.strokeStyle='rgba(109,51,23,.26)';ctx.lineWidth=1;ctx.stroke();
      ctx.font = `${button.fontWeight} ${button.fontSize}px ${button.fontFamily}`;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = button.selected ? '#542615' : '#fff4d6';
      const labelWidth=Math.max(1,rect.width-(button.valueLabel?45:28));
      if(!/\bRoo\b/.test(button.fontFamily)||!png(rooMenuText(button.label),rect.x+16,rect.y+rect.height/2,{size:button.fontSize*.882,palette:button.rooPalette,align:'left',maxWidth:labelWidth}))ctx.fillText(button.label,rect.x+16,rect.y+rect.height/2,labelWidth);
      ctx.textAlign = 'right'; ctx.font = `400 ${Math.max(14,button.fontSize*.65)}px 'Staging Secondary',sans-serif`; ctx.fillStyle = '#efe3cc';
      ctx.fillText(button.valueLabel, rect.x + rect.width - 14, rect.y + rect.height / 2);
      ctx.restore(); this.primitiveCount++; return;
    }
    if (button.kind === "slot") {
      roundedRect(ctx, rect, 10);
      ctx.fillStyle = "#0c2029";
      ctx.fill();
      ctx.strokeStyle = "#bf9656";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (button.kind !== "slot") {
      ctx.font = `${button.fontWeight} ${button.fontSize}px ${button.fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.shadowColor = button.launch ? "#172536" : "rgba(255,235,151,.6)";
      ctx.shadowOffsetY = 2;
      if (button.kind === "toggle" && button.stacked) {
        const size = button.fontSize * .882;
        ctx.textAlign = 'center'; ctx.fillStyle = button.color;
        for (const [label, offset] of [[button.label, -.8], [button.valueLabel, .8]] as const) {
          const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2 + offset * button.fontSize;
          if (!png(rooMenuText(label), x, y, {size, palette:button.rooPalette, align:'center', maxWidth:Math.max(1,rect.width-16)})) ctx.fillText(label,x,y,Math.max(1,rect.width-16));
        }
      } else if (button.kind === "toggle") {
        // The Canvas mirror does not inherit flexbox shrinking/wrapping.
        // Fit the label and choice together, reserving a real gap even for
        // long values such as CLASSIC on a narrow options card.
        const gap = 12;
        const available = Math.max(1, rect.width - 50 - gap);
        const usesRoo=/\bRoo\b/.test(button.fontFamily);
        const measure=(text:string)=>usesRoo?(layoutRooAtlas(ROO_ATLAS_METRICS.counter,rooMenuText(text),getRooAppearance().tracking)?.width??0)*button.fontSize*.882:ctx.measureText(text).width;
        const textWidth = measure(button.label)+measure(button.valueLabel);
        const fit = Math.min(1, available / Math.max(1, textWidth));
        ctx.font = `${button.fontWeight} ${button.fontSize * fit}px ${button.fontFamily}`;
        ctx.textAlign = "left";
        ctx.fillStyle = button.color;
        if(!usesRoo||!png(rooMenuText(button.label),rect.x+25,rect.y+rect.height/2,{size:button.fontSize*fit*.882,palette:button.rooPalette,align:'left'}))ctx.fillText(button.label,rect.x+25,rect.y+rect.height/2);
        ctx.textAlign = "right";
        ctx.fillStyle = button.valueColor;
        if(!usesRoo||!png(rooMenuText(button.valueLabel),rect.x+rect.width-25,rect.y+rect.height/2,{size:button.fontSize*fit*.882,palette:button.rooPalette,align:'right'}))ctx.fillText(
          button.valueLabel,
          rect.x + rect.width - 25,
          rect.y + rect.height / 2,
        );
      } else {
        ctx.textAlign = "center";
        // Snapshot color already includes selected, danger and Game Over's
        // context override from the semantic DOM cascade.
        ctx.fillStyle = button.color;
        if(!/\bRoo\b/.test(button.fontFamily)||!png(rooMenuText(button.label),rect.x+rect.width/2,rect.y+rect.height/2,{size:button.fontSize*.882,palette:button.rooPalette,align:'center',maxWidth:Math.max(1,rect.width-36)}))ctx.fillText(
          button.label,
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          Math.max(1, rect.width - 36),
        );
      }
    }
    ctx.restore();
    this.primitiveCount++;
  }

  private paintProgress(
    ctx: CanvasRenderingContext2D,
    progress: GameFlowSurfaceProgress,
  ): void {
    ctx.save();
    roundedRect(ctx, progress.track, 10);
    ctx.fillStyle = "#6f3218";
    ctx.fill();
    roundedRect(ctx, progress.fill, 7);
    const gradient = ctx.createLinearGradient(
      progress.fill.x,
      0,
      progress.fill.x + progress.fill.width,
      0,
    );
    gradient.addColorStop(0, "#62cf37");
    gradient.addColorStop(1, "#e8e82f");
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(137,237,64,.8)";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    this.primitiveCount++;
  }

  private paintThumbnail(
    ctx: CanvasRenderingContext2D,
    thumbnail: GameFlowSurfaceThumbnail,
  ): void {
    const { rect, source } = thumbnail;
    ctx.save();
    ctx.globalAlpha = thumbnail.opacity ?? 1;
    ctx.fillStyle = "#090b12";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (source) {
      try {
        const w = Math.max(1, rect.width - 8), h = Math.max(1, rect.height - 8);
        const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
        const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
        const scale = Math.max(w/sw,h/sh), cropW = w/scale, cropH = h/scale;
        ctx.drawImage(source,(sw-cropW)/2,(sh-cropH)/2,cropW,cropH,rect.x+4,rect.y+4,w,h);
      } catch {
        // A transient/lost source frame leaves the readable dark card in place.
      }
    }
    ctx.strokeStyle = "#54280f";
    ctx.lineWidth = 4;
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    ctx.restore();
    this.primitiveCount++;
  }

  private paintMask(
    ctx: CanvasRenderingContext2D,
    mask: GameFlowSurfaceRect & { opacity: number },
  ): void {
    this.ensureMaskImage();
    ctx.save();
    ctx.globalAlpha = mask.opacity;
    if (this.maskImageReady && this.maskImage) {
      const size = Math.min(mask.width * 0.52, mask.height * 0.78, 300);
      ctx.shadowColor = "rgba(255,91,19,.34)";
      ctx.shadowBlur = 35;
      ctx.drawImage(
        this.maskImage,
        mask.x + (mask.width - size) / 2,
        mask.y + (mask.height - size) / 2,
        size,
        size,
      );
    } else {
      ctx.fillStyle = "#ff9b20";
      ctx.font = `400 ${Math.min(mask.width, mask.height) * 0.34}px Roo, Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("☠", mask.x + mask.width / 2, mask.y + mask.height / 2);
    }
    ctx.restore();
    this.primitiveCount++;
  }

  private ensureMaskImage(): void {
    if (this.maskImage || typeof Image === "undefined") return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (this.disposed) return;
      this.maskImageReady = image.naturalWidth > 0 && image.naturalHeight > 0;
      this.invalidate();
      this.onAsyncInvalidate();
    };
    image.onerror = () => {
      this.maskImageReady = false;
    };
    const url = `${import.meta.env.BASE_URL}crossbones.png`;
    trackPresentationImage(image, url);
    image.src = url;
    this.maskImage = image;
  }

  private paintText(ctx: CanvasRenderingContext2D, text: GameFlowSurfaceText): void {
    const { rect, font } = text;
    if (font.opacity <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = font.opacity;
    ctx.font = `${font.weight} ${font.size}px ${font.family}`;
    ctx.textAlign = font.align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = font.color;
    ctx.strokeStyle = font.strokeColor;
    ctx.lineWidth = font.strokeWidth * 2;
    ctx.lineJoin = "round";
    const letterSpacingContext = ctx as CanvasRenderingContext2D & {
      letterSpacing?: string;
    };
    if ("letterSpacing" in letterSpacingContext)
      letterSpacingContext.letterSpacing = `${font.letterSpacing}px`;
    const lines = text.wrap
      ? wrapLines(ctx, text.text, Math.max(1, rect.width))
      : [text.text];
    const lineHeight = Math.max(font.size, font.lineHeight);
    const top = rect.y + (rect.height - lines.length * lineHeight) / 2;
    const x = font.align === "center"
      ? rect.x + rect.width / 2
      : font.align === "right"
        ? rect.x + rect.width
        : rect.x;
    for (let index = 0; index < lines.length; index++) {
      const y = top + lineHeight * (index + 0.5);
      if(/\bRoo\b/.test(font.family)){
        ctx.filter=text.pngFilter??'none';
        if(this.rooAtlas.draw(ctx,rooMenuText(lines[index]),x,y,{size:font.size*.882,palette:text.rooPalette,...(text.pngFilter?{lightPosition:0}:{}),align:font.align,maxWidth:rect.width}))continue;
        ctx.filter='none';
      }
      if (font.strokeWidth > 0) ctx.strokeText(lines[index], x, y, rect.width);
      ctx.fillText(lines[index], x, y, rect.width);
    }
    ctx.restore();
    this.primitiveCount++;
  }

  private composite(
    resources: GameFlowSurfaceResources,
    renderer: THREE.WebGLRenderer,
    size: Readonly<GameFlowSurfaceSize>,
    target: THREE.WebGLRenderTarget | null,
  ): boolean {
    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    const previousViewport = renderer.getViewport(PREVIOUS_VIEWPORT);
    const previousScissor = renderer.getScissor(PREVIOUS_SCISSOR);
    const previousScissorTest = renderer.getScissorTest();
    const previousAutoClear = renderer.autoClear;
    try {
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, size.width, size.height);
      renderer.setScissor(0, 0, size.width, size.height);
      renderer.setScissorTest(false);
      renderer.autoClear = false;
      renderer.render(resources.scene, resources.camera);
      this.compositeDraws++;
      return true;
    } finally {
      renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      renderer.setViewport(previousViewport);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
      renderer.autoClear = previousAutoClear;
    }
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  rect: Readonly<GameFlowSurfaceRect>,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.lineTo(rect.x + rect.width - r, rect.y);
  ctx.quadraticCurveTo(
    rect.x + rect.width,
    rect.y,
    rect.x + rect.width,
    rect.y + r,
  );
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height - r);
  ctx.quadraticCurveTo(
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x + rect.width - r,
    rect.y + rect.height,
  );
  ctx.lineTo(rect.x + r, rect.y + rect.height);
  ctx.quadraticCurveTo(
    rect.x,
    rect.y + rect.height,
    rect.x,
    rect.y + rect.height - r,
  );
  ctx.lineTo(rect.x, rect.y + r);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = words[0];
  for (let index = 1; index < words.length; index++) {
    const candidate = `${line} ${words[index]}`;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = words[index];
    }
  }
  lines.push(line);
  return lines;
}
