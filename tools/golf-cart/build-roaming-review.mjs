// Optional local review of the built game. The next production build removes it.
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await build({entryPoints:['tools/golf-cart/roaming-review.ts'],outfile:'dist/cart-roaming-review.js',bundle:true,format:'esm',target:'es2022',define:{'import.meta.env.DEV':'true'}});
const html=await readFile('dist/index.html','utf8');
await writeFile('dist/cart-roaming-review.html',html.replace('</body>',`<script>addEventListener('DOMContentLoaded',()=>import('./cart-roaming-review.js'));</script></body>`));
console.log('Local traffic review ready: /cart-roaming-review.html?playtest&level=country-club');
