#!/usr/bin/env python3
"""
Extract full-width product group sections from Pronorm price book PDFs.
Each image captures the complete row: diagram + description + prices.
"""

import re
import os
import json
import subprocess
import sys
from PIL import Image
from pathlib import Path

DPI = 200
SCALE = DPI / 72.0
SKU_RE = re.compile(r'([A-Z]{1,4}(?:\s[A-Z]{1,4})?)\s+(\d{2,3}(?:-\d{2,3}){2,3})')

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


def get_page_groups(pdf_path, page_num):
    """Get product group boundaries and SKU mappings from a page."""
    try:
        result = subprocess.run(
            ['pdftotext', '-f', str(page_num), '-l', str(page_num), '-bbox', pdf_path, '-'],
            capture_output=True, text=True, timeout=15
        )
        html = result.stdout
    except:
        return []

    word_re = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)</word>')

    # Group words by Y position (within 2pt tolerance)
    lines_by_y = {}
    for wm in word_re.finditer(html):
        y = float(wm.group(2))
        y_key = round(y / 2) * 2
        if y_key not in lines_by_y:
            lines_by_y[y_key] = []
        lines_by_y[y_key].append((float(wm.group(1)), y, float(wm.group(3)), float(wm.group(4)), wm.group(5)))

    sorted_ys = sorted(lines_by_y.keys())

    # Find product group boundaries:
    # A group starts at a description line (e.g. "Base unit") that has or is followed by SKU lines
    groups = []
    i = 0
    while i < len(sorted_ys):
        y_key = sorted_ys[i]
        words = sorted(lines_by_y[y_key], key=lambda w: w[0])
        line_text = ' '.join(w[4] for w in words)

        # Check if this line starts a product group (description keyword)
        is_desc = any(kw in line_text for kw in DESC_STARTERS)
        has_sku = bool(SKU_RE.search(line_text))

        if is_desc or has_sku:
            group_start_y = min(w[1] for w in words)
            group_skus = []

            # Collect SKUs from this line and following lines until next group
            j = i
            last_content_y = group_start_y
            while j < len(sorted_ys):
                jy = sorted_ys[j]
                jwords = lines_by_y[jy]
                jtext = ' '.join(w[4] for w in jwords)

                # Collect SKUs
                for m in SKU_RE.finditer(jtext):
                    sku = f"{m.group(1).strip()} {m.group(2)}"
                    if sku not in group_skus:
                        group_skus.append(sku)

                last_content_y = max(w[3] for w in jwords)  # yMax

                # Check if next line starts a new group
                if j > i:
                    next_is_desc = any(kw in jtext for kw in DESC_STARTERS)
                    # Only break if we already have SKUs and this is a new description
                    if next_is_desc and group_skus and not SKU_RE.search(jtext):
                        break
                    # Also break if there's a big gap (>30pt) suggesting new section
                    if j + 1 < len(sorted_ys):
                        gap = sorted_ys[j + 1] - jy
                        if gap > 30 and group_skus:
                            j += 1
                            last_content_y = max(w[3] for w in lines_by_y[sorted_ys[j-1]])
                            break

                j += 1

            if group_skus:
                # Build base key from first SKU
                first_sku = group_skus[0]
                parts = first_sku.split(' ')
                num = parts[-1]
                num_parts = num.split('-')
                prefix = ' '.join(parts[:-1])
                base_key = f"{prefix} xx-{'-'.join(num_parts[1:])}" if len(num_parts) >= 3 else first_sku

                groups.append({
                    'y_start': group_start_y,
                    'y_end': last_content_y,
                    'base_key': base_key,
                    'skus': group_skus,
                })
                i = j
                continue

        i += 1

    return groups


def render_and_crop_groups(pdf_path, page_num, groups, pdf_source, output_dir, sku_to_image):
    """Render a page and crop full-width product group sections."""
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
        return 0

    img_file = None
    for f in Path(tmp_dir).glob("r-*.png"):
        img_file = str(f)
        break

    if not img_file or not os.path.exists(img_file):
        return 0

    extracted = 0
    try:
        img = Image.open(img_file)
        page_w, page_h = img.width, img.height

        for g in groups:
            # Crop full-width section with small padding
            margin_top = 8  # pt
            margin_bottom = 4  # pt
            x0 = int(5 * SCALE)  # Small left margin
            x1 = page_w - int(5 * SCALE)  # Small right margin
            y0 = max(0, int((g['y_start'] - margin_top) * SCALE))
            y1 = min(page_h, int((g['y_end'] + margin_bottom) * SCALE))

            if y1 - y0 < 30:
                continue

            crop = img.crop((x0, y0, x1, y1))

            # Check if mostly white (blank)
            try:
                pixels = list(crop.convert('L').getdata())
                if pixels:
                    avg = sum(pixels) / len(pixels)
                    if avg > 252:
                        continue
            except:
                pass

            safe_key = g['base_key'].replace(' ', '_').replace('/', '-')
            filename = f"{pdf_source}_{safe_key}_p{page_num}.png"
            filepath = os.path.join(output_dir, filename)

            # Optimize: save as JPEG for smaller file sizes since these are full-width
            jpeg_filename = f"{pdf_source}_{safe_key}_p{page_num}.jpg"
            jpeg_path = os.path.join(output_dir, jpeg_filename)
            crop_rgb = crop.convert('RGB')
            crop_rgb.save(jpeg_path, 'JPEG', quality=85, optimize=True)

            # Map all SKUs in this group to this image
            for sku in g['skus']:
                sku_to_image[sku] = jpeg_filename

            extracted += 1

        img.close()
    except Exception as e:
        print(f"    Error: {e}", flush=True)

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

    # Phase 2: Extract groups and render
    extracted = 0
    for idx, pg_num in enumerate(pricing_pages):
        groups = get_page_groups(pdf_path, pg_num)
        if not groups:
            continue

        count = render_and_crop_groups(pdf_path, pg_num, groups, pdf_source, output_dir, sku_to_image)
        extracted += count

        if (idx + 1) % 25 == 0:
            print(f"  Processed {idx+1}/{len(pricing_pages)} pages — {extracted} groups", flush=True)

    mapped = len([s for s in sku_to_image if sku_to_image[s].startswith(pdf_source)])
    print(f"  Done: {extracted} group images, {mapped} SKUs mapped", flush=True)
    return extracted


def main():
    single = sys.argv[1] if len(sys.argv) > 1 else None

    print("=" * 60)
    print("PRONORM GROUP EXTRACTOR v4 (Full-width sections)")
    print("=" * 60, flush=True)

    output_dir = "/sessions/jolly-nice-clarke/pronorm-usa/public/data/diagrams"
    os.makedirs(output_dir, exist_ok=True)

    map_path = os.path.join(output_dir, "_sku_image_map.json")
    if single and os.path.exists(map_path):
        with open(map_path) as f:
            sku_to_image = json.load(f)
        # Remove old entries for this source
        sku_to_image = {k: v for k, v in sku_to_image.items() if not v.startswith(single)}
        # Remove old image files for this source
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

    # Save mapping
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
