// Canvas-native gameplay HUD composition.
//
// The browser HUD still owns state, layout, accessibility and interaction. This
// surface mirrors only the PLAY presentation into one transparent Canvas2D
// texture, then blends that texture into the already-rendered pre-CRT target.
// Tuner/editor/presentation controls are deliberately absent from the binding
// contract, so they remain sharp DOM above the CRT output.

import * as THREE from "three";
import {
  SOURCE_HUD_TRACKING,
  sourceTrackingPixels,
  wrapComboLabelLine,
} from "./comboHud";

export interface GameHudRenderSize {
  /** Exact physical-pixel width of the pre-CRT image. */
  width: number;
  /** Exact physical-pixel height of the pre-CRT image. */
  height: number;
}

/**
 * Explicit handles to the existing gameplay DOM. All handles are optional so
 * new HUD features can be staged independently, but no selector scan or DOM
 * screenshot is ever performed. `viewport` defines the CSS coordinate space;
 * omitted means the browser viewport.
 */
export interface GameHudElements {
  viewport?: HTMLElement;

  crateIcon?: HTMLElement;
  crateValue?: HTMLElement;
  fruitIcon?: HTMLElement;
  fruitValue?: HTMLElement;
  crystalIcon?: HTMLElement;
  gemIcon?: HTMLElement;
  comboGemIcon?: HTMLElement;

  lifeFace?: HTMLElement;
  lifeValue?: HTMLElement;
  deathModeLabel?: HTMLElement;
  scoreLabel?: HTMLElement;
  scoreValue?: HTMLElement;
  timeTrialClock?: HTMLElement;
  timeTrialValue?: HTMLElement;
  timeTrialFreeze?: HTMLElement;

  special?: HTMLElement;
  specialLabel?: HTMLElement;
  specialTrack?: HTMLElement;
  specialFill?: HTMLElement;
  specialControls?: HTMLElement;

  results?: HTMLElement;
  resultsTitle?: HTMLElement;
  resultsTime?: HTMLElement;
  resultsList?: HTMLElement;
  resultsSub?: HTMLElement;

  boost?: HTMLElement;
  boostRing?: HTMLElement;
  boostLabel?: HTMLElement;
  trick?: HTMLElement;
  trickLine?: HTMLElement;
  trickTotal?: HTMLElement;
  grindBalance?: HTMLElement;
  grindNeedle?: HTMLElement;
  manualBalance?: HTMLElement;
  manualNeedle?: HTMLElement;

  message?: HTMLElement;
  messageTitle?: HTMLElement;
  messageSub?: HTMLElement;
  flash?: HTMLElement;
  fade?: HTMLElement;
  halo?: HTMLElement;

  death?: HTMLElement;
  deathTitle?: HTMLElement;
  deathSub?: HTMLElement;
  replayBadge?: HTMLElement;
  recordBadge?: HTMLElement;
}

export type GameHudRelicState = "hidden" | "ghost" | "earned";

export interface GameHudCounterState {
  visible?: boolean;
  value: string | number;
}

export interface GameHudClockState {
  visible?: boolean;
  value: string;
  freeze?: string;
  frozen?: boolean;
}

export interface GameHudResultsState {
  visible?: boolean;
  title: string;
  time: string;
  rows?: Array<{ label: string; value: string; isNew?: boolean }>;
  sub?: string;
}

export interface GameHudBoostState {
  visible?: boolean;
  /** Remaining boost time. Together with `period`, this reproduces the laps. */
  remaining: number;
  period: number;
  critical?: boolean;
  label?: string;
}

export interface GameHudSpecialState {
  visible?: boolean;
  /** SPECIAL bar percentage in the inclusive range 0..100. */
  value: number;
  ready?: boolean;
  label?: string;
  controls?: string;
}

export interface GameHudBalanceState {
  mode: "grind" | "manual";
  /** Needle position, clamped to [-1, 1]. */
  value: number;
  critical?: boolean;
}

/**
 * Optional state overrides. UI normally lets the surface read its live Roo
 * labels/classes/rects directly; these fields make the renderer usable without
 * DOM text (tests, future canvas-owned HUD state, or a staged migration).
 * `undefined` means "read the bound DOM" and `null` means "hide this item".
 */
export interface GameHudFrameState {
  crates?: GameHudCounterState | null;
  fruit?: GameHudCounterState | null;
  life?: (GameHudCounterState & { deathsMode?: boolean }) | null;
  score?: (GameHudCounterState & { label?: string }) | null;
  clock?: GameHudClockState | null;
  special?: GameHudSpecialState | null;
  relics?: Partial<Record<"crystal" | "gem" | "comboGem", GameHudRelicState>>;
  results?: GameHudResultsState | null;
  boost?: GameHudBoostState | null;
  trick?: { visible?: boolean; line: string; total: string; bailed?: boolean } | null;
  balance?: GameHudBalanceState | null;
  message?: { visible?: boolean; title: string; sub?: string } | null;
  flashAlpha?: number;
  fadeAlpha?: number;
  haloAlpha?: number;
  death?: { visible?: boolean; title?: string; sub?: string } | null;
  replayBadge?: string | null;
  recordBadge?: string | null;
  nowMs?: number;
  /** Extension point for a future gameplay-only canvas decoration. */
  drawExtra?: (
    context: CanvasRenderingContext2D,
    size: Readonly<GameHudRenderSize>,
  ) => void;
}

export interface GameHudSurfaceOptions {
  elements?: GameHudElements;
  lifeFaceUrl?: string;
  rooFontFamily?: string;
  /** Draw simple crate/fruit silhouettes when the 3D icon pass is unavailable. */
  drawIconFallbacks?: boolean;
}

export interface GameHudSurfaceDiagnostics {
  width: number;
  height: number;
  canvasFrames: number;
  textureUploads: number;
  textureReallocations: number;
  compositeDraws: number;
  primitives: number;
  lastCanvasMs: number;
  lifeFaceReady: boolean;
  rooFontReady: boolean;
  disposed: boolean;
}

export const GAME_HUD_PALETTES = {
  counter: {
    top: "#fff5a5",
    middle: "#ffc13c",
    bottom: "#ee671d",
    rim: "rgba(255, 252, 207, 0.82)",
    shade: "rgba(112, 30, 7, 0.72)",
    shadow: "rgba(20, 8, 2, 0.72)",
  },
  bonus: {
    top: "#effff1",
    middle: "#69e89b",
    bottom: "#2782dd",
    rim: "rgba(224, 255, 239, 0.84)",
    shade: "rgba(7, 48, 99, 0.72)",
    shadow: "rgba(2, 13, 30, 0.75)",
  },
} as const;

type RooPalette = keyof typeof GAME_HUD_PALETTES;

interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutMap {
  sourceWidth: number;
  sourceHeight: number;
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
}

interface RooStyle {
  size: number;
  align?: CanvasTextAlign;
  palette?: RooPalette;
  tracking?: number;
  maxWidth?: number;
  alpha?: number;
  glow?: string;
}

