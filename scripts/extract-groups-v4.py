#!/usr/bin/env python3
"""
Extract full-width product group sections from Pronorm price book PDFs.
Each image captures the complete row: diagram + description + prices.
Crops are bounded by the horizontal rule lines that separate product groups.
"""

import re
import os
import json
import subprocess
import sys
import numpy as np
from PIL import Image
from pathlib import Path

DPI = 150
SCALE = DPI / 72.0
TARGET_WIDTH = 1400  # Max output image width in pixels
# Broad SKU regex: matches 2-part (RW 30-76), 3-part (U 80-76-01), 4-part (KH 60-195-00-063)
SKU_RE = re.compile(r'([A-Z]{1,6}(?:\s[A-Z]{1,6})?)\s+(\d{1,4}(?:-\d{2,4}){1,4})')
# No-space SKU format: PFGSM450-32-56
NOSPACE_SKU_RE = re.compile(r'([A-Z]{2,6}\d{2,4})-(\d{2,4}(?:-\d{2,4}){0,3})')

DESC_STARTERS = [
    'Base unit', 'Wall unit', 'Tall unit', 'Front', 'Closing', 'Surcharge',
    'Corner', 'Shelf', 'Filler', 'Carousel', 'Larder', 'Bottle',
    'Waste', 'Pull-out', 'Drawer', 'Built-under', 'Wine', 'Countertop',
    'Sliding door', 'Wardrobe', 'Dressing', 'Utility', 'Single',
    'Panel', 'Bridging', 'Worktop', 'Wall shelf', 'Tall shelf',
    'Hatch', 'Open shelf', 'Microwave', 'Oven', 'Dishwasher',
    'Raised', 'End panel', 'Plinth', 'Cornice', 'Light pelmet',
    'Back panel', 'Towel', 'Spice', 'Living', 'Shelf unit',
    'Broom', 'Laundry', 'Ironing', 'Shoe', 'Coat', 'Mirror',
    'Wall recess', 'Niche', 'Internal', 'Accessory',
    'Upper flap', 'Lower flap', 'for appliance', 'for sink',
    'for raised', 'for free', 'for standing', 'Handle rail',
    'Surrounding', 'Upright', 'Cover', 'Side panel', 'Decorative',
    'Oven unit', 'Microwave unit', 'Storage', 'Door set',
]


def extract_text_page(pdf_path, page_num):
    """Extract text from a single page using pdftotext subprocess."""
    try:
        result = subprocess.run(
            ['pdftotext', '-f', str(page_num), '-l', str(page_num), pdf_path, '-'],
            capture_output=True, text=True, timeout=15
        )
        return result.stdout
    except:
        return ""


def is_pricing_page(text, pdf_source):
    """Check if a page contains pricing data."""
    if not text:
        return False
    has_pricing = ('Price group' in text or 'classified by material' in text) and SKU_RE.search(text)
    if not has_pricing:
        return False
    if pdf_source == 'pc':
        header = '\n'.join(text.split('\n')[:5])
        is_classic = any(l.strip().endswith(' C') and not l.strip().endswith(' P C')
                         for l in header.split('\n'))
        if is_classic:
            return False
    return True


