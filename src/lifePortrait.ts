/** The HUD and Life crates use the same artwork and active-head selection. */
export type LifePortraitStyle = 'skull' | 'alternate';
export const LIFE_PORTRAITS = {
  skull: { file: 'bone-head.png', label: 'Bone Head' },
  alternate: { file: 'roo.png', label: 'BoolieRoo' },
} as const;

let activeStyle: LifePortraitStyle = 'skull';
const listeners = new Set<() => void>();

export function lifePortraitStyle(): LifePortraitStyle { return activeStyle; }
export function lifePortraitUrl(style: LifePortraitStyle): string {
  return `${import.meta.env.BASE_URL}${LIFE_PORTRAITS[style].file}`;
}
export function setLifePortraitStyle(style: LifePortraitStyle): void {
  if (activeStyle === style) return;
  activeStyle = style;
  for (const listener of listeners) listener();
}
export function onLifePortraitChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