interface PlainTextStyle {
  size: number;
  align: CanvasTextAlign;
  color: string;
  weight?: string;
  family?: string;
  shadow?: string;
  alpha?: number;
  maxWidth?: number;
  lineHeight?: number;
}

const PREVIOUS_VIEWPORT = new THREE.Vector4();
const PREVIOUS_SCISSOR = new THREE.Vector4();

/** Read the single source glyph behind a Roo SVG without rasterising the DOM. */
export function readRooHudText(element: HTMLElement | undefined): string {
  if (!element) return "";
  const glyph = element.querySelector("text");
  const raw = glyph?.textContent ?? element.textContent ?? "";
  return raw.replace(/\s+/g, " ").trim();
}

export class GameHudSurface {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly quad: THREE.Mesh;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private elements: GameHudElements;
  private readonly fontFamily: string;
  private readonly iconFallbacks: boolean;
  private lifeFace: HTMLImageElement | null = null;
  private lifeFaceReady = false;
  private rooFontReady = false;
  private disposed = false;
  private hasPixels = false;
  private primitiveCount = 0;
  private canvasFrames = 0;
  private textureUploads = 0;
  private textureReallocations = 0;
  private compositeDraws = 0;
  private lastCanvasMs = 0;

  constructor(options: GameHudSurfaceOptions = {}) {
    this.elements = options.elements ?? {};
    this.fontFamily = options.rooFontFamily ?? "Roo";
    this.iconFallbacks = options.drawIconFallbacks ?? false;

    this.canvas = document.createElement("canvas");
    this.canvas.width = 1;
    this.canvas.height = 1;
    const context = this.canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Gameplay HUD requires a Canvas2D context");
    this.context = context;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.name = "GameplayHUD.PreCRT.Canvas";
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.unpackAlignment = 1;

    this.material = new THREE.MeshBasicMaterial({
      name: "GameplayHUD.PreCRT.Composite",
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.geometry, this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 0.5;

    this.loadLifeFace(
      options.lifeFaceUrl ?? `${import.meta.env.BASE_URL}roo.png`,
    );
    if (document.fonts) {
      void document.fonts
        .load(`400 96px "${this.fontFamily}"`, "SCORE 0123456789")
        .then(() => {
          this.rooFontReady = document.fonts.check(
            `400 96px "${this.fontFamily}"`,
          );
        })
        .catch(() => {
          this.rooFontReady = false;
        });
    }
  }

  setElements(elements: GameHudElements): void {
    this.elements = elements;
  }

  get diagnostics(): GameHudSurfaceDiagnostics {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      canvasFrames: this.canvasFrames,
      textureUploads: this.textureUploads,
      textureReallocations: this.textureReallocations,
      compositeDraws: this.compositeDraws,
      primitives: this.primitiveCount,
      lastCanvasMs: this.lastCanvasMs,
      lifeFaceReady: this.lifeFaceReady,
      rooFontReady: this.rooFontReady,
      disposed: this.disposed,
    };
  }

  /**
   * Paint a fresh transparent HUD at the exact pre-CRT dimensions. Returns
   * false when there is nothing to composite this frame.
   */
  draw(
    size: Readonly<GameHudRenderSize>,
    frame: Readonly<GameHudFrameState> = {},
  ): boolean {
    this.assertLive();
    const started = now();
    const width = validDimension(size.width);
    const height = validDimension(size.height);
    this.ensureSize(width, height);

    const ctx = this.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowColor = "transparent";
    ctx.clearRect(0, 0, width, height);
    this.primitiveCount = 0;

    const layout = this.layout(width, height);
    const time = frame.nowMs ?? now();

    // Same ascending z-order as ui.ts: halo behind persistent HUD; flash and
    // result cards above it; death fade and GAME OVER on top.
    this.paintHalo(ctx, width, height, frame);
    this.paintCounters(ctx, layout, width, height, frame, time);
    this.paintScoreAndClock(ctx, layout, width, height, frame);
    this.paintSpecial(ctx, layout, width, height, frame, time);
    this.paintBoost(ctx, layout, width, height, frame, time);
    this.paintTrick(ctx, layout, width, height, frame);
    this.paintBalance(ctx, layout, width, height, frame);
    this.paintMessage(ctx, layout, width, height, frame);
    this.paintFlatEffect(ctx, width, height, frame.flashAlpha, this.elements.flash, "#a3202a");
    this.paintResults(ctx, layout, width, height, frame);
    this.paintFlatEffect(ctx, width, height, frame.fadeAlpha, this.elements.fade, "#000000");
    this.paintDeath(ctx, layout, width, height, frame);
    this.paintBadges(ctx, layout, width, height, frame);

    if (frame.drawExtra) {
      ctx.save();
      frame.drawExtra(ctx, { width, height });
      ctx.restore();
      this.mark();
    }

    this.hasPixels = this.primitiveCount > 0;
    this.texture.needsUpdate = true;
    this.textureUploads++;
    this.canvasFrames++;
    this.lastCanvasMs = now() - started;
    return this.hasPixels;
  }

  private paintSpecial(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
    time: number,
  ): void {
    const explicit = frame.special;
    const visible =
      explicit === null
        ? false
        : explicit
          ? explicit.visible !== false
          : isLaidOut(this.elements.special);
    if (!visible) return;

    const sx = width / 1280;
    const sy = height / 720;
    const host = this.rect(this.elements.special, layout) ?? {
      x: 40 * sx,
      y: height - 96 * sy,
      width: Math.min(340 * sx, width * 0.42),
      height: 66 * sy,
    };
    const rawValue =
      explicit?.value ?? Number.parseFloat(this.elements.special?.dataset.value ?? '0');
    const fraction = clamp01((Number.isFinite(rawValue) ? rawValue : 0) / 100);
    const ready =
      explicit?.ready ?? this.elements.special?.classList.contains('hud-special-ready') ?? false;
    const alpha = explicit ? 1 : elementOpacity(this.elements.special, 1);
    if (alpha <= 0.001) return;

    const labelRect = this.rect(this.elements.specialLabel, layout) ?? {
      x: host.x,
      y: host.y,
      width: host.width,
      height: 22 * sy,
    };
    const trackRect = this.rect(this.elements.specialTrack, layout) ?? {
      x: host.x,
      y: host.y + 25 * sy,
      width: host.width,
      height: 15 * sy,
    };
    const controlsRect = this.rect(this.elements.specialControls, layout) ?? {
      x: host.x,
      y: host.y + 43 * sy,
      width: host.width,
      height: 18 * sy,
    };

    ctx.save();
    ctx.globalAlpha = alpha;
    if (ready) {
      const pulse = 0.55 + 0.25 * Math.sin(time * 0.012);
      ctx.shadowColor = `rgba(255, 184, 28, ${pulse})`;
      ctx.shadowBlur = 18 * sy;
    }
    ctx.fillStyle = 'rgba(12, 10, 18, 0.82)';
    ctx.fillRect(trackRect.x, trackRect.y, trackRect.width, trackRect.height);
    ctx.strokeStyle = ready ? '#fff16a' : 'rgba(255, 196, 72, 0.72)';
    ctx.lineWidth = Math.max(1, 2 * sy);
    ctx.strokeRect(trackRect.x, trackRect.y, trackRect.width, trackRect.height);

    if (fraction > 0) {
      const inset = Math.max(1, 2 * sy);
      const fillWidth = Math.max(0, (trackRect.width - inset * 2) * fraction);
      const gradient = ctx.createLinearGradient(trackRect.x, 0, trackRect.x + trackRect.width, 0);
      gradient.addColorStop(0, '#ff7a18');
      gradient.addColorStop(0.72, '#ffc928');
      gradient.addColorStop(1, ready ? '#fffbd0' : '#ffe36a');
      ctx.fillStyle = gradient;
      ctx.fillRect(
        trackRect.x + inset,
        trackRect.y + inset,
        fillWidth,
        Math.max(0, trackRect.height - inset * 2),
      );
    }
    ctx.restore();
    this.mark();

    this.drawRooInRect(
      ctx,
      explicit?.label ?? (readRooHudText(this.elements.specialLabel) || 'SPECIAL'),
      labelRect,
      {
        size: 18 * sy,
        align: 'left',
        tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.word, 18 * sy),
        glow: ready ? '#ffb41f' : undefined,
      },
    );
    const controls =
      explicit?.controls ?? readRooHudText(this.elements.specialControls);
    if (controls) {
      this.drawPlainText(
        ctx,
        controls,
        controlsRect.x,
        controlsRect.y + controlsRect.height / 2,
        {
          size: Math.max(8, 10 * sy),
          align: 'left',
          color: ready ? '#fff5aa' : '#d0b46d',
        },
      );
    }
  }

