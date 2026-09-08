import type { CustomLevelData, CustomOceanData } from "./level";
import { ATMOSPHERE_NUMBERS, ATMOSPHERE_COLORS, atmosphereColorHex, resolveDataAtmosphere,
  type AtmosphereColor, type CustomAtmosphereData } from "./levelAtmosphere";

/** Enter node editing without changing any ocean geometry. */
export function editOceanShoreline(ocean: CustomOceanData): void {
  ocean.shore ??= [[0, ocean.length / 2, ocean.seaward, 0], [0, -ocean.length / 2, ocean.seaward, 0]];
}

/** Replace a curved shoreline with its endpoint chord, retaining its world
 * endpoints and seaward side. Closed/coincident endpoints have no chord. */
export function straightenOceanShoreline(ocean: CustomOceanData): boolean {
  if (!ocean.shore) return true;
  const a = ocean.shore[0], b = ocean.shore[ocean.shore.length - 1];
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  if (length < 1) return false;
  const localYaw = Math.atan2(-dx, -dz);
  const yaw = (ocean.yaw ?? 0) * Math.PI / 180;
  const midX = (a[0] + b[0]) / 2, midZ = (a[1] + b[1]) / 2;
  ocean.p = [ocean.p[0] + midX * Math.cos(yaw) + midZ * Math.sin(yaw), ocean.p[1],
    ocean.p[2] - midX * Math.sin(yaw) + midZ * Math.cos(yaw)];
  const nx = a[2] + b[2], nz = a[3] + b[3];
  const reference = Math.hypot(nx, nz) > 0.001 ? [nx, nz] : [a[2], a[3]];
  ocean.seaward = Math.cos(localYaw) * reference[0] - Math.sin(localYaw) * reference[1] < 0 ? -1 : 1;
  ocean.yaw = (yaw + localYaw) * 180 / Math.PI;
  ocean.length = length;
  delete ocean.shore;
  return true;
}

type Point = [number, number, number];
interface EnvironmentHooks {
  data: () => CustomLevelData;
  levelId?: () => string;
  number: (label: string, get: () => number, set: (v: number) => void, step?: number) => HTMLElement;
  commit: () => void;
  focus: (point: readonly number[]) => void;
  cameraFocus: () => Point;
}

/** Level-owned scenery has the same transactions as components. List selectors
 * keep hundreds of shoreline rings from creating thousands of input elements. */
export class EditorEnvironment {
  readonly element = document.createElement("details");
  private sandIndex = 0;
  private foamIndex = 0;
  private shoreIndex = 0;
  private structure = "";
  private choices: { element: HTMLSelectElement | HTMLInputElement; get: () => string }[] = [];
  constructor(private hooks: EnvironmentHooks) {
    this.element.className = "ed-environment";
    this.render();
  }

  private structureKey(): string {
    const d = this.hooks.data();
    return `${d.components.some(c => c.t === "worldmap")}: ${!!d.ocean}:${d.ocean?.shore?.length ?? 0}:${d.unitySand?.length ?? 0}:${d.shoreFoam?.length ?? 0}:${!!d.atmosphere}:${d.atmosphere?.fallbackSunColor === null}:${d.sky ?? ""}:${!!d.jungleAtmosphere}`;
  }

  sync(): void {
    if (this.structureKey() !== this.structure) this.render();
    else for (const choice of this.choices) choice.element.value = choice.get();
  }

