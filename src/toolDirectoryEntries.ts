import { TUNING_SECTIONS, TUNING_RANGES, TUNING_LABELS } from './tuning';
import { toolSectionId, type ToolRoute } from './toolRoutes';

export interface ToolEntry {
  name: string;
  description: string;
  category: string;
  path: string;
  source: string;
  local?: boolean;
  keywords?: string;
}

const entries: ToolEntry[] = [];
function tool(name: string, route: ToolRoute, description: string, source: string,
  category = 'Game & configuration', level = 'codex-lab', section = '', keywords = ''): void {
  const query = new URLSearchParams({ playtest: '', level, tool: route });
  if (section) query.set('section', section);
  entries.push({ name, description, source, category, keywords, path: `?${query}` });
}
tool('Character Lab', 'characterlab', 'Head profiles, body proportions, skeleton, clothing, gloves, hands, limb bones, footwear and tail.', 'src/characterLab.ts', 'Labs & studios');
tool('Animation Studio', 'animationstudio', 'Clip library, timeline, keyframes, IK, elasticity, mirroring, drafts, import and export.', 'src/animationStudio.ts', 'Labs & studios');
tool('Water Studio · coast', 'waterstudio', 'Live waves, coastal surf, depth, normals, specular, foam and colour. Level water profile.', 'src/waterstudio.ts', 'Labs & studios', 'beachfront');
tool('Water Studio · world map', 'waterstudio', 'The independent map water profile, with live world-map preview.', 'src/waterstudio.ts', 'Labs & studios', 'warproom');
tool('Puff / smoke studio', 'puffstudio', 'Smoke particle shapes, lifetime, movement, colour and burst preview.', 'src/puffstudio.ts', 'Labs & studios');
tool('Swirl / wormhole studio', 'swirlstudio', 'Band-based wormhole geometry, colour, motion, presets and export.', 'src/swirlstudio.ts', 'Labs & studios');
tool('Gouraud Field Lab', 'fieldstudio', 'Menu / Title, Warp / Loading, Game Over and Scratch workspaces; sine fields, palette, seed and presets.', 'src/fieldstudio.ts', 'Labs & studios');
tool('Movement tuner · all controls', 'tuning', 'Every movement section, save/reset/defaults, JSON copy, input replays and video capture.', 'src/ui.ts', 'Movement tuning');
for (const section of TUNING_SECTIONS) {
  const keys = section.keys.filter(key => TUNING_RANGES[key] !== undefined);
  if (!keys.length) continue;
  tool(section.title, 'tuning', `${keys.length} live controls: ${keys.map(key => TUNING_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2')).join(', ')}.`, 'src/tuning.ts', 'Movement tuning',
    section.title.startsWith('SKATE PARK') ? 'jungle-cup' : 'codex-lab', toolSectionId(section.title), keys.join(' '));
}
const placed = new Set(TUNING_SECTIONS.flatMap(section => section.keys));
const other = Object.keys(TUNING_RANGES).filter(key => !placed.has(key as typeof TUNING_SECTIONS[number]['keys'][number]));
if (other.length) tool('OTHER', 'tuning', other.join(', '), 'src/tuning.ts', 'Movement tuning', 'codex-lab', 'other');
tool('CRT shader tuning', 'crt', 'Shader variants, quality, scanlines, afterglow, colour, presets and all CRT parameters.', 'src/crt-guest/panel.ts');
tool('Render quality', 'render', 'Base resolution, output scaling, frame rate and rendering controls.', 'src/render-quality/panel.ts');
tool('Gameplay skateboard tuning', 'board', 'Live gameplay board geometry, wheels, trucks, artwork and colour.', 'src/skateboard/panel.ts');
tool('Spin effects tuning', 'spin', 'Character / grounded skate targets, per-ring shape, colour, wave, noise and motion.', 'src/spin-effects/panel.ts');
tool('LOOK · visual treatment', 'look', 'Colour grading, lift / gamma / gain, split tone, channel mixer, bloom, vignette and presets.', 'src/visual-treatment/panel.ts');
tool('Text tuning', 'text', 'Secondary text size, face weight, outline, shadow and silver gradient; Roo tracking and shimmer.', 'src/secondaryTextPanel.ts', 'Game & configuration', 'warproom');
tool('Menu PNG focus filters', 'text', 'Flash rate, white duration, brightness, desaturation and inactive artwork filters.', 'src/menuPngFocusSettings.ts', 'Game & configuration', 'warproom', 'focus');
tool('Game options', 'options', 'Sound, music, play mode, CRT, resolution, controller prompt style, trick guide and progress.', 'src/gameFlowUI.ts', 'Game & configuration', 'warproom');
tool('Save / load', 'save-load', 'Campaign save slots and save management.', 'src/gameFlowUI.ts', 'Game & configuration', 'warproom');
tool('Level Select', 'level-select', 'Player-facing course selection and earned collectibles.', 'src/gameFlowUI.ts', 'Game & configuration', 'warproom');
tool('Developer MENU', 'menu', 'All registered levels; new/import, split screen, run modes, life rules and cloud sync controls.', 'src/ui.ts');
tool('Replay & video capture', 'tuning', 'Save replay (F8), load a replay, and start/stop WebM recording (F9).', 'src/replay.ts');
for (const [name, section, description] of [
  ['Level editor · selection', 'selection', 'Select and inspect pieces; transforms, materials, movement and component properties.'],
  ['Level editor · project', 'project', 'Level name, spawn, death plane, sky, file import/export, restore original and project settings.'],
  ['Level editor · environment', 'environment', 'Atmosphere, fog, sun, ocean, sand, shoreline and foam configuration.'],
  ['Level editor · add palette', 'add', 'Terrain, crates, paths, movers, camera zones, enemies, hazards and scenery components.'],
  ['Level editor · layers', 'layers', 'Hierarchy, groups, visibility, selection and layer transforms.'],
]) tool(name, 'editor', description, 'src/editor.ts', 'Level authoring', 'codex-lab', section);
for (const [id, name, description] of [
  ['codex-lab', 'Codex Geometry Lab · Blockworks', 'The Blockworks · Greybox course: source-owned geometry and traversal experiments.'],
  ['backport-lab', 'Backport Mechanics Lab', 'Procedural paths and reusable level primitives.'],
  ['bone-yard', 'Bone Yard · Wipeout Playground', 'Crash, trip, breakup, recovery and fatal-pit testing.'],
  ['flats', 'Flats & Pipes', 'Skate transitions, quarter pipes, rails and vert traversal.'],
  ['jungle-cup', 'Jungle Cup', 'Competition skating, balance, tricks and park camera tuning.'],
  ['waterpark', 'Waterpark', 'Loops, pipes, transfers and water hazards.'],
]) entries.push({ name, description, category: 'Playable labs & test courses', path: `?playtest&level=${id}`, source: 'src/level.ts' });
entries.push(
  { name: 'Skateboard lab · map UI profile', description: 'Open the independent map/menu skateboard settings tab.', category: 'Labs & studios', path: 'skateboard-lab.html?tab=map-ui', source: 'src/skateboard/lab.ts' },
  { name: 'Roo text · bonus palette', description: 'Preview and export the bonus lettering palette.', category: 'Labs & studios', path: 'roo-type-lab.html?palette=bonus&text=BONUS', source: 'src/roo-type/lab.ts' },
  { name: 'Roo text · counter palette', description: 'Preview and export HUD counter lettering.', category: 'Labs & studios', path: 'roo-type-lab.html?palette=counter&text=0123456789', source: 'src/roo-type/lab.ts' },
);
for (const [flag, name, description, level] of [
  ['oceanreview', 'Coastal ocean review', 'Coastal presentation review launch.', 'beachfront'],
  ['oceanoverview', 'Ocean overview', 'Wide ocean review camera.', 'beachfront'],
  ['coastphysics', 'Coast physics review', 'Coastal road and physics review launch.', 'descent'],
  ['frameprobe', 'Frame probe', 'Game with hidden #frame-probe machine-readable metrics (inspect in browser developer tools).', 'codex-lab'],
  ['crtdiag', 'CRT diagnostics', 'Game with hidden #crt-diagnostics shader/pass data.', 'codex-lab'],
  ['renderdiag', 'Render diagnostics', 'Game with hidden #render-diagnostics resolution and render metrics.', 'codex-lab'],
  ['lookdiag', 'LOOK diagnostics', 'Game with hidden #look-diagnostics visual-treatment data.', 'codex-lab'],
  ['touch', 'Touch controls preview', 'Force the touch control layout for browser inspection.', 'codex-lab'],
  ['lite', 'Lite rendering', 'Fast playtest launch with the existing lightweight renderer.', 'codex-lab'],
  ['nopost', 'Post-processing bypass', 'Review the coastal scene with the post-processing pass disabled for this launch.', 'beachfront'],
  ['nopasses', 'Ocean-pass bypass', 'Inspect coastal rendering without ocean reflection/refraction passes.', 'beachfront'],
  ['nocrt', 'CRT bypass', 'Review the full scene with CRT disabled for this launch.', 'beachfront'],
  ['nosmaa', 'SMAA bypass', 'Review post-processing without SMAA antialiasing.', 'beachfront'],
  ['rawoutput', 'Raw colour output', 'Review the coastal post pass without colour grading.', 'beachfront'],
  ['nolut', 'LUT bypass', 'Inspect coastal output without the colour lookup table.', 'beachfront'],
  ['nodither', 'Dither bypass', 'Inspect coastal output without dithering.', 'beachfront'],
]) entries.push({ name, description, category: 'Performance & diagnostics', path: `?playtest&level=${level}&${flag}`, source: 'src/main.ts' });

export const toolEntries: readonly ToolEntry[] = entries;
