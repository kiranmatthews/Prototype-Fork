// Preserve the established native launch/return contract after the global
// controller rollback. The original safety checks reject under-shell catches,
// protect the lower floor, and retain legitimate coping/drop-in ownership;
// the recorded/51-case suite covers actual releases and ballistic continuity.
await import('./validate-halfpipe-safety.mjs');
await import('./test-park-halfpipe-vert.mjs');
