import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// @astrojs/sitemap emits sitemap-index.xml + sitemap-0.xml, never sitemap.xml.
// Copy the index to /sitemap.xml so the conventional path is a real 200 XML
// file instead of a redirect (a 301'd sitemap is what triggered Google Search
// Console "Couldn't fetch" on pinnaclesales.biz in Aug 2026).
function aliasSitemapXml() {
  return {
    name: 'alias-sitemap-xml',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const outDir = fileURLToPath(dir);
        const indexFile = join(outDir, 'sitemap-index.xml');
        if (existsSync(indexFile)) copyFileSync(indexFile, join(outDir, 'sitemap.xml'));
      },
    },
  };
}

export default defineConfig({
  // Astro 7 defaults to compressHTML: 'jsx', which drops whitespace between
  // inline elements (breadcrumb separators, nav links, inline <a>/<strong> in
  // copy). Keep the Astro 5 behavior so rendered text is unchanged.
  compressHTML: true,
  site: 'https://pronormusa.com',
  integrations: [
    sitemap({
      filter: (page) => !['/dealer-portal', '/thank-you', '/404'].some((p) => page.includes(p)),
    }),
    aliasSitemapXml(),
    react(),
  ],
  build: {
    inlineStylesheets: 'auto'
  },
  vite: {
    build: {
      // Vite 8 minifies CSS with Lightning CSS, which drops vendor prefixes it
      // thinks the targets don't need. Without explicit targets it removed
      // -webkit-backdrop-filter (still required by Safari < 18 / iOS 17) from
      // the scrolled header. Same browsers as Vite's "baseline widely
      // available" default, with Safari/iOS widened to 15.
      cssTarget: ['chrome111', 'edge111', 'firefox114', 'safari15', 'ios15'],
    },
  }
});
