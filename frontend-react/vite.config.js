import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Stamps dist/sw.js with a fresh build id. Without it sw.js is byte-identical
 * across deploys, so installed apps never notice a new version.
 */
function stampServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'farmbook-stamp-sw',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '');
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', buildId));
    },
  };
}

/**
 * Preloads the Poppins weights used for most on-screen text (400 body, 600
 * semibold labels/nav) so the browser fetches them immediately instead of
 * after the fallback-font paint. font-display: swap still shows a visible
 * flash while a weight loads even self-hosted -- this is what actually
 * closes that gap, not just the self-hosting itself.
 */
function preloadCriticalFonts() {
  let outDir = 'dist';
  const criticalWeights = [400, 600];
  return {
    name: 'farmbook-preload-fonts',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const assetsDir = resolve(outDir, 'assets');
      const htmlFile = resolve(outDir, 'index.html');
      if (!existsSync(assetsDir) || !existsSync(htmlFile)) return;

      const files = readdirSync(assetsDir);
      const tags = criticalWeights
        .map((weight) => files.find((f) => new RegExp(`^poppins-latin-${weight}-normal-.*\\.woff2$`).test(f)))
        .filter(Boolean)
        .map((file) => `    <link rel="preload" as="font" type="font/woff2" href="/assets/${file}" crossorigin>`)
        .join('\n');
      if (!tags) return;

      const html = readFileSync(htmlFile, 'utf8');
      writeFileSync(htmlFile, html.replace('</head>', `${tags}\n  </head>`));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorker(), preloadCriticalFonts()],
  server: {
    port: 3000,
    open: false,
  },
});
