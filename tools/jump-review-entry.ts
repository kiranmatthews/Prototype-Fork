// A direct bookmark must start the playable comparison as well as the Labs link.
const url = new URL(window.location.href);
if (!url.searchParams.has('playtest')) url.searchParams.set('playtest', '');
if (!url.searchParams.has('level')) url.searchParams.set('level', 'codex-lab');
window.history.replaceState(window.history.state, '', url);
await import('../src/main');
await import('./jump-browser-review');
export {};
