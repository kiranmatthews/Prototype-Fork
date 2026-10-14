import {
  VisualTreatmentSettings,
  VISUAL_TREATMENT_PRESETS,
  visualTreatmentActivity,
  visualTreatmentSettings,
  type Color3,
  type ToneMapper,
  type VisualTreatmentPatch,
  type VisualTreatmentValue,
} from "./settings";

interface NumberControl {
  label: string;
  min: number;
  max: number;
  step: number;
  read: (value: Readonly<VisualTreatmentValue>) => number;
  write: (
    value: number,
    current: Readonly<VisualTreatmentValue>,
  ) => VisualTreatmentPatch;
}

interface SectionDefinition {
  title: string;
  open?: boolean;
  controls: readonly NumberControl[];
}

const grade = (
  label: string,
  key: "exposureEV" | "contrastPct" | "saturationPct" | "hueShiftDeg" | "temperature" | "tint" | "splitBalancePct",
  min: number,
  max: number,
  step: number,
): NumberControl => ({
  label,
  min,
  max,
  step,
  read: (value) => value.grading[key],
  write: (value) => ({ grading: { [key]: value } }),
});

const vector = (
  label: string,
  key: "colorFilter" | "lift" | "gamma" | "gain" | "splitShadows" | "splitHighlights",
  index: 0 | 1 | 2,
  min: number,
  max: number,
  step: number,
): NumberControl => ({
  label,
  min,
  max,
  step,
  read: (value) => value.grading[key][index],
  write: (value, current) => {
    const next = [...current.grading[key]] as Color3;
    next[index] = value;
    return { grading: { [key]: next } };
  },
});

const mixer = (
  label: string,
  row: 0 | 1 | 2,
  column: 0 | 1 | 2,
): NumberControl => ({
  label,
  min: -200,
  max: 200,
  step: 1,
  read: (value) => value.grading.channelMixer[row][column],
  write: (value, current) => {
    const next = current.grading.channelMixer.map((values) => [...values]) as [
      Color3,
      Color3,
      Color3,
    ];
    next[row][column] = value;
    return { grading: { channelMixer: next } };
  },
});

const bloom = (
  label: string,
  key: "intensity" | "threshold" | "scatter" | "clamp" | "maxIterations",
  min: number,
  max: number,
  step: number,
): NumberControl => ({
  label,
  min,
  max,
  step,
  read: (value) => value.bloom[key],
  write: (value) => ({ bloom: { [key]: value } }),
});

const bloomTint = (label: string, index: 0 | 1 | 2): NumberControl => ({
  label,
  min: 0,
  max: 4,
  step: 0.01,
  read: (value) => value.bloom.tint[index],
  write: (value, current) => {
    const next = [...current.bloom.tint] as Color3;
    next[index] = value;
    return { bloom: { tint: next } };
  },
});

const vignette = (
  label: string,
  key: "intensity" | "smoothness",
  min: number,
  max: number,
  step: number,
): NumberControl => ({
  label,
  min,
  max,
  step,
  read: (value) => value.vignette[key],
  write: (value) => ({ vignette: { [key]: value } }),
});

