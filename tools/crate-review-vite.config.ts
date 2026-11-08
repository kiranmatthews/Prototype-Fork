import { mergeConfig } from 'vite';
import base from '../vite.config';

// Shared node_modules must not share Vite's mutable dev cache across worktrees.
// This config is only for the local review pages; production uses vite.config.ts.
export default mergeConfig(base, { cacheDir: '.motion-playtest-cache/crate-review-vite-cache', server: { hmr: false } });
