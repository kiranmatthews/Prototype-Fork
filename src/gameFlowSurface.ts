// Cached Canvas2D mirror for the game-owned modal UI.
//
// GameFlowUI remains the only interaction/accessibility owner. This surface
// receives an immutable snapshot made from that semantic DOM's known geometry,
// paints it into one canvas, and composites one fullscreen quad at the pre-CRT
// insertion point. No DOM screenshotting, foreignObject, or debug UI enters the
// render path.

import * as THREE from "three";

export type GameFlowSurfaceScreen =
  | "launch"
  | "new-slots"
  | "load-slots"
  | "confirm-new"
  | "save-load"
  | "confirm-save"
  | "confirm-load"
  | "confirm-quit-main"
  | "pause"
  | "options"
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
}

export interface GameFlowSurfaceButton {
  rect: GameFlowSurfaceRect;
  kind: "action" | "slot" | "toggle";
  label: string;
  valueLabel: string;
  color: string;
  valueColor: string;
  opacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  selected: boolean;
  disabled: boolean;
  danger: boolean;
}

export interface GameFlowSurfaceProgress {
  track: GameFlowSurfaceRect;
  fill: GameFlowSurfaceRect;
}

export interface GameFlowSurfaceThumbnail {
  rect: GameFlowSurfaceRect;
  source: HTMLCanvasElement | null;
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
  ".game-preview-name",
  ".game-progress-head h2",
  ".game-progress-head strong",
  ".game-progress-grid span",
  ".game-progress-grid strong",
  ".game-progress-grid small",
  ".game-progress-cleared",
  ".game-over-title",
  ".game-over-question",
  ".game-results-title",
  ".game-results-tally span",
  ".game-results-tally strong",
  ".game-award > span",
  ".game-award > small",
].join(",");

const PREVIOUS_VIEWPORT = new THREE.Vector4();
const PREVIOUS_SCISSOR = new THREE.Vector4();
export const GAME_FLOW_MAX_RASTER_PIXELS = 2_073_600;

function finiteDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

