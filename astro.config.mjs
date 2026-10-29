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
  }
});
