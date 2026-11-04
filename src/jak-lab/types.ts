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
  screenHud?: ScreenHudKind;
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
  sun?: string; skyPalette?: string; sunPresets?: ParticleLightingSelection[];
  sunFades?: {level: string; fade: number; source: Provenance}[];
}
export interface ParticleLightingLibrary {
  sources: {file: string; sha256: string}[];
  lightTables: {id: string; source: Provenance; snapshots: ParticleLightingSnapshot[]}[];
  palettes: {id: string; source: Provenance; hours: {
    snapshot1: number; snapshot2: number; 'morph-start': number; 'morph-end': number;
  }[]}[];
  contexts: ParticleLightingContext[];
  sunTables?: {id: string; source: Provenance; snapshots: {source: Provenance; color: number[]}[]}[];
}
export type SunHours = {op: 'and' | 'or'; terms: SunHours[]} | {op: '<' | '<=' | '>' | '>='; hour: number};
export interface SunOrbit {slot: number; highNoon: number; tilt: number; rise: number; distance: number; source: Provenance}
export interface SunParticleLibrary {
  sources: {file: string; sha256: string}[];
  orbits: SunOrbit[];
  hosts: {group: string; orbit: number; hours: SunHours; source: Provenance}[];
}
export interface FuelCellHudProfile {
  id: '4:3' | '16:9'; iconScale: number; centerScale: number; iconY: number;
  starburst3: [number, number]; starburst4: [number, number]; source: Provenance;
}
export interface FuelCellHudLibrary {
  group: string; model: string; clip: string; yawStart: number; yawPerFrame: number;
  profiles: FuelCellHudProfile[];
  callbacks: {name: string; source: Provenance; formSha256: string}[];
  sources: {file: string; sha256: string}[];
}
export type ScreenHudKind='health'|'power'|'buzzers'|'first-person';
export interface ScreenHudProfile {
  id:'4:3'|'16:9';
  layers:{group:string;position:[number,number,number];source:Provenance}[];
  scales:Record<string,number>;source:Provenance;
}
export interface ScreenHudDefinition {
  id:ScreenHudKind;name:string;xSign:number;ySign:number;
  profiles:ScreenHudProfile[];source:Provenance;
}
export interface ScreenHudLibrary {
  entries:ScreenHudDefinition[];ecoFullTicks:number;
  callbacks:{name:string;source:Provenance;formSha256:string}[];
  sources:{file:string;sha256:string}[];
}
export interface FirstPersonHudDefinition extends ScreenHudDefinition {
  id:'first-person';maximumOffset:number;
  rates:{arrival:number;departure:number;restore:number;suppress:number};
  callbacks:{name:string;source:Provenance;formSha256:string}[];
  sources:{file:string;sha256:string}[];
}
export interface MeshDeathProfile {
  id:string; vertexSkip:number; frames:number; overlap:number; particle:number;
  sound:string|null; source:Provenance;
}
export interface MeshDeathReference {
  model:string; path:string; bytes:number; sha256:string; decodedBytes:number; decodedSha256:string;
  sourceAssembly:string; sourceAssemblySha256:string; sourceModelSha256:string;
  sourceVertexStart:number; sourceVertices:number; unreferencedVertices:number; crossCopies:number;
  events:{clip:string; effect:string; artistFrame:number; seconds:number; assemblyLine:number}[];
}
export interface MeshDeathData {
  version:number; meshNode:number; sourceVertices:number; crossCopies:number;
  positions:number[]; joints:number[]; weights:number[]; morphPositions:number[][];
  effects:{start:number; count:number; copies:number[]}[][];
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
  sunParticles?: SunParticleLibrary | null;
  fuelCellHud?: FuelCellHudLibrary | null;
  screenHud?: ScreenHudLibrary | null;
  firstPersonHud?: FirstPersonHudDefinition | null;
  meshDeaths?: {profiles:MeshDeathProfile[]; texture:string; models:MeshDeathReference[]};
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
  kind: 'effect';
  category: 'particle' | 'assembly' | 'disappearance';
  categories?: import('./effectCategories').EffectCategory[];
  model?: ModelDefinition; effect?: EffectDefinition;
  death?:MeshDeathReference;
};
let assetBase = '/__jak-lab/asset/';
export function configureAssetBase(catalogueURL: URL): void {
  assetBase = new URL(catalogueURL.pathname.endsWith('/__jak-lab/catalogue.json') ? 'asset/' : 'assets/', catalogueURL).href;
}
export const assetURL = (path: string) => assetBase + path.split('/').map(encodeURIComponent).join('/');