/** Keep Canvas2D uploads bounded while the quad still covers the full target. */
export function gameFlowRasterSize(
  width: number,
  height: number,
): GameFlowSurfaceSize {
  const targetWidth = finiteDimension(width);
  const targetHeight = finiteDimension(height);
  const pixels = targetWidth * targetHeight;
  if (pixels <= GAME_FLOW_MAX_RASTER_PIXELS)
    return { width: targetWidth, height: targetHeight };
  const scale = Math.sqrt(GAME_FLOW_MAX_RASTER_PIXELS / pixels);
  return {
    width: Math.max(1, Math.floor(targetWidth * scale)),
    height: Math.max(1, Math.floor(targetHeight * scale)),
  };
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
  return Object.freeze({
    x: rect.left - origin.left,
    y: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
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
    source.panel.querySelectorAll<HTMLElement>(".game-results-tally > div"),
  )
    .map((node) => rectFrom(node, origin))
    .filter((rect): rect is GameFlowSurfaceRect => rect !== null);

  const texts: GameFlowSurfaceText[] = [];
  for (const node of source.panel.querySelectorAll<HTMLElement>(TEXT_SELECTOR)) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    const measuredRect = rectFrom(node, origin);
    // Roo's Canvas2D middle baseline has a taller ascender than its CSS line
    // box. Nudge the two logo rows together so BOARD does not climb back into
    // the launch eyebrow after rasterisation.
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
        rect,
        font,
        wrap:
          node.classList.contains("game-panel-subtitle") ||
          node.classList.contains("game-input-hint"),
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
    const toggle = button.classList.contains("game-toggle");
    const slot = button.classList.contains("game-save-slot");
    const value = toggle ? button.querySelector<HTMLElement>(":scope > strong") : null;
    const label = toggle ? button.querySelector<HTMLElement>(":scope > span") : null;
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
        kind: slot ? "slot" : toggle ? "toggle" : "action",
        label: slot
          ? ""
          : ((label?.textContent ?? button.textContent) || "")
              .replace(/\s+/g, " ")
              .trim(),
        valueLabel: (value?.textContent ?? "").trim(),
        color: stableButtonColor(button, style.color),
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

  const thumbnailRect = source.thumbnail
    ? rectFrom(source.thumbnail, origin)
    : null;
  const thumbnail = source.thumbnail && thumbnailRect
    ? Object.freeze({
        rect: thumbnailRect,
        source: source.thumbnailCaptured ? source.thumbnail : null,
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
    cards: immutableArray(cards),
    blocks: immutableArray(blocks),
    buttons: immutableArray(buttons),
    texts: immutableArray(texts),
    progress,
    thumbnail,
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

  constructor(
    private readonly readState: () => GameFlowSurfaceRenderState,
    private readonly onAsyncInvalidate: () => void = () => {},
  ) {}

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
    const raster = gameFlowRasterSize(targetWidth, targetHeight);
    const state = this.state ?? this.readState();
    this.state = state;
    this.screen = state.screen;
    if (!state.visible) {
      this.hasPixels = false;
      return false;
    }

    const resources = this.ensureResources();
    const resized = this.ensureSize(resources, raster.width, raster.height);
    if (this.dirty || resized) this.paint(resources, state, raster.width, raster.height);
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
    for (const card of state.cards) this.paintCard(ctx, card);
    for (const block of state.blocks) this.paintBlock(ctx, block);
    for (const button of state.buttons) this.paintButton(ctx, button);
    if (state.progress) this.paintProgress(ctx, state.progress);
    if (state.thumbnail) this.paintThumbnail(ctx, state.thumbnail);
    if (state.maskFallback) this.paintMask(ctx, state.maskFallback);
    for (const text of state.texts) this.paintText(ctx, text);
    ctx.restore();
    this.hasPixels = this.primitiveCount > 0;
    resources.texture.needsUpdate = true;
    this.textureUploads++;
    this.canvasFrames++;
    this.paintedRevision = this.revision;
    this.lastCanvasMs = performance.now() - started;
    this.dirty = false;
  }

  private paintBackdrop(
    ctx: CanvasRenderingContext2D,
    screen: GameFlowSurfaceScreen | null,
    width: number,
    height: number,
  ): void {
    ctx.save();
    if (screen === "results") {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "rgba(3,5,10,0)");
      gradient.addColorStop(0.38, "rgba(3,5,10,0)");
      gradient.addColorStop(0.58, "rgba(3,5,10,.35)");
      gradient.addColorStop(1, "rgba(3,5,10,.88)");
      ctx.fillStyle = gradient;
    } else {
      const radius = Math.max(width, height) * 0.72;
      const gradient = ctx.createRadialGradient(
        width * 0.5,
        height * (screen === "gameover" ? 0.44 : 0.4),
        0,
        width * 0.5,
        height * 0.5,
        radius,
      );
      gradient.addColorStop(
        0,
        screen === "gameover" ? "rgba(176,55,13,.20)" : "rgba(31,58,100,.18)",
      );
      gradient.addColorStop(0.66, "rgba(3,5,12,.58)");
      gradient.addColorStop(1, "rgba(2,3,8,.90)");
      ctx.fillStyle = gradient;
    }
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    this.primitiveCount++;
  }

  private paintCard(ctx: CanvasRenderingContext2D, rect: GameFlowSurfaceRect): void {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.62)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 14;
    roundedRect(ctx, rect, 13);
    ctx.fillStyle = "#35190f";
    ctx.fill();
    ctx.shadowColor = "transparent";
    const wood = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
    wood.addColorStop(0, "#ffd37d");
    wood.addColorStop(0.56, "#e7ad55");
    wood.addColorStop(1, "#a75b27");
    roundedRect(ctx, rect, 13);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = "#5d2d17";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#5c2a0f";
    ctx.lineWidth = 1;
    for (const fraction of [0.14, 0.59]) {
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.width * fraction, rect.y + 5);
      ctx.lineTo(rect.x + rect.width * (fraction + 0.015), rect.y + rect.height - 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const [x, y] of [
      [rect.x + 13, rect.y + 13],
      [rect.x + rect.width - 13, rect.y + rect.height - 13],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#8a491f";
      ctx.fill();
      ctx.strokeStyle = "#4a230f";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    this.primitiveCount++;
  }

  private paintBlock(ctx: CanvasRenderingContext2D, rect: GameFlowSurfaceRect): void {
    ctx.save();
    roundedRect(ctx, rect, 8);
    ctx.fillStyle = "rgba(92,43,18,.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(91,41,17,.55)";
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
    ctx.save();
    // One captured element opacity drives action/toggle text or the slot's
    // compound background. Slot child text receives that ancestor opacity in
    // its own snapshot, so rgba color alpha is never multiplied a second time.
    ctx.globalAlpha = button.opacity;
    if (button.kind === "slot") {
      roundedRect(ctx, rect, 10);
      ctx.fillStyle = button.selected
        ? "rgba(255,244,183,.68)"
        : "rgba(255,226,147,.30)";
      ctx.fill();
      ctx.strokeStyle = "#7f3c1b";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (button.selected && button.kind !== "slot") {
      // A warm, stable highlight replaces the DOM's layout-changing scale and
      // filter transition. It uses the same paper/orange palette without ever
      // moving the semantic hit rectangle underneath the pointer.
      const insetX = Math.max(3, Math.min(10, rect.height * 0.12));
      const insetY = Math.max(2, Math.min(6, rect.height * 0.08));
      roundedRect(
        ctx,
        {
          x: rect.x + insetX,
          y: rect.y + insetY,
          width: Math.max(1, rect.width - insetX * 2),
          height: Math.max(1, rect.height - insetY * 2),
        },
        8,
      );
      ctx.fillStyle = "rgba(255,244,183,.22)";
      ctx.fill();
      ctx.strokeStyle = "rgba(240,90,32,.40)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (button.selected) {
      const mid = rect.y + rect.height / 2;
      ctx.beginPath();
      ctx.moveTo(rect.x + 4, mid - 10);
      ctx.lineTo(rect.x + 21, mid);
      ctx.lineTo(rect.x + 4, mid + 10);
      ctx.closePath();
      ctx.fillStyle = "#218d3c";
      ctx.shadowColor = "#103514";
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fill();
      ctx.shadowColor = "transparent";
    }
    if (button.kind !== "slot") {
      ctx.font = `${button.fontWeight} ${button.fontSize}px ${button.fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(255,235,151,.6)";
      ctx.shadowOffsetY = 2;
      if (button.kind === "toggle") {
        ctx.textAlign = "left";
        ctx.fillStyle = button.color;
        ctx.fillText(button.label, rect.x + 25, rect.y + rect.height / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = button.valueColor;
        ctx.fillText(
          button.valueLabel,
          rect.x + rect.width - 25,
          rect.y + rect.height / 2,
        );
      } else {
        ctx.textAlign = "center";
        // Snapshot color already includes selected, danger and Game Over's
        // context override from the semantic DOM cascade.
        ctx.fillStyle = button.color;
        ctx.fillText(
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
    ctx.fillStyle = "#090b12";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (source) {
      try {
        ctx.drawImage(
          source,
          rect.x + 4,
          rect.y + 4,
          Math.max(1, rect.width - 8),
          Math.max(1, rect.height - 8),
        );
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
    image.src = `${import.meta.env.BASE_URL}crossbones.png`;
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
