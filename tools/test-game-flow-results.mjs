import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const noop = () => {};

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }
  fromString(value) {
    this.values = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  add(...names) {
    for (const name of names) this.values.add(name);
  }
  remove(...names) {
    for (const name of names) this.values.delete(name);
  }
  contains(name) {
    return this.values.has(name);
  }
  toggle(name, force) {
    const on = force === undefined ? !this.values.has(name) : Boolean(force);
    if (on) this.values.add(name);
    else this.values.delete(name);
    return on;
  }
  toString() {
    return [...this.values].join(" ");
  }
}

class FakeElement {
  constructor(tag = "div") {
    this.tagName = String(tag).toUpperCase();
    this.style = {};
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    this.hidden = false;
    this.inert = false;
    this.disabled = false;
    this._text = "";
    this._html = "";
  }
  get className() {
    return this.classList.toString();
  }
  set className(value) {
    this.classList.fromString(value);
  }
  get textContent() {
    if (this._text) return this._text;
    if (this._html) return this._html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return this.children.map((child) => child.textContent ?? "").join(" ").trim();
  }
  set textContent(value) {
    this._text = String(value ?? "");
    this._html = "";
    this.children = [];
  }
  get innerHTML() {
    return this._html;
  }
  set innerHTML(value) {
    this._html = String(value ?? "");
    this._text = "";
    this.children = [];
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  append(...children) {
    for (const child of children) this.appendChild(child);
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this._text = "";
    this._html = "";
    this.append(...children);
  }
  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }
  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains?.(candidate));
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  toggleAttribute(name, force) {
    const on = force === undefined ? !this.attributes.has(name) : Boolean(force);
    if (on) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return on;
  }
  focus() {
    globalThis.document.activeElement = this;
  }
  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    return false;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector) {
    const classes = selector
      .split(",")
      .map((part) => part.trim())
      .filter((part) => /^\.[\w-]+$/.test(part))
      .map((part) => part.slice(1));
    const found = [];
    const visit = (node) => {
      if (classes.some((name) => node.classList?.contains(name))) found.push(node);
      for (const child of node.children ?? []) visit(child);
    };
    for (const child of this.children) visit(child);
    return found;
  }
}

function installHeadlessDom() {
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeElement;
  globalThis.HTMLCanvasElement = FakeElement;
  const body = new FakeElement("body");
  const head = new FakeElement("head");
  globalThis.document = {
    body,
    head,
    activeElement: null,
    fonts: null,
    createElement: (tag) => new FakeElement(tag),
  };
  const storage = new Map();
  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear: () => storage.clear(),
    getItem: (key) => storage.get(String(key)) ?? null,
    key: (index) => [...storage.keys()][index] ?? null,
    removeItem: (key) => storage.delete(String(key)),
    setItem: (key, value) => storage.set(String(key), String(value)),
  };
  globalThis.window = {
    addEventListener: noop,
    removeEventListener: noop,
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false }),
    visualViewport: null,
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = noop;
}

function findClass(rootElement, className) {
  if (rootElement.classList?.contains(className)) return rootElement;
  for (const child of rootElement.children ?? []) {
    const found = findClass(child, className);
    if (found) return found;
  }
  return null;
}

function resultState(timeTrial) {
  return timeTrial
    ? {
        kind: "time-trial",
        levelName: "Jungle Ruins",
        actualTime: 59.25,
        relicTarget: 60,
        boxes: 8,
        totalBoxes: 20,
        bestTimes: [59.25, 56.12, 58.3, 70],
      }
    : {
        kind: "normal",
        levelName: "Jungle Ruins",
        boxes: 17,
        totalBoxes: 20,
        crystal: true,
        boxGem: false,
        comboGem: false,
        firstClear: true,
      };
}

