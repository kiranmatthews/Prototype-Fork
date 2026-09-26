// Explicit Canvas-native mirrors of map and touch UI. Semantic DOM keeps
// layout, accessibility and hit areas; only its ink moves beneath CRT.
import * as THREE from "three";
import { GameHudSurface } from "./gameHudSurface";
import { paintSilverSecondaryText } from "./secondaryText";
import { paintInputPrompts, sampleInputPrompts } from "./inputPromptUI";
import { secondaryTextSettings } from "./secondaryTextSettings";
import type { CompetitionPresentation } from "./competition/presentation";

// The black transition curtain is compositor-owned. Copying it into this
// texture froze its opacity whenever the world stopped rendering.
const INK = ".world-map-ui, .tc-zone, .tc-pause, .game-cartoon-cursor, .input-glyph, .input-prompt-row, .competition-host";

// Include only semantic nodes whose ink the painters below actually read.
// Layout/style values are sampled every rendered frame: CSS transitions and
// hover/focus never wait for a mutation observer or a lower-rate UI clock.
const PAINT_NODES = ".world-map-ui, .world-map-level-card, .world-map-enter-touch, .world-map-action, .world-map-action .secondary-silver, .world-map-action > span, .world-map-action kbd, .tc-zone, .tc-pad, .tc-btn, .tc-pause, .tc-arrow, .tc-pause span, .game-cartoon-cursor";
const PAINT_STYLES = [
  'display', 'opacity', 'backgroundColor', 'borderTopWidth', 'borderTopColor',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  'fontWeight', 'fontSize', 'fontFamily', 'textAlign', 'justifyContent', 'paddingLeft', 'paddingRight',
  'letterSpacing', 'color', 'webkitTextStrokeWidth', 'webkitTextStrokeColor', 'textOverflow',
] as const;
type PaintInput = string | number | boolean;
interface ElementPaintMeasurement { rect: DOMRect; style: CSSStyleDeclaration; }

