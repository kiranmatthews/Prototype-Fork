import textures from './levels/mall-art-textures.json';

export const MALL_TEXTURE_KINDS = textures.map(texture => texture.kind);
const byKind = new Map(textures.map(texture => [texture.kind, texture]));
export const mallArt = (kind?: string) => kind ? byKind.get(kind) : undefined;
