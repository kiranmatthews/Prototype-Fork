import { silverSecondaryLabel } from "./secondaryText";
import { createSecondaryTextPanel } from "./secondaryTextPanel";
import {
  CAMPAIGN_ISLANDS,
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

function formatTime(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.floor((value - Math.floor(value)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export class WorldMapUI {
  private readonly root = node("section", "world-map-ui");
  private readonly eyebrow = node("span", "world-map-level-eyebrow");
  private readonly levelName = node("h1", "world-map-level-name");
  private readonly status = node("span", "world-map-level-status");
  private readonly trial = node("div", "world-map-trial");
  private readonly collectibleRow = node("div", "world-map-collectibles");
  private readonly unlockNotice = node("div", "world-map-unlock-notice");
  private readonly enterButton = node("button", "world-map-enter-touch");
  private selectedKey = "jungle";
  private moving = false;
  private unlockNoticeTimer: number | null = null;

  constructor(
    private readonly campaign: CampaignStore,
    private readonly callbacks: WorldMapUICallbacks,
  ) {
    this.root.setAttribute("aria-label", "Island world map");
    this.root.hidden = true;

    const levelCard = node("div", "world-map-level-card");
    const titleRow = node("div", "world-map-level-title-row");
    const titleCopy = node("div", "world-map-level-copy");
    titleCopy.append(this.eyebrow, this.levelName, this.status);
    this.collectibleRow.setAttribute("aria-label", "Level collectibles");
    this.enterButton.type = "button";
    this.enterButton.setAttribute("aria-label", "Enter selected level");
    this.enterButton.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 16h21M18 7l9 9-9 9"/></svg>';
    this.enterButton.addEventListener("click", () => { if (!this.moving && !this.enterButton.disabled) this.callbacks.onEnter(); });
    titleRow.append(titleCopy, this.collectibleRow, this.enterButton);
    levelCard.append(titleRow, this.trial);

    const actionBar = node("nav", "world-map-actions");
    actionBar.setAttribute("aria-label", "World map actions");
    actionBar.append(
      this.actionButton("△", "VIEW PROGRESS", "I", "progress"),
      this.actionButton("⚙", "OPTIONS", "P", "options"),
      this.actionButton("□", "SAVE / LOAD", "L", "save-load"),
      this.actionButton("○", "QUIT GAME", "Q", "quit"),
    );

    this.unlockNotice.setAttribute("role", "status");
    this.unlockNotice.setAttribute("aria-live", "polite");
    this.unlockNotice.hidden = true;
    this.root.append(this.createTouchSurface(), levelCard, actionBar, this.unlockNotice);
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
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
    this.unlockNotice.classList.remove("show");
    this.unlockNotice.hidden = true;
    this.unlockNotice.textContent = "";
    if (this.unlockNoticeTimer !== null) window.clearTimeout(this.unlockNoticeTimer);
    this.unlockNoticeTimer = null;
    document.body.classList.remove("world-map-active");
  }

  announceUnlock(progressKeys: readonly string[]): void {
    const names = progressKeys
      .map((key) => campaignLevelByKey(key)?.name)
      .filter((name): name is string => !!name);
    if (!names.length) return;
    if (this.unlockNoticeTimer !== null) window.clearTimeout(this.unlockNoticeTimer);
    this.unlockNotice.hidden = false;
    this.unlockNotice.textContent = `NEW PATH OPEN · ${names.join(" / ").toUpperCase()}`;
    this.unlockNotice.classList.remove("show");
    void this.unlockNotice.offsetWidth;
    this.unlockNotice.classList.add("show");
    this.unlockNoticeTimer = window.setTimeout(() => {
      this.unlockNotice.classList.remove("show");
      this.unlockNoticeTimer = window.setTimeout(() => {
        this.unlockNotice.hidden = true;
        this.unlockNotice.textContent = "";
        this.unlockNoticeTimer = null;
      }, 240);
    }, 3600);
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

  private render(): void {
    const definition = campaignLevelByKey(this.selectedKey) ?? CAMPAIGN_LEVELS[0];
    const island = CAMPAIGN_ISLANDS.find(
      (candidate) => candidate.id === definition.islandId,
    ) ?? CAMPAIGN_ISLANDS[0];
    const progress = this.campaign.levelProgress(definition.levelId);
    const unlocked = this.campaign.levelUnlocked(definition.progressKey);
    this.enterButton.disabled = this.moving || !unlocked;
    this.enterButton.setAttribute("aria-label", `Enter ${definition.name}`);
    this.root.dataset.selectedKey = definition.progressKey;
    this.root.classList.toggle("is-moving", this.moving);
    this.root.classList.toggle("is-locked", !unlocked);
    this.root.classList.toggle("is-boss", definition.boss === true);
    this.eyebrow.textContent = this.moving
      ? "FOLLOWING THE CURRENT"
      : definition.boss
        ? `ISLAND FINALE · ${island.name.toUpperCase()}`
        : `LEVEL ${CAMPAIGN_LEVELS.indexOf(definition) + 1} · ${island.name.toUpperCase()}`;
    this.levelName.textContent = definition.name.toUpperCase();
    this.status.textContent = this.moving
      ? "TRAVELLING…"
      : !unlocked
        ? "LOCKED"
        : progress?.cleared
          ? "COMPLETE · PLAY AGAIN"
          : "READY";
    const rewards = [
      ["◆", "CRYSTAL", progress?.crystal === true],
      ["◇", "BOX GEM", progress?.boxGem === true],
      ["⬙", "COMBO GEM", progress?.comboGem === true],
      ["◉", "TIME RELIC", progress?.timeRelic === true],
    ] as const;
    this.collectibleRow.replaceChildren();
    for (const [glyph, label, earned] of rewards) {
      const reward = node("span", `world-map-collectible${earned ? " earned" : ""}`);
      reward.setAttribute("aria-label", `${label}: ${earned ? "collected" : "missing"}`);
      reward.innerHTML = `<b aria-hidden="true">${glyph}</b><small>${label}</small>`;
      this.collectibleRow.appendChild(reward);
    }

    if (progress?.cleared) {
      this.trial.hidden = false;
      this.trial.innerHTML = `<span>⏱ TIME TRIAL UNLOCKED</span><strong>BEST ${formatTime(progress.bestTime)}</strong><small>TARGET ${formatTime(definition.relicTime)}</small>`;
    } else {
      this.trial.hidden = true;
      this.trial.replaceChildren();
    }
  }

  private actionButton(
    glyph: string,
    label: string,
    key: string,
    section: WorldMapSection,
  ): HTMLButtonElement {
    const button = node("button", "world-map-action");
    button.type = "button";
    button.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
    const keyHint = node("kbd", "");
    keyHint.textContent = key;
    button.append(silverSecondaryLabel(label), keyHint);
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
      .world-map-ui {
        position: fixed; inset: 0; z-index: 72; pointer-events: none;
        color: #fff8db; font-family: Roo, Impact, system-ui, sans-serif;
      }
      .world-map-ui[hidden], body.game-shell-modal .world-map-ui, body.game-shell-transitioning .world-map-ui { display: none !important; }
      .world-map-touch-surface { display:none; position:absolute; inset:0; touch-action:none; user-select:none; }
      .world-map-enter-touch { display:none; }
      .world-map-level-card {
        background: linear-gradient(145deg, rgba(69,78,54,.94), rgba(24,55,57,.93));
        border: 2px solid rgba(250,220,151,.74); box-shadow: 0 10px 24px rgba(6,28,38,.3), inset 0 1px rgba(255,255,255,.22);
        backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
      }
      .world-map-level-eyebrow { color: #9be0c1; font: 800 11px/1.1 ui-monospace, monospace; letter-spacing: .14em; }
      .world-map-level-card {
        position: absolute; top: max(20px, env(safe-area-inset-top)); right: max(26px, env(safe-area-inset-right));
        width: min(600px, 47vw); min-height: 96px; padding: 11px 18px 10px; box-sizing: border-box;
        border-radius: 26px 8px 26px 8px;
      }
      .world-map-level-title-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
      .world-map-level-copy { min-width: 0; display: grid; }
      .world-map-level-name { margin: 2px 0 0; font-size: clamp(27px, 2.6vw, 40px); line-height: .96; color: #fff0b6; text-shadow: 0 3px #173c3f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .world-map-level-status { color: #ffd568; font: 900 11px/1.2 ui-monospace, monospace; letter-spacing: .08em; margin-top: 5px; }
      .world-map-ui.is-locked .world-map-level-status { color: #b7c3c4; }
      .world-map-ui.is-boss .world-map-level-name { color: #ffd456; }
      .world-map-collectibles { display: grid; grid-template-columns: repeat(4, 40px); gap: 5px; flex: 0 0 auto; }
      .world-map-collectible { display: grid; place-items: center; color: rgba(153,177,176,.46); }
      .world-map-collectible b { font: 900 25px/1 system-ui, sans-serif; }
      .world-map-collectible small { margin-top: 2px; color: inherit; font: 700 7px/1 ui-monospace, monospace; white-space: nowrap; }
      .world-map-collectible.earned { color: #f8e3ff; text-shadow: 0 0 10px #d75fff; }
      .world-map-collectible:nth-child(3).earned { color: #86f29a; text-shadow: 0 0 10px #43ce66; }
      .world-map-collectible:nth-child(4).earned { color: #7fd3ff; text-shadow: 0 0 10px #389be7; }
      .world-map-trial { display: flex; gap: 13px; align-items: center; margin-top: 9px; padding-top: 7px; border-top: 1px solid rgba(229,248,214,.24); font: 800 10px/1.1 ui-monospace, monospace; }
      .world-map-trial span { color: #a7efc9; } .world-map-trial strong { color: #fff; } .world-map-trial small { color: #ffd568; }
      .world-map-action { border: 0; color: #fff8db; font-family: inherit; cursor: pointer; touch-action: manipulation; }
      .world-map-action:focus-visible { outline: 2px solid #e8f0f4; outline-offset: 4px; border-radius: 3px; }
      .world-map-action:hover strong { filter: brightness(1.2); }
      .world-map-actions { position: absolute; left: 50%; bottom: max(28px, env(safe-area-inset-bottom)); transform: translateX(-50%); pointer-events: auto; display: flex; gap: clamp(16px, 2.4vw, 46px); padding: 0; background: none; border: 0; }
      .world-map-actions { width: max-content; max-width: calc(100vw - 24px); }
      .world-map-action { display: flex; align-items: center; gap: 9px; padding: 4px 5px; min-height: 44px; background: transparent; flex-shrink: 0; }
      .world-map-action span { color: #b7c7d5; font: 900 clamp(17px, 1.3vw, 25px)/1 system-ui; -webkit-text-stroke: 1px #101820; paint-order: stroke fill; text-shadow: 1px 1px #08090b, 2px 2px #08090b; }
      .world-map-action strong { font-size: clamp(calc(19px * var(--secondary-size-scale, 1)), calc(1.65vw * var(--secondary-size-scale, 1)), calc(32px * var(--secondary-size-scale, 1))); line-height: 1.15; white-space: nowrap; }
      .world-map-action kbd { color: #d9e1e6; border: 1px solid #70818b; border-radius: 4px; padding: 3px 4px; background: #17212aba; font: 700 11px/1 var(--font-secondary); box-shadow: 1px 2px #08090b; }
      .world-map-unlock-notice { position: absolute; left: 50%; top: 21%; transform: translate(-50%, -18px) scale(.92); opacity: 0; padding: 10px 22px; border: 2px solid #fff0a3; border-radius: 22px; background: linear-gradient(135deg, rgba(237,131,41,.96), rgba(198,72,30,.96)); color: #fff8d5; box-shadow: 0 8px 25px rgba(36,19,7,.36); font-size: clamp(20px, 2.2vw, 31px); letter-spacing: .035em; text-align: center; transition: opacity .22s, transform .32s cubic-bezier(.2,1.4,.4,1); }
      .world-map-unlock-notice.show { opacity: 1; transform: translate(-50%, 0) scale(1); }
      @media (max-width: 980px) {
        .world-map-level-card { width: 54vw; }
        .world-map-action kbd { display: none; }
        .world-map-actions { gap: 5px; }
      }
      @media (pointer: coarse) {
        .world-map-level-card { top: max(8px, env(safe-area-inset-top)); right: auto; left: 50%; transform: translateX(-50%); width: min(58vw, 520px); min-height: 0; padding: 9px 14px; }
        .world-map-level-name { font-size: clamp(24px, 7vh, 34px); }
        .world-map-collectibles { grid-template-columns: repeat(4, 31px); }
        .world-map-collectible small { display: none; }
        .world-map-trial { margin-top: 5px; padding-top: 4px; }
        .world-map-actions { bottom: max(14px, env(safe-area-inset-bottom)); gap: 8px; }
        .world-map-action { justify-content: center; gap: 6px; }
        .world-map-action kbd { display: none; }
      }
      @media (max-height: 520px) and (pointer: fine) {
        .world-map-level-card { top: max(8px, env(safe-area-inset-top)); right: auto; left: 50%; transform: translateX(-50%); width: min(58vw, 520px); min-height: 0; padding: 9px 14px; }
        .world-map-level-name { font-size: clamp(24px, 7vh, 34px); }
        .world-map-collectibles { grid-template-columns: repeat(4, 31px); }
        .world-map-collectible small { display: none; }
        .world-map-trial { margin-top: 5px; padding-top: 4px; }
        .world-map-actions { bottom: max(10px, env(safe-area-inset-bottom)); }
      }
      @media (orientation: portrait) {
        .world-map-level-card { top: 11vh; right: auto; left: 50%; transform: translateX(-50%); width: 88vw; }
        .world-map-level-title-row { display: grid; gap: 7px; }
        .world-map-level-name { font-size: 32px; }
        .world-map-collectibles { width: 100%; grid-template-columns: repeat(4, 1fr); }
        .world-map-actions { left: 50%; right: auto; top: auto; bottom: calc(var(--tc-size, 168px) + max(10px, env(safe-area-inset-bottom)) + 14px); transform: translateX(-50%); display: grid; grid-template-columns: repeat(2, max-content); column-gap: 16px; row-gap: 4px; }
        .world-map-action { min-width: 44px; }
        .world-map-action strong { font-size: calc(20px * var(--secondary-size-scale, 1)); }
        .world-map-unlock-notice { top: calc(11vh + 185px); width: max-content; max-width: 82vw; }
      }
      body.tc-on .world-map-touch-surface { display:block; pointer-events:auto; }
      body.tc-on .world-map-level-card { pointer-events:auto; z-index:1; }
      body.tc-on .world-map-actions { z-index:1; bottom:max(16px, env(safe-area-inset-bottom)); }
      body.tc-on .world-map-action > span, body.tc-on .world-map-action kbd { display:none; }
      body.tc-on .world-map-action { min-height:48px; padding:6px 10px; touch-action:manipulation; }
      body.tc-on .world-map-enter-touch { display:grid; place-items:center; flex:0 0 48px; width:48px; height:48px; padding:9px; border:1px solid #daf8e3; border-radius:50%; background:#1d5546; color:#effff4; cursor:pointer; touch-action:manipulation; }
      body.tc-on .world-map-enter-touch svg { width:100%; height:100%; fill:none; stroke:currentColor; stroke-width:3.5; stroke-linecap:round; stroke-linejoin:round; }
      body.tc-on .world-map-enter-touch:disabled { opacity:.35; cursor:default; }
      body.tc-on .world-map-enter-touch:focus-visible { outline:3px solid white; outline-offset:3px; }
      @media (orientation:portrait) {
        body.tc-on .world-map-level-title-row { grid-template-columns:minmax(0,1fr) 48px; align-items:center; }
        body.tc-on .world-map-level-copy { grid-column:1; }
        body.tc-on .world-map-enter-touch { grid-column:2; grid-row:1/3; }
        body.tc-on .world-map-collectibles { grid-column:1; }
        body.tc-on .world-map-actions { grid-template-columns:repeat(2,max-content); column-gap:12px; }
      }
    `;
    document.head.appendChild(style);
  }
}
