import {
  VisualTreatmentSettings,
  VISUAL_TREATMENT_PRESETS,
  visualTreatmentSettings,
  type VisualTreatmentValue,
} from "./settings";

interface Control {
  label: string;
  key: keyof VisualTreatmentValue;
  min: number;
  max: number;
  step: number;
}

const CONTROLS: readonly Control[] = [
  { label: "Exposure", key: "exposure", min: -2, max: 2, step: 0.01 },
  { label: "Contrast", key: "contrast", min: 0.25, max: 2, step: 0.01 },
  { label: "Saturation", key: "saturation", min: 0, max: 2, step: 0.01 },
  { label: "Bloom intensity", key: "bloomIntensity", min: 0, max: 2, step: 0.01 },
  { label: "Bloom threshold", key: "bloomThreshold", min: 0, max: 2, step: 0.01 },
  { label: "Bloom radius", key: "bloomRadius", min: 0.5, max: 16, step: 0.1 },
  { label: "Vignette", key: "vignetteIntensity", min: 0, max: 1, step: 0.01 },
  { label: "Vignette softness", key: "vignetteSmoothness", min: 0.05, max: 1, step: 0.01 },
];

const CSS = `
  :host{all:initial;position:fixed;inset:0;z-index:95;pointer-events:none;color:#f8efff;
    font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  *{box-sizing:border-box;border-radius:0!important}button,input{font:inherit}
  .launcher{position:fixed;top:76%;right:0;pointer-events:auto;padding:10px 6px;border:1px solid #d887ff;
    border-right:0;background:#130918;color:#edb8ff;font-weight:900;letter-spacing:.8px;cursor:pointer}
  :host([data-open]) .launcher{display:none}.panel{display:none;position:fixed;top:12px;right:12px;bottom:12px;
    width:min(430px,calc(100vw - 24px));pointer-events:auto;overflow:auto;border:2px solid #d887ff;background:#0a0810}
  :host([data-open]) .panel{display:block}.title{display:flex;align-items:center;gap:8px;padding:10px 12px;
    border-bottom:2px solid #d887ff;background:#211028;font-weight:900}.title span{flex:1}.close{width:30px}
  .intro,.status{padding:9px 11px;color:#c8b3d1;border-bottom:1px solid #53305e;font-size:10px}
  .actions{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid #53305e}
  .actions{flex-wrap:wrap}
  button{min-height:28px;padding:5px 9px;border:1px solid #71417f;background:#19101d;color:#fff;cursor:pointer}
  .toggle{display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #53305e;font-weight:900}
  .control{display:grid;grid-template-columns:minmax(120px,1fr) minmax(90px,1fr) 72px;gap:7px;
    align-items:center;min-height:39px;padding:5px 9px;border-bottom:1px solid #28202c}
  input[type=range]{width:100%;accent-color:#d887ff}input[type=number]{width:72px;padding:3px 5px;
    border:1px solid #71417f;background:#050407;color:#fff;text-align:right}
  .tint{display:flex;align-items:center;gap:10px;padding:10px}.tint input{width:42px;height:28px}
`;

const hex = (value: Readonly<VisualTreatmentValue>): string =>
  `#${[value.tintR, value.tintG, value.tintB]
    .map((part) => Math.round(Math.min(1, part) * 255).toString(16).padStart(2, "0"))
    .join("")}`;

export class VisualTreatmentPanel {
  readonly element: HTMLElement;
  private readonly shadow: ShadowRoot;
  private readonly bindings: Array<{ control: Control; range: HTMLInputElement; number: HTMLInputElement }> = [];
  private readonly enabled: HTMLInputElement;
  private readonly tint: HTMLInputElement;
  private readonly unsubscribe: () => void;

  constructor(private readonly settings: VisualTreatmentSettings) {
    this.element = document.createElement("visual-treatment-panel");
    this.shadow = this.element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    this.shadow.append(style);
    const launcher = this.button("LOOK", "launcher");
    launcher.setAttribute("aria-label", "Open visual treatment panel");
    launcher.addEventListener("click", () => this.element.toggleAttribute("data-open", true));
    this.shadow.append(launcher);
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
    close.addEventListener("click", () => this.element.removeAttribute("data-open"));
    panel.append(title);
    const intro = document.createElement("div");
    intro.className = "intro";
    intro.textContent = "One shared grading, bloom and vignette stack. Global for now; ready for per-level presets later.";
    panel.append(intro);
    const actions = document.createElement("div");
    actions.className = "actions";
    const reset = this.button("Reset neutral");
    reset.addEventListener("click", () => this.settings.reset());
    actions.append(reset);
    for (const [label, preset] of [
      ["Coast source", VISUAL_TREATMENT_PRESETS.coast],
      ["Bonus source", VISUAL_TREATMENT_PRESETS.bonus],
      ["Meshy source", VISUAL_TREATMENT_PRESETS.meshy],
    ] as const) {
      const button = this.button(label);
      button.addEventListener("click", () => this.settings.applyPreset(preset));
      actions.append(button);
    }
    panel.append(actions);
    const toggle = document.createElement("label");
    toggle.className = "toggle";
    this.enabled = document.createElement("input");
    this.enabled.type = "checkbox";
    this.enabled.setAttribute("aria-label", "Enable visual treatment");
    this.enabled.addEventListener("change", () => this.settings.patch({ enabled: this.enabled.checked }));
    toggle.append(this.enabled, document.createTextNode("Enable treatment"));
    panel.append(toggle);
    for (const control of CONTROLS) panel.append(this.control(control));
    const tintLabel = document.createElement("label");
    tintLabel.className = "tint";
    this.tint = document.createElement("input");
    this.tint.type = "color";
    this.tint.setAttribute("aria-label", "Color filter");
    this.tint.addEventListener("input", () => {
      const source = this.tint.value;
      this.settings.patch({
        tintR: Number.parseInt(source.slice(1, 3), 16) / 255,
        tintG: Number.parseInt(source.slice(3, 5), 16) / 255,
        tintB: Number.parseInt(source.slice(5, 7), 16) / 255,
      });
    });
    tintLabel.append(this.tint, document.createTextNode("Color filter"));
    panel.append(tintLabel);
    const status = document.createElement("div");
    status.className = "status";
    status.textContent = "Neutral defaults preserve the current presentation.";
    panel.append(status);
    this.shadow.append(panel);
    document.body.append(this.element);
    this.unsubscribe = this.settings.subscribe((value) => this.refresh(value), true);
  }

  dispose(): void {
    this.unsubscribe();
    this.element.remove();
  }

  private control(control: Control): HTMLElement {
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
    const commit = (source: HTMLInputElement): void => {
      const value = Number(source.value);
      if (Number.isFinite(value))
        this.settings.patch({ [control.key]: value });
    };
    range.addEventListener("input", () => commit(range));
    number.addEventListener("change", () => commit(number));
    row.append(text, range, number);
    this.bindings.push({ control, range, number });
    return row;
  }

  private refresh(value: Readonly<VisualTreatmentValue>): void {
    this.enabled.checked = value.enabled;
    this.tint.value = hex(value);
    for (const { control, range, number } of this.bindings) {
      const serialized = String(value[control.key]);
      range.value = serialized;
      if (this.shadow.activeElement !== number) number.value = serialized;
    }
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