export class GameInterfaceSurface {
  private surface: GameHudSurface | null = null;
  private composited = false;
  private cursorDrawn = false;
  private paintInputs: readonly PaintInput[] | null = null;
  private cachedCursorDrawn = false;
  private paintRevision = 0;
  private readonly measurements = new Map<HTMLElement, ElementPaintMeasurement>();
  private observedRenderer: THREE.WebGLRenderer | null = null;
  private readonly invalidate = (): void => { this.paintRevision++; };
  constructor(private competition?: CompetitionPresentation) {
    const style = document.createElement("style");
    // Filter opacity preserves source CSS opacity (including fades), layout,
    // pointer capture and hit testing. Never hide via display/visibility here.
    style.textContent = INK.split(", ").filter(selector=>selector!=='.competition-host').map(selector => `body.game-interface-composited ${selector}`).join(",") + " { filter:opacity(0) !important; }" +
      // The fullscreen competition root has no authored opacity animation.
      // Zero opacity preserves input/layout and allows the browser to skip
      // painting it entirely; a CSS filter can allocate an offscreen surface.
      "body.game-interface-composited .competition-host { opacity:0 !important; filter:none !important; }" +
      // This DOM ink is already invisible and mirrored into WebGL. Leaving
      // nine frosted-glass backdrops active still asks the browser to blur the
      // moving canvas at native device resolution, even when the game is 540p.
      "body.game-interface-composited :is(.tc-arrow,.tc-btn,.tc-pause) { -webkit-backdrop-filter:none !important; backdrop-filter:none !important; }";
    document.head.appendChild(style);
    secondaryTextSettings.subscribe(this.invalidate);
    document.fonts?.addEventListener('loadingdone', this.invalidate);
    document.fonts?.addEventListener('loadingerror', this.invalidate);
  }
  setComposited(value: boolean): void {
    if (this.composited !== value) this.invalidate();
    this.composited = value;
    document.body.classList.toggle("game-interface-composited", value);
    this.competition?.setComposited(value);
  }
  get diagnostics() { return { composited: this.composited, cursorDrawn: this.cursorDrawn, competition: this.competition?.diagnostics ?? null, surface: this.surface?.diagnostics ?? null }; }
  draw(renderer: THREE.WebGLRenderer, size: { width: number; height: number }, target: THREE.WebGLRenderTarget | null): void {
    this.drawShared(renderer,size,target);
    this.competition?.draw(renderer,size,target);
  }
  private drawShared(renderer: THREE.WebGLRenderer, size: { width: number; height: number }, target: THREE.WebGLRenderTarget | null): void {
    this.cursorDrawn = false;
    this.measurements.clear();
    if (this.observedRenderer !== renderer) {
      this.observedRenderer?.domElement.removeEventListener('webglcontextrestored', this.invalidate);
      this.observedRenderer = renderer;
      renderer.domElement.addEventListener('webglcontextrestored', this.invalidate);
      this.invalidate();
    }
    // Ordinary desktop gameplay has no map/touch/cursor ink. Do not upload
    // another full-screen transparent texture just to draw nothing.
    const visible=[...document.querySelectorAll(INK)].filter(element=>!element.closest('.competition-host')&&this.visible(element));
    if(!visible.length){this.paintInputs=null;return;}
    this.surface ??= new GameHudSurface();
    // A null render target is expressed in CSS pixels by Three.js, while its
    // drawing buffer is physical pixels. Match GameFlowSurface's direct-path
    // contract so prompt icons do not become the menu's lone 1x layer on a
    // Retina display.
    const pixelRatio = target === null ? renderer.getPixelRatio() : 1;
    const raster = {
      width: Math.max(1, Math.round(size.width * pixelRatio)),
      height: Math.max(1, Math.round(size.height * pixelRatio)),
    };
    const prompts = sampleInputPrompts(document, '.competition-host');
    const inputs: PaintInput[] = [raster.width, raster.height, window.innerWidth, window.innerHeight, this.paintRevision];
    for (const element of document.querySelectorAll<HTMLElement>(PAINT_NODES)) {
      const { rect, style } = this.measure(element);
      inputs.push(element.tagName, element.className, rect.x, rect.y, rect.width, rect.height, element.textContent ?? '', element.firstChild?.textContent ?? '',
        element.matches(':hover'), element.matches(':focus-visible'));
      for (const property of PAINT_STYLES) inputs.push(style[property]);
    }
    inputs.push(...prompts.inputs);
    if (this.paintInputs && inputs.length === this.paintInputs.length && inputs.every((value, index) => value === this.paintInputs![index])) {
      this.cursorDrawn = this.cachedCursorDrawn;
      this.surface.composite(renderer, size, target);
      return;
    }
    const drawn = this.surface.draw(raster, { drawExtra: ctx => {
      this.cursorDrawn = false;
      ctx.scale(raster.width / window.innerWidth, raster.height / window.innerHeight);
      this.paintMap(ctx); this.paintTouch(ctx);
      paintInputPrompts(ctx,document,'.competition-host',prompts); this.paintCursor(ctx);
    } });
    this.paintInputs = inputs;
    this.cachedCursorDrawn = this.cursorDrawn;
    if (drawn) this.surface.composite(renderer, size, target);
  }

