import {
  SkateboardSettings,
  skateboardSettings,
  type SkateboardColor,
  type SkateboardSettingsValue,
} from "./settings";

interface SliderDefinition {
  readonly label: string;
  readonly key?: keyof SkateboardSettingsValue;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly read?: (value: Readonly<SkateboardSettingsValue>) => number;
  readonly write?: (value: number) => Partial<SkateboardSettingsValue>;
}

interface SectionDefinition {
  readonly title: string;
  readonly controls: readonly SliderDefinition[];
}

export interface SkateboardTuningPanelOptions {
  readonly settings?: SkateboardSettings;
  readonly parent?: HTMLElement;
  readonly initiallyOpen?: boolean;
  readonly labMode?: boolean;
}

const SECTIONS: readonly SectionDefinition[] = [
  {
    title: "Board shape",
    controls: [
      { label: "Overall scale", key: "overallScale", min: 0.25, max: 3, step: 0.001 },
      { label: "Deck half width", key: "deckHalfWidth", min: 0.05, max: 0.65, step: 0.001 },
      {
        label: "Deck length",
        min: 0.4,
        max: 3.6,
        step: 0.001,
        read: (s) => s.deckTailLength + s.deckNoseLength,
        write: (value) => ({ deckTailLength: value * 0.5, deckNoseLength: value * 0.5 }),
      },
      { label: "Tail body transition", key: "centralTailTransition", min: -0.9, max: -0.1, step: 0.001 },
      { label: "Nose body transition", key: "centralNoseTransition", min: 0.1, max: 0.9, step: 0.001 },
      { label: "Tail taper length", key: "tailTaperLongitudinalExponent", min: 0.25, max: 8, step: 0.01 },
      { label: "Tail taper width", key: "tailTaperTransverseExponent", min: 0.25, max: 8, step: 0.01 },
      { label: "Nose taper length", key: "noseTaperLongitudinalExponent", min: 0.25, max: 8, step: 0.01 },
      { label: "Nose taper width", key: "noseTaperTransverseExponent", min: 0.25, max: 8, step: 0.01 },
    ],
  },
  {
    title: "Deck curve",
    controls: [
      { label: "Tail kick rise", key: "tailKickRise", min: 0, max: 0.25, step: 0.001 },
      { label: "Nose kick rise", key: "noseKickRise", min: 0, max: 0.25, step: 0.001 },
      { label: "Tail kick start", key: "tailKickStart", min: -0.95, max: -0.05, step: 0.001 },
      { label: "Nose kick start", key: "noseKickStart", min: 0.05, max: 0.95, step: 0.001 },
      { label: "Concave depth", key: "concaveDepth", min: 0, max: 0.05, step: 0.0001 },
      { label: "Concave fade start", key: "concaveFadeStart", min: 0.1, max: 0.95, step: 0.001 },
      { label: "Concave tip multiplier", key: "concaveTipMultiplier", min: 0, max: 1, step: 0.01 },
      { label: "Rail bevel radius", key: "railBevelRadius", min: 0, max: 0.02, step: 0.0001 },
      { label: "Rail bevel segments", key: "railBevelSegments", min: 1, max: 8, step: 1 },
      { label: "Length rows", key: "deckLengthSegments", min: 4, max: 256, step: 1 },
      { label: "Width columns", key: "deckWidthSegments", min: 3, max: 64, step: 1 },
      { label: "Deck thickness", key: "deckThickness", min: 0.003, max: 0.04, step: 0.0001 },
    ],
  },
  {
    title: "Wheels",
    controls: [
      { label: "Wheel radius", key: "wheelRadius", min: 0.025, max: 0.2, step: 0.001 },
      { label: "Wheel width", key: "wheelWidth", min: 0.025, max: 0.3, step: 0.001 },
      { label: "Track half width", key: "wheelTrackHalfWidth", min: 0.05, max: 0.65, step: 0.001 },
    ],
  },
  {
    title: "Trucks",
    controls: [
      { label: "Front truck Z", key: "frontTruckLocalZ", min: 0.05, max: 1.75, step: 0.001 },
      { label: "Rear truck Z", key: "rearTruckLocalZ", min: -1.75, max: -0.05, step: 0.001 },
      { label: "Front rotation X°", key: "frontTruckRotationXDegrees", min: -180, max: 180, step: 0.1 },
      { label: "Front rotation Y°", key: "frontTruckRotationYDegrees", min: -180, max: 180, step: 0.1 },
      { label: "Front rotation Z°", key: "frontTruckRotationZDegrees", min: -180, max: 180, step: 0.1 },
      { label: "Rear rotation X°", key: "rearTruckRotationXDegrees", min: -180, max: 180, step: 0.1 },
      { label: "Rear rotation Y°", key: "rearTruckRotationYDegrees", min: -180, max: 180, step: 0.1 },
      { label: "Rear rotation Z°", key: "rearTruckRotationZDegrees", min: -180, max: 180, step: 0.1 },
      { label: "Baseplate width", key: "truckBaseplateWidth", min: 0.03, max: 0.6, step: 0.001 },
      { label: "Baseplate length", key: "truckBaseplateLength", min: 0.02, max: 0.4, step: 0.001 },
      { label: "Baseplate thick", key: "truckBaseplateThickness", min: 0.003, max: 0.12, step: 0.001 },
      { label: "Hanger radius", key: "truckHangerRadius", min: 0.004, max: 0.08, step: 0.001 },
      { label: "Imported truck scale", key: "replacementTruckScale", min: 0.01, max: 10, step: 0.01 },
    ],
  },
  {
    title: "Placement / art",
    controls: [
      { label: "Board to ground", key: "boardToGroundDistance", min: 0.04, max: 0.6, step: 0.001 },
      { label: "Artwork scale X", key: "artworkScaleX", min: 0.2, max: 3, step: 0.001 },
      { label: "Artwork scale Y", key: "artworkScaleY", min: 0.2, max: 3, step: 0.001 },
    ],
  },
  {
    title: "Deck finish",
    controls: [
      { label: "Top wear", key: "topWear", min: 0, max: 1, step: 0.01 },
      { label: "Top wear rough", key: "topWearRoughness", min: 0, max: 1, step: 0.01 },
      { label: "Bottom wear", key: "bottomWear", min: 0, max: 1, step: 0.01 },
      { label: "Bottom wear rough", key: "bottomWearRoughness", min: 0, max: 1, step: 0.01 },
    ],
  },
];

