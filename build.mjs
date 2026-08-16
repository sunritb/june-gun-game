import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'bundle/game.js',
  logLevel: 'info',
});
console.log('built bundle/game.js');
