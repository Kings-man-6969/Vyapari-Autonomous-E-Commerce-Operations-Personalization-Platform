import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['.smoke/render.jsx'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: '.smoke/bundle.cjs',
  jsx: 'automatic',
  logLevel: 'warning',
  // Vite injects these; esbuild needs them spelled out for a non-Vite build.
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'),
    // Spelled out so esbuild does not warn about `import.meta` in a CommonJS
    // output. Deliberately empty: the render suite then exercises the path that
    // matters most, which is "no measurement id, so no tag is loaded" -- and
    // passes explicit envs to `measurementId` for the configured branch.
    'import.meta.env.VITE_GA4_MEASUREMENT_ID': JSON.stringify(''),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  banner: {
    js: "const { createRequire } = require('module'); const require_ = createRequire(__filename);",
  },
});
console.log('bundled');
