/** Meshy scenery for Moonbone Vault, through the shared instanced decor path. */
export const MOONBONE_ASSETS = {
  moonboneskull: { file: '../moonbone-vault/moonbone-skull', label: 'Moonbone punk skull monument',
    size: [8, 8, 6], wind: false, normalStrength: .12, doubleSided: false },
  moonboneribarch: { file: '../moonbone-vault/moonbone-rib-arch', label: 'Moonbone sculpted fossil arch',
    size: [26, 23, 4], wind: false, normalStrength: .12, doubleSided: false },
  moonbonecrypt: { file: '../moonbone-vault/moonbone-crypt', label: 'Moonbone punk crypt shrine',
    size: [12, 8, 4], wind: false, normalStrength: .12, doubleSided: false },
} as const;
