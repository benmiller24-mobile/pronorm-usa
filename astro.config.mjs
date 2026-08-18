import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://pronormusa.com',
  integrations: [
    sitemap({
      filter: (page) => !['/dealer-portal', '/thank-you', '/404', '/become-a-dealer'].some((p) => page.includes(p)),    }),
    react(),
  ],
  build: {
    inlineStylesheets: 'auto'
  }
});
