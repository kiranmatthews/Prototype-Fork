export interface Provenance {file: string; line: number}
export interface ParticleField {
  field: string;
  op: 'float' | 'int' | 'float-int' | 'value' | 'copy' | 'data';
  value?: string | string[] | unknown[];
  base?: number; range?: number; mult?: number;
}
export interface ParticleDefinition {
  id: number; source: Provenance; fields: ParticleField[];
}
export interface EffectItem {
  particle: number; flags?: string[]; period?: number; length?: number;
  offset?: number; binding?: number; 'hour-mask'?: number;
  'falloff-to'?: number; 'fade-after'?: number;
}
export interface EffectDefinition {
  id: number; name: string; source: Provenance; items: EffectItem[];
  bounds?: [string, number, number, number, number];
  duration?: number; 'linger-duration'?: number; flags?: string[];
  directLaunch?: {particle: number; function: string | null};
  sourceAssembly?: SourceAssemblyKind;
}
export type SourceAssemblyKind='eco-beam'|'sage-cage';
export interface ModelDefinition {
  id: string; path: string; name: string; area: string; background: boolean;
  bytes: number; sha256: string; meshes: string[];
  encoding?: 'gzip'; decodedBytes?: number; decodedSha256?: string;
  animations: {name: string; channels: number}[];
}
export interface TextureDefinition {id: string; path: string; bytes: number; sha256: string}
export type ContactAction = {op: 'kill'} |
  {op: 'launch'; particle: number; is3d: boolean; height: 'surface' | 'particle'} |
  {op: 'sound'; name: string; chance?: number; height?: 'surface' | 'particle'};
export interface ContactCallback {
  kind: 'height-contact'; comparison: 'below' | 'at-or-above'; descending: boolean;
  actions: ContactAction[]; source: Provenance; formSha256: string;
}
export interface HostReplay {
  kind: 'part-tracker'; group: string; duration: number; linger: number;
  source: Provenance & {function: string | null}; formSha256: string;
}
export interface ParticleLightingSnapshot {
  source: Provenance;
  particle: number[]; ambient: number[]; light: number[];
}
export interface ParticleLightingSelection {
  kind: 'cycle' | 'snapshot'; snapshot: number | null;
  source: Provenance; function: string;
}
export interface ParticleLightingContext {
  id: string; source: Provenance; levels: string[]; lights: string; palette: string;
  presets: ParticleLightingSelection[];
}
export interface ParticleLightingLibrary {
  sources: {file: string; sha256: string}[];
  lightTables: {id: string; source: Provenance; snapshots: ParticleLightingSnapshot[]}[];
  palettes: {id: string; source: Provenance; hours: {
    snapshot1: number; snapshot2: number; 'morph-start': number; 'morph-end': number;
  }[]}[];
  contexts: ParticleLightingContext[];
}
export interface Catalogue {
  schemaVersion: number; game: string; sourceVersion: string;
  coverage: {
    sourceFiles: number; particleDefinitions: number; effectGroups: number;
    artGroups: number; expectedJointGeometries: number; exportedModels: number;
    exportedTextures: number; missingJointGeometries: unknown[];
    missingParticleReferences: unknown[]; missingParticleTextures: string[];
  };
  particles: ParticleDefinition[]; groups: EffectDefinition[];
  models: ModelDefinition[]; textures: TextureDefinition[];
  callbackPrograms?: Record<string, ContactCallback>;
  particleLighting?: ParticleLightingLibrary | null;
  sourceInventory?: {
    partTrackerLaunches?: {replay?: HostReplay}[];
    runtimeParticlePatches: {particles: unknown[]; source: Provenance}[];
    standaloneParticles: {particle: number; source: Provenance; alsoInGroupGraph: boolean;
      launches: {source: Provenance & {function: string | null}; is3d: boolean}[]}[];
  };
}
export type RenderingMode = 'original' | 'gouraud' | 'compare';
export type Exhibit = {
  id: string; name: string; area: string;
  kind: 'object' | 'effect' | 'scene';
  model?: ModelDefinition; effect?: EffectDefinition;
};
let assetBase = '/__jak-lab/asset/';
export function configureAssetBase(catalogueURL: URL): void {
  assetBase = new URL(catalogueURL.pathname.endsWith('/__jak-lab/catalogue.json') ? 'asset/' : 'assets/', catalogueURL).href;
}
export const assetURL = (path: string) => assetBase + path.split('/').map(encodeURIComponent).join('/');
