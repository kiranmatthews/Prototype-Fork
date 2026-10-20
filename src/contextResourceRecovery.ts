/** Three retains resource-disposal listeners across context restoration. A
 * later owner release can therefore delete a handle from the lost context.
 * Its storage is already gone: ignore only handles created by this context
 * in an earlier generation. Current and foreign handles retain native checks.
 * CPU assets and their disposal listeners remain owned by their usual caches. */
const installed = new WeakMap<WebGLRenderingContext | WebGL2RenderingContext, () => ContextResourceRecoveryDiagnostics>();
interface ContextResourceRecoveryDiagnostics {
  generation: number;
  skippedDeletes: number;
}

export function installContextResourceRecovery(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): () => ContextResourceRecoveryDiagnostics {
  const existing = installed.get(gl);
  if (existing) return existing;
  let generation = 0, skippedDeletes = 0, lost = false;
  canvas.addEventListener('webglcontextlost', () => {
    if (gl.isContextLost() && !lost) { generation++; lost = true; }
  });
  canvas.addEventListener('webglcontextrestored', () => { if (!gl.isContextLost()) lost = false; });
  const methods = gl as unknown as Record<string, (...args: unknown[]) => unknown>;
  const pairs = [
    ['createBuffer', 'deleteBuffer'], ['createTexture', 'deleteTexture'],
    ['createFramebuffer', 'deleteFramebuffer'], ['createRenderbuffer', 'deleteRenderbuffer'],
    ['createProgram', 'deleteProgram'], ['createShader', 'deleteShader'],
    ['createVertexArray', 'deleteVertexArray'], ['createQuery', 'deleteQuery'],
    ['createSampler', 'deleteSampler'], ['createTransformFeedback', 'deleteTransformFeedback'],
    ['fenceSync', 'deleteSync'],
  ];
  for (const [createName, deleteName] of pairs) {
    const create = methods[createName], remove = methods[deleteName];
    if (typeof create !== 'function' || typeof remove !== 'function') continue;
    // A separate weak registry per type preserves errors for wrong-type and
    // cross-context arguments, and cannot keep retired GPU handles alive.
    const owners = new WeakMap<object, number>();
    methods[createName] = function (this: typeof gl, ...args) {
      const resource = create.apply(this, args);
      if (this === gl && resource !== null && typeof resource === 'object') owners.set(resource, generation);
      return resource;
    };
    methods[deleteName] = function (this: typeof gl, ...args) {
      const resource = args[0];
      if (this === gl && resource !== null && typeof resource === 'object') {
        const owner = owners.get(resource);
        if (owner !== undefined && owner < generation) { skippedDeletes++; return; }
      }
      return remove.apply(this, args);
    };
  }
  const diagnostics = () => ({ generation, skippedDeletes });
  installed.set(gl, diagnostics);
  return diagnostics;
}
