// Explicit Canvas-native mirrors of map and touch UI. Semantic DOM keeps
// layout, accessibility and hit areas; only its ink moves beneath CRT.
import * as THREE from "three";
import { GameHudSurface } from "./gameHudSurface";
import { paintSilverSecondaryText } from "./secondaryText";
import { paintInputPrompts } from "./inputPromptUI";

const INK = ".world-map-ui, .tc-zone, .tc-pause, .game-cartoon-cursor, .game-transition-curtain, .input-glyph, .input-prompt-row";

export class GameInterfaceSurface {
  private surface: GameHudSurface | null = null;
  private composited = false;
  private cursorDrawn = false;
  constructor() {
    const style = document.createElement("style");
    // Filter opacity preserves source CSS opacity (including fades), layout,
    // pointer capture and hit testing. Never hide via display/visibility here.
    style.textContent = INK.split(", ").map(selector => `body.game-interface-composited ${selector}`).join(",") + " { filter:opacity(0) !important; }";
    document.head.appendChild(style);
  }
  setComposited(value: boolean): void {
    this.composited = value;
    document.body.classList.toggle("game-interface-composited", value);
  }
  get diagnostics() { return { composited: this.composited, cursorDrawn: this.cursorDrawn, surface: this.surface?.diagnostics ?? null }; }
  draw(renderer: THREE.WebGLRenderer, size: { width: number; height: number }, target: THREE.WebGLRenderTarget | null): void {
    this.cursorDrawn = false;
    // Ordinary desktop gameplay has no map/touch/cursor ink. Do not upload
    // another full-screen transparent texture just to draw nothing.
    if (![...document.querySelectorAll(INK)].some(element => this.visible(element))) return;
    this.surface ??= new GameHudSurface();
    this.surface.render(renderer, size, { drawExtra: ctx => {
      this.cursorDrawn = false;
      ctx.scale(size.width / window.innerWidth, size.height / window.innerHeight);
      this.paintMap(ctx); this.paintTouch(ctx); paintInputPrompts(ctx); this.paintCursor(ctx); this.paintCurtain(ctx);
    } }, target);
  }

  private visible(element: Element | null): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    return rect.width > .5 && rect.height > .5 && style.display !== "none" && Number(style.opacity) > .001;
  }
  private box(ctx: CanvasRenderingContext2D, element: HTMLElement, fill?: string | CanvasGradient): void {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
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
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
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
      const rect = card.getBoundingClientRect();
      const fill = ctx.createLinearGradient(rect.x,rect.y,rect.right,rect.bottom);
      fill.addColorStop(0,"rgba(69,78,54,.94)"); fill.addColorStop(1,"rgba(24,55,57,.93)");
      this.box(ctx, card, fill);
      for (const element of card.querySelectorAll<HTMLElement>(".world-map-level-eyebrow, .world-map-level-name, .world-map-level-status, .world-map-collectible b, .world-map-collectible small, .world-map-trial span, .world-map-trial strong, .world-map-trial small")) this.text(ctx,element);
      const enter = card.querySelector<HTMLElement>(".world-map-enter-touch");
      if (this.visible(enter)) {
        this.box(ctx,enter);
        const r = enter.getBoundingClientRect(), style = getComputedStyle(enter);
        ctx.save(); ctx.globalAlpha *= Number(style.opacity); ctx.translate(r.x+9,r.y+9); ctx.scale((r.width-18)/32,(r.height-18)/32);
        ctx.strokeStyle = style.color; ctx.lineWidth = 3.5; ctx.lineCap = ctx.lineJoin = "round";
        ctx.stroke(new Path2D("M5 16h21M18 7l9 9-9 9")); ctx.restore();
      }
    }
    for (const button of root.querySelectorAll<HTMLElement>(".world-map-action")) {
      if (!this.visible(button)) continue;
      const label = button.querySelector<HTMLElement>(".secondary-silver");
      if (this.visible(label)) {
        const r = label.getBoundingClientRect();
        ctx.save();
        if (button.matches(":hover")) ctx.filter = "brightness(1.2)";
        paintSilverSecondaryText(ctx,label.firstChild?.textContent ?? "",r.x,r.y,parseFloat(getComputedStyle(label).fontSize));
        ctx.restore();
      }
      for (const element of button.querySelectorAll<HTMLElement>(":scope > span, kbd")) {
        if (element.classList.contains("input-glyph")) continue;
        if (!this.visible(element)) continue;
        if (element.tagName === "KBD") this.box(ctx,element);
        this.text(ctx,element);
      }
      if (button.matches(":focus-visible")) {
        const r = button.getBoundingClientRect(); ctx.save(); ctx.strokeStyle="#e8f0f4"; ctx.lineWidth=2; ctx.strokeRect(r.x-4,r.y-4,r.width+8,r.height+8); ctx.restore();
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
    const r = cursor.getBoundingClientRect();
    ctx.save(); ctx.globalAlpha *= Number(getComputedStyle(cursor).opacity); ctx.translate(r.x,r.y); ctx.scale(r.width/54,r.height/64); ctx.lineJoin="round";
    const path = new Path2D("M6 4 47 35 29 39 39 57 29 62 19 43 7 55Z");
    ctx.fillStyle="#ff8c22"; ctx.strokeStyle="#47190c"; ctx.lineWidth=5; ctx.stroke(path); ctx.fill(path);
    ctx.fillStyle="#ffd846"; ctx.fill(new Path2D("M11 12 37 33 24 35 31 49 27 51 18 36 11 44Z")); ctx.restore();
  }
  private paintCurtain(ctx: CanvasRenderingContext2D): void {
    const curtain = document.querySelector(".game-transition-curtain");
    if (this.visible(curtain)) this.box(ctx,curtain);
  }
}
