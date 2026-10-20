// Optional local-only review of the built production runtime. Run after build;
// dist is ignored and the next build removes these synthetic controls.
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await build({entryPoints:['tools/race-powerups-game-review.ts'],outfile:'dist/race-powerups-game-review.js',bundle:true,format:'esm',target:'es2022',define:{'import.meta.env.DEV':'true'}});
const html=await readFile('dist/index.html','utf8');
await writeFile('dist/race-powerups-game-review.html',html.replace('</body>',`<script>addEventListener('DOMContentLoaded',()=>import('./race-powerups-game-review.js'));</script></body>`));
console.log('Local production review ready: /race-powerups-game-review.html?playtest&level=country-club');