installHeadlessDom();
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { GameFlowUI } = await server.ssrLoadModule("/src/gameFlowUI.ts");
  const callbacks = {
    onNewGame: noop,
    onLoadGame: noop,
    onSaveGame: () => true,
    onAutosaveChange: () => true,
    onQuitToMain: () => true,
    onResume: noop,
    onRestart: noop,
    onQuitLevel: noop,
    onGameOverRetry: noop,
    onGameOverQuit: noop,
    onResultsRetry: noop,
    onResultsContinue: noop,
    onAudioOptions: noop,
  };
  const gameFlow = new GameFlowUI({}, callbacks, {
    sfxMuted: false,
    musicMuted: false,
  });

  gameFlow.showResults(resultState(false));
  const normalPanel = gameFlow.panel;
  const normalTally = findClass(normalPanel, "game-results-tally");
  assert.ok(normalTally, "normal results lost their tally container");
  assert.doesNotMatch(
    normalTally.innerHTML,
    /<span>\s*(?:YOUR\s+)?TIME\s*<\/span>/i,
    "normal clears must not show elapsed time",
  );
  assert.match(normalTally.innerHTML, /<span>\s*BOXES\s*<\/span>/i);
  assert.equal(
    (normalTally.innerHTML.match(/<div>/g) ?? []).length,
    1,
    "normal results must contain only the box tally cell",
  );
  const normalAwards = findClass(normalPanel, "game-results-awards");
  assert.equal(normalAwards, null, "earned prizes must be actual 3D assets, not symbol UI");
  assert.match(findClass(normalPanel, "game-results-card").getAttribute("aria-label"), /Crystal/);
  assert.ok(findClass(normalPanel, "game-results-title"));
  assert.equal(findClass(normalPanel, "game-results-actions")?.children.length, 2);

  gameFlow.showResults(resultState(true));
  const trialPanel = gameFlow.panel;
  const trialTally = findClass(trialPanel, "game-results-tally");
  assert.ok(trialTally, "time-trial results lost their timing comparison");
  assert.match(trialTally.innerHTML, /YOUR TIME/i);
  assert.match(trialTally.innerHTML, /0:59\.25/);
  assert.match(trialTally.innerHTML, /RELIC TARGET/i);
  assert.match(trialTally.innerHTML, /1:00\.00/);
  assert.match(trialTally.innerHTML, /BOXES/i);
  assert.match(trialTally.innerHTML, /8 \/ 20/);
  assert.match(trialTally.innerHTML, /YOUR BEST TIMES/);
  assert.match(trialTally.innerHTML, /0:56\.12 · 0:58\.30 · 0:59\.25/);
  assert.doesNotMatch(trialTally.innerHTML, /1:10\.00/);
  assert.match(trialTally.innerHTML, /class="game-results-run-time"/);
  assert.equal(
    (trialTally.innerHTML.match(/<div[ >]/g) ?? []).length,
    4,
    "time trials need the prominent run time, relic target, boxes, and best times",
  );
  assert.doesNotMatch(
    trialTally.innerHTML,
    /VERDICT|EARNED|MISSED|SAPPHIRE|GOLD|PLATINUM/i,
    "time-trial results must not add a relic verdict row",
  );
  assert.equal(
    findClass(trialPanel, "game-results-awards"),
    null,
    "time-trial results must not create the normal award grid",
  );
  assert.ok(findClass(trialPanel, "game-results-title"));
  assert.equal(findClass(trialPanel, "game-results-actions")?.children.length, 2);

  const [flowSource, surfaceSource, mainSource, campaignApi] = await Promise.all([
    readFile(`${root}src/gameFlowUI.ts`, "utf8"),
    readFile(`${root}src/gameFlowSurface.ts`, "utf8"),
    readFile(`${root}src/main.ts`, "utf8"),
    server.ssrLoadModule("/src/campaign.ts"),
  ]);
  const stateStart = flowSource.indexOf("export type ResultsScreenState");
  const stateEnd = flowSource.indexOf("export interface GameFlowUICallbacks", stateStart);
  const stateInterface = stateStart >= 0 && stateEnd > stateStart
    ? flowSource.slice(stateStart, stateEnd)
    : "";
  assert.match(
    stateInterface,
    /kind:\s*"normal"[\s\S]*kind:\s*"time-trial"/,
    "results state needs exact normal/time-trial discriminated variants",
  );
  assert.match(
    stateInterface,
    /actualTime:\s*number;[\s\S]*relicTarget:\s*number;/,
    "time-trial results need the authored relic target",
  );
  assert.match(
    mainSource,
    /completion\.kind === "time-trial"[\s\S]{0,300}showTimeTrialResults\(completion\.time\)/,
    "the completion owner must pass time-trial identity/target into results",
  );
  assert.match(
    mainSource,
    /function showTimeTrialResults\([\s\S]{0,800}kind:\s*"time-trial"[\s\S]{0,200}actualTime:\s*time[\s\S]{0,120}relicTarget/,
    "time-trial presentation must receive actual time and its relic target",
  );
  assert.match(
    mainSource,
    /commitTimeTrial\([\s\S]{0,180}timeRelic:\s*time <= relicTarget/,
    "matching the one-minute target exactly must earn the relic",
  );
  assert.equal(campaignApi.CAMPAIGN_LEVELS.length, 9);
  assert.ok(
    campaignApi.CAMPAIGN_LEVELS.every((level) => level.relicTime === 60),
    "every canonical time-trial relic target must be 1:00",
  );
  assert.equal(
    typeof campaignApi.CampaignStore.prototype.commitTimeTrial,
    "function",
    "time-trial completion needs a campaign commit path independent of normal clear rewards",
  );
  localStorage.clear();
  const store = new campaignApi.CampaignStore();
  store.newGame(1);
  store.commitTimeTrial("jungle", { time: 59.25, timeRelic: true });
  const trialProgress = store.levelProgress("jungle");
  assert.equal(trialProgress.cleared, false);
  assert.equal(trialProgress.crystal, false);
  assert.equal(trialProgress.boxGem, false);
  assert.equal(trialProgress.comboGem, false);
  assert.equal(trialProgress.timeRelic, true);
  assert.equal(trialProgress.bestTime, 59.25);
  assert.match(
    surfaceSource,
    /"\.game-results-tally span"[\s\S]{0,100}"\.game-results-tally strong"/,
    "the Canvas mirror must capture both timing labels and timing values",
  );
  const liveStart = mainSource.indexOf('if (resultsPresentation && gameFlow.currentScreen === "results")');
  const liveEnd = mainSource.indexOf('// Pause/menu worlds', liveStart);
  const liveFrame = mainSource.slice(liveStart, liveEnd);
  assert.ok(liveStart > 0 && liveEnd > liveStart);
  assert.match(liveFrame, /resultsPresentation\.update\(dt\)/);
  assert.match(liveFrame, /renderGameplayWithGameFlow\(dt\)/);
  assert.doesNotMatch(liveFrame, /player\.step|level\.update|captureGameplay/, 'results animate without simulation or per-frame thumbnail copies');

  console.log(
    "Validated normal and time-trial results content across semantic DOM and Canvas selectors.",
  );
} finally {
  await server.close();
}
