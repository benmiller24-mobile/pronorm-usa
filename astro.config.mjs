import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  // Astro 7 defaults to compressHTML: 'jsx', which drops whitespace between
  // inline elements (breadcrumb separators, nav links, inline <a>/<strong> in
  // copy). Keep the Astro 5 behavior so rendered text is unchanged.
  compressHTML: true,
  site: 'https://pronormusa.com',
  integrations: [
    sitemap({
      filter: (page) => !['/dealer-portal', '/thank-you', '/404'].some((p) => page.includes(p)),    }),
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
