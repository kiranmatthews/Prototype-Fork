import { defineConfig } from 'vite';
import { desktopAssets } from '../tools/desktop/assets.mjs';

// A separate build: the Pages/PWA entry and its deployment stay independent.
export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [desktopAssets()],
  resolve: { dedupe: ['three'] },
  define: {
    'import.meta.env.VITE_DESKTOP': JSON.stringify('true'),
    __BUILD_CHANNEL__: JSON.stringify('Codex/sol fork · Offline desktop'),
    __BUILD_TAG__: JSON.stringify(process.env.BONEMAN_BUILD_ID ?? new Date().toISOString().slice(0, 16) + ' UTC'),
  },
  build: {
    outDir: 'desktop/web',
    emptyOutDir: true,
    target: 'chrome138',
    sourcemap: false,
    rollupOptions: { input: { index: 'index.html', resetLocalData: 'reset-local-data.html' } },
  },
});