const CSS = `
  :host { all: initial; position: fixed; inset: 0; z-index: 94; pointer-events: none;
    color: #f6f1e8; font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  *, *::before, *::after { box-sizing: border-box; border-radius: 0 !important; }
  button, input { font: inherit; }
  .launcher { position: fixed; top: 52%; right: 0; pointer-events: auto; padding: 10px 6px;
    border: 1px solid #ff9438; border-right: 0; background: #130b06; color: #ffbd76;
    font-weight: 900; letter-spacing: .8px; cursor: pointer; box-shadow: -4px 4px 0 #0008; }
  :host([data-open]) .launcher { display: none; }
  .panel { display: none; position: fixed; top: 12px; right: 12px; bottom: 12px;
    width: min(470px, calc(100vw - 24px)); pointer-events: auto; overflow: hidden;
    border: 2px solid #ff9438; background: #090c11; box-shadow: -10px 10px 0 #000b; }
  :host([data-open]) .panel { display: flex; flex-direction: column; }
  .title { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 12px;
    border-bottom: 2px solid #ff9438; background: #21140c; font-weight: 900; letter-spacing: 1px; }
  .title span { flex: 1; } .close { width: 30px; padding: 3px; }
  .intro { flex: 0 0 auto; padding: 9px 11px; color: #c2af9b; border-bottom: 1px solid #51311c;
    font-size: 10px; }
  .actions { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 10px;
    border-bottom: 1px solid #51311c; }
  .sections { flex: 1 1 auto; overflow: auto; padding: 8px 9px 14px; scrollbar-color: #ad5e27 #090c11; }
  details { border: 1px solid #4b2c19; border-bottom: 0; background: #0e1117; }
  details:last-child { border-bottom: 1px solid #4b2c19; }
  summary { padding: 9px 10px; cursor: pointer; color: #ffc181; background: #1a120d;
    font-weight: 900; letter-spacing: .6px; text-transform: uppercase; }
  .control { display: grid; grid-template-columns: minmax(128px, 1.15fr) minmax(92px, 1fr) 76px;
    gap: 7px; align-items: center; min-height: 38px; padding: 5px 8px; border-top: 1px solid #27221e; }
  .control:nth-child(odd) { background: #12151b; }
  .control label { color: #e2d5c7; overflow-wrap: anywhere; }
  input[type='range'] { width: 100%; min-width: 70px; accent-color: #ff9438; }
  input[type='number'] { width: 76px; height: 26px; padding: 3px 5px; border: 1px solid #704329;
    background: #050608; color: #fff; text-align: right; outline: none; }
  input[type='number']:focus { border-color: #fff; box-shadow: inset 0 -2px #ff9438; }
  .colors { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 9px; border: 1px solid #4b2c19;
    border-top: 0; background: #0e1117; }
  .color { display: flex; align-items: center; gap: 8px; color: #e2d5c7; }
  .color input { width: 38px; height: 27px; padding: 0; border: 1px solid #704329; background: none; }
  .status { flex: 0 0 auto; min-height: 29px; padding: 7px 10px; border-top: 1px solid #51311c;
    color: #c09a77; font-size: 10px; overflow-wrap: anywhere; }
  button { min-height: 28px; padding: 5px 9px; border: 1px solid #704329; background: #18110c;
    color: #f6f1e8; cursor: pointer; }
  button:hover, button:focus-visible { border-color: #fff; background: #322015; outline: none; }
  .hidden { display: none; }
  @media (max-width: 560px) {
    .panel { inset: 0; width: 100vw; }
    .control { grid-template-columns: minmax(112px, 1fr) 90px 70px; gap: 5px; padding-inline: 6px; }
    input[type='number'] { width: 70px; }
  }
`;

