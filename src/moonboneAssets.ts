/** Meshy scenery for Moonbone Vault, through the shared instanced decor path. */
export const MOONBONE_ASSETS = {
  moonboneskull: { file: '../moonbone-vault/moonbone-skull', label: 'Moonbone punk skull monument',
    size: [7.159472, 8, 7.96632], wind: false, normalStrength: .12, doubleSided: false },
  moonboneribarch: { file: '../moonbone-vault/moonbone-rib-arch', label: 'Moonbone sculpted fossil arch',
    size: [26, 18.70596, 9.53849], wind: false, normalStrength: .12, doubleSided: false },
  moonbonecrypt: { file: '../moonbone-vault/moonbone-crypt', label: 'Moonbone punk crypt shrine',
    size: [12, 7.925208, 6.251388], wind: false, normalStrength: .12, doubleSided: false },
  moonbonesky: { file: '', image: 'moonbone-vault/sky.webp', label: 'Moonbone painted lunar sky',
    size: [360, 240, .02], wind: false, matte: true },
  moonboneclouds: { file: '', image: 'moonbone-vault/clouds-alpha.webp', label: 'Moonbone parallax moonlit clouds',
    size: [270, 180, .02], wind: false, matte: true, edgeFade: .035 },
  moonboneridge: { file: '', image: 'moonbone-vault/ridge-alpha.webp', label: 'Moonbone distant ossuary ridge',
    size: [210, 140, .02], wind: false, matte: true, alphaCutout: true },
} as const;
