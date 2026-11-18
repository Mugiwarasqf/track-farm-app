import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync } from 'node:fs';
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

/**
 * Recompresses and downsizes the photo/icon assets Vite copies verbatim from
 * public/ (Vite's asset pipeline never transforms the public dir, so these
 * were shipping as raw multi-megabyte Unsplash downloads at 4000px+ widths
 * into UI slots a few hundred px wide). Runs in place against dist/ so no
 * src="" path in any component needs to change. Manifest-pinned app icons
 * (public/manifest.json's declared sizes) are recompressed only, never
 * resized -- PWA installers expect those exact pixel dimensions.
 */
function optimizeImages() {
  let outDir = 'dist';
  const PHOTO_DIRS = ['images', 'supportImage', 'onboarding', 'birds'];
  const PHOTO_MAX_WIDTH = 1600;
  const ICON_MAX_WIDTH = 256;
  const MIN_BYTES_TO_PROCESS = 20_000;
  const PINNED_SIZE_FILES = new Set(['icon/app-icon.png', 'icon/app-icon-192.png']);

  return {
    name: 'farmbook-optimize-images',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const walk = (dir) =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const full = resolve(dir, entry.name);
          return entry.isDirectory() ? walk(full) : [full];
        });

      const targets = [...PHOTO_DIRS.map((d) => resolve(outDir, d)), resolve(outDir, 'icon')]
        .filter(existsSync)
        .flatMap(walk)
        .filter((f) => /\.(jpe?g|png)$/i.test(f));

      let before = 0;
      let after = 0;
      for (const file of targets) {
        const relPath = file.slice(outDir.length + 1).replace(/\\/g, '/');
        const size = statSync(file).size;
        if (size < MIN_BYTES_TO_PROCESS) continue;

        const pinned = PINNED_SIZE_FILES.has(relPath);
        const maxWidth = relPath.startsWith('icon/') ? ICON_MAX_WIDTH : PHOTO_MAX_WIDTH;

        let img = sharp(file);
        if (!pinned) img = img.resize({ width: maxWidth, withoutEnlargement: true });

        const buffer = await (/\.png$/i.test(file)
          ? img.png({ quality: 80, compressionLevel: 9, palette: true }).toBuffer()
          : img.jpeg({ quality: 78, mozjpeg: true }).toBuffer());

        if (buffer.length < size) {
          // sharp's read handle on `file` can still be closing on Windows;
          // writing straight back to the same path races it (EBUSY/UNKNOWN).
          const tmp = `${file}.tmp`;
          writeFileSync(tmp, buffer);
          renameSync(tmp, file);
          before += size;
          after += buffer.length;
        }
      }
      if (before > 0) {
        const pct = (100 * (1 - after / before)).toFixed(0);
        console.log(`[optimize-images] ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB (-${pct}%)`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorker(), preloadCriticalFonts(), optimizeImages()],
  server: {
    port: 3000,
    open: false,
  },
});