interface ControlBinding {
  readonly definition: SliderDefinition;
  readonly slider: HTMLInputElement;
  readonly numeric: HTMLInputElement;
}

const colorToHex = (color: SkateboardColor): string =>
  `#${[color.r, color.g, color.b]
    .map((part) => Math.round(part * 255).toString(16).padStart(2, "0"))
    .join("")}`;

const hexToColor = (hex: string): SkateboardColor => ({
  r: Number.parseInt(hex.slice(1, 3), 16) / 255,
  g: Number.parseInt(hex.slice(3, 5), 16) / 255,
  b: Number.parseInt(hex.slice(5, 7), 16) / 255,
  a: 1,
});

export class SkateboardTuningPanel {
  readonly element: HTMLDivElement;
  readonly settings: SkateboardSettings;
  private readonly shadow: ShadowRoot;
  private readonly bindings: ControlBinding[] = [];
  private readonly lightColor: HTMLInputElement;
  private readonly darkColor: HTMLInputElement;
  private readonly status: HTMLDivElement;
  private readonly unsubscribe: () => void;
  private openState = false;

  constructor(options: SkateboardTuningPanelOptions = {}) {
    this.settings = options.settings ?? skateboardSettings;
    const documentRef = options.parent?.ownerDocument ?? document;
    this.element = documentRef.createElement("div");
    this.element.setAttribute("data-skateboard-panel-host", "");
    this.shadow = this.element.attachShadow({ mode: "open" });
    for (const name of ["keydown", "keyup", "keypress"] as const)
      this.shadow.addEventListener(name, (event) => event.stopPropagation());
    const style = documentRef.createElement("style");
    style.textContent = CSS;
    this.shadow.appendChild(style);

    const launcher = this.button("BOARD", "launcher");
    launcher.setAttribute("aria-label", "Open skateboard tuning panel");
    launcher.hidden = document.body.classList.contains("tc-on");
    launcher.addEventListener("click", () => this.setOpen(true));
    this.shadow.appendChild(launcher);

    const panel = this.make("section", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Skateboard tuning panel");
    const title = this.make("header", "title");
    title.append(this.make("span", "", "SURF CRUISER — SHAPE LAB"));
    const close = this.button("×", "close");
    close.setAttribute("aria-label", "Close skateboard tuning panel");
    close.addEventListener("click", () => this.setOpen(false));
    title.append(close);
    panel.append(title);
    panel.append(
      this.make(
        "div",
        "intro",
        options.labMode
          ? "Approved Board JSON · edits rebuild every inspection board and autosave in this browser."
          : "Approved Surf Cruiser · edits rebuild the attached player board live and autosave in this browser.",
      ),
    );

    const actions = this.make("div", "actions");
    const route = this.button(options.labMode ? "Back to game" : "Open full lab");
    route.addEventListener("click", () => {
      window.location.href = new URL(
        options.labMode ? "./" : "./skateboard-lab.html",
        document.baseURI,
      ).href;
    });
    const reset = this.button("Reset approved board");
    reset.addEventListener("click", () => {
      this.settings.reset();
      this.setStatus("Restored the approved Board Lab JSON.");
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
    SECTIONS.forEach((definition, sectionIndex) => {
      const details = documentRef.createElement("details");
      details.open = sectionIndex < 2;
      const summary = documentRef.createElement("summary");
      summary.textContent = definition.title;
      details.append(summary);
      for (const control of definition.controls)
        details.append(this.createSlider(control));
      sections.append(details);
    });
    const colors = this.make("div", "colors");
    this.lightColor = this.createColor("Light ply", "plywoodLightColor", colors);
    this.darkColor = this.createColor("Dark ply", "plywoodDarkColor", colors);
    sections.append(colors);
    panel.append(sections);
    this.status = this.make(
      "div",
      "status",
      "Board JSON v1 · 3,148 vertices · 6,292 triangles · 7 materials",
    );
    panel.append(this.status);
    this.shadow.append(panel);
    (options.parent ?? documentRef.body).append(this.element);
    this.unsubscribe = this.settings.subscribe((value) => this.refresh(value), true);
    this.setOpen(options.initiallyOpen ?? false);
  }

  setOpen(open: boolean): void {
    this.openState = open;
    this.element.toggleAttribute("data-open", open);
  }

  toggle(): void {
    this.setOpen(!this.openState);
  }

  dispose(): void {
    this.unsubscribe();
    this.element.remove();
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  private createSlider(definition: SliderDefinition): HTMLDivElement {
    const row = this.make("div", "control");
    const label = document.createElement("label");
    label.textContent = definition.label;
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
    const commit = (source: HTMLInputElement): void => {
      const value = Number(source.value);
      if (!Number.isFinite(value)) return;
      const patch = definition.write
        ? definition.write(value)
        : ({ [definition.key!]: value } as Partial<SkateboardSettingsValue>);
      this.settings.patch(patch);
    };
    slider.addEventListener("input", () => commit(slider));
    numeric.addEventListener("change", () => commit(numeric));
    this.bindings.push({ definition, slider, numeric });
    row.append(label, slider, numeric);
    return row;
  }

  private createColor(
    labelText: string,
    key: "plywoodLightColor" | "plywoodDarkColor",
    parent: HTMLElement,
  ): HTMLInputElement {
    const label = this.make("label", "color");
    const input = document.createElement("input");
    input.type = "color";
    input.setAttribute("aria-label", labelText);
    input.addEventListener("input", () =>
      this.settings.patch({ [key]: hexToColor(input.value) }),
    );
    label.append(input, document.createTextNode(labelText));
    parent.append(label);
    return input;
  }

  private refresh(value: Readonly<SkateboardSettingsValue>): void {
    for (const { definition, slider, numeric } of this.bindings) {
      const current = definition.read
        ? definition.read(value)
        : (value[definition.key!] as number);
      const serialized = String(current);
      slider.value = serialized;
      if (this.shadow.activeElement !== numeric) numeric.value = serialized;
    }
    this.lightColor.value = colorToHex(value.plywoodLightColor);
    this.darkColor.value = colorToHex(value.plywoodDarkColor);
  }

  private async copyJson(): Promise<void> {
    const source = this.settings.serialize(true);
    try {
      await navigator.clipboard.writeText(source);
      this.setStatus("Copied version 1 tuning JSON.");
    } catch {
      window.prompt("Copy skateboard tuning JSON", source);
      this.setStatus("Tuning JSON ready to copy.");
    }
  }

  private downloadJson(): void {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([this.settings.serialize(true)], { type: "application/json" }),
    );
    link.download = "skateboard-presentation-tuning.json";
    link.click();
    URL.revokeObjectURL(link.href);
    this.setStatus("Downloaded skateboard-presentation-tuning.json.");
  }

  private async loadJson(input: HTMLInputElement): Promise<void> {
    const selected = input.files?.[0];
    input.value = "";
    if (!selected) return;
    try {
      this.settings.importJson(await selected.text());
      this.setStatus(`Loaded ${selected.name}.`);
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

export function createSkateboardTuningPanel(
  options: SkateboardTuningPanelOptions = {},
): SkateboardTuningPanel {
  return new SkateboardTuningPanel(options);
}