const SECTIONS: readonly SectionDefinition[] = [
  {
    title: "Color adjustments",
    open: true,
    controls: [
      grade("Exposure EV", "exposureEV", -5, 5, 0.01),
      grade("Contrast %", "contrastPct", -100, 100, 0.1),
      grade("Saturation %", "saturationPct", -100, 100, 0.1),
      grade("Hue shift °", "hueShiftDeg", -180, 180, 0.5),
      grade("Temperature", "temperature", -100, 100, 0.5),
      grade("White-balance tint", "tint", -100, 100, 0.5),
      vector("Filter R", "colorFilter", 0, 0, 2, 0.01),
      vector("Filter G", "colorFilter", 1, 0, 2, 0.01),
      vector("Filter B", "colorFilter", 2, 0, 2, 0.01),
    ],
  },
  {
    title: "Lift · gamma · gain",
    controls: [
      vector("Lift R", "lift", 0, -0.5, 0.5, 0.005),
      vector("Lift G", "lift", 1, -0.5, 0.5, 0.005),
      vector("Lift B", "lift", 2, -0.5, 0.5, 0.005),
      vector("Gamma R", "gamma", 0, 0.1, 4, 0.01),
      vector("Gamma G", "gamma", 1, 0.1, 4, 0.01),
      vector("Gamma B", "gamma", 2, 0.1, 4, 0.01),
      vector("Gain R", "gain", 0, 0, 4, 0.01),
      vector("Gain G", "gain", 1, 0, 4, 0.01),
      vector("Gain B", "gain", 2, 0, 4, 0.01),
    ],
  },
  {
    title: "Split tone · channel mixer",
    controls: [
      grade("Split balance %", "splitBalancePct", -100, 100, 1),
      mixer("Red out · Red in", 0, 0),
      mixer("Red out · Green in", 0, 1),
      mixer("Red out · Blue in", 0, 2),
      mixer("Green out · Red in", 1, 0),
      mixer("Green out · Green in", 1, 1),
      mixer("Green out · Blue in", 1, 2),
      mixer("Blue out · Red in", 2, 0),
      mixer("Blue out · Green in", 2, 1),
      mixer("Blue out · Blue in", 2, 2),
    ],
  },
  {
    title: "Unity bloom",
    open: true,
    controls: [
      bloom("Intensity", "intensity", 0, 5, 0.01),
      bloom("Threshold (gamma)", "threshold", 0, 4, 0.01),
      bloom("Scatter", "scatter", 0, 1, 0.01),
      bloom("HDR clamp", "clamp", 0, 65472, 1),
      bloom("Max iterations", "maxIterations", 2, 8, 1),
      bloomTint("Bloom tint R", 0),
      bloomTint("Bloom tint G", 1),
      bloomTint("Bloom tint B", 2),
    ],
  },
  {
    title: "Vignette",
    controls: [
      vignette("Intensity", "intensity", 0, 1, 0.01),
      vignette("Smoothness", "smoothness", 0.01, 1, 0.01),
      {
        label: "Center X",
        min: 0,
        max: 1,
        step: 0.01,
        read: (value) => value.vignette.center[0],
        write: (value, current) => ({
          vignette: { center: [value, current.vignette.center[1]] },
        }),
      },
      {
        label: "Center Y",
        min: 0,
        max: 1,
        step: 0.01,
        read: (value) => value.vignette.center[1],
        write: (value, current) => ({
          vignette: { center: [current.vignette.center[0], value] },
        }),
      },
    ],
  },
];

