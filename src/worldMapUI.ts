import { silverSecondaryLabel } from "./secondaryText";
import { createSecondaryTextPanel } from "./secondaryTextPanel";
import { createInputGlyph } from "./inputPromptUI";
import type { InputAction } from "./inputBindings";
import type * as THREE from "three";
import { MapLevelPresentation, mapTrialTime } from "./mapLevelPresentation";
import {
  CAMPAIGN_LEVELS,
  campaignLevelByKey,
  type CampaignStore,
} from "./campaign";
import type {
  WorldMapDirections,
  WorldMapSection,
} from "./worldMapController";

export interface WorldMapUICallbacks {
  onMapTap: (clientX: number, clientY: number) => void;
  onEnter: () => void;
  onOpenSection: (section: WorldMapSection) => void;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

export class WorldMapUI {
  private readonly root = node("section", "world-map-ui");
  private readonly levelCard = node("div", "world-map-level-card");
  private readonly levelName = node("h1", "world-map-level-name");
  private readonly trial = node("div", "world-map-trial");
  private readonly collectibleRow = node("div", "world-map-collectibles");
  private readonly enterButton = node("button", "world-map-enter-touch");
  private selectedKey = "jungle";
  private moving = false;
  private presentation: MapLevelPresentation | null = null;

  constructor(
    private readonly campaign: CampaignStore,
    private readonly callbacks: WorldMapUICallbacks,
  ) {
    this.root.setAttribute("aria-label", "Island world map");
    this.root.hidden = true;

    const titleCopy = node("div", "world-map-semantic");
    titleCopy.append(this.levelName, this.collectibleRow);
    this.collectibleRow.setAttribute("aria-label", "Level collectibles");
    this.enterButton.type = "button";
    this.enterButton.setAttribute("aria-label", "Enter selected level");
    this.enterButton.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 16h21M18 7l9 9-9 9"/></svg>';
    this.enterButton.addEventListener("click", () => { if (!this.moving && !this.enterButton.disabled) this.callbacks.onEnter(); });
    this.levelCard.append(titleCopy, this.enterButton);
    this.trial.setAttribute("aria-label", "Time trial records");

    const actionBar = node("nav", "world-map-actions");
    actionBar.setAttribute("aria-label", "World map actions");
    actionBar.append(
      this.actionButton("mapProgress", "VIEW PROGRESS", "progress"),
      this.actionButton("mapOptions", "OPTIONS", "options"),
      this.actionButton("mapSaveLoad", "SAVE / LOAD", "save-load"),
      this.actionButton("mapQuit", "QUIT GAME", "quit"),
    );

    this.root.append(this.createTouchSurface(), this.levelCard, this.trial, actionBar);
    document.body.appendChild(this.root);
    this.injectStyle();
    createSecondaryTextPanel();
    (window as unknown as Record<string, unknown>).__worldMapUI = this;
  }

  show(progressKey: string, moving = false): void {
    this.selectedKey = progressKey;
    this.moving = moving;
    this.root.hidden = false;
    document.body.classList.add("world-map-active");
    this.render(true);
  }

  hide(): void {
    this.root.hidden = true;
    document.body.classList.remove("world-map-active");
  }

  setSelection(
    progressKey: string,
    moving: boolean,
    _directions?: WorldMapDirections,
  ): void {
    this.selectedKey = progressKey;
    this.moving = moving;
    if (!this.root.hidden) this.render();
  }

  get presentationDiagnostics() { return this.presentation?.diagnostics ?? null; }

  draw(renderer: THREE.WebGLRenderer, dt: number, size?: { width: number; height: number }, target?: THREE.WebGLRenderTarget | null): void {
    if (this.root.hidden || document.body.classList.contains("game-shell-modal") || document.body.classList.contains("game-shell-transitioning")) return;
    this.presentation?.draw(renderer, dt, size, target);
  }

