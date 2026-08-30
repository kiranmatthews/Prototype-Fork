import {
  groundedSkateSpinRingSettings,
  SpinRingSettings,
  spinRingSettings,
  type SpinRingOverride,
  type SpinRingSettingsValue,
} from "./settings";

interface SliderDefinition {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly read: (value: Readonly<SpinRingSettingsValue>) => number;
  readonly write: (value: number) => void;
}

export interface SpinTuningPanelOptions {
  readonly settings?: SpinRingSettings;
  readonly groundedSkateSettings?: SpinRingSettings;
  readonly parent?: HTMLElement;
  readonly initiallyOpen?: boolean;
  readonly labMode?: boolean;
}

const GLOBAL_SECTIONS: readonly {
  title: string;
  controls: readonly {
    label: string;
    key: keyof SpinRingSettingsValue;
    min: number;
    max: number;
    step: number;
  }[];
}[] = [
  {
    title: "Geometry",
    controls: [
      { label: "Ring count", key: "ringCount", min: 1, max: 8, step: 1 },
      { label: "Segments", key: "segmentCount", min: 8, max: 48, step: 1 },
      { label: "Seed", key: "seed", min: 0, max: 999, step: 1 },
      { label: "Fit / radius", key: "radiusScale", min: 0.8, max: 1.6, step: 0.001 },
      { label: "Vertical spread", key: "verticalSpread", min: 0, max: 0.8, step: 0.001 },
      { label: "Inner lane", key: "ringInner", min: 0.65, max: 1.5, step: 0.001 },
      { label: "Outer lane", key: "ringOuter", min: 0.65, max: 1.5, step: 0.001 },
      { label: "Tilt minimum", key: "minimumTiltDegrees", min: 0, max: 80, step: 0.01 },
      { label: "Tilt maximum", key: "maximumTiltDegrees", min: 0, max: 80, step: 0.01 },
    ],
  },
  {
    title: "Stroke",
    controls: [
      { label: "Line width", key: "ringLine", min: 0.005, max: 0.06, step: 0.0001 },
      { label: "Glow width", key: "ringGlow", min: 0.01, max: 0.18, step: 0.0001 },
      { label: "Brightness", key: "ringBright", min: 0, max: 4, step: 0.01 },
      { label: "Alpha", key: "alpha", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: "Motion / distortion",
    controls: [
      { label: "Distortion depth", key: "depth", min: 0.2, max: 2, step: 0.001 },
      { label: "Variation", key: "vary", min: 0, max: 0.5, step: 0.001 },
      { label: "Low drift", key: "sharedLow", min: 0, max: 0.04, step: 0.0001 },
      { label: "Low rate", key: "sharedLowRate", min: -16, max: 16, step: 0.01 },
      { label: "Mid drift", key: "sharedMid", min: 0, max: 0.04, step: 0.0001 },
      { label: "Mid rate", key: "sharedMidRate", min: -16, max: 16, step: 0.01 },
      { label: "Breathe", key: "breathe", min: 0, max: 0.05, step: 0.0001 },
      { label: "Breathe rate", key: "breatheRate", min: 0, max: 6, step: 0.01 },
      { label: "Wave amount", key: "wavyAmp", min: 0, max: 0.08, step: 0.0001 },
      { label: "Wave frequency", key: "wavyFreq", min: 1, max: 24, step: 0.01 },
      { label: "Wave rate", key: "wavyRate", min: -16, max: 16, step: 0.01 },
      { label: "Jagged amount", key: "jagAmp", min: 0, max: 0.08, step: 0.0001 },
      { label: "Jagged frequency", key: "jagFreq", min: 1, max: 24, step: 0.01 },
      { label: "Jagged rate", key: "jagRate", min: -16, max: 16, step: 0.01 },
      { label: "Warp phase spin", key: "spin", min: -6, max: 6, step: 0.001 },
      { label: "Ring spin diff", key: "spinDiff", min: -6, max: 6, step: 0.001 },
    ],
  },
  {
    title: "Radial / palette",
    controls: [
      { label: "Radial travel", key: "swallow", min: -2, max: 2, step: 0.001 },
      { label: "Travel inner", key: "swallowTo", min: 0.01, max: 1.08, step: 0.001 },
      { label: "Travel outer", key: "swallowFrom", min: 0.03, max: 2, step: 0.001 },
      { label: "Current", key: "current", min: -2, max: 2, step: 0.001 },
      { label: "Current rate", key: "currentRate", min: -16, max: 16, step: 0.01 },
      { label: "Pulse", key: "pulse", min: -2, max: 2, step: 0.001 },
      { label: "Pulse rate", key: "pulseRate", min: -16, max: 16, step: 0.01 },
      { label: "Palette cycle rate", key: "cycleRate", min: -16, max: 16, step: 0.01 },
      { label: "White mix", key: "whiteMix", min: 0, max: 1, step: 0.01 },
    ],
  },
];

const CSS = `
  :host { all: initial; position: fixed; inset: 0; z-index: 96; pointer-events: none;
    color: #f6f1e8; font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  *, *::before, *::after { box-sizing: border-box; border-radius: 0 !important; }
  button, input { font: inherit; }
  .launcher { position: fixed; top: 64%; right: 0; pointer-events: auto; padding: 10px 6px;
    border: 1px solid #ff5f9d; border-right: 0; background: #160811; color: #ff9dc3;
    font-weight: 900; letter-spacing: .8px; cursor: pointer; box-shadow: -4px 4px 0 #0008; }
  :host([data-open]) .launcher { display: none; }
  .panel { display: none; position: fixed; top: 12px; right: 40px; bottom: 12px;
    width: min(424px, calc(100vw - 80px)); pointer-events: auto; overflow: hidden;
    border: 2px solid #ff6a35; background: #080c12; box-shadow: -10px 10px 0 #000b; }
  :host([data-open]) .panel { display: flex; flex-direction: column; }
  .title { display: flex; align-items: center; gap: 8px; padding: 10px 12px;
    border-bottom: 2px solid #ff6a35; background: #21110b; font-weight: 900; letter-spacing: 1px; }
  .title span { flex: 1; } .close { width: 30px; padding: 3px; }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #56301d; }
  .tabs button { min-height: 36px; border: 0; border-right: 1px solid #56301d;
    background: #100c12; color: #aa929e; font-weight: 900; letter-spacing: .5px; }
  .tabs button:last-child { border-right: 0; }
  .tabs button[aria-selected='true'] { background: #3b1628; color: #fff2f8;
    box-shadow: inset 0 -3px #ff5f9d; }
  .intro { padding: 8px 11px; color: #b7a99f; border-bottom: 1px solid #56301d; font-size: 10px; }
  .actions { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 10px; border-bottom: 1px solid #56301d; }
  .sections { flex: 1 1 auto; overflow: auto; padding: 8px 9px 14px; scrollbar-color: #b34f65 #080c12; }
  details { border: 1px solid #4b2932; border-bottom: 0; background: #0d1118; }
  details:last-child { border-bottom: 1px solid #4b2932; }
  summary { padding: 9px 10px; cursor: pointer; color: #ffad78; background: #1b1012;
    font-weight: 900; letter-spacing: .6px; text-transform: uppercase; }
  .control { display: grid; grid-template-columns: minmax(128px, 1.15fr) minmax(88px, 1fr) 78px;
    gap: 7px; align-items: center; min-height: 38px; padding: 5px 8px; border-top: 1px solid #282127; }
  .control:nth-child(odd) { background: #12151b; }
  .control label { color: #dfd3ca; overflow-wrap: anywhere; }
  input[type='range'] { width: 100%; min-width: 68px; accent-color: #ff5f9d; }
  input[type='number'], .hex { width: 78px; height: 26px; padding: 3px 5px; border: 1px solid #704052;
    background: #040609; color: #fff; text-align: right; outline: none; }
  input:focus { border-color: #fff; box-shadow: inset 0 -2px #ff5f9d; }
  .selector { display: flex; align-items: center; gap: 5px; padding: 8px; border-top: 1px solid #282127; }
  .selector .name { width: 112px; color: #dfd3ca; } .selector .value { min-width: 66px; text-align: center; }
  .slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 5px 8px 8px; }
  .slots button[aria-pressed='true'] { background: #77314e; border-color: #ff9dc3; }
  .swatch { display: grid; grid-template-columns: 42px 1fr 90px; gap: 8px; align-items: center;
    padding: 7px 8px 10px; border-top: 1px solid #282127; }
  .swatch input[type='color'] { width: 42px; height: 27px; padding: 0; border: 1px solid #704052; background: none; }
  .hex { width: 90px; text-align: left; }
  .status { min-height: 29px; padding: 7px 10px; border-top: 1px solid #56301d; color: #bd927e; font-size: 10px; }
  button { min-height: 28px; padding: 5px 9px; border: 1px solid #704052; background: #191017;
    color: #f6f1e8; cursor: pointer; }
  button:hover, button:focus-visible { border-color: #fff; background: #38202b; outline: none; }
  .hidden { display: none; }
  @media (max-width: 560px) { .panel { inset: 0; width: 100vw; }
    .control { grid-template-columns: minmax(108px, 1fr) 84px 70px; gap: 5px; padding-inline: 6px; }
    input[type='number'] { width: 70px; } }
`;

interface Binding {
  readonly definition: SliderDefinition;
  readonly slider: HTMLInputElement;
  readonly numeric: HTMLInputElement;
}

type ColorSlot = "lineColorA" | "lineColorB" | "glowColorA" | "glowColorB";
type SpinTuningTarget = "character" | "grounded-skate";

function packedToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function hexToPacked(value: string): number | null {
  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized, 16) : null;
}

function rgbToHsv(packed: number): [number, number, number] {
  const r = ((packed >> 16) & 255) / 255;
  const g = ((packed >> 8) & 255) / 255;
  const b = (packed & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = ((h * 60) + 360) % 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToPacked(h: number, s: number, v: number): number {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g] = [chroma, x];
  else if (h < 120) [r, g] = [x, chroma];
  else if (h < 180) [g, b] = [chroma, x];
  else if (h < 240) [g, b] = [x, chroma];
  else if (h < 300) [r, b] = [x, chroma];
  else [r, b] = [chroma, x];
  return (
    (Math.round((r + m) * 255) << 16) |
    (Math.round((g + m) * 255) << 8) |
    Math.round((b + m) * 255)
  );
}

export class SpinTuningPanel {
  readonly element: HTMLDivElement;
  readonly settings: SpinRingSettings;
  readonly groundedSkateSettings: SpinRingSettings;
  private readonly shadow: ShadowRoot;
  private readonly bindings: Binding[] = [];
  private readonly ringSelection: HTMLSpanElement;
  private readonly slotButtons = new Map<ColorSlot, HTMLButtonElement>();
  private readonly colorInput: HTMLInputElement;
  private readonly hexInput: HTMLInputElement;
  private readonly status: HTMLDivElement;
  private readonly unsubscribes: (() => void)[] = [];
  private readonly tabButtons = new Map<SpinTuningTarget, HTMLButtonElement>();
  private readonly intro: HTMLDivElement;
  private selectedRing = 0;
  private selectedSlot: ColorSlot = "lineColorA";
  private activeTarget: SpinTuningTarget = "character";
  private openState = false;

  constructor(options: SpinTuningPanelOptions = {}) {
    this.settings = options.settings ?? spinRingSettings;
    this.groundedSkateSettings =
      options.groundedSkateSettings ?? groundedSkateSpinRingSettings;
    const documentRef = options.parent?.ownerDocument ?? document;
    this.element = documentRef.createElement("div");
    this.element.setAttribute("data-spin-panel-host", "");
    this.shadow = this.element.attachShadow({ mode: "open" });
    for (const name of ["keydown", "keyup", "keypress"] as const)
      this.shadow.addEventListener(name, (event) => event.stopPropagation());
    const style = documentRef.createElement("style");
    style.textContent = CSS;
    this.shadow.append(style);
    const launcher = this.button("SPIN", "launcher");
    launcher.setAttribute("aria-label", "Open spin effects tuning panel");
    launcher.addEventListener("click", () => this.setOpen(true));
    this.shadow.append(launcher);

    const panel = this.make("section", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Spin orbital rings tuning panel");
    const title = this.make("header", "title");
    title.append(this.make("span", "", "SPIN ORBITAL RINGS"));
    const close = this.button("×", "close");
    close.setAttribute("aria-label", "Close spin effects tuning panel");
    close.addEventListener("click", () => this.setOpen(false));
    title.append(close);
    panel.append(title);
    const tabs = this.make("div", "tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Spin effect profile");
    for (const [target, label] of [
      ["character", "CHARACTER SPIN"],
      ["grounded-skate", "GROUND SKATE"],
    ] as const) {
      const tab = this.button(label);
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "spin-ring-settings-sections");
      tab.addEventListener("click", () => this.setActiveTarget(target));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const next =
          event.key === "ArrowRight" || event.key === "End"
            ? "grounded-skate"
            : "character";
        this.setActiveTarget(next);
        this.tabButtons.get(next)?.focus();
      });
      this.tabButtons.set(target, tab);
      tabs.append(tab);
    }
    panel.append(tabs);
    this.intro = this.make("div", "intro");
    panel.append(this.intro);
    const actions = this.make("div", "actions");
    const route = this.button(options.labMode ? "Back to game" : "Open full lab");
    route.addEventListener("click", () => {
      window.location.href = new URL(
        options.labMode ? "./" : "./spin-lab.html",
        document.baseURI,
      ).href;
    });
    const reset = this.button("Reset tab defaults");
    reset.addEventListener("click", () => {
      this.activeSettings.reset();
      this.setStatus(`${this.activeTargetLabel} defaults restored.`);
    });
    const copy = this.button("Copy JSON");
    copy.addEventListener("click", () => void this.copyJson());
    const download = this.button("Download JSON");
    download.addEventListener("click", () => this.downloadJson());
    const load = this.button("Load JSON");
    const file = documentRef.createElement("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.className = "hidden";
    file.addEventListener("change", () => void this.loadJson(file));
    load.addEventListener("click", () => file.click());
    actions.append(route, reset, copy, download, load, file);
    panel.append(actions);

    const sections = this.make("div", "sections");
    sections.id = "spin-ring-settings-sections";
    const perRing = documentRef.createElement("details");
    perRing.open = true;
    perRing.append(this.make("summary", "", "Per-ring"));
    const selector = this.make("div", "selector");
    selector.append(this.make("span", "name", "Edit ring"));
    const previous = this.button("<");
    previous.setAttribute("aria-label", "Previous spin ring");
    previous.addEventListener("click", () => {
      this.selectedRing = Math.max(0, this.selectedRing - 1);
      this.refresh(this.activeSettings.value);
    });
    this.ringSelection = this.make("span", "value");
    const next = this.button(">");
    next.setAttribute("aria-label", "Next spin ring");
    next.addEventListener("click", () => {
      this.selectedRing = Math.min(
        this.activeSettings.value.ringCount - 1,
        this.selectedRing + 1,
      );
      this.refresh(this.activeSettings.value);
    });
    selector.append(previous, this.ringSelection, next);
    perRing.append(selector);
    perRing.append(
      this.createSlider({
        label: "Height offset", min: -1, max: 1, step: 0.001,
        read: (value) => value.ringOverrides[this.selectedRing].heightOffset,
        write: (value) => this.activeSettings.updateRing(this.selectedRing, { heightOffset: value }),
      }),
      this.createSlider({
        label: "Radius size", min: 0.5, max: 1.75, step: 0.001,
        read: (value) => value.ringOverrides[this.selectedRing].radiusScale,
        write: (value) => this.activeSettings.updateRing(this.selectedRing, { radiusScale: value }),
      }),
    );
    const slots = this.make("div", "slots");
    for (const [slot, label] of [
      ["lineColorA", "Line A"], ["lineColorB", "Line B"],
      ["glowColorA", "Glow A"], ["glowColorB", "Glow B"],
    ] as const) {
      const button = this.button(label);
      button.addEventListener("click", () => {
        this.selectedSlot = slot;
        this.refresh(this.activeSettings.value);
      });
      this.slotButtons.set(slot, button);
      slots.append(button);
    }
    perRing.append(slots);
    for (const definition of [
      { label: "Hue", min: 0, max: 360, step: 1, channel: 0 },
      { label: "Saturation", min: 0, max: 1, step: 0.01, channel: 1 },
      { label: "Value", min: 0, max: 1, step: 0.01, channel: 2 },
    ] as const) {
      perRing.append(this.createSlider({
        label: definition.label,
        min: definition.min,
        max: definition.max,
        step: definition.step,
        read: (value) => rgbToHsv(this.selectedColor(value))[definition.channel],
        write: (nextValue) => {
          const hsv = rgbToHsv(this.selectedColor(this.activeSettings.value));
          hsv[definition.channel] = nextValue;
          this.setSelectedColor(hsvToPacked(hsv[0], hsv[1], hsv[2]));
        },
      }));
    }
    perRing.append(this.createSlider({
      label: "Pulse phase", min: 0, max: 1, step: 0.01,
      read: (value) => value.ringOverrides[this.selectedRing].colorPulsePhase,
      write: (value) => this.activeSettings.updateRing(this.selectedRing, { colorPulsePhase: value }),
    }));
    const swatch = this.make("div", "swatch");
    this.colorInput = documentRef.createElement("input");
    this.colorInput.type = "color";
    this.colorInput.setAttribute("aria-label", "Selected spin ring color");
    this.colorInput.addEventListener("input", () => {
      const parsed = hexToPacked(this.colorInput.value);
      if (parsed !== null) this.setSelectedColor(parsed);
    });
    swatch.append(this.colorInput, this.make("span", "", "Live swatch"));
    this.hexInput = documentRef.createElement("input");
    this.hexInput.className = "hex";
    this.hexInput.setAttribute("aria-label", "Selected spin ring hex color");
    this.hexInput.addEventListener("change", () => {
      const parsed = hexToPacked(this.hexInput.value);
      if (parsed === null) {
        this.setStatus("Colour must be exactly #RRGGBB.");
        this.refresh(this.activeSettings.value);
      } else this.setSelectedColor(parsed);
    });
    swatch.append(this.hexInput);
    perRing.append(swatch);
    sections.append(perRing);

    for (const [sectionIndex, section] of GLOBAL_SECTIONS.entries()) {
      const details = documentRef.createElement("details");
      details.open = sectionIndex === 0;
      details.append(this.make("summary", "", section.title));
      for (const control of section.controls) {
        details.append(this.createSlider({
          ...control,
          read: (value) => value[control.key] as number,
          write: (value) => this.activeSettings.patch({
            [control.key]: value,
          } as Partial<SpinRingSettingsValue>),
        }));
      }
      if (section.title === "Motion / distortion") {
        details.append(this.createSlider({
          label: "Ring self-spin (rev/s)", min: -8, max: 8, step: 0.01,
          read: (value) => value.selfSpinRadiansPerSecond / (Math.PI * 2),
          write: (value) => this.activeSettings.patch({ selfSpinRadiansPerSecond: value * Math.PI * 2 }),
        }));
      }
      sections.append(details);
    }
    panel.append(sections);
    this.status = this.make(
      "div",
      "status",
      "Unity preset v1 · 6 rings · 660 dynamic vertices · 1,056 triangles",
    );
    panel.append(this.status);
    this.shadow.append(panel);
    (options.parent ?? documentRef.body).append(this.element);
    this.unsubscribes.push(
      this.settings.subscribe((value) => {
        if (this.activeTarget === "character") this.refresh(value);
      }),
      this.groundedSkateSettings.subscribe((value) => {
        if (this.activeTarget === "grounded-skate") this.refresh(value);
      }),
    );
    this.refresh(this.activeSettings.value);
    this.setOpen(options.initiallyOpen ?? false);
  }

  private get activeSettings(): SpinRingSettings {
    return this.activeTarget === "character"
      ? this.settings
      : this.groundedSkateSettings;
  }

  private get activeTargetLabel(): string {
    return this.activeTarget === "character"
      ? "Character spin"
      : "Grounded skate";
  }

  private setActiveTarget(target: SpinTuningTarget): void {
    if (this.activeTarget === target) return;
    this.activeTarget = target;
    this.selectedRing = 0;
    this.refresh(this.activeSettings.value);
  }

  setOpen(open: boolean): void {
    this.openState = open;
    this.element.toggleAttribute("data-open", open);
  }
  toggle(): void { this.setOpen(!this.openState); }
  dispose(): void {
    for (const unsubscribe of this.unsubscribes.splice(0)) unsubscribe();
    this.element.remove();
  }
  setStatus(text: string): void { this.status.textContent = text; }

  private createSlider(definition: SliderDefinition): HTMLDivElement {
    const row = this.make("div", "control");
    const label = this.make("label", "", definition.label);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(definition.min);
    slider.max = String(definition.max);
    slider.step = String(definition.step);
    slider.setAttribute("aria-label", definition.label);
    const numeric = document.createElement("input");
    numeric.type = "number";
    numeric.min = slider.min;
    numeric.max = slider.max;
    numeric.step = slider.step;
    numeric.setAttribute("aria-label", `${definition.label} numeric value`);
    slider.addEventListener("input", () => definition.write(Number(slider.value)));
    numeric.addEventListener("input", () => {
      const parsed = Number(numeric.value);
      if (Number.isFinite(parsed)) definition.write(parsed);
    });
    this.bindings.push({ definition, slider, numeric });
    row.append(label, slider, numeric);
    return row;
  }

  private refresh(value: Readonly<SpinRingSettingsValue>): void {
    for (const [target, button] of this.tabButtons) {
      const selected = target === this.activeTarget;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    this.intro.textContent =
      this.activeTarget === "character"
        ? "On-foot / rope spin · sculpture + full-height rings · 15-tick ring handoff."
        : "Grounded skateboard spin · native rider rotation + independent low rings · includes X pump/charge.";
    this.selectedRing = Math.max(0, Math.min(value.ringCount - 1, this.selectedRing));
    this.ringSelection.textContent = `${this.selectedRing + 1} / ${value.ringCount}`;
    for (const { definition, slider, numeric } of this.bindings) {
      const current = definition.read(value);
      slider.value = String(current);
      if (this.shadow.activeElement !== numeric) numeric.value = String(current);
    }
    for (const [slot, button] of this.slotButtons)
      button.setAttribute("aria-pressed", String(slot === this.selectedSlot));
    const color = this.selectedColor(value);
    this.colorInput.value = packedToHex(color);
    if (this.shadow.activeElement !== this.hexInput) this.hexInput.value = packedToHex(color).toUpperCase();
    this.status.textContent =
      `${this.activeTargetLabel} · live mesh · ${value.ringCount} rings · ${(
        value.ringCount * 5 * value.segmentCount
      ).toLocaleString()} vertices · ${(
        value.ringCount * 4 * value.segmentCount * 2
      ).toLocaleString()} triangles`;
  }

  private selectedColor(value: Readonly<SpinRingSettingsValue>): number {
    return value.ringOverrides[this.selectedRing][this.selectedSlot];
  }
  private setSelectedColor(value: number): void {
    this.activeSettings.updateRing(this.selectedRing, {
      [this.selectedSlot]: value,
    } as Partial<SpinRingOverride>);
  }

  private async copyJson(): Promise<void> {
    const source = this.activeSettings.serialize(true);
    try {
      await navigator.clipboard.writeText(source);
      this.setStatus("Tuning JSON copied to the clipboard.");
    } catch {
      window.prompt("Copy spin orbital-ring tuning JSON", source);
    }
  }
  private downloadJson(): void {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([this.activeSettings.serialize(true)], { type: "application/json" }),
    );
    link.download =
      this.activeTarget === "character"
        ? "spin-orbital-ring-tuning.json"
        : "grounded-skate-spin-ring-tuning.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  private async loadJson(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      this.activeSettings.importJson(await file.text());
      this.setStatus(`Loaded ${file.name}.`);
    } catch (error) {
      this.setStatus(`Could not load tuning: ${String(error)}`);
    }
  }
  private button(text: string, className = ""): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }
  private make<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text = "",
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }
}

export function createSpinTuningPanel(
  options: SpinTuningPanelOptions = {},
): SpinTuningPanel {
  return new SpinTuningPanel(options);
}