const CSS = `
  :host{all:initial;position:fixed;inset:0;z-index:115;pointer-events:none;color:#f8efff;
    font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  *{box-sizing:border-box;border-radius:0!important}button,input,select{font:inherit}
  .launcher{position:fixed;top:76%;right:0;pointer-events:auto;padding:10px 6px;border:1px solid #d887ff;
    border-right:0;background:#130918;color:#edb8ff;font-weight:900;letter-spacing:.8px;cursor:pointer}
  :host([data-open]) .launcher{display:none}.panel{display:none;position:fixed;top:12px;right:12px;bottom:12px;
    width:min(470px,calc(100vw - 24px));pointer-events:auto;overflow:hidden;border:2px solid #d887ff;
    background:#0a0810;box-shadow:-10px 10px 0 #000a}
  :host([data-open]) .panel{display:flex;flex-direction:column}.title{display:flex;align-items:center;gap:8px;
    padding:10px 12px;border-bottom:2px solid #d887ff;background:#211028;font-weight:900}.title span{flex:1}
  .close{width:30px}.intro,.status{padding:9px 11px;color:#c8b3d1;border-bottom:1px solid #53305e;font-size:10px}
  .actions{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-bottom:1px solid #53305e}
  button{min-height:28px;padding:5px 9px;border:1px solid #71417f;background:#19101d;color:#fff;cursor:pointer}
  .toggle{display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #53305e;font-weight:900}
  .sections{flex:1;overflow:auto;padding:8px}details{border:1px solid #34263a;border-bottom:0;background:#0d0b12}
  details:last-child{border-bottom:1px solid #34263a}summary{padding:9px;color:#edb8ff;background:#1b1220;
    font-weight:900;text-transform:uppercase;cursor:pointer}
  .control{display:grid;grid-template-columns:minmax(128px,1fr) minmax(90px,1fr) 76px;gap:7px;
    align-items:center;min-height:38px;padding:5px 8px;border-top:1px solid #28202c}
  input[type=range]{width:100%;accent-color:#d887ff}input[type=number],select{padding:3px 5px;
    border:1px solid #71417f;background:#050407;color:#fff;text-align:right}
  input[type=number]{width:76px}select{width:92px}
  .option,.color{display:flex;align-items:center;gap:10px;padding:8px;border-top:1px solid #28202c}
  .option span,.color span{flex:1}.color input{width:42px;height:28px}.status{border-top:1px solid #53305e;border-bottom:0}
`;

const hex = (color: readonly number[]): string =>
  `#${color.map((part) => Math.round(Math.min(1, Math.max(0, part)) * 255)
    .toString(16).padStart(2, "0")).join("")}`;
const fromHex = (source: string): Color3 => [
  Number.parseInt(source.slice(1, 3), 16) / 255,
  Number.parseInt(source.slice(3, 5), 16) / 255,
  Number.parseInt(source.slice(5, 7), 16) / 255,
];