  private measure(element: HTMLElement): ElementPaintMeasurement {
    let measurement = this.measurements.get(element);
    if (!measurement) {
      measurement = { rect: element.getBoundingClientRect(), style: getComputedStyle(element) };
      this.measurements.set(element, measurement);
    }
    return measurement;
  }
  private visible(element: Element | null): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false;
    const { rect, style } = this.measure(element);
    return rect.width > .5 && rect.height > .5 && style.display !== "none" && Number(style.opacity) > .001;
  }
  private box(ctx: CanvasRenderingContext2D, element: HTMLElement, fill?: string | CanvasGradient): void {
    const { rect, style } = this.measure(element);
    ctx.save(); ctx.globalAlpha *= Number(style.opacity);
    const radii = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(value => Math.min(parseFloat(value) || 0, rect.height / 2));
    ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radii);
    ctx.fillStyle = fill ?? style.backgroundColor; ctx.fill();
    const border = parseFloat(style.borderTopWidth);
    if (border > 0) { ctx.strokeStyle = style.borderTopColor; ctx.lineWidth = border; ctx.stroke(); }
    ctx.restore();
  }
  private text(ctx: CanvasRenderingContext2D, element: HTMLElement, override?: string): void {
    if (!this.visible(element)) return;
    const { rect, style } = this.measure(element);
    let text = override ?? element.textContent ?? "";
    if (!text.trim()) return;
    ctx.save(); ctx.globalAlpha *= Number(style.opacity);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    const padding = parseFloat(style.paddingLeft) || 0;
    const available = Math.max(1, rect.width - padding - (parseFloat(style.paddingRight) || 0));
    const centered = style.textAlign === "center" || style.justifyContent === "center";
    const tx = centered ? rect.x + rect.width / 2 : rect.x + padding;
    if (centered) ctx.textAlign = "center";
    if ("letterSpacing" in ctx) ctx.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
    if (style.textOverflow === "ellipsis" && ctx.measureText(text).width > rect.width) {
      while (text && ctx.measureText(text + "…").width > rect.width) text = text.slice(0,-1);
      text += "…";
    }
    ctx.fillStyle = style.color;
    const stroke = parseFloat(style.webkitTextStrokeWidth);
    if (stroke > 0) { ctx.strokeStyle=style.webkitTextStrokeColor; ctx.lineWidth=stroke; ctx.lineJoin="round"; ctx.strokeText(text,tx,rect.y+rect.height/2,available); }
    ctx.fillText(text, tx, rect.y + rect.height / 2, available);
    ctx.restore();
  }
  private paintMap(ctx: CanvasRenderingContext2D): void {
    const root = document.querySelector(".world-map-ui");
    if (!this.visible(root)) return;
    const card = root.querySelector<HTMLElement>(".world-map-level-card");
    if (card && this.visible(card)) {
      // Deck printing, trophies and trial records are real scene geometry,
      // already drawn at the same pre-CRT seam. Only the touch hit target has
      // a Canvas-native ink mirror here.
      const enter = card.querySelector<HTMLElement>(".world-map-enter-touch");
      if (this.visible(enter)) {
        this.box(ctx,enter);
        this.text(ctx,enter);
      }
    }
    for (const button of root.querySelectorAll<HTMLElement>(".world-map-action")) {
      if (!this.visible(button)) continue;
      const label = button.querySelector<HTMLElement>(".secondary-silver");
      if (this.visible(label)) {
        const { rect: r, style } = this.measure(label);
        ctx.save();
        if (button.matches(":hover")) ctx.filter = "brightness(1.2)";
        paintSilverSecondaryText(ctx,label.firstChild?.textContent ?? "",r.x,r.y,parseFloat(style.fontSize));
        ctx.restore();
      }
      for (const element of button.querySelectorAll<HTMLElement>(":scope > span, kbd")) {
        if (element.classList.contains("input-glyph")) continue;
        if (!this.visible(element)) continue;
        if (element.tagName === "KBD") this.box(ctx,element);
        this.text(ctx,element);
      }
      if (button.matches(":focus-visible")) {
        const { rect: r } = this.measure(button); ctx.save(); ctx.strokeStyle="#e8f0f4"; ctx.lineWidth=2; ctx.strokeRect(r.x-4,r.y-4,r.width+8,r.height+8); ctx.restore();
      }
    }
  }
  private paintTouch(ctx: CanvasRenderingContext2D): void {
    for (const pad of document.querySelectorAll<HTMLElement>(".tc-pad, .tc-btn, .tc-pause")) {
      const zone = pad.closest(".tc-zone");
      if (!this.visible(pad) || (zone && !this.visible(zone))) continue;
      this.box(ctx,pad);
      if (pad.matches(".tc-pad")) {
        for (const arrow of pad.querySelectorAll<HTMLElement>(".tc-arrow")) { this.box(ctx,arrow); this.text(ctx,arrow); }
      } else if (pad.matches(".tc-pause")) {
        for (const bar of pad.querySelectorAll<HTMLElement>("span")) this.box(ctx,bar);
      } else this.text(ctx,pad);
    }
  }
  private paintCursor(ctx: CanvasRenderingContext2D): void {
    const cursor = document.querySelector(".game-cartoon-cursor");
    if (!this.visible(cursor)) return;
    this.cursorDrawn = true;
    const { rect: r, style } = this.measure(cursor);
    ctx.save(); ctx.globalAlpha *= Number(style.opacity); ctx.translate(r.x,r.y); ctx.scale(r.width/54,r.height/64); ctx.lineJoin="round";
    const path = new Path2D("M6 4 47 35 29 39 39 57 29 62 19 43 7 55Z");
    ctx.fillStyle="#ff8c22"; ctx.strokeStyle="#47190c"; ctx.lineWidth=5; ctx.stroke(path); ctx.fill(path);
    ctx.fillStyle="#ffd846"; ctx.fill(new Path2D("M11 12 37 33 24 35 31 49 27 51 18 36 11 44Z")); ctx.restore();
  }
}