  render(): void {
    this.structure = this.structureKey();
    const { data, number, focus, cameraFocus } = this.hooks;
    const d = data();
    this.element.replaceChildren();
    this.choices = [];
    const summary = document.createElement("summary");
    summary.textContent = `Environment · ${d.ocean ? 1 : 0} ocean · ${d.unitySand?.length ?? 0} sand · ${d.shoreFoam?.length ?? 0} foam`;
    this.element.append(summary);
    const heading = (text: string): void => {
      const h = document.createElement("div"); h.className = "ed-sect"; h.textContent = text;
      this.element.append(h);
    };
    const button = (text: string, action: () => void): void => {
      const b = document.createElement("button"); b.className = "ed-btn"; b.textContent = text;
      b.addEventListener("click", () => { action(); b.blur(); }); this.element.append(b);
    };
    const change = (action: () => void): void => { action(); this.hooks.commit(); this.render(); };
    const num = (label: string, get: () => number, set: (v: number) => void, step = 0.5): void => {
      this.element.append(number(label, get, set, step));
    };
    const choice = (label: string, values: readonly string[], current: () => string, set: (v: string) => void): void => {
      const row = document.createElement("label"); row.className = "ed-row";
      const text = document.createElement("span"); text.textContent = label;
      const select = document.createElement("select"); select.setAttribute("aria-label", label);
      for (const v of values) { const o = document.createElement("option"); o.value = v; o.textContent = v; select.append(o); }
      select.value = current(); this.choices.push({ element: select, get: current });
      select.addEventListener("change", () => change(() => set(select.value)));
      row.append(text, select); this.element.append(row);
    };
    const pointRows = (prefix: string, get: () => readonly number[], set: (p: Point) => void): void => {
      for (const [i, axis] of ["x", "y", "z"].entries())
        num(`${prefix} ${axis}`, () => get()[i], v => { const p = [...get()] as Point; p[i] = v; set(p); });
      button(`frame ${prefix}`, () => focus(get()));
      button(`${prefix} = camera focus`, () => change(() => set(cameraFocus())));
    };
    const list = (label: string, count: number, index: number, select: (i: number) => void): void => {
      const input = document.createElement("select"); input.className = "ed-select";
      input.setAttribute("aria-label", label);
      for (let i = 0; i < count; i++) {
        const o = document.createElement("option"); o.value = String(i); o.textContent = `${label} ${i + 1}`; input.append(o);
      }
      input.value = String(index);
      input.addEventListener("change", () => { select(Number(input.value)); this.render(); });
      this.element.append(input);
    };

    heading("LEVEL BEHAVIOR");
    if (d.components.some(c => c.t === "worldmap")) {
      const note = document.createElement("div"); note.className = "ed-dim";
      note.textContent = "The campaign map uses the map HUD and navigation."; this.element.append(note);
    } else choice("collection HUD", ["standard", "bonus"], () => data().hudMode ?? "standard", v => {
      if (v === "bonus") data().hudMode = "bonus"; else delete data().hudMode;
    });
    choice("jungle atmosphere", ["off", "on"], () => data().jungleAtmosphere ? "on" : "off", v => { data().jungleAtmosphere = v === "on"; });
    for (const [key, label] of [
      ["allBalanceCrates", "crates on balance paths"],
      ["perfectGrindBoost", "perfect grind boost"],
      ["keepPlayFog", "keep authored fog"],
    ] as const)
      choice(label, ["off", "on"], () => (data()[key] ?? (key === "keepPlayFog" && (this.hooks.levelId?.() === "sky" || !!data().jungleAtmosphere))) ? "on" : "off", v => { data()[key] = v === "on"; });
    num("ledge assist", () => data().ledgeAssist ?? 0, v => { data().ledgeAssist = Math.min(1, Math.max(0, v)); }, 0.05);

    heading("ATMOSPHERE");
    const resolved = () => resolveDataAtmosphere(data(), this.hooks.levelId?.());
    choice("atmosphere settings", ["level defaults", "custom"], () => data().atmosphere ? "custom" : "level defaults", value => {
      if (value === "custom") data().atmosphere = resolved(); else delete data().atmosphere;
    });
    const atmosphereNote = document.createElement("div"); atmosphereNote.className = "ed-dim";
    atmosphereNote.textContent = "Fog and draw distance apply in play; the editor keeps its clear inspection view. Custom values override sky and map lighting.";
    this.element.append(atmosphereNote);
    if (d.atmosphere) {
      const setAtmosphere = <K extends keyof CustomAtmosphereData>(key: K, value: CustomAtmosphereData[K]): void => {
        (data().atmosphere ??= {})[key] = value;
      };
      choice("backdrop", ["sky", "fog"], () => resolved().backdrop, value => setAtmosphere("backdrop", value as "sky" | "fog"));
      choice("scene fog", ["on", "off"], () => resolved().fogEnabled ? "on" : "off", value => setAtmosphere("fogEnabled", value === "on"));
      const color = (key: keyof typeof ATMOSPHERE_COLORS): void => {
        const row = document.createElement("label"); row.className = "ed-row";
        const label = document.createElement("span"); label.textContent = ATMOSPHERE_COLORS[key];
        const input = document.createElement("input"); input.type = "color";
        input.setAttribute("aria-label", ATMOSPHERE_COLORS[key]);
        const get = () => atmosphereColorHex(resolved()[key] as AtmosphereColor);
        input.value = get(); this.choices.push({ element: input, get });
        input.addEventListener("change", () => {
          if (/^#[0-9a-fA-F]{6}$/.test(input.value) && input.value.toLowerCase() !== get())
            change(() => setAtmosphere(key, input.value));
          else input.value = get();
        });
        row.append(label, input); this.element.append(row);
      };
      const numeric = (key: keyof typeof ATMOSPHERE_NUMBERS): void => {
        const limits = ATMOSPHERE_NUMBERS[key];
        // Display round-off tails without changing the captured value. The
        // numeric editor compares against this same getter before committing.
        num(limits.label, () => Number(resolved()[key].toPrecision(12)), value => {
          let next = Math.min(limits.max, Math.max(limits.min, value));
          if (key === "fogNear") next = Math.min(next, resolved().fogFar - 0.01);
          if (key === "fogFar") next = Math.max(next, resolved().fogNear + 0.01);
          setAtmosphere(key, next);
        }, limits.step);
      };
      numeric("fogNear"); numeric("fogFar"); color("fogColor"); numeric("drawDistance");
      color("ambientSky"); color("ambientGround"); numeric("ambientIntensity");
      color("sunColor"); numeric("sunIntensity"); color("fillColor"); numeric("fillIntensity"); numeric("shadowStrength");
      heading("FALLBACK SKY");
      const fallbackNote = document.createElement("div"); fallbackNote.className = "ed-dim";
      fallbackNote.textContent = "These colors and sun settings are used only when the painted sky is unavailable.";
      this.element.append(fallbackNote);
      color("fallbackTop"); color("fallbackBottom"); color("fallbackFog");
      choice("fallback stars", ["off", "on"], () => resolved().fallbackStars ? "on" : "off", value => setAtmosphere("fallbackStars", value === "on"));
      choice("fallback sun", ["off", "on"], () => resolved().fallbackSunColor === null ? "off" : "on", value => setAtmosphere("fallbackSunColor", value === "off" ? null : "#fffdf2"));
      if (resolved().fallbackSunColor !== null) {
        color("fallbackSunColor"); numeric("fallbackSunU"); numeric("fallbackSunV");
      }
    }

    heading("OCEAN");
    if (d.components.some(c => c.t === "worldmap")) {
      const note = document.createElement("div"); note.className = "ed-dim";
      note.textContent = "The campaign map owns its ocean. Move the map component to move them together.";
      this.element.append(note);
    } else if (d.ocean) {
      const ocean = () => data().ocean!;
      pointRows("ocean", () => ocean().p, p => { ocean().p = p; });
      num("ocean length", () => ocean().length, v => {
        const length = Math.max(1, v), ratio = length / ocean().length;
        if (ocean().shore) ocean().shore = ocean().shore!.map(([x,z,nx,nz]) => [x * ratio,z * ratio,nx,nz]);
        ocean().length = length;
      });
      num("ocean width", () => ocean().width, v => { ocean().width = Math.max(1, v); });
      num("ocean yaw °", () => ocean().yaw ?? 0, v => { ocean().yaw = v; }, 15);
      num("shore overlap", () => ocean().overlap ?? 6, v => { ocean().overlap = Math.max(0, v); });
      num("length segments", () => ocean().longitudinalSegments ?? 128, v => { ocean().longitudinalSegments = Math.max(1, Math.round(v)); }, 1);
      num("width segments", () => ocean().lateralSegments ?? 128, v => { ocean().lateralSegments = Math.max(1, Math.round(v)); }, 1);
      choice("seaward side", ["left", "right"], () => ocean().seaward === -1 ? "left" : "right", v => {
        const next = v === "left" ? -1 : 1;
        if (next !== ocean().seaward && ocean().shore)
          ocean().shore = ocean().shore!.map(([x,z,nx,nz]) => [x,z,-nx,-nz]);
        ocean().seaward = next;
      });
      choice("wave coordinates", ["three", "unity"], () => ocean().sourceCoordinates ?? "three", v => { ocean().sourceCoordinates = v as "three" | "unity"; });
      choice("extend coast tails", ["off", "on"], () => ocean().extendTails ? "on" : "off", v => { ocean().extendTails = v === "on"; });
      if (ocean().shore) {
        const shore = () => ocean().shore!;
        this.shoreIndex = Math.min(this.shoreIndex, shore().length - 1);
        const index = document.createElement("input"); index.type = "number"; index.min = "1";
        index.max = String(shore().length); index.step = "1"; index.value = String(this.shoreIndex + 1);
        index.setAttribute("aria-label", "shore node");
        const indexRow = document.createElement("label"); indexRow.className = "ed-row";
        const label = document.createElement("span"); label.textContent = `shore node / ${shore().length}`;
        indexRow.append(label, index); this.element.append(indexRow);
        index.addEventListener("change", () => {
          this.shoreIndex = Math.min(shore().length - 1, Math.max(0, Math.round(Number(index.value) || 1) - 1)); this.render();
        });
        const knot = () => shore()[this.shoreIndex];
        num("shore local x", () => knot()[0], v => { knot()[0] = v; });
        num("shore local z", () => knot()[1], v => { knot()[1] = v; });
        num("shore normal °", () => Math.atan2(knot()[3], knot()[2]) * 180 / Math.PI, v => {
          const a = v * Math.PI / 180; knot()[2] = Math.cos(a); knot()[3] = Math.sin(a);
        }, 15);
        button("insert shore node", () => change(() => {
          const i = Math.min(this.shoreIndex, shore().length - 2), a = shore()[i], b = shore()[i + 1];
          const nx = a[2] + b[2], nz = a[3] + b[3], length = Math.hypot(nx,nz);
          shore().splice(i + 1, 0, [(a[0]+b[0])/2,(a[1]+b[1])/2,length > .001 ? nx/length : a[2],length > .001 ? nz/length : a[3]]);
          this.shoreIndex = i + 1;
        }));
        if (shore().length > 2) button("remove shore node", () => change(() => { shore().splice(this.shoreIndex,1); }));
        button("frame shore node", () => {
          const [x, z] = knot(), yaw = (ocean().yaw ?? 0) * Math.PI / 180;
          focus([ocean().p[0] + x * Math.cos(yaw) + z * Math.sin(yaw), ocean().p[1],
            ocean().p[2] - x * Math.sin(yaw) + z * Math.cos(yaw)]);
        });
        const a = shore()[0], b = shore()[shore().length - 1];
        // A straight ocean is at least one metre long in the interchange
        // contract; leave short/closed coasts editable as nodes.
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= 1)
          button("use straight shoreline", () => change(() => { straightenOceanShoreline(ocean()); }));
        else {
          const note = document.createElement("div"); note.className = "ed-dim";
          note.textContent = "Separate the first and last nodes by at least 1 m to use a straight shoreline.";
          this.element.append(note);
        }
      } else button("edit shoreline nodes", () => change(() => { editOceanShoreline(ocean()); }));
      button("remove ocean", () => change(() => { delete data().ocean; }));
    } else button("add ocean at focus", () => change(() => {
      data().ocean = { geometryVersion: 2, p: cameraFocus(), length: 100, width: 80, seaward: 1, sourceCoordinates: "three" };
    }));

    heading("SAND PATCHES");
    const sandCount = d.unitySand?.length ?? 0;
    if (sandCount) {
      this.sandIndex = Math.min(this.sandIndex, sandCount - 1);
      list("sand patch", sandCount, this.sandIndex, i => { this.sandIndex = i; });
      const sand = () => data().unitySand![this.sandIndex];
      pointRows("sand", () => sand().p, p => { sand().p = p; });
      for (const [i, label] of ["width", "height", "depth"].entries())
        num(`sand ${label}`, () => sand().s[i], v => { sand().s[i] = Math.max(0.1, v); });
      num("sand yaw °", () => sand().yaw ?? 0, v => { sand().yaw = v; }, 15);
      button("remove sand patch", () => change(() => {
        data().unitySand!.splice(this.sandIndex, 1); if (!data().unitySand!.length) delete data().unitySand;
      }));
    }
    button("add sand at focus", () => change(() => {
      (data().unitySand ??= []).push({ p: cameraFocus(), s: [12, 1, 12] });
      this.sandIndex = data().unitySand!.length - 1;
    }));

    heading("SHORE FOAM");
    const foamCount = d.shoreFoam?.length ?? 0;
    if (foamCount) {
      this.foamIndex = Math.min(this.foamIndex, foamCount - 1);
      list("foam ring", foamCount, this.foamIndex, i => { this.foamIndex = i; });
      const foam = () => data().shoreFoam![this.foamIndex];
      pointRows("foam", () => foam().center, p => { foam().center = p; });
      for (const [i, label] of ["half width", "half length"].entries())
        num(`foam ${label}`, () => foam().axes[i], v => { const a: [number, number] = [...foam().axes]; a[i] = Math.max(0.1, v); foam().axes = a; });
      num("foam yaw °", () => -Math.atan2(foam().right[2], foam().right[0]) * 180 / Math.PI, v => {
        const a = v * Math.PI / 180;
        foam().right = [Math.cos(a), 0, -Math.sin(a)]; foam().forward = [Math.sin(a), 0, Math.cos(a)];
      }, 15);
      num("foam phase", () => foam().phase, v => { foam().phase = v; }, 0.1);
      button("remove foam ring", () => change(() => {
        data().shoreFoam!.splice(this.foamIndex, 1); if (!data().shoreFoam!.length) delete data().shoreFoam;
      }));
    }
    button("add foam at focus", () => change(() => {
      (data().shoreFoam ??= []).push({ center: cameraFocus(), axes: [8, 12], right: [1, 0, 0], forward: [0, 0, 1], phase: 0 });
      this.foamIndex = data().shoreFoam!.length - 1;
    }));
  }
}
