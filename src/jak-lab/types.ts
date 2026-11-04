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
}
export interface ModelDefinition {
  id: string; path: string; name: string; area: string; background: boolean;
  bytes: number; sha256: string; meshes: string[];
  encoding?: 'gzip'; decodedBytes?: number; decodedSha256?: string;
  animations: {name: string; channels: number}[];
}
export interface TextureDefinition {id: string; path: string; bytes: number; sha256: string}
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
  sourceInventory?: {
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