  /**
   * Blend the last Canvas2D frame over `target` (or the currently-bound target).
   * This never clears color/depth/stencil and restores every renderer property
   * it changes, including the caller's split viewport/scissor.
   */
  composite(
    renderer: THREE.WebGLRenderer,
    size: Readonly<GameHudRenderSize>,
    target: THREE.WebGLRenderTarget | null = renderer.getRenderTarget(),
  ): boolean {
    this.assertLive();
    if (!this.hasPixels) return false;
    const width = validDimension(size.width);
    const height = validDimension(size.height);
    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    const previousViewport = renderer.getViewport(PREVIOUS_VIEWPORT);
    const previousScissor = renderer.getScissor(PREVIOUS_SCISSOR);
    const previousScissorTest = renderer.getScissorTest();
    const previousAutoClear = renderer.autoClear;
    try {
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.setScissorTest(false);
      renderer.autoClear = false;
      renderer.render(this.scene, this.camera);
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

  /** Paint and immediately composite over the current pre-CRT target. */
  render(
    renderer: THREE.WebGLRenderer,
    size: Readonly<GameHudRenderSize>,
    frame: Readonly<GameHudFrameState> = {},
    target: THREE.WebGLRenderTarget | null = renderer.getRenderTarget(),
  ): boolean {
    return this.draw(size, frame) && this.composite(renderer, size, target);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    if (this.lifeFace) {
      this.lifeFace.onload = null;
      this.lifeFace.onerror = null;
      this.lifeFace = null;
    }
    this.scene.clear();
  }

  private paintHalo(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const alpha = clamp01(
      frame.haloAlpha ?? elementOpacity(this.elements.halo),
    );
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // An elliptical radial wash plus repeated inset strokes approximates the
    // CSS radial-gradient/inset-shadow without baking viewport geometry.
    ctx.translate(width / 2, height / 2);
    const aspect = width / Math.max(1, height);
    ctx.scale(aspect, 1);
    const radius = height * 0.72;
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.48, 0, 0, radius);
    gradient.addColorStop(0, "rgba(70,232,130,0)");
    gradient.addColorStop(0.72, "rgba(70,232,130,0.10)");
    gradient.addColorStop(1, "rgba(70,232,130,0.48)");
    ctx.fillStyle = gradient;
    ctx.fillRect(-width / (2 * aspect), -height / 2, width / aspect, height);
    ctx.restore();
    this.mark();
  }

  private paintCounters(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
    time: number,
  ): void {
    const sy = height / 720;
    const counterSize = 90 * sy;
    const iconSize = 77 * sy;
    const left = 40 * (width / 1280);
    const top = 16 * sy;
    const gap = 12 * sy;
    const rowStep = iconSize + 8 * sy;

    const crates = resolveCounter(frame.crates, this.elements.crateValue);
    if (crates) {
      const iconRect = this.rect(this.elements.crateIcon, layout) ?? {
        x: left,
        y: top,
        width: iconSize,
        height: iconSize,
      };
      const valueRect = this.rect(this.elements.crateValue, layout) ?? {
        x: iconRect.x + iconRect.width + gap,
        y: top,
        width: width * 0.24,
        height: counterSize * 1.285,
      };
      if (this.iconFallbacks && !this.elements.crateIcon)
        this.drawCrateFallback(ctx, iconRect, time);
      this.drawRooInRect(ctx, String(crates.value), valueRect, {
        size: counterSize,
        align: "left",
        tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.largeNumber, counterSize),
      });
    }

    const fruit = resolveCounter(frame.fruit, this.elements.fruitValue);
    if (fruit) {
      const iconRect = this.rect(this.elements.fruitIcon, layout) ?? {
        x: left,
        y: top + rowStep,
        width: iconSize,
        height: iconSize,
      };
      const valueRect = this.rect(this.elements.fruitValue, layout) ?? {
        x: iconRect.x + iconRect.width + gap,
        y: iconRect.y,
        width: width * 0.24,
        height: counterSize * 1.285,
      };
      if (this.iconFallbacks && !this.elements.fruitIcon)
        this.drawFruitFallback(ctx, iconRect, time);
      this.drawRooInRect(ctx, String(fruit.value), valueRect, {
        size: counterSize,
        align: "left",
        tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.largeNumber, counterSize),
      });
    }

    const relicFallbackY = top + rowStep * 2;
    this.paintRelic(
      ctx,
      this.elements.crystalIcon,
      frame.relics?.crystal,
      this.rect(this.elements.crystalIcon, layout) ?? {
        x: left,
        y: relicFallbackY,
        width: 53 * sy,
        height: 74 * sy,
      },
      "crystal",
    );
    this.paintRelic(
      ctx,
      this.elements.gemIcon,
      frame.relics?.gem,
      this.rect(this.elements.gemIcon, layout) ?? {
        x: left + 67 * sy,
        y: relicFallbackY + 12 * sy,
        width: 67 * sy,
        height: 50 * sy,
      },
      "gem",
    );
    this.paintRelic(
      ctx,
      this.elements.comboGemIcon,
      frame.relics?.comboGem,
      this.rect(this.elements.comboGemIcon, layout) ?? {
        x: left + 148 * sy,
        y: relicFallbackY + 12 * sy,
        width: 67 * sy,
        height: 50 * sy,
      },
      "comboGem",
    );