export class VisualTreatmentPanel {
  readonly element: HTMLElement;
  private readonly shadow: ShadowRoot;
  private readonly bindings: Array<(value: Readonly<VisualTreatmentValue>, active: Element | null) => void> = [];
  private readonly pending = new Map<HTMLInputElement, (value: Readonly<VisualTreatmentValue>) => VisualTreatmentPatch>();
  private status: HTMLElement | null = null;
  private frame: number | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private activeNumber: HTMLInputElement | null = null;
  private opened = false;
  private disposed = false;
  private readonly unsubscribe: () => void;
  private readonly onPageHide = (): void => this.flush();
  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.flush();
  };

  constructor(private readonly settings: VisualTreatmentSettings) {
    this.element = document.createElement("visual-treatment-panel");
    this.shadow = this.element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    this.shadow.append(style);
    const launcher = this.button("LOOK", "launcher");
    launcher.setAttribute("aria-label", "Open visual treatment panel");
    launcher.hidden = document.body.classList.contains("tc-on");
    launcher.addEventListener("click", () => this.setOpen(true));
    this.shadow.append(launcher);
    document.body.append(this.element);
    // Most sessions never open LOOK. The shell needs no controls or refresh loop.
    this.unsubscribe = this.settings.subscribe(() => {
      if (this.opened) this.schedule();
    });
    window.addEventListener("pagehide", this.onPageHide);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private build(): void {
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Visual treatment panel");
    const title = document.createElement("header");
    title.className = "title";
    title.append(document.createElement("span"), this.button("×", "close"));
    title.querySelector("span")!.textContent = "VISUAL TREATMENT";
    const close = title.querySelector("button")!;
    close.setAttribute("aria-label", "Close visual treatment panel");
    close.addEventListener("click", () => this.setOpen(false));
    panel.append(title);
    const intro = document.createElement("div");
    intro.className = "intro";
    intro.textContent = "Unity-style HDR bloom plus a change-driven 32³ color-grading LUT. Neutral settings stay on the direct path.";
    panel.append(intro);

    const actions = document.createElement("div");
    actions.className = "actions";
    const reset = this.button("Reset neutral");
    reset.addEventListener("click", () => this.commit(() => this.settings.reset()));
    actions.append(reset);
    for (const [label, preset] of [
      ["Default Unity", VISUAL_TREATMENT_PRESETS.unityDefault],
      ["Coast Unity", VISUAL_TREATMENT_PRESETS.coast],
      ["Bonus Unity", VISUAL_TREATMENT_PRESETS.bonus],
      ["Meshy Unity", VISUAL_TREATMENT_PRESETS.meshy],
    ] as const) {
      const button = this.button(label);
      button.addEventListener("click", () => this.commit(() => this.settings.applyPreset(preset)));
      actions.append(button);
    }
    panel.append(actions);

    const toggle = document.createElement("label");
    toggle.className = "toggle";
    const enabled = this.checkbox("Enable visual treatment", value => value.enabled,
      checked => ({ enabled: checked }));
    toggle.append(enabled, document.createTextNode("Enable treatment"));
    panel.append(toggle);

    const sections = document.createElement("div");
    sections.className = "sections";
    const colorDetails = this.details("Color adjustments", true);
    const toneMapper = document.createElement("select");
    toneMapper.setAttribute("aria-label", "Tone mapper");
    for (const value of ["none", "neutral", "aces"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.toUpperCase();
      toneMapper.append(option);
    }
    toneMapper.addEventListener("change", () =>
      this.commit(() => this.settings.patch({ grading: { toneMapper: toneMapper.value as ToneMapper } })),
    );
    this.bindValue(toneMapper, value => value.grading.toneMapper);
    colorDetails.append(this.optionRow("Tone mapper", toneMapper));
    this.addColor(colorDetails, "Color filter", (value) => value.grading.colorFilter,
      (value) => ({ grading: { colorFilter: value } }));
    for (const control of SECTIONS[0].controls) colorDetails.append(this.control(control));
    sections.append(colorDetails);

    for (const definition of SECTIONS.slice(1, 3)) {
      const details = this.details(definition.title, definition.open ?? false);
      if (definition.title.startsWith("Split")) {
        this.addColor(details, "Shadow tone", (value) => value.grading.splitShadows,
          (value) => ({ grading: { splitShadows: value } }));
        this.addColor(details, "Highlight tone", (value) => value.grading.splitHighlights,
          (value) => ({ grading: { splitHighlights: value } }));
      }
      for (const control of definition.controls) details.append(this.control(control));
      sections.append(details);
    }

    const bloomDetails = this.details("Unity bloom", true);
    this.addColor(bloomDetails, "Bloom tint", (value) => value.bloom.tint,
      (value) => ({ bloom: { tint: value } }));
    const highQuality = this.checkbox("High quality bloom filtering", value => value.bloom.highQuality,
      checked => ({ bloom: { highQuality: checked } }));
    bloomDetails.append(this.optionRow("HQ bicubic upsample", highQuality));
    const downscale = document.createElement("select");
    downscale.setAttribute("aria-label", "Bloom starting resolution");
    for (const [value, label] of [["2", "Half"], ["4", "Quarter"]] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      downscale.append(option);
    }
    downscale.addEventListener("change", () =>
      this.commit(() => this.settings.patch({ bloom: { downscale: downscale.value === "4" ? 4 : 2 } })),
    );
    this.bindValue(downscale, value => String(value.bloom.downscale));
    bloomDetails.append(this.optionRow("Starting resolution", downscale));
    for (const control of SECTIONS[3].controls) bloomDetails.append(this.control(control));
    sections.append(bloomDetails);

    const vignetteDetails = this.details("Vignette", false);
    this.addColor(vignetteDetails, "Vignette color", (value) => value.vignette.color,
      (value) => ({ vignette: { color: value } }));
    const rounded = this.checkbox("Rounded vignette", value => value.vignette.rounded,
      checked => ({ vignette: { rounded: checked } }));
    vignetteDetails.append(this.optionRow("Rounded / aspect-correct", rounded));
    for (const control of SECTIONS[4].controls) vignetteDetails.append(this.control(control));
    sections.append(vignetteDetails);
    panel.append(sections);
    this.status = document.createElement("div");
    this.status.className = "status";
    panel.append(this.status);
    this.shadow.append(panel);
  }

  dispose(): void {
    if (this.disposed) return;
    this.setOpen(false);
    this.flush();
    this.disposed = true;
    this.unsubscribe();
    window.removeEventListener("pagehide", this.onPageHide);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.element.remove();
  }

  setOpen(open: boolean): void {
    if (this.disposed || open === this.opened) return;
    this.opened = open;
    if (!open) this.activeNumber = null;
    if (open && !this.status) this.build();
    this.element.toggleAttribute("data-open", open);
    this.flush();
  }

  private schedule(): void {
    if (this.frame !== null || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      // Retain the frame sentinel through notification so our own write cannot
      // schedule a redundant second refresh.
      try {
        this.applyPending();
        if (this.opened) this.refresh(this.settings.value);
      } finally {
        this.frame = null;
      }
    });
  }

  private queue(input: HTMLInputElement, write: (value: Readonly<VisualTreatmentValue>) => VisualTreatmentPatch): void {
    // Reinsert so overlapping picker/channel edits retain input order.
    this.pending.delete(input);
    this.pending.set(input, write);
    this.schedule();
  }

  private applyPending(): void {
    if (!this.pending.size) return;
    // Fold writes against the latest state, preserving simultaneous RGB/mixer
    // edits and external changes to other controls. Persist/notify only once.
    let value = this.settings.value;
    const patch: VisualTreatmentPatch = {};
    for (const write of this.pending.values()) {
      const next = write(value);
      if (next.enabled !== undefined) patch.enabled = next.enabled;
      if (next.grading) patch.grading = { ...patch.grading, ...next.grading };
      if (next.bloom) patch.bloom = { ...patch.bloom, ...next.bloom };
      if (next.vignette) patch.vignette = { ...patch.vignette, ...next.vignette };
      value = {
        enabled: patch.enabled ?? value.enabled,
        grading: next.grading ? { ...value.grading, ...next.grading } : value.grading,
        bloom: next.bloom ? { ...value.bloom, ...next.bloom } : value.bloom,
        vignette: next.vignette ? { ...value.vignette, ...next.vignette } : value.vignette,
      };
    }
    this.pending.clear();
    this.settings.patch(patch, { persist: false });
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    // Preview at display rate; synchronous browser storage is off the drag path.
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.settings.flush();
    }, 180);
  }

  private flush(): void {
    this.applyPending();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.settings.flush();
    if (this.opened) this.refresh(this.settings.value);
  }

  private commit(action: () => void): void {
    this.applyPending();
    action();
    this.flush();
  }

  private bindValue(input: HTMLInputElement | HTMLSelectElement, read: (value: Readonly<VisualTreatmentValue>) => string): void {
    this.bindings.push(value => {
      const next = read(value);
      if (input.value !== next) input.value = next;
    });
  }

  private checkbox(label: string, read: (value: Readonly<VisualTreatmentValue>) => boolean,
    write: (checked: boolean) => VisualTreatmentPatch): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => this.commit(() => this.settings.patch(write(input.checked))));
    this.bindings.push(value => {
      const next = read(value);
      if (input.checked !== next) input.checked = next;
    });
    return input;
  }

  private control(control: NumberControl): HTMLElement {
    const row = document.createElement("label");
    row.className = "control";
    const text = document.createElement("span");
    text.textContent = control.label;
    const range = document.createElement("input");
    range.type = "range";
    range.min = String(control.min);
    range.max = String(control.max);
    range.step = String(control.step);
    range.setAttribute("aria-label", control.label);
    const number = document.createElement("input");
    number.type = "number";
    number.min = range.min;
    number.max = range.max;
    number.step = range.step;
    number.setAttribute("aria-label", `${control.label} numeric value`);
    const queueRange = (): void => {
      const next = range.valueAsNumber;
      if (Number.isFinite(next)) this.queue(range, value => control.write(next, value));
    };
    range.addEventListener("input", queueRange);
    range.addEventListener("change", () => { queueRange(); this.flush(); });
    number.addEventListener("change", () => {
      const next = number.valueAsNumber;
      this.commit(() => {
        if (Number.isFinite(next)) this.settings.patch(control.write(next, this.settings.value));
      });
      // A committed/blurred numeric edit always displays its clamped value;
      // incomplete typing is left alone until then.
      number.value = String(control.read(this.settings.value));
    });
    number.addEventListener("focus", () => { this.activeNumber = number; });
    number.addEventListener("blur", () => {
      if (this.activeNumber === number) this.activeNumber = null;
      const next = String(control.read(this.settings.value));
      if (number.value !== next) number.value = next;
    });
    row.append(text, range, number);
    let previous: number | undefined;
    this.bindings.push((value, active) => {
      const next = control.read(value);
      if (next === previous) return;
      previous = next;
      const serialized = String(next);
      if (range.value !== serialized) range.value = serialized;
      if (active !== number && number.value !== serialized) number.value = serialized;
    });
    return row;
  }

  private details(title: string, open: boolean): HTMLDetailsElement {
    const details = document.createElement("details");
    details.open = open;
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.append(summary);
    return details;
  }

  private optionRow(label: string, input: HTMLElement): HTMLElement {
    const row = document.createElement("label");
    row.className = "option";
    const text = document.createElement("span");
    text.textContent = label;
    row.append(text, input);
    return row;
  }

  private addColor(
    parent: HTMLElement,
    label: string,
    read: (value: Readonly<VisualTreatmentValue>) => readonly number[],
    write: (value: Color3) => VisualTreatmentPatch,
  ): void {
    const row = document.createElement("label");
    row.className = "color";
    const text = document.createElement("span");
    text.textContent = label;
    const input = document.createElement("input");
    input.type = "color";
    input.setAttribute("aria-label", label);
    const queueColor = (): void => {
      const next = fromHex(input.value);
      this.queue(input, () => write(next));
    };
    input.addEventListener("input", queueColor);
    input.addEventListener("change", () => { queueColor(); this.flush(); });
    row.append(text, input);
    parent.append(row);
    let previous: readonly number[] = [];
    this.bindings.push(value => {
      const next = read(value);
      if (next.every((part, index) => part === previous[index])) return;
      previous = [...next];
      const serialized = hex(next);
      if (input.value !== serialized) input.value = serialized;
    });
  }

  private refresh(value: Readonly<VisualTreatmentValue>): void {
    // Querying ShadowRoot.activeElement can synchronously resolve dirty style.
    // Focus/blur already tell us which numeric draft must be left untouched.
    const active = this.activeNumber;
    for (const refresh of this.bindings) refresh(value, active);
    const activity = visualTreatmentActivity(value);
    const parts = [
      activity.grading ? "GRADE" : "",
      activity.bloom ? "BLOOM" : "",
      activity.vignette ? "VIGNETTE" : "",
    ].filter(Boolean);
    const status = !value.enabled
      ? "OFF · direct presentation path"
      : parts.length
        ? `${parts.join(" + ")} · LUT rebuilds only when controls change`
        : "NEUTRAL · direct presentation path";
    if (this.status!.textContent !== status) this.status!.textContent = status;
  }

  private button(text: string, className = ""): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }
}

export function createVisualTreatmentPanel(
  settings = visualTreatmentSettings,
): VisualTreatmentPanel {
  return new VisualTreatmentPanel(settings);
}
