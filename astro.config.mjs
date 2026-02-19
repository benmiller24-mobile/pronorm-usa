import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://www.pronormusa.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/dealer-portal'),
    }),
    react(),
  ],
  build: {
    inlineStylesheets: 'auto'
  }
});
