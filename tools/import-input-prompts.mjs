// Copy the user-supplied PNG variants unchanged; do not import atlas sheets.
import { readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Usage: node tools/import-input-prompts.mjs /path/to/Source');
const variants = {
  keyboard: 'Keyboard_Mouse/Dark', ps4: 'P4Gamepad/Stylized',
  ps5: 'P5Gamepad/Default', xbox: 'XGamepad/Default', switch: 'SGamepad/Default',
};
let count = 0;
for (const [family, variant] of Object.entries(variants)) {
  const output = resolve('public/input-prompts', family);
  mkdirSync(output, { recursive: true });
  for (const name of readdirSync(join(source, variant))) {
    if (!name.endsWith('.png') || /sprite/i.test(name)) continue;
    copyFileSync(join(source, variant, name), join(output, name)); count++;
  }
}
console.log(`Imported ${count} original prompt PNGs.`);