    const life = resolveCounter(frame.life, this.elements.lifeValue);
    if (life) {
      const faceRect = this.rect(this.elements.lifeFace, layout) ?? {
        x: width - 40 * (width / 1280) - iconSize,
        y: top - iconSize * 0.14,
        width: iconSize,
        height: iconSize,
      };
      const deathsMode =
        frame.life?.deathsMode ??
        (this.elements.lifeFace?.parentElement?.classList.contains(
          "hud-deathcount",
        ) ?? false);
      this.drawLifeFace(ctx, faceRect, deathsMode);
      const lifeRect = this.rect(this.elements.lifeValue, layout) ?? {
        x: faceRect.x - counterSize * 1.35,
        y: top,
        width: counterSize * 1.25,
        height: counterSize * 1.285,
      };
      const lifeSize = Math.min(111 * sy, counterSize * 1.23);
      this.drawRooInRect(ctx, String(life.value), lifeRect, {
        size: lifeSize,
        align: "right",
        tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.largeNumber, lifeSize),
      });
      if (deathsMode) {
        const labelRect = this.rect(this.elements.deathModeLabel, layout) ?? {
          x: lifeRect.x + lifeRect.width + 4 * sy,
          y: lifeRect.y + lifeRect.height - 22 * sy,
          width: 72 * sy,
          height: 18 * sy,
        };
        this.drawPlainText(ctx, "DEATHS", labelRect.x, labelRect.y + labelRect.height / 2, {
          size: Math.max(10, 14 * sy),
          align: "left",
          color: "#ff765f",
          weight: "bold",
          shadow: "rgba(0,0,0,0.85)",
        });
      }
    }
  }

  private paintScoreAndClock(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const sy = height / 720;
    const right = width - 40 * (width / 1280);
    const score = resolveCounter(frame.score, this.elements.scoreValue);
    if (score) {
      const valueRect = this.rect(this.elements.scoreValue, layout) ?? {
        x: right - 260 * sy,
        y: 128 * sy,
        width: 260 * sy,
        height: 46 * sy,
      };
      const labelRect = this.rect(this.elements.scoreLabel, layout) ?? {
        x: valueRect.x,
        y: valueRect.y - 24 * sy,
        width: valueRect.width,
        height: 24 * sy,
      };
      this.drawRooInRect(ctx, frame.score?.label ?? (readRooHudText(this.elements.scoreLabel) || "SCORE"), labelRect, {
        size: 22 * sy,
        align: "right",
        tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.word, 22 * sy),
      });
      this.drawRooInRect(ctx, String(score.value), valueRect, {
        size: 36 * sy,
        align: "right",
        tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.largeNumber, 36 * sy),
      });
    }

    const clock = resolveClock(frame.clock, this.elements.timeTrialClock, this.elements.timeTrialValue, this.elements.timeTrialFreeze);
    if (!clock) return;
    const valueRect = this.rect(this.elements.timeTrialValue, layout) ?? {
      x: right - 380 * sy,
      y: 14 * sy,
      width: 380 * sy,
      height: 116 * sy,
    };
    this.drawRooInRect(ctx, clock.value, valueRect, {
      size: 90 * sy,
      align: "right",
      tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.largeNumber, 90 * sy),
      palette: "bonus",
      glow: clock.frozen ? "#6ee6ff" : undefined,
    });
    if (clock.freeze) {
      const freezeRect = this.rect(this.elements.timeTrialFreeze, layout) ?? {
        x: valueRect.x,
        y: valueRect.y + valueRect.height,
        width: valueRect.width,
        height: 30 * sy,
      };
      this.drawRooInRect(ctx, clock.freeze, freezeRect, {
        size: 22 * sy,
        align: "right",
        tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.word, 22 * sy),
        palette: "bonus",
      });
    }
  }

  private paintBoost(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
    time: number,
  ): void {
    const explicit = frame.boost;
    const visible = explicit === null
      ? false
      : explicit
        ? explicit.visible !== false
        : isLaidOut(this.elements.boost);
    if (!visible) return;
    const sy = height / 720;
    const ringRect = this.rect(this.elements.boostRing, layout) ?? {
      x: width / 2 - 29 * sy,
      y: height * 0.81,
      width: 58 * sy,
      height: 58 * sy,
    };
    let fraction = 1;
    let under = "rgba(10,30,18,0.75)";
    let over = "#46e882";
    let critical = false;
    if (explicit) {
      const period = Math.max(0.001, explicit.period);
      const laps = Math.max(0, Math.floor(explicit.remaining / period));
      fraction = ((explicit.remaining / period) % 1 + 1) % 1;
      const shades = ["#1c6e3c", "#2fae5c", "#46e882", "#a4ffc8"];
      under = laps === 0 ? under : shades[Math.min(laps - 1, shades.length - 1)];
      over = shades[Math.min(laps, shades.length - 1)];
      critical = explicit.critical ?? explicit.remaining < 1;
    } else {
      const parsed = parseConicBackground(this.elements.boostRing?.style.background ?? "");
      if (parsed) ({ fraction, under, over } = parsed);
      critical = this.elements.boost?.classList.contains("hud-boost-low") ?? false;
    }
    const blink = critical && Math.floor(time / 150) % 2 === 0 ? 0.35 : 1;
    const cx = ringRect.x + ringRect.width / 2;
    const cy = ringRect.y + ringRect.height / 2;
    const radius = Math.min(ringRect.width, ringRect.height) * 0.4;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.lineCap = "butt";
    ctx.lineWidth = Math.max(3, radius * 0.42);
    ctx.shadowColor = "rgba(70,232,130,0.55)";
    ctx.shadowBlur = 6 * sy;
    ctx.strokeStyle = under;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (fraction > 0.001) {
      ctx.strokeStyle = over;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
      ctx.stroke();
    }
    ctx.restore();
    this.mark();
    const label = explicit?.label ?? (readRooHudText(this.elements.boostLabel) || "BALANCE");
    const labelRect = this.rect(this.elements.boostLabel, layout) ?? {
      x: width / 2 - 90 * sy,
      y: ringRect.y + ringRect.height + 4 * sy,
      width: 180 * sy,
      height: 28 * sy,
    };
    this.drawRooInRect(ctx, label, labelRect, {
      size: 20 * sy,
      align: "center",
      tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.word, 20 * sy),
    });
  }

  private paintTrick(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const explicit = frame.trick;
    const visible = explicit === null
      ? false
      : explicit
        ? explicit.visible !== false
        : isLaidOut(this.elements.trick);
    if (!visible) return;
    const line = (explicit?.line ?? readRooHudText(this.elements.trickLine)).toUpperCase();
    const total = explicit?.total ?? readRooHudText(this.elements.trickTotal);
    const bailed = explicit?.bailed ?? this.elements.trick?.classList.contains("hud-trick-bail") ?? false;
    const alpha = explicit ? 1 : elementOpacity(this.elements.trick, 1);
    const sy = height / 720;
    const lineRect = this.rect(this.elements.trickLine, layout) ?? {
      x: width * 0.03,
      y: height * 0.84,
      width: width * 0.94,
      height: 84 * sy,
    };
    const totalRect = this.rect(this.elements.trickTotal, layout) ?? {
      x: width * 0.03,
      y: lineRect.y + lineRect.height,
      width: width * 0.94,
      height: 78 * sy,
    };
    // CSS transform animations change getBoundingClientRect(), but not the
    // width the browser used to lay out the text. Wrap against the stable
    // authored width so entrance/fall motion cannot change the line count.
    const stableTextWidth = Math.min(width * 0.94, 1100 * layout.scaleX);
    const stableLineRect = {
      ...lineRect,
      x: (width - stableTextWidth) / 2,
      width: stableTextWidth,
    };
    const comboFamily = `"${this.fontFamily}", Impact, "Arial Black", sans-serif`;
    this.drawWrappedPlainText(ctx, line, stableLineRect, {
      size: 28 * sy,
      align: "center",
      weight: "400",
      family: comboFamily,
      color: bailed ? "#ff3b30" : "#ffe08a",
      shadow: bailed ? "#ff3b30" : "rgba(53,24,6,0.9)",
      alpha,
      lineHeight: 31 * sy,
    });
    this.drawPlainText(
      ctx,
      total,
      totalRect.x + totalRect.width / 2,
      totalRect.y + totalRect.height / 2,
      {
        size: 48 * sy,
        align: "center",
        weight: "400",
        family: comboFamily,
        color: bailed ? "#ff3b30" : "#ffb43a",
        shadow: bailed ? "#ff3b30" : "rgba(53,24,6,0.9)",
        alpha,
        maxWidth: stableTextWidth,
      },
    );
  }

  private paintBalance(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const explicit = frame.balance;
    if (explicit === null) return;
    let mode: "grind" | "manual" | null = explicit?.mode ?? null;
    if (!mode) {
      if (isLaidOut(this.elements.grindBalance)) mode = "grind";
      else if (isLaidOut(this.elements.manualBalance)) mode = "manual";
    }
    if (!mode) return;
    const sy = height / 720;
    const horizontal = mode === "grind";
    const trackEl = horizontal ? this.elements.grindBalance : this.elements.manualBalance;
    const needleEl = horizontal ? this.elements.grindNeedle : this.elements.manualNeedle;
    const track = this.rect(trackEl, layout) ?? (horizontal
      ? { x: width / 2 - 120 * sy, y: height * 0.76, width: 240 * sy, height: 14 * sy }
      : { x: width / 2 + 96 * sy, y: height * 0.72, width: 14 * sy, height: 132 * sy });
    this.drawBalanceTrack(ctx, track, horizontal);
    let needle = this.rect(needleEl, layout);
    if (!needle && explicit) {
      const value = Math.max(-1, Math.min(1, explicit.value));
      needle = horizontal
        ? {
            x: track.x + track.width * (0.5 + value * 0.46) - 4 * sy,
            y: track.y - 4 * sy,
            width: 8 * sy,
            height: 20 * sy,
          }
        : {
            x: track.x - 4 * sy,
            y: track.y + track.height * (0.5 + value * 0.44) - 4 * sy,
            width: 22 * sy,
            height: 8 * sy,
          };
    }
    if (!needle) return;
    const color = explicit
      ? explicit.critical
        ? "#ff2d1e"
        : Math.abs(explicit.value) > 0.7
          ? "#e2483d"
          : "#8fd4a8"
      : getComputedStyle(needleEl!).backgroundColor || "#8fd4a8";
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 5 * sy;
    roundRect(ctx, needle.x, needle.y, needle.width, needle.height, 4 * sy);
    ctx.fill();
    ctx.restore();
    this.mark();
  }

  private paintMessage(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const explicit = frame.message;
    const visible = explicit === null
      ? false
      : explicit
        ? explicit.visible !== false
        : isLaidOut(this.elements.message);
    if (!visible) return;
    const sy = height / 720;
    const title = explicit?.title ?? readRooHudText(this.elements.messageTitle);
    const sub = explicit?.sub ?? readRooHudText(this.elements.messageSub);
    const titleRect = this.rect(this.elements.messageTitle, layout) ?? {
      x: width * 0.03,
      y: height * 0.26,
      width: width * 0.94,
      height: 108 * sy,
    };
    this.drawRooInRect(ctx, title, titleRect, {
      size: 84 * sy,
      align: "center",
      tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.word, 84 * sy),
    });
    if (sub) {
      const subRect = this.rect(this.elements.messageSub, layout) ?? {
        x: width * 0.1,
        y: titleRect.y + titleRect.height + 6 * sy,
        width: width * 0.8,
        height: 28 * sy,
      };
      this.drawPlainText(ctx, sub, subRect.x + subRect.width / 2, subRect.y + subRect.height / 2, {
        size: 16 * sy,
        align: "center",
        color: "#cfe3d8",
        shadow: "rgba(0,0,0,0.85)",
      });
    }
  }

  private paintResults(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const explicit = frame.results;
    const visible = explicit === null
      ? false
      : explicit
        ? explicit.visible !== false
        : isLaidOut(this.elements.results);
    if (!visible) return;
    const sy = height / 720;
    const card = this.rect(this.elements.results, layout) ?? {
      x: width / 2 - 190 * sy,
      y: height / 2 - 150 * sy,
      width: 380 * sy,
      height: 300 * sy,
    };
    ctx.save();
    const panel = ctx.createLinearGradient(0, card.y, 0, card.y + card.height);
    panel.addColorStop(0, "rgba(26,30,44,0.94)");
    panel.addColorStop(1, "rgba(10,12,18,0.94)");
    ctx.fillStyle = panel;
    ctx.strokeStyle = "#3a4152";
    ctx.lineWidth = Math.max(1, sy);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 30 * sy;
    roundRect(ctx, card.x, card.y, card.width, card.height, 12 * sy);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.stroke();
    ctx.restore();
    this.mark();

    const title = explicit?.title ?? readRooHudText(this.elements.resultsTitle);
    const time = explicit?.time ?? readRooHudText(this.elements.resultsTime);
    const titleRect = this.rect(this.elements.resultsTitle, layout) ?? {
      x: card.x + 20 * sy,
      y: card.y + 14 * sy,
      width: card.width - 40 * sy,
      height: 54 * sy,
    };
    const timeRect = this.rect(this.elements.resultsTime, layout) ?? {
      x: card.x + 20 * sy,
      y: titleRect.y + titleRect.height,
      width: card.width - 40 * sy,
      height: 84 * sy,
    };
    this.drawRooInRect(ctx, title, titleRect, {
      size: 42 * sy,
      align: "center",
      palette: "bonus",
      tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.word, 42 * sy),
    });
    this.drawRooInRect(ctx, time, timeRect, {
      size: 66 * sy,
      align: "center",
      palette: "bonus",
      tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.largeNumber, 66 * sy),
    });

    if (explicit?.rows) {
      let y = timeRect.y + timeRect.height + 5 * sy;
      for (const row of explicit.rows.slice(0, 5)) {
        const rr = { x: card.x + 28 * sy, y, width: card.width - 56 * sy, height: 23 * sy };
        this.drawResultRow(ctx, rr, row.label, row.value, Boolean(row.isNew), sy);
        y += 24 * sy;
      }
    } else if (this.elements.resultsList) {
      const rows = Array.from(this.elements.resultsList.querySelectorAll<HTMLElement>(".hud-ttrow"));
      for (const row of rows) {
        const rr = this.rect(row, layout);
        if (!rr) continue;
        const spans = row.querySelectorAll("span");
        this.drawResultRow(
          ctx,
          rr,
          spans[0]?.textContent?.trim() ?? "",
          spans[1]?.textContent?.trim() ?? "",
          row.classList.contains("hud-ttrow-new"),
          sy,
        );
      }
    }
    const sub = explicit?.sub ?? readRooHudText(this.elements.resultsSub);
    if (sub) {
      const sr = this.rect(this.elements.resultsSub, layout) ?? {
        x: card.x + 10 * sy,
        y: card.y + card.height - 30 * sy,
        width: card.width - 20 * sy,
        height: 20 * sy,
      };
      this.drawPlainText(ctx, sub, sr.x + sr.width / 2, sr.y + sr.height / 2, {
        size: 12 * sy,
        align: "center",
        color: "#9fb0c8",
      });
    }
  }

  private paintDeath(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const explicit = frame.death;
    const visible = explicit === null
      ? false
      : explicit
        ? explicit.visible !== false
        : isLaidOut(this.elements.death);
    if (!visible) return;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    this.mark();
    const sy = height / 720;
    const title = explicit?.title ?? (readRooHudText(this.elements.deathTitle) || "GAME OVER");
    const sub = explicit?.sub ?? (readRooHudText(this.elements.deathSub) || "press any button");
    const titleRect = this.rect(this.elements.deathTitle, layout) ?? {
      x: width * 0.03,
      y: height / 2 - 78 * sy,
      width: width * 0.94,
      height: 134 * sy,
    };
    this.drawRooInRect(ctx, title, titleRect, {
      size: 104 * sy,
      align: "center",
      tracking: sourceTrackingPixels(SOURCE_HUD_TRACKING.word, 104 * sy),
    });
    const subRect = this.rect(this.elements.deathSub, layout) ?? {
      x: width * 0.1,
      y: titleRect.y + titleRect.height + 10 * sy,
      width: width * 0.8,
      height: 28 * sy,
    };
    this.drawPlainText(ctx, sub, subRect.x + subRect.width / 2, subRect.y + subRect.height / 2, {
      size: 16 * sy,
      align: "center",
      color: "#9fb0c8",
    });
  }

  private paintBadges(
    ctx: CanvasRenderingContext2D,
    layout: LayoutMap,
    width: number,
    height: number,
    frame: Readonly<GameHudFrameState>,
  ): void {
    const sy = height / 720;
    const badges: Array<{
      text: string;
      element?: HTMLElement;
      color: string;
      fallbackY: number;
    }> = [];
    const replayText = frame.replayBadge === undefined
      ? isLaidOut(this.elements.replayBadge)
        ? readRooHudText(this.elements.replayBadge)
        : ""
      : frame.replayBadge ?? "";
    if (replayText) badges.push({ text: replayText, element: this.elements.replayBadge, color: "#ffd75e", fallbackY: 10 * sy });
    const recordText = frame.recordBadge === undefined
      ? isLaidOut(this.elements.recordBadge)
        ? readRooHudText(this.elements.recordBadge)
        : ""
      : frame.recordBadge ?? "";
    if (recordText) badges.push({ text: recordText, element: this.elements.recordBadge, color: "#ff5e5e", fallbackY: 34 * sy });
    for (const badge of badges) {
      const measured = this.measurePlain(ctx, badge.text, 12 * sy, "bold");
      const rect = this.rect(badge.element, layout) ?? {
        x: width / 2 - measured / 2 - 10 * sy,
        y: badge.fallbackY,
        width: measured + 20 * sy,
        height: 24 * sy,
      };
      ctx.save();
      ctx.fillStyle = "rgba(20,24,34,0.75)";
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10 * sy);
      ctx.fill();
      ctx.restore();
      this.mark();
      this.drawPlainText(ctx, badge.text, rect.x + rect.width / 2, rect.y + rect.height / 2, {
        size: 12 * sy,
        align: "center",
        color: badge.color,
        weight: "bold",
      });
    }
  }

  private paintFlatEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    override: number | undefined,
    element: HTMLElement | undefined,
    color: string,
  ): void {
    const alpha = clamp01(override ?? elementOpacity(element));
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    this.mark();
  }

  private paintRelic(
    ctx: CanvasRenderingContext2D,
    element: HTMLElement | undefined,
    override: GameHudRelicState | undefined,
    rect: SurfaceRect,
    kind: "crystal" | "gem" | "comboGem",
  ): void {
    const state = override ?? relicState(element);
    // Earned relics are the real 3D meshes rendered immediately before this
    // surface. Only their unearned ghost belongs to Canvas2D.
    if (state !== "ghost") return;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#aeb4bb";
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    if (kind === "crystal") {
      ctx.moveTo(rect.x + rect.width * 0.5, rect.y);
      ctx.lineTo(rect.x + rect.width, rect.y + rect.height * 0.38);
      ctx.lineTo(rect.x + rect.width * 0.5, rect.y + rect.height);
      ctx.lineTo(rect.x, rect.y + rect.height * 0.38);
    } else {
      ctx.moveTo(rect.x + rect.width * 0.25, rect.y);
      ctx.lineTo(rect.x + rect.width * 0.75, rect.y);
      ctx.lineTo(rect.x + rect.width, rect.y + rect.height * 0.35);
      ctx.lineTo(rect.x + rect.width * 0.5, rect.y + rect.height);
      ctx.lineTo(rect.x, rect.y + rect.height * 0.35);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this.mark();
  }

  private drawRooInRect(
    ctx: CanvasRenderingContext2D,
    text: string,
    rect: SurfaceRect,
    style: RooStyle,
  ): void {
    if (!text || rect.width <= 0 || rect.height <= 0) return;
    const align = style.align ?? "left";
    const x = align === "center"
      ? rect.x + rect.width / 2
      : align === "right"
        ? rect.x + rect.width
        : rect.x;
    this.drawRooText(ctx, text, x, rect.y + rect.height / 2, {
      ...style,
      align,
      maxWidth: style.maxWidth ?? rect.width,
    });
  }

  private drawRooText(
    ctx: CanvasRenderingContext2D,
    rawText: string,
    x: number,
    y: number,
    style: RooStyle,
  ): void {
    const text = rawText.toUpperCase();
    if (!text) return;
    const palette = GAME_HUD_PALETTES[style.palette ?? "counter"];
    const tracking = style.tracking ?? Math.max(0, style.size * 0.025);
    const family = `"${this.fontFamily}", Impact, "Arial Black", sans-serif`;
    let size = Math.max(1, style.size);
    ctx.save();
    ctx.font = `400 ${size}px ${family}`;
    let positions = measureTracked(ctx, text, tracking);
    if (style.maxWidth && positions.width > style.maxWidth) {
      const ratio = style.maxWidth / positions.width;
      size *= ratio;
      ctx.font = `400 ${size}px ${family}`;
      positions = measureTracked(ctx, text, tracking * ratio);
    }
    let start = x;
    const align = style.align ?? "left";
    if (align === "center") start -= positions.width / 2;
    else if (align === "right") start -= positions.width;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = clamp01(style.alpha ?? 1);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = style.glow ?? palette.shadow;
    ctx.shadowBlur = style.glow ? size * 0.15 : size * 0.045;
    ctx.shadowOffsetY = size * 0.045;
    ctx.strokeStyle = palette.shade;
    ctx.lineWidth = Math.max(1, size * 0.035);
    for (const glyph of positions.glyphs) ctx.strokeText(glyph.char, start + glyph.x, y);

    const face = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    face.addColorStop(0, palette.top);
    face.addColorStop(0.48, palette.middle);
    face.addColorStop(1, palette.bottom);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = face;
    for (const glyph of positions.glyphs) ctx.fillText(glyph.char, start + glyph.x, y);

    // A fine lit rim is the cheap Canvas2D equivalent of Roo's clipped inner
    // SVG rim/bevel. At 720p it survives CRT filtering without becoming a keyline.
    ctx.globalAlpha *= 0.56;
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = Math.max(0.75, size * 0.012);
    ctx.shadowColor = "transparent";
    for (const glyph of positions.glyphs)
      ctx.strokeText(glyph.char, start + glyph.x, y - size * 0.008);
    ctx.restore();
    this.mark();
  }

  private drawPlainText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: PlainTextStyle,
  ): void {
    if (!text) return;
    ctx.save();
    ctx.font = `${style.weight ?? "normal"} ${Math.max(1, style.size)}px ${style.family ?? "ui-monospace, Menlo, Consolas, monospace"}`;
    ctx.textAlign = style.align;
    ctx.textBaseline = "middle";
    ctx.globalAlpha = clamp01(style.alpha ?? 1);
    ctx.fillStyle = style.color;
    if (style.shadow) {
      ctx.shadowColor = style.shadow;
      ctx.shadowBlur = Math.max(2, style.size * 0.25);
      ctx.shadowOffsetY = Math.max(1, style.size * 0.1);
    }
    if (style.maxWidth !== undefined) ctx.fillText(text, x, y, style.maxWidth);
    else ctx.fillText(text, x, y);
    ctx.restore();
    this.mark();
  }

  private drawWrappedPlainText(
    ctx: CanvasRenderingContext2D,
    text: string,
    rect: SurfaceRect,
    style: PlainTextStyle,
  ): void {
    if (!text || rect.width <= 0 || rect.height <= 0) return;
    const family = style.family ?? "ui-monospace, Menlo, Consolas, monospace";
    const weight = style.weight ?? "normal";
    ctx.save();
    ctx.font = `${weight} ${Math.max(1, style.size)}px ${family}`;
    const lines = wrapComboLabelLine(
      text,
      rect.width,
      (value) => ctx.measureText(value).width,
    );
    ctx.restore();
    if (lines.length === 0) return;

    const preferredLineHeight = style.lineHeight ?? style.size * 1.08;
    const lineHeight = Math.min(preferredLineHeight, rect.height / lines.length);
    const fittedSize = Math.min(style.size, lineHeight / 1.08);
    const centerY = rect.y + rect.height / 2;
    for (let i = 0; i < lines.length; i++) {
      this.drawPlainText(
        ctx,
        lines[i],
        rect.x + rect.width / 2,
        centerY + (i - (lines.length - 1) / 2) * lineHeight,
        {
          ...style,
          size: fittedSize,
          align: "center",
          maxWidth: rect.width,
        },
      );
    }
  }

  private drawLifeFace(
    ctx: CanvasRenderingContext2D,
    rect: SurfaceRect,
    deathsMode: boolean,
  ): void {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = Math.max(3, rect.height * 0.06);
    ctx.shadowOffsetY = Math.max(2, rect.height * 0.035);
    if (deathsMode) ctx.filter = "grayscale(0.35) saturate(1.3)";
    if (this.lifeFaceReady && this.lifeFace) {
      drawImageContain(ctx, this.lifeFace, rect);
    } else {
      this.drawLifeFallback(ctx, rect);
    }
    ctx.restore();
    this.mark();
  }

  private drawLifeFallback(ctx: CanvasRenderingContext2D, rect: SurfaceRect): void {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height * 0.55;
    const r = Math.min(rect.width, rect.height) * 0.35;
    ctx.fillStyle = "#f28a18";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.75, cy - r * 0.55);
    ctx.lineTo(cx - r * 0.95, cy - r * 1.25);
    ctx.lineTo(cx - r * 0.25, cy - r * 0.78);
    ctx.lineTo(cx + r * 0.25, cy - r * 0.78);
    ctx.lineTo(cx + r * 0.95, cy - r * 1.25);
    ctx.lineTo(cx + r * 0.75, cy - r * 0.55);
    ctx.arc(cx, cy, r, -0.8, Math.PI * 1.8);
    ctx.fill();
    ctx.fillStyle = "#43230e";
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.12, r * 0.09, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.35, cy - r * 0.12, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCrateFallback(
    ctx: CanvasRenderingContext2D,
    rect: SurfaceRect,
    time: number,
  ): void {
    const s = Math.min(rect.width, rect.height) * 0.72;
    const x = rect.x + (rect.width - s) / 2;
    const y = rect.y + (rect.height - s) / 2 + Math.sin(time * 0.0011) * rect.height * 0.025;
    ctx.save();
    ctx.fillStyle = "#bd6b22";
    ctx.strokeStyle = "#582b0d";
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.fillRect(x, y, s, s);
    ctx.strokeRect(x, y, s, s);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.stroke();
    ctx.restore();
    this.mark();
  }

  private drawFruitFallback(
    ctx: CanvasRenderingContext2D,
    rect: SurfaceRect,
    time: number,
  ): void {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2 + Math.sin(time * 0.0013) * rect.height * 0.025;
    const r = Math.min(rect.width, rect.height) * 0.3;
    ctx.save();
    const gradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    gradient.addColorStop(0, "#fff76a");
    gradient.addColorStop(0.42, "#f89a21");
    gradient.addColorStop(1, "#b52b17");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.78, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4c9c2f";
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.8);
    ctx.quadraticCurveTo(cx + r * 0.35, cy - r * 1.3, cx + r * 0.7, cy - r * 1.05);
    ctx.stroke();
    ctx.restore();
    this.mark();
  }

  private drawBalanceTrack(
    ctx: CanvasRenderingContext2D,
    rect: SurfaceRect,
    horizontal: boolean,
  ): void {
    ctx.save();
    const gradient = horizontal
      ? ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.height)
      : ctx.createLinearGradient(rect.x, 0, rect.x + rect.width, 0);
    gradient.addColorStop(0, "rgba(8,10,15,0.90)");
    gradient.addColorStop(1, "rgba(26,30,44,0.90)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#3a4152";
    ctx.lineWidth = 1;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, Math.min(rect.width, rect.height) / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5a6478";
    if (horizontal) ctx.fillRect(rect.x + rect.width / 2 - 1, rect.y + 2, 2, Math.max(0, rect.height - 4));
    else {
      ctx.fillRect(rect.x + 2, rect.y + rect.height / 2 - 1, Math.max(0, rect.width - 4), 2);
      ctx.fillStyle = "#454e62";
      ctx.fillRect(rect.x + 4, rect.y + 2, Math.max(0, rect.width - 8), 2);
      ctx.fillRect(rect.x + 4, rect.y + rect.height - 4, Math.max(0, rect.width - 8), 2);
    }
    ctx.restore();
    this.mark();
  }

  private drawResultRow(
    ctx: CanvasRenderingContext2D,
    rect: SurfaceRect,
    label: string,
    value: string,
    isNew: boolean,
    scale: number,
  ): void {
    if (isNew) {
      ctx.save();
      ctx.fillStyle = "#2b4436";
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 4 * scale);
      ctx.fill();
      ctx.restore();
      this.mark();
    }
    const color = isNew ? "#b6f0cc" : "#9fb0c8";
    this.drawPlainText(ctx, label, rect.x + 6 * scale, rect.y + rect.height / 2, {
      size: 14 * scale,
      align: "left",
      color,
    });
    this.drawPlainText(ctx, value, rect.x + rect.width - 6 * scale, rect.y + rect.height / 2, {
      size: 14 * scale,
      align: "right",
      color,
    });
  }

  private measurePlain(
    ctx: CanvasRenderingContext2D,
    text: string,
    size: number,
    weight = "normal",
  ): number {
    ctx.save();
    ctx.font = `${weight} ${size}px ui-monospace, Menlo, Consolas, monospace`;
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }

  private rect(element: HTMLElement | undefined, layout: LayoutMap): SurfaceRect | null {
    if (!element || !isLaidOut(element)) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: (rect.left - layout.originX) * layout.scaleX,
      y: (rect.top - layout.originY) * layout.scaleY,
      width: rect.width * layout.scaleX,
      height: rect.height * layout.scaleY,
    };
  }

  private layout(width: number, height: number): LayoutMap {
    const viewport = this.elements.viewport;
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const sourceWidth = Math.max(1, rect.width || viewport.clientWidth);
      const sourceHeight = Math.max(1, rect.height || viewport.clientHeight);
      return {
        sourceWidth,
        sourceHeight,
        originX: rect.left,
        originY: rect.top,
        scaleX: width / sourceWidth,
        scaleY: height / sourceHeight,
      };
    }
    const sourceWidth = Math.max(1, window.innerWidth || width);
    const sourceHeight = Math.max(1, window.innerHeight || height);
    return {
      sourceWidth,
      sourceHeight,
      originX: 0,
      originY: 0,
      scaleX: width / sourceWidth,
      scaleY: height / sourceHeight,
    };
  }

  private ensureSize(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) return;
    // WebGL2 allocates CanvasTexture storage immutably. Changing only the
    // canvas dimensions leaves the old portrait allocation alive, so the next
    // texSubImage upload is stretched across landscape after rotation. Dispose
    // the GPU allocation first; the same Texture object/material binding is
    // lazily recreated at the new dimensions on the next upload.
    this.texture.dispose();
    this.canvas.width = width;
    this.canvas.height = height;
    this.texture.needsUpdate = true;
    this.textureReallocations++;
  }

  private loadLifeFace(url: string): void {
    if (!url || typeof Image === "undefined") return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (this.disposed) return;
      this.lifeFaceReady = image.naturalWidth > 0 && image.naturalHeight > 0;
    };
    image.onerror = () => {
      this.lifeFaceReady = false;
    };
    image.src = url;
    this.lifeFace = image;
  }

  private mark(): void {
    this.primitiveCount++;
  }

  private assertLive(): void {
    if (this.disposed) throw new Error("GameHudSurface used after dispose()");
  }
}

