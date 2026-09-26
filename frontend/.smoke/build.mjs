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
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  banner: {
    js: "const { createRequire } = require('module'); const require_ = createRequire(__filename);",
  },
});
console.log('bundled');
