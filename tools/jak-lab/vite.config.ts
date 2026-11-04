import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {localJakLab} from './local-assets.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));

// Independent delivery: no game runtime, held jump experiment, public asset pack
// or normal Pages output is imported/copied into this lab build.
export default defineConfig({
  root,base:'./',publicDir:false,plugins:[localJakLab()],
  build:{outDir:resolve(root,process.env.JAK_LAB_SITE_DIR??'.jak-lab-data/site'),emptyOutDir:true,
    assetsDir:'runtime',rollupOptions:{input:resolve(root,'jak-lab.html')}},
  resolve:{dedupe:['three']},
});
