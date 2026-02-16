# Pronorm USA — pronormusa.com

Premium website for Pronorm German fitted kitchens in the United States. Built with Astro for static deployment on Netlify.

## Site Architecture — 17 Pages

### Consumer-Facing Pages
| Page | URL | Purpose |
|------|-----|---------|
| Homepage | `/` | Hero, collections preview, social proof, CTAs |
| Collections | `/collections` | All collections overview |
| Y-Line | `/collections/y-line` | Handleless collection detail |
| Modern Shaker LF | `/collections/modern-shaker` | Shaker collection detail |
| Boho Textured Oak | `/collections/boho-oak` | Textured oak collection detail |
| Why Pronorm | `/why-pronorm` | Brand story, construction, sustainability |
| Gallery | `/gallery` | Project photography grid with filters |
| Find a Dealer | `/find-a-dealer` | Dealer locator with zip search |
| Request Consultation | `/request-consultation` | Primary lead capture form |
| FAQ | `/faq` | FAQ with schema markup for rich results |
| Contact | `/contact` | General contact form |

### Content Marketing / SEO
| Page | URL | Purpose |
|------|-----|---------|
| Magazine | `/magazine` | Blog/content hub index |
| German vs American | `/magazine/german-vs-american-kitchens` | Key SEO article |

### B2B / Dealer
| Page | URL | Purpose |
|------|-----|---------|
| Become a Dealer | `/become-a-dealer` | Dealer partnership application |

### Utility
| Page | URL |
|------|-----|
| Thank You | `/thank-you` |
| Privacy Policy | `/privacy` |
| 404 | `/404` |

## Lead Generation Features

- **5 Netlify Forms**: consultation, dealer-application, contact, newsletter, magazine-subscribe
- **Consultation CTA** on every major page
- **Zip code dealer search** on homepage and Find a Dealer
- **Newsletter signup** in footer (every page) and Magazine
- **Referral tracking** in consultation form (Instagram, Google, Houzz, etc.)

## SEO Features

- Schema.org markup: Organization, WebSite, Article, FAQPage
- Open Graph and Twitter Card meta on all pages
- Auto-generated sitemap via @astrojs/sitemap
- Semantic HTML throughout
- robots.txt with sitemap reference
- Canonical URLs
- SEO-optimized page titles and descriptions
- Blog/Magazine content targeting high-value keywords:
  - "German kitchen cabinets"
  - "German fitted kitchens USA"
  - "handleless kitchen design"
  - "modern shaker kitchen cabinets"
  - "European kitchen design"

## Deploy to Netlify

### Option 1: Git-based deploy (recommended)
1. Push this project to a GitHub/GitLab repo
2. Log into [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your repo
5. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Deploy!

### Option 2: Manual deploy
1. Run `npm run build` locally
2. Drag the `dist/` folder to Netlify's deploy dropzone

### Post-Deploy
1. Add custom domain `pronormusa.com` in Netlify settings
2. Enable HTTPS (automatic with Netlify)
3. Verify forms work at Netlify → Forms dashboard
4. Submit sitemap to Google Search Console
5. Add GA4 tracking snippet to `SEOHead.astro`

## Image Placeholders

All images currently show styled placeholder blocks with descriptive labels. Replace with real photography:

1. Add images to `public/images/`
2. Replace `<div class="img-placeholder">` blocks with `<img>` tags
3. Use WebP format for best performance
4. Include alt text for accessibility

### Priority Images Needed
- Hero: Full-width Pronorm kitchen (21:9 ratio)
- Collections: Y-Line, Modern Shaker, Boho Oak hero shots (4:5 ratio)
- Gallery: 12+ project photos in various ratios
- Instagram: 6 square posts
- Dealer map: Static or interactive map image

## Instagram Integration

The site includes placeholder Instagram grid sections. To connect a live feed:
- Use [Behold.so](https://behold.so) or [EmbedSocial](https://embedsocial.com) for a widget
- Or manually update the grid with your latest posts

## Tech Stack

- **Framework**: Astro 5
- **Styling**: Custom CSS (no framework dependency)
- **Fonts**: Cormorant Garamond + DM Sans (Google Fonts)
- **Forms**: Netlify Forms (built-in)
- **Sitemap**: @astrojs/sitemap
- **Hosting**: Netlify (static)

## Development

```bash
npm install
npm run dev      # Start dev server at localhost:4321
npm run build    # Build for production
npm run preview  # Preview production build
```

## Design System

- **Aesthetic**: European luxury editorial — warm, sophisticated, magazine-quality
- **Typography**: Cormorant Garamond (display) + DM Sans (body)
- **Colors**: Warm neutrals with copper accent (#b87333)
- **Animations**: Scroll-reveal, hover transitions, staggered load animations

---

*Exclusive US distribution by [Pinnacle Sales](https://pinnaclesales.biz)*
