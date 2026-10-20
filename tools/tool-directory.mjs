import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { siteEntries } from './site-entries.mjs';

const descriptions = {
  'index.html': ['Game', 'Launch the game, campaign and player menus.', 'Game & configuration'],
  'crt-review.html': ['CRT test-pattern lab', 'Animated colour bars, checkerboards and glow with the complete CRT shader tuner.', 'Labs & studios'],
  'skateboard-lab.html': ['Skateboard shape lab', 'Gameplay and map boards: shape, curves, wheels, trucks, artwork, wear and plywood.', 'Labs & studios'],
  'skate-pose-review.html': ['Skate pose contact sheet', 'Looping, labelled skate captures with transport, views, filters and editable animation studies.', 'Labs & studios'],
  'spin-lab.html': ['Spin smear lab', 'Character spin smears, orbital rings, colours, mesh shape and animation preview.', 'Labs & studios'],
  'milk-review.html': ['Fruit / milk pickup lab', 'Pickup model, appearance and motion review.', 'Labs & studios'],
  'roo-type-lab.html': ['Roo text appearance studio', 'Glyphs, palettes, tracking, edge highlights, counters and transparent PNG / atlas exports.', 'Labs & studios'],
  'reset-local-data.html': ['Reset local game data', 'Review local settings and saves, choose what to reset, confirm and undo.', 'Maintenance'],
  'public/update-game.html': ['Update game', 'Load the latest published build while retaining saves and settings.', 'Maintenance'],
  'public/offline-save.html': ['Save game offline', 'Download and inspect offline game availability.', 'Maintenance'],
  'public/stability-report.html': ['Graphics stability report', 'Inspect the last three local sessions without loading the game.', 'Maintenance'],
};

const humanize = value => value.replace(/\.html$/, '').split(/[-/]/).map(word =>
  ({ ui: 'UI', hud: 'HUD', crt: 'CRT', png: 'PNG' })[word] ?? word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

function category(file) {
  if (/editor/.test(file)) return 'Editor reviews';
  if (/roo-type|balance-meter\/bake/.test(file)) return 'Font & baking tools';
  if (/performance|frame-work|crash/.test(file)) return 'Performance & diagnostics';
  if (/menu|hud|save-grid|level-select|competition-review|touch-controls|trick-guide|milk-bottle/.test(file)) return 'UI & input reviews';
  if (/skin|idle|skate-charge|skate-pose|crouch|ice-skate|ice-walk|wallride-facing|grind-head|interaction/.test(file)) return 'Character & animation reviews';
  if (file.startsWith('tools/') || /boardwalk-review|coastal-water|milk-review/.test(file)) return 'Art & asset reviews';
  return 'Gameplay reviews';
}

// Review controls usually operate on the already-loaded world. Give their
// bookmarks the same explicit fixtures used in the authoring documentation.
function reviewQuery(file) {
  if (file.includes('/') && file !== 'tools/carton-game-review.html') return '';
  let level = 'codex-lab';
  if (/park-|competition|jungle-cup|cup-performance|trick-|grind-|balance-|spin-review|interaction|milk-bottle/.test(file)) level = 'jungle-cup';
  if (/milk-crate|explosive-bundle|swimming|level-select/.test(file)) level = 'jungle';
  if (/boardwalk-play/.test(file)) level = 'beachfront';
  if (/bone-yard/.test(file)) level = 'bone-yard';
  if (/treehouse-trail/.test(file)) level = 'treehouse-trail';
  if (/crab-chief/.test(file)) level = 'crab-chief';
  if (/world-map-skid/.test(file)) level = 'warproom';
  if (/bonus-presentation/.test(file)) level = 'crate-primer';
  if (/milk-distance/.test(file)) level = 'test';
  if (/^(mobile-performance|performance|crash)-/.test(file)) level = 'sky';
  return `?playtest&level=${level}${/mobile-performance|cup-performance|touch-controls/.test(file) ? '&touch' : ''}`;
}

async function htmlFiles(root, directory, recursive) {
  const result = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isFile() && file.endsWith('.html')) result.push(file);
    else if (recursive && entry.isDirectory()) result.push(...await htmlFiles(root, file, true));
  }
  return result;
}

// Discover every project-owned browser entry, including local-only authoring proofs.
// Never import their modules here: many QA harnesses deliberately stage game state.
export async function discoverToolPages(root) {
  const files = (await Promise.all([
    htmlFiles(root, '', false), htmlFiles(root, 'tools', true), htmlFiles(root, 'public', true),
  ])).flat().sort();
  const published = new Set(Object.values(siteEntries));
  return Promise.all(files.map(async source => {
    const html = await readFile(path.join(root, source), 'utf8');
    const heading = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1].replace(/&amp;/g, '&');
    const title = heading && !/^BONEMAN$/i.test(heading.trim()) ? heading : humanize(source.replace(/^tools\//, ''));
    const [name, description, group] = descriptions[source] ?? [title,
      /roo-type/.test(source) ? 'Local font proof or baking utility; some historical proofs require their generated working assets.' :
      source.startsWith('tools/') ? 'Local authoring / asset review. Open with the development server running.' :
      'Local browser review with staging or inspection controls. Open with the development server running.', category(source)];
    const local = !published.has(source) && !source.startsWith('public/');
    return { name, description, category: group, source,
      path: source.replace(/^public\//, '') + (local ? reviewQuery(source) : ''),
      local,
    };
  }));
}

export function toolDirectory() {
  let root;
  const id = '\0virtual:tool-pages';
  return {
    name: 'tool-directory',
    configResolved(config) { root = config.root; },
    resolveId(source) { if (source === 'virtual:tool-pages') return id; },
    async load(source) {
      if (source !== id) return;
      const pages = await discoverToolPages(root);
      for (const page of pages) this.addWatchFile(path.join(root, page.source));
      return `export default ${JSON.stringify(pages)};`;
    },
    configureServer(server) {
      // New/deleted pages appear on the next directory load, without a hand-maintained list.
      const invalidate = file => {
        if (!file.endsWith('.html')) return;
        const mod = server.moduleGraph.getModuleById(id);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', invalidate).on('unlink', invalidate);
    },
  };
}
