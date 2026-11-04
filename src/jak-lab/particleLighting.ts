import type {ParticleLightingContext, ParticleLightingLibrary, ParticleLightingSelection} from './types';

const f32 = Math.fround;
const multiply = (a: number, b: number) => f32(f32(a) * f32(b));
const lerp = (a: number, b: number, t: number) => f32(multiply(a, f32(1 - t)) + multiply(b, t));
export interface ParticleLightingPreset {
  id: string; context: ParticleLightingContext; selection: ParticleLightingSelection;
}

/** mood.gc:135/146/259. Keep table interpolation separate from the fallback:
 * a zero particle colour means derive it from ambient and directional lights,
 * but only if all three interpolated RGB components are zero. */
export function sampleParticleLighting(library: ParticleLightingLibrary, preset: ParticleLightingPreset,
  hour: number): [number, number, number] {
  if (!Number.isFinite(hour)) throw new Error('Lighting hour must be finite');
  const context = preset.context, selection = preset.selection;
  const table = library.lightTables.find(t => t.id === context.lights)!;
  let first: number, second: number, weight = 0;
  if (selection.kind === 'snapshot') {
    first = second = selection.snapshot!;
  } else {
    const time = f32(((hour % 24) + 24) % 24), index = Math.trunc(time) % 24;
    const fraction = f32(time - Math.trunc(time));
    const row = library.palettes.find(t => t.id === context.palette)!.hours[index];
    first = row.snapshot1; second = row.snapshot2;
    weight = lerp(row['morph-start'], row['morph-end'], fraction);
  }
  const a = table.snapshots[first], b = table.snapshots[second];
  const rgb = [0, 1, 2].map(i => first === second ? f32(a.particle[i]) : lerp(a.particle[i], b.particle[i], weight)) as [number, number, number];
  if (rgb.every(value => value === 0)) {
    return [0, 1, 2].map(i => {
      const ambient = first === second ? f32(a.ambient[i]) : lerp(a.ambient[i], b.ambient[i], weight);
      const light = first === second ? f32(a.light[i]) : lerp(a.light[i], b.light[i], weight);
      return multiply(.5, f32(ambient + multiply(.5, f32(ambient + light))));
    }) as [number, number, number];
  }
  return rgb;
}

/** All choices are actual palette/quick-snapshot call sites, not fabricated
 * assignments of unused table entries to arbitrary hours. */
export class ParticleLighting {
  readonly presets: ParticleLightingPreset[];
  selected: ParticleLightingPreset;
  constructor(readonly library: ParticleLightingLibrary, sourceFile: string) {
    this.presets = library.contexts.flatMap(context => context.presets.map(selection => ({
      id: `${context.id}:${selection.kind}${selection.snapshot === null ? '' : '-' + selection.snapshot}`,
      context, selection,
    })));
    const area = sourceFile.startsWith('levels/') ? sourceFile.split('/')[1] : '';
    this.selected = this.presets.find(p => p.context.levels.includes(area)) ??
      this.presets.find(p => p.context.id === 'default') ?? this.presets[0];
    if (!this.selected) throw new Error('Source particle lighting has no presets');
  }
  select(id: string): void {
    const preset = this.presets.find(p => p.id === id);
    if (!preset) throw new Error(`Unknown particle lighting preset: ${id}`);
    this.selected = preset;
  }
  sample(hour: number): [number, number, number] { return sampleParticleLighting(this.library, this.selected, hour); }
}