function resolveCounter(
  override: GameHudCounterState | null | undefined,
  element: HTMLElement | undefined,
): GameHudCounterState | null {
  if (override === null) return null;
  if (override) return override.visible === false ? null : override;
  if (!isLaidOut(element) || ownVisibilityHidden(element)) return null;
  const value = readRooHudText(element);
  return value ? { value } : null;
}

function resolveClock(
  override: GameHudClockState | null | undefined,
  clockElement: HTMLElement | undefined,
  valueElement: HTMLElement | undefined,
  freezeElement: HTMLElement | undefined,
): GameHudClockState | null {
  if (override === null) return null;
  if (override) return override.visible === false ? null : override;
  if (!isLaidOut(clockElement)) return null;
  const value = readRooHudText(valueElement);
  if (!value) return null;
  const freeze = ownVisibilityHidden(freezeElement) ? "" : readRooHudText(freezeElement);
  return {
    value,
    freeze,
    frozen: clockElement?.classList.contains("hud-tt-frozen") ?? false,
  };
}

function relicState(element: HTMLElement | undefined): GameHudRelicState {
  if (!element || !isLaidOut(element)) return "hidden";
  if (element.classList.contains("hud-relic-off")) return "ghost";
  if (ownVisibilityHidden(element)) return "earned";
  return "earned";
}