  private render(immediate = false): void {
    const definition = campaignLevelByKey(this.selectedKey) ?? CAMPAIGN_LEVELS[0];
    const progress = this.campaign.levelProgress(definition.levelId);
    const unlocked = this.campaign.levelUnlocked(definition.progressKey);
    this.enterButton.disabled = this.moving || !unlocked;
    this.enterButton.setAttribute("aria-label", `Enter ${definition.name}`);
    this.root.dataset.selectedKey = definition.progressKey;
    this.root.classList.toggle("is-moving", this.moving);
    this.root.classList.toggle("is-locked", !unlocked);
    this.root.classList.toggle("is-boss", definition.boss === true);
    this.levelName.textContent = definition.name.toUpperCase();
    const rewards = [
      ["CRYSTAL", progress?.crystal === true],
      ["BOX GEM", progress?.boxGem === true],
      ["COMBO GEM", progress?.comboGem === true],
      ["TIME RELIC", progress?.timeRelic === true],
    ] as const;
    this.collectibleRow.replaceChildren();
    for (const [label, earned] of rewards) {
      const reward = node("span", `world-map-collectible${earned ? " earned" : ""}`);
      reward.setAttribute("aria-label", `${label}: ${earned ? "collected" : "missing"}`);
      reward.textContent = `${label}: ${earned ? "collected" : "missing"}`;
      this.collectibleRow.appendChild(reward);
    }

    const trialUnlocked = this.campaign.runModesUnlocked(definition.levelId);
    const times = progress?.trialTimes ?? (progress?.bestTime ? [progress.bestTime] : []);
    this.trial.setAttribute("aria-hidden", String(!trialUnlocked));
    this.trial.replaceChildren();
    if (trialUnlocked) {
      const records = node("div", "world-map-semantic");
      records.textContent = `Time trial. Personal bests: ${[0, 1, 2].map(i => `${i + 1}: ${mapTrialTime(times[i])}`).join(", ")}. Time to beat: ${mapTrialTime(definition.relicTime)}`;
      this.trial.append(records);
    }
    this.presentation ??= new MapLevelPresentation(this.levelCard, this.trial);
    this.presentation.select({ key: definition.progressKey, name: definition.name,
      earned: rewards.map(([, earned]) => earned), trialUnlocked, times: [...times], target: definition.relicTime }, immediate);
  }

  private actionButton(
    action: InputAction,
    label: string,
    section: WorldMapSection,
  ): HTMLButtonElement {
    const button = node("button", "world-map-action");
    button.type = "button";
    button.append(createInputGlyph(action), silverSecondaryLabel(label));
    button.addEventListener("click", () => this.callbacks.onOpenSection(section));
    return button;
  }

  private createTouchSurface(): HTMLElement {
    const surface = node("div", "world-map-touch-surface");
    surface.setAttribute("aria-hidden", "true");
    let pointer: { id: number; x: number; y: number; time: number; canceled: boolean } | null = null;
    surface.addEventListener("pointerdown", event => {
      if (pointer) { pointer.canceled = true; return; }
      if (!event.isPrimary || event.button !== 0 || this.moving) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), canceled: false };
      surface.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    surface.addEventListener("pointermove", event => {
      if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 14) pointer.canceled = true;
    });
    surface.addEventListener("pointerup", event => {
      if (pointer?.id !== event.pointerId) return;
      const tap = pointer; pointer = null;
      if (!tap.canceled && !this.moving && !this.root.hidden && performance.now() - tap.time < 1000 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 14)
        this.callbacks.onMapTap(event.clientX, event.clientY);
    });
    for (const type of ["pointercancel", "lostpointercapture"])
      surface.addEventListener(type, () => { pointer = null; });
    return surface;
  }

