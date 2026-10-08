import pages from 'virtual:tool-pages';
import { toolEntries, type ToolEntry } from './toolDirectoryEntries';
import './toolDirectory.css';

declare const __BUILD_TAG__: string;
declare const __BUILD_CHANNEL__: string;

const root = new URL('../', location.href);
const categories = [
  'Labs & studios', 'Game & configuration', 'Movement tuning', 'Level authoring',
  'Playable labs & test courses', 'Maintenance', 'Gameplay reviews', 'Character & animation reviews',
  'UI & input reviews', 'Editor reviews', 'Art & asset reviews', 'Font & baking tools', 'Performance & diagnostics',
];
const entries = [...toolEntries, ...pages].sort((a, b) =>
  categories.indexOf(a.category) - categories.indexOf(b.category) || a.name.localeCompare(b.name));
const publishedCount = entries.filter(entry => !entry.local).length;
const localCount = entries.length - publishedCount;
const params = new URLSearchParams(location.search);
const key = 'solProtoToolDirectoryLocalBase';
let localBase = import.meta.env.DEV ? root.href : 'http://localhost:5173/';
try { localBase = safeBase(localStorage.getItem(key) ?? '') ?? localBase; } catch { /* storage optional */ }

function safeBase(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.search = ''; url.hash = '';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch { return null; }
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
function anchor(label: string, href: string, className = ''): HTMLAnchorElement {
  const link = element('a', label, className); link.href = href; return link;
}
const app = document.querySelector<HTMLDivElement>('#tool-directory')!;
const header = element('header', '', 'masthead');
const top = element('div', '', 'topline');
top.append(element('span', 'BONEMAN / CODEX · SOL', 'eyebrow'), anchor('Back to game ↗', root.href));
header.append(top, element('h1', 'Labs & tools'),
  element('p', 'Every studio, tuner, configuration screen and browser review. One long list, one bookmark.', 'intro'));
const counts = element('div', '', 'counts');
counts.append(element('span', `${entries.length} destinations`), element('span', `${publishedCount} published`), element('span', `${localCount} local development`));
header.append(counts);
const localSettings = element('details', '', 'local-settings');
localSettings.append(element('summary', 'Using the local review tools'));
localSettings.append(element('p', 'Published links work immediately. Local development links open your running checkout; start it with npm run dev. Historical art proofs may also need their original working assets.'));
const localLabel = element('label', 'Development server URL');
const localInput = element('input'); localInput.type = 'url'; localInput.value = localBase;
localInput.autocomplete = 'off'; localInput.spellcheck = false;
localLabel.append(localInput);
const localStatus = element('span', '', 'local-status'); localStatus.setAttribute('role', 'status');
localSettings.append(localLabel, localStatus);
header.append(localSettings);
app.append(header);

const filters = element('form', '', 'filters'); filters.setAttribute('role', 'search');
filters.addEventListener('submit', event => event.preventDefault());
const searchLabel = element('label', 'Find a tool');
const search = element('input'); search.type = 'search'; search.placeholder = 'Search names, controls, filenames…';
search.value = params.get('q') ?? ''; search.id = 'search'; searchLabel.append(search);
const categoryLabel = element('label', 'Category'); const category = element('select'); category.id = 'category';
category.add(new Option('All categories', ''));
for (const name of categories) category.add(new Option(`${name} (${entries.filter(entry => entry.category === name).length})`, name));
category.value = categories.includes(params.get('category') ?? '') ? params.get('category')! : '';
categoryLabel.append(category);
const availabilityLabel = element('label', 'Availability'); const availability = element('select'); availability.id = 'availability';
for (const [label, value] of [['Everything', ''], ['Published', 'published'], ['Local development', 'local']]) availability.add(new Option(label, value));
availability.value = ['published', 'local'].includes(params.get('availability') ?? '') ? params.get('availability')! : '';
availabilityLabel.append(availability);
const clear = element('button', 'Clear'); clear.type = 'button';
filters.append(searchLabel, categoryLabel, availabilityLabel, clear);
app.append(filters);
const resultStatus = element('p', '', 'result-count'); resultStatus.setAttribute('role', 'status'); resultStatus.setAttribute('aria-live', 'polite');
const main = element('main'); main.id = 'directory'; main.tabIndex = -1;
app.append(resultStatus, main);
const footer = element('footer');
footer.append(element('p', 'Browser pages are discovered from the project at each build. Movement sections come directly from the tuner. Local reviews retain their development-only status.'),
  element('p', `${__BUILD_CHANNEL__} · build ${__BUILD_TAG__}`, 'stamp'), anchor('Back to top ↑', '#'));
app.append(footer);

function destination(entry: ToolEntry): string {
  return new URL(entry.path, entry.local ? localBase : root).href;
}
function render(): void {
  const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = entries.filter(entry => (!category.value || entry.category === category.value) &&
    (!availability.value || Boolean(entry.local) === (availability.value === 'local')) &&
    words.every(word => `${entry.name} ${entry.description} ${entry.keywords ?? ''} ${entry.source} ${entry.path} ${entry.category}`.toLowerCase().includes(word)));
  main.replaceChildren();
  resultStatus.textContent = `${matches.length} of ${entries.length} destinations`;
  let number = 0;
  for (const group of categories) {
    const items = matches.filter(entry => entry.category === group);
    if (!items.length) continue;
    const section = element('section');
    section.append(element('h2', `${group} · ${items.length}`));
    const list = element('ol'); list.start = number + 1;
    for (const entry of items) {
      number++;
      const row = element('li'); row.dataset.source = entry.source;
      const content = element('div', '', 'entry');
      const line = element('div', '', 'entry-title');
      line.append(anchor(entry.name, destination(entry), 'destination'),
        element('span', entry.local ? 'Local dev' : 'Published', entry.local ? 'badge local' : 'badge'));
      content.append(line, element('p', entry.description));
      const meta = element('div', '', 'entry-meta');
      meta.append(element('code', entry.path), anchor(entry.source, `https://github.com/kiranmatthews/Prototype-Fork/blob/main/${entry.source}`, 'source'));
      content.append(meta); row.append(content); list.append(row);
    }
    section.append(list); main.append(section);
  }
  if (!matches.length) main.append(element('p', 'No matching tools. Try another search or clear the filters.', 'empty'));
  const url = new URL(location.href); url.search = '';
  if (search.value) url.searchParams.set('q', search.value);
  if (category.value) url.searchParams.set('category', category.value);
  if (availability.value) url.searchParams.set('availability', availability.value);
  history.replaceState(null, '', url);
}
for (const control of [search, category, availability]) control.addEventListener('input', render);
clear.addEventListener('click', () => { search.value = category.value = availability.value = ''; render(); search.focus(); });
localInput.addEventListener('change', () => {
  const next = safeBase(localInput.value);
  localInput.setAttribute('aria-invalid', String(!next));
  if (!next) { localStatus.textContent = 'Enter a full http:// or https:// server URL.'; return; }
  localBase = next; localInput.value = next;
  try { localStorage.setItem(key, next); } catch { /* links still work without persistence */ }
  localStatus.textContent = 'Local links updated.'; render();
});
render();
