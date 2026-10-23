import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Separate preview: the normal 2x level and shared registry stay untouched.
const port = Number(process.env.SCHOOL_SOURCE_PORT || 5313);
const frozen = process.env.SCHOOL_RUNTIME_SNAPSHOT;
const runtime = ['player', 'tuning', 'level', 'input', 'skateParkPhysics', 'skateParkTuning', 'skateSteering', 'vertBoardRelease', 'vertSkateMotion', 'meshContactNormal', 'skateChaseCamera', 'skateReferencePhysics', 'referenceRailCapture'];
const server = await createServer({
  plugins: [{ name: 'school-source-preview', enforce: 'pre',
  transformIndexHtml() {
    // Capture errors before the game exports its review bridge. A late iframe
    // load listener otherwise misses startup errors that appear in DevTools.
    return [{ tag: 'script', injectTo: 'head-prepend', children:
      "window.__schoolStartupErrors=[];window.addEventListener('error',e=>window.__schoolStartupErrors.push({message:e.message,file:e.filename,line:e.lineno,column:e.colno,stack:e.error?.stack||null}));" }];
  }, async load(id) {
    if (id === `${process.cwd()}/src/levels/codex-lab.ts`) return (await readFile(id, 'utf8')).replace("export { SCHOOL_MIAMI_LEVEL } from './school-miami';", "export { SCHOOL_SOURCE_LEVEL as SCHOOL_MIAMI_LEVEL } from './school-source';");
    if (frozen && runtime.some(n => id === `${process.cwd()}/src/${n}.ts`)) return readFile(`${frozen}/${id.split('/').at(-1)}`, 'utf8');
  } }],
  server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false },
});
await server.listen(); server.printUrls();
