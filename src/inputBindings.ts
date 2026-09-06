/** Stable semantic actions; prompts and input read the same physical bindings. */
export const INPUT_BINDINGS = {
  jump: { key: 'Space', button: 0 }, grab: { key: 'KeyQ', button: 1 },
  spin: { key: 'KeyF', button: 2 }, grind: { key: 'KeyE', button: 3 },
  inventory: { key: 'KeyI', button: 6 }, transfer: { key: 'KeyT', button: 7 },
  restart: { key: 'KeyR', button: 8 }, pause: { key: 'KeyP', button: 9 },
  confirm: { key: 'Enter', button: 0 }, back: { key: 'Escape', button: 1 },
  mapEnter: { key: 'Enter', button: 0 }, mapProgress: { key: 'KeyI', button: 3 },
  mapOptions: { key: 'KeyP', button: 9 }, mapSaveLoad: { key: 'KeyL', button: 2 },
  mapQuit: { key: 'KeyQ', button: 1 },
  up: { key: 'ArrowUp', button: 12 }, down: { key: 'ArrowDown', button: 13 },
  left: { key: 'ArrowLeft', button: 14 }, right: { key: 'ArrowRight', button: 15 },
} as const;
export type InputAction = keyof typeof INPUT_BINDINGS;
export function actionButtonDown(pad: Gamepad | null, action: InputAction): boolean {
  return pad?.buttons[INPUT_BINDINGS[action].button]?.pressed === true;
}