  private injectStyle(): void {
    const style = document.createElement("style");
    style.textContent = `
      .world-map-ui { position:fixed; inset:0; z-index:72; pointer-events:none; color:#fff8db; font-family:Roo, Impact, system-ui, sans-serif; }
      .world-map-ui[hidden], body.game-shell-modal .world-map-ui, body.game-shell-transitioning .world-map-ui { display:none !important; }
      .world-map-semantic { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
      .world-map-touch-surface { display:none; position:absolute; inset:0; touch-action:none; user-select:none; }
      .world-map-level-card { position:absolute; left:max(28px,env(safe-area-inset-left)); top:max(25px,env(safe-area-inset-top)); width:min(650px,43vw); aspect-ratio:2.45; }
      .world-map-trial { position:absolute; right:max(30px,env(safe-area-inset-right)); top:max(30px,env(safe-area-inset-top)); width:min(350px,26vw); aspect-ratio:.96; }
      .world-map-enter-touch { display:none; }
      .world-map-action { border:0; color:#fff8db; font-family:inherit; cursor:pointer; touch-action:manipulation; }
      .world-map-action:focus-visible { outline:2px solid #e8f0f4; outline-offset:4px; border-radius:3px; }
      .world-map-action:hover strong { filter:brightness(1.2); }
      .world-map-actions { position: absolute; left: 50%; bottom: max(28px, env(safe-area-inset-bottom)); transform: translateX(-50%); pointer-events: auto; display: flex; gap: clamp(16px, 2.4vw, 46px); padding: 0; background: none; border: 0; }
      .world-map-actions { width:max-content; max-width:calc(100vw - 24px); }
      .world-map-action { display:flex; align-items:center; gap:9px; padding:4px 5px; min-height:44px; background:transparent; flex-shrink:0; }
      .world-map-action strong { font-size:clamp(calc(19px * var(--secondary-size-scale, 1)), calc(1.65vw * var(--secondary-size-scale, 1)), calc(32px * var(--secondary-size-scale, 1))); line-height:1.15; white-space:nowrap; }
      .world-map-action .input-glyph { --prompt-icon-size:clamp(34px,2.5vw,48px); }
      @media (max-width:980px) {
        .world-map-actions { gap:5px; }
        .world-map-level-card { left:max(14px,env(safe-area-inset-left)); top:max(10px,env(safe-area-inset-top)); width:46vw; }
        .world-map-trial { right:max(14px,env(safe-area-inset-right)); top:max(10px,env(safe-area-inset-top)); width:min(240px,29vw); }
      }
      @media (max-height:520px) {
        .world-map-actions { bottom:max(10px,env(safe-area-inset-bottom)); }
        .world-map-trial { width:min(230px,45vh); }
      }
      @media (orientation:portrait) {
        .world-map-level-card { top:max(24px,env(safe-area-inset-top)); left:5vw; width:90vw; }
        .world-map-trial { top:calc(max(24px,env(safe-area-inset-top)) + 38vw); right:5vw; width:min(230px,46vw); }
        .world-map-actions { display: grid; grid-template-columns: repeat(2, max-content); column-gap:16px; row-gap:4px; }
        .world-map-action { min-width:44px; }
        .world-map-action strong { font-size:calc(20px * var(--secondary-size-scale, 1)); }
      }
      body.tc-on .world-map-touch-surface { display:block; pointer-events:auto; }
      body.tc-on .world-map-level-card { z-index:1; pointer-events:auto; }
      body.tc-on .world-map-trial[aria-hidden="false"] { pointer-events:auto; }
      body.tc-on .world-map-actions { z-index:1; bottom:max(16px, env(safe-area-inset-bottom)); }
      body.tc-on .world-map-action { min-height:48px; padding:6px 10px; touch-action:manipulation; }
      body.tc-on .world-map-enter-touch { position:absolute; right:0; top:65%; pointer-events:auto; display:grid; place-items:center; width:48px; height:48px; padding:9px; border:2px solid #d3ccc0; border-radius:50%; background:#20272b; box-shadow:0 3px 0 #080c10; color:#fff3d2; cursor:pointer; touch-action:manipulation; }
      body.tc-on .world-map-enter-touch svg { width:100%; height:100%; fill:none; stroke:currentColor; stroke-width:3.5; stroke-linecap:round; stroke-linejoin:round; }
      body.tc-on .world-map-enter-touch:disabled { opacity:.35; cursor:default; }
      body.tc-on .world-map-enter-touch:focus-visible { outline:3px solid white; outline-offset:3px; }
      @media (orientation:portrait) {
        body.tc-on .world-map-action .input-glyph { --prompt-icon-size:28px; }
        body.tc-on:not([data-prompt-family="touch"]) .world-map-action { padding-inline:4px; gap:4px; }
        body.tc-on .world-map-actions { grid-template-columns:repeat(2,max-content); column-gap:12px; }
      }
    `;
    document.head.appendChild(style);
  }
}