def find_rule_lines(img_array):
    """Find horizontal rule lines in a rendered page image.
    Returns list of pixel row positions where dark lines span >80% of the page width."""
    h, w = img_array.shape
    # Check the middle 80% of the page to avoid edge artifacts
    margin = int(w * 0.1)
    middle = img_array[:, margin:w - margin]

    rule_rows = []
    for i in range(h):
        dark_frac = (middle[i] < 128).mean()
        if dark_frac > 0.80:
            rule_rows.append(i)

    # Group consecutive rows into single line positions
    lines = []
    if rule_rows:
        start = rule_rows[0]
        prev = rule_rows[0]
        for r in rule_rows[1:]:
            if r - prev > 3:
                lines.append((start + prev) // 2)  # midpoint
                start = r
            prev = r
        lines.append((start + prev) // 2)

    return lines


def get_bbox_words(pdf_path, page_num):
    """Get word positions from pdftotext -bbox."""
    try:
        result = subprocess.run(
            ['pdftotext', '-f', str(page_num), '-l', str(page_num), '-bbox', pdf_path, '-'],
            capture_output=True, text=True, timeout=15
        )
        html = result.stdout
    except:
        return []

    word_re = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)</word>')
    words = []
    for wm in word_re.finditer(html):
        words.append({
            'x': float(wm.group(1)),
            'y': float(wm.group(2)),
            'y2': float(wm.group(4)),
            'text': wm.group(5)
        })
    return words


def extract_skus_from_text(text):
    """Extract all SKUs from a line of text."""
    clean = re.sub(r'\bL/R\b', '_/_', text)
    skus = []
    for m in SKU_RE.finditer(clean):
        sku = f"{m.group(1).strip()} {m.group(2)}"
        if sku not in skus:
            skus.append(sku)
    for m in NOSPACE_SKU_RE.finditer(clean):
        sku = f"{m.group(1)}-{m.group(2)}"
        if sku not in skus:
            skus.append(sku)
    return skus


def build_groups_from_rules(rule_lines_px, words, page_h_px):
    """Build product groups by assigning words to bands between horizontal rule lines.
    Each band between two rule lines that contains both a desc keyword and SKUs = one group.
    Within a band, further split if desc+SKU lines indicate multiple product types."""

    # Convert rule line pixel positions to pt
    rule_lines_pt = [r / SCALE for r in rule_lines_px]

    # Create bands between consecutive rule lines
    boundaries = [0] + rule_lines_pt + [page_h_px / SCALE]

    bands = []
    for i in range(len(boundaries) - 1):
        bands.append({
            'y_start_pt': boundaries[i],
            'y_end_pt': boundaries[i + 1],
            'y_start_px': int(boundaries[i] * SCALE),
            'y_end_px': int(boundaries[i + 1] * SCALE),
        })

    # Assign words to bands
    for band in bands:
        band['words'] = []
    for w in words:
        y_mid = (w['y'] + w['y2']) / 2
        for band in bands:
            if band['y_start_pt'] <= y_mid <= band['y_end_pt']:
                band['words'].append(w)
                break

    # Group words within each band by Y position, then detect sub-groups
    groups = []
    for band in bands:
        if not band['words']:
            continue

        # Group words by Y (within 2pt tolerance)
        lines_by_y = {}
        for w in band['words']:
            y_key = round(w['y'] / 2) * 2
            if y_key not in lines_by_y:
                lines_by_y[y_key] = []
            lines_by_y[y_key].append(w)

        sorted_ys = sorted(lines_by_y.keys())

        # Within each band, split on desc+SKU lines
        current_sub = None
        for y_key in sorted_ys:
            line_words = sorted(lines_by_y[y_key], key=lambda w: w['x'])
            line_text = ' '.join(w['text'] for w in line_words)
            clean_text = re.sub(r'\bL/R\b', '_/_', line_text)

            is_desc = any(kw in line_text for kw in DESC_STARTERS)
            has_sku = bool(SKU_RE.search(clean_text)) or bool(NOSPACE_SKU_RE.search(clean_text))
            skus = extract_skus_from_text(line_text) if has_sku else []

            # Start new sub-group when desc + SKU on same line
            if is_desc and has_sku:
                if current_sub and current_sub['skus']:
                    groups.append(current_sub)
                current_sub = {
                    'skus': list(skus),
                    'y_start_px': band['y_start_px'] if not groups or (groups and groups[-1]['y_end_px'] != band['y_start_px']) else band['y_start_px'],
                    'y_end_px': band['y_end_px'],
                    'band_start_px': band['y_start_px'],
                    'band_end_px': band['y_end_px'],
                }
            elif current_sub and skus:
                for s in skus:
                    if s not in current_sub['skus']:
                        current_sub['skus'].append(s)

        if current_sub and current_sub['skus']:
            groups.append(current_sub)

    # Now refine: if a band has multiple sub-groups, find intermediate rule lines
    # to split the crop correctly. Otherwise use the full band.
    refined = []
    i = 0
    while i < len(groups):
        g = groups[i]
        # Check if next group shares the same band
        if i + 1 < len(groups) and groups[i + 1]['band_start_px'] == g['band_start_px']:
            # Multiple groups in one band — we need to find the rule line between them
            # Use the text-based approach: the next group's first SKU y_position
            # Actually, the band has no internal rule lines (that's why it's one band).
            # Use the midpoint between last SKU of this group and first of next group.
            # For now, just keep them as separate groups sharing the band crop.
            # We'll refine the crop in the render step using rule line detection within the band.
            pass
        refined.append(g)
        i += 1

    # Set base_key from first SKU
    for g in refined:
        g['base_key'] = g['skus'][0] if g['skus'] else 'unknown'

    return refined


def render_page(pdf_path, page_num):
    """Render a page to PNG, return the image and cleanup path."""
    tmp_dir = "/tmp/pdf-render"
    os.makedirs(tmp_dir, exist_ok=True)
    for f in Path(tmp_dir).glob("*.png"):
        f.unlink()

    tmp_base = f"{tmp_dir}/r"
    try:
        subprocess.run(
            ['pdftoppm', '-f', str(page_num), '-l', str(page_num),
             '-png', '-r', str(DPI), pdf_path, tmp_base],
            capture_output=True, timeout=30
        )
    except:
        return None, None

    for f in Path(tmp_dir).glob("r-*.png"):
        return str(f), tmp_dir

    return None, None


def process_page(pdf_path, page_num, pdf_source, output_dir, sku_to_image):
    """Process a single page: render, find rule lines, detect groups, crop."""

    # Step 1: Render page
    img_file, tmp_dir = render_page(pdf_path, page_num)
    if not img_file:
        return 0

    try:
        img = Image.open(img_file)
        page_w, page_h = img.width, img.height
        gray = np.array(img.convert('L'))
    except:
        return 0

    # Step 2: Find horizontal rule lines
    rule_lines = find_rule_lines(gray)

    # Step 3: Get word positions
    words = get_bbox_words(pdf_path, page_num)

    # Step 4: Build groups from rule-line bands + text analysis
    groups = build_groups_from_rules(rule_lines, words, page_h)

    if not groups:
        img.close()
        try:
            os.remove(img_file)
        except:
            pass
        return 0

    # Step 5: For groups that share a band (no rule line between them),
    # scan the actual image for thin horizontal lines within the band to find sub-boundaries
    # (Some pages have lighter or partial rule lines between sub-groups)
    refined_groups = []
    band_groups = {}
    for g in groups:
        band_key = (g['band_start_px'], g['band_end_px'])
        if band_key not in band_groups:
            band_groups[band_key] = []
        band_groups[band_key].append(g)

    for band_key, bg_list in band_groups.items():
        if len(bg_list) == 1:
            # Single group in band — crop = full band
            g = bg_list[0]
            g['crop_y0'] = g['band_start_px']
            g['crop_y1'] = g['band_end_px']
            refined_groups.append(g)
        else:
            # Multiple groups in band — look for internal rule lines
            band_start, band_end = band_key
            band_strip = gray[band_start:band_end, :]
            margin = int(page_w * 0.1)
            middle_strip = band_strip[:, margin:page_w - margin]

            # Find internal rule lines (>60% dark — may be thinner)
            internal_rules = []
            for row_idx in range(middle_strip.shape[0]):
                dark_frac = (middle_strip[row_idx] < 128).mean()
                if dark_frac > 0.60:
                    internal_rules.append(band_start + row_idx)

            # Consolidate into line positions
            internal_lines = []
            if internal_rules:
                start = internal_rules[0]
                prev = internal_rules[0]
                for r in internal_rules[1:]:
                    if r - prev > 3:
                        internal_lines.append((start + prev) // 2)
                        start = r
                    prev = r
                internal_lines.append((start + prev) // 2)

            # Remove lines that are the band boundaries themselves
            internal_lines = [l for l in internal_lines
                              if l > band_start + 5 and l < band_end - 5]

            if len(internal_lines) >= len(bg_list) - 1:
                # We have enough internal lines to split
                split_points = [band_start] + internal_lines[:len(bg_list) - 1] + [band_end]
                for idx, g in enumerate(bg_list):
                    g['crop_y0'] = split_points[idx]
                    g['crop_y1'] = split_points[idx + 1]
                    refined_groups.append(g)
            else:
                # Not enough internal lines — use proportional split based on SKU count
                total_skus = sum(len(g['skus']) for g in bg_list)
                if total_skus == 0:
                    total_skus = len(bg_list)
                band_height = band_end - band_start
                y = band_start
                for g in bg_list:
                    ratio = len(g['skus']) / total_skus
                    g['crop_y0'] = int(y)
                    y += band_height * ratio
                    g['crop_y1'] = int(y)
                    refined_groups.append(g)

    # Step 6: Crop and save each group
    extracted = 0
    for g in refined_groups:
        y0 = max(0, g['crop_y0'])
        y1 = min(page_h, g['crop_y1'])

        # Ensure we include the rule lines (extend by 1px if needed)
        if y0 > 0:
            y0 = max(0, y0 - 1)
        y1 = min(page_h, y1 + 1)

        if y1 - y0 < 30:
            continue

        crop = img.crop((0, y0, page_w, y1))

        # Check if mostly white (blank)
        try:
            crop_arr = np.array(crop.convert('L'))
            if crop_arr.mean() > 252:
                continue
        except:
            pass

        safe_key = g['base_key'].replace(' ', '_').replace('/', '-')
        jpeg_filename = f"{pdf_source}_{safe_key}_p{page_num}.jpg"
        jpeg_path = os.path.join(output_dir, jpeg_filename)
        crop_rgb = crop.convert('RGB')
        if crop_rgb.width > TARGET_WIDTH:
            ratio = TARGET_WIDTH / crop_rgb.width
            new_h = int(crop_rgb.height * ratio)
            crop_rgb = crop_rgb.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
        crop_rgb.save(jpeg_path, 'JPEG', quality=65, optimize=True)

        for sku in g['skus']:
            sku_to_image[sku] = jpeg_filename

        extracted += 1

    img.close()
    try:
        os.remove(img_file)
    except:
        pass

    return extracted


def process_pdf(pdf_path, pdf_source, output_dir, sku_to_image):
    """Process a single PDF."""
    name = Path(pdf_path).name
    print(f"\nProcessing: {name}", flush=True)

    try:
        result = subprocess.run(['pdfinfo', pdf_path], capture_output=True, text=True, timeout=15)
        for line in result.stdout.split('\n'):
            if line.startswith('Pages:'):
                num_pages = int(line.split(':')[1].strip())
                break
        else:
            print("  Could not determine page count", flush=True)
            return 0
    except:
        print("  Could not read PDF info", flush=True)
        return 0

    print(f"  {num_pages} pages — scanning...", flush=True)

    # Phase 1: Find pricing pages
    pricing_pages = []
    for pg in range(1, num_pages + 1):
        text = extract_text_page(pdf_path, pg)
        if is_pricing_page(text, pdf_source):
            pricing_pages.append(pg)
        if pg % 100 == 0:
            print(f"  Scanned {pg}/{num_pages} — {len(pricing_pages)} pricing pages", flush=True)

    print(f"  Found {len(pricing_pages)} pricing pages", flush=True)
    if not pricing_pages:
        return 0

    # Phase 2: Process each page
    extracted = 0
    for idx, pg_num in enumerate(pricing_pages):
        count = process_page(pdf_path, pg_num, pdf_source, output_dir, sku_to_image)
        extracted += count
        if (idx + 1) % 25 == 0:
            print(f"  Processed {idx+1}/{len(pricing_pages)} pages — {extracted} groups", flush=True)

    mapped = len([s for s in sku_to_image if sku_to_image[s].startswith(pdf_source)])
    print(f"  Done: {extracted} group images, {mapped} SKUs mapped", flush=True)
    return extracted


def main():
    single = sys.argv[1] if len(sys.argv) > 1 else None

    print("=" * 60)
    print("PRONORM GROUP EXTRACTOR v5 (Rule-line bounded crops)")
    print("=" * 60, flush=True)

    output_dir = "/sessions/jolly-nice-clarke/pronorm-usa/public/data/diagrams"
    os.makedirs(output_dir, exist_ok=True)

    map_path = os.path.join(output_dir, "_sku_image_map.json")
    if single and os.path.exists(map_path):
        with open(map_path) as f:
            sku_to_image = json.load(f)
        sku_to_image = {k: v for k, v in sku_to_image.items() if not v.startswith(single)}
        for f in Path(output_dir).glob(f"{single}_*.jpg"):
            f.unlink()
        for f in Path(output_dir).glob(f"{single}_*.png"):
            f.unlink()
    else:
        sku_to_image = {}
        for f in Path(output_dir).glob("*.jpg"):
            f.unlink()
        for f in Path(output_dir).glob("*.png"):
            f.unlink()

    pdfs = [
        ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF_GB_proline-classic 09-2025.pdf", "pc"),
        ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF_GB_Y-line-X-line 09-2025.pdf", "yx"),
        ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF-Living-09-2025_GB.pdf", "living"),
    ]

    if single:
        pdfs = [p for p in pdfs if p[1] == single]

    total = 0
    for path, src in pdfs:
        if os.path.exists(path):
            count = process_pdf(path, src, output_dir, sku_to_image)
            total += count

    with open(map_path, 'w') as f:
        json.dump(sku_to_image, f, separators=(',', ':'))

    print(f"\n{'='*60}")
    print(f"Total group images: {total}")
    print(f"SKUs mapped: {len(sku_to_image)}")

    cat_path = "/sessions/jolly-nice-clarke/pronorm-usa/public/data/pricing-search.json"
    if os.path.exists(cat_path):
        with open(cat_path) as f:
            catalog = json.load(f)
        total_skus = len(catalog)
        mapped = sum(1 for item in catalog if item['s'] in sku_to_image)
        print(f"Catalog coverage: {mapped}/{total_skus} ({100*mapped/total_skus:.0f}%)")

    print("Done!", flush=True)


if __name__ == "__main__":
    main()
