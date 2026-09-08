// Generated from tools/nightworks-kit/module-specs.json.
export const NIGHTWORKS_MODULES = {
nightplateau:{"file":"../nightworks-kit/plateau","label":"plateau","size":[10,7,9],"wind":false,"normalStrength":0.18,"lod":true,"backdrop":false},
nightsteppingrock:{"file":"../nightworks-kit/stepping-rock","label":"stepping rock","size":[4.5,4,4.5],"wind":false,"normalStrength":0.18,"lod":true,"backdrop":false},
nightlongisland:{"file":"../nightworks-kit/long-island","label":"long island","size":[15,8,7],"wind":false,"normalStrength":0.18,"lod":true,"backdrop":false},
nightphaserock:{"file":"../nightworks-kit/phase-rock","label":"phase rock","size":[4.5,4,4.5],"wind":false,"normalStrength":0.18,"lod":true,"backdrop":false},
nightrockridge:{"file":"../nightworks-kit/rock-ridge","label":"rock ridge","size":[12,3,0.6],"wind":false,"normalStrength":0.18,"lod":true,"backdrop":false},
nightanchorrock:{"file":"../nightworks-kit/anchor-rock","label":"anchor rock","size":[4,3,3],"wind":false,"normalStrength":0.18,"lod":true,"backdrop":false},
nightdistantarch:{"file":"../nightworks-kit/distant-arch","label":"distant arch","size":[22,30,8],"wind":false,"normalStrength":0.18,"lod":true,"backdrop":true},
} as const;
export type NightworksKind = keyof typeof NIGHTWORKS_MODULES;