function isLaidOut(element: HTMLElement | undefined): boolean {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  // Deliberately ignore CSS visibility/opacity: UI hides its live DOM copy
  // while compositing, but visibility:hidden retains the authoritative layout.
  return rect.width > 0.5 && rect.height > 0.5;
}

function ownVisibilityHidden(element: HTMLElement | undefined): boolean {
  return element?.style.visibility === "hidden";
}

function elementOpacity(element: HTMLElement | undefined, fallback = 0): number {
  if (!element || !element.isConnected) return fallback;
  const raw = Number.parseFloat(getComputedStyle(element).opacity);
  return Number.isFinite(raw) ? raw : fallback;
}

function parseConicBackground(value: string): {
  fraction: number;
  under: string;
  over: string;
} | null {
  const gradient = value.match(
    /^conic-gradient\((#[0-9a-fA-F]{3,8}) 0turn ([0-9.]+)turn, (.+) [0-9.]+turn 1turn\)$/,
  );
  if (gradient) {
    return {
      over: gradient[1],
      fraction: clamp01(Number.parseFloat(gradient[2])),
      under: gradient[3],
    };
  }
  const solid = value.match(/^(#[0-9a-fA-F]{3,8}|rgba?\(.+\))$/);
  return solid ? { fraction: 0, under: solid[1], over: solid[1] } : null;
}

function measureTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): { width: number; glyphs: Array<{ char: string; x: number }> } {
  const glyphs: Array<{ char: string; x: number }> = [];
  let x = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    glyphs.push({ char, x });
    x += ctx.measureText(char).width;
    if (i < text.length - 1) x += tracking;
  }
  return { width: x, glyphs };
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  rect: SurfaceRect,
): void {
  const sourceWidth = image.width || 1;
  const sourceHeight = image.height || 1;
  const scale = Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  ctx.drawImage(
    image,
    rect.x + (rect.width - width) / 2,
    rect.y + (rect.height - height) / 2,
    width,
    height,
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function validDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
