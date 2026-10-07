const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

const opts = {
  entryPoints: { extension: 'src/extension.ts', uninstall: 'src/uninstall.ts' },
  bundle: true,
  outdir: 'dist',
  external: ['vscode'],
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: true,
};

(async () => {
  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
  } else {
    await esbuild.build(opts);
  }
})().catch(() => process.exit(1));
