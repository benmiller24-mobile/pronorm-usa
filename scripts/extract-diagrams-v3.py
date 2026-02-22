#!/usr/bin/env python3
"""
Extract product diagrams from Pronorm price book PDFs.
Ultra memory-efficient: process one page at a time, subprocess for everything.
"""

import re
import os
import json
import subprocess
import sys
from PIL import Image
from pathlib import Path

DPI = 150
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
    'for raised', 'for free', 'for standing',
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

    # Skip Classic-only pages in P/C PDF
    if pdf_source == 'pc':
        header = '\n'.join(text.split('\n')[:5])
        is_classic = any(l.strip().endswith(' C') and not l.strip().endswith(' P C')
                         for l in header.split('\n'))
        if is_classic:
            return False
    return True


def find_groups_from_text(text):
    """Find product groups and their SKUs from page text."""
    lines = text.split('\n')
    groups = []
    seen_keys = set()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        m = SKU_RE.search(stripped)
        if not m:
            continue

        prefix = m.group(1).strip()
        num = m.group(2)
        parts = num.split('-')
        base_key = f"{prefix} xx-{'-'.join(parts[1:])}" if len(parts) >= 3 else f"{prefix} {num}"

        if base_key in seen_keys:
            continue
        seen_keys.add(base_key)

        # Collect all SKUs with same base pattern
        skus = []
        for check_line in lines:
            check = check_line.strip()
            for sm in SKU_RE.finditer(check):
                full_sku = f"{sm.group(1).strip()} {sm.group(2)}"
                cn = sm.group(2).split('-')
                ck = f"{sm.group(1).strip()} xx-{'-'.join(cn[1:])}" if len(cn) >= 3 else ""
                if ck == base_key and full_sku not in skus:
                    skus.append(full_sku)

        desc = stripped.split(str(m.group(0)))[0].strip()
        groups.append({'base_key': base_key, 'skus': skus, 'desc': desc})

    return groups


def find_diagram_regions(pdf_path, page_num):
    """Use pdftotext with -bbox to find Y positions of product groups."""
    # Use pdftotext to get word positions via HTML output
    try:
        result = subprocess.run(
            ['pdftotext', '-f', str(page_num), '-l', str(page_num), '-bbox', pdf_path, '-'],
            capture_output=True, text=True, timeout=15
        )
        html = result.stdout
    except:
        return []

    # Parse word positions from bbox HTML output
    # Format: <word xMin="x" yMin="y" xMax="x" yMax="y">text</word>
    word_re = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)</word>')

    lines_by_y = {}
    for wm in word_re.finditer(html):
        y = float(wm.group(2))
        y_key = round(y / 2) * 2
        text = wm.group(5)
        if y_key not in lines_by_y:
            lines_by_y[y_key] = []
        lines_by_y[y_key].append((float(wm.group(1)), y, text))

    group_ys = []
    seen_keys = set()
    sorted_ys = sorted(lines_by_y.keys())
    for idx, y_key in enumerate(sorted_ys):
        words = sorted(lines_by_y[y_key], key=lambda w: w[0])
        line_text = ' '.join(w[2] for w in words)

        m = SKU_RE.search(line_text)
        if not m:
            continue

        first_y = min(w[1] for w in words)
        prefix = m.group(1).strip()
        num = m.group(2)
        parts = num.split('-')
        base_key = f"{prefix} xx-{'-'.join(parts[1:])}" if len(parts) >= 3 else f"{prefix} {num}"
        if base_key not in seen_keys:
            group_ys.append((first_y, base_key))
            seen_keys.add(base_key)

    return group_ys


def render_and_crop(pdf_path, page_num, group_ys, groups, pdf_source, output_dir, sku_to_image):
    """Render a single page and crop diagram regions."""
    tmp_dir = "/tmp/pdf-render"
    os.makedirs(tmp_dir, exist_ok=True)

    # Clean any previous render
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

    # Find the rendered image
    img_file = None
    for f in Path(tmp_dir).glob("r-*.png"):
        img_file = str(f)
        break

    if not img_file or not os.path.exists(img_file):
        return 0

    extracted = 0
    try:
        img = Image.open(img_file)

        for i, (y_pos, base_key) in enumerate(group_ys):
            y_start = y_pos
            y_end = group_ys[i + 1][0] - 3 if i + 1 < len(group_ys) else y_start + 100

            x0 = int(8 * SCALE)
            x1 = int(82 * SCALE)
            y0 = max(0, int((y_start - 12) * SCALE))
            y1 = min(img.height, int(y_end * SCALE))

            if y1 - y0 < 20 or x1 - x0 < 20:
                continue

            crop = img.crop((x0, y0, x1, y1))

            # Check if mostly white (blank)
            pixels = list(crop.getdata())
            if pixels:
                avg = sum(sum(p[:3]) / 3 for p in pixels) / len(pixels)
                if avg > 248:
                    continue

            safe_key = base_key.replace(' ', '_').replace('/', '-')
            filename = f"{pdf_source}_{safe_key}_p{page_num}.png"
            filepath = os.path.join(output_dir, filename)
            crop.save(filepath, optimize=True)

            # Map SKUs
            for g in groups:
                if g['base_key'] == base_key:
                    for sku in g['skus']:
                        sku_to_image[sku] = filename
                    break

            extracted += 1

        img.close()
    except Exception as e:
        pass

    # Cleanup
    try:
        os.remove(img_file)
    except:
        pass

    return extracted


def process_pdf(pdf_path, pdf_source, output_dir, sku_to_image):
    """Process a single PDF completely using subprocess tools only."""
    name = Path(pdf_path).name
    print(f"\nProcessing: {name}", flush=True)

    # Get page count
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

    print(f"  {num_pages} pages — scanning for pricing pages...", flush=True)

    # Phase 1: Find pricing pages (text only, very lightweight)
    pricing_pages = {}
    for pg in range(1, num_pages + 1):
        text = extract_text_page(pdf_path, pg)
        if is_pricing_page(text, pdf_source):
            groups = find_groups_from_text(text)
            if groups:
                pricing_pages[pg] = groups

        if pg % 100 == 0:
            print(f"  Scanned {pg}/{num_pages} — {len(pricing_pages)} pricing pages found", flush=True)

    print(f"  Found {len(pricing_pages)} pricing pages", flush=True)

    if not pricing_pages:
        return 0

    # Phase 2+3: For each pricing page, get Y positions and render/crop
    extracted = 0
    for idx, pg_num in enumerate(sorted(pricing_pages.keys())):
        group_ys = find_diagram_regions(pdf_path, pg_num)
        if not group_ys:
            continue

        count = render_and_crop(pdf_path, pg_num, group_ys, pricing_pages[pg_num],
                               pdf_source, output_dir, sku_to_image)
        extracted += count

        if (idx + 1) % 20 == 0:
            print(f"  Processed {idx+1}/{len(pricing_pages)} pricing pages — {extracted} diagrams", flush=True)

    mapped = len([s for s in sku_to_image if sku_to_image[s].startswith(pdf_source)])
    print(f"  Done: {extracted} diagrams, {mapped} SKUs mapped", flush=True)
    return extracted


def main():
    # Allow processing a single PDF by argument
    single = sys.argv[1] if len(sys.argv) > 1 else None

    print("=" * 60)
    print("PRONORM DIAGRAM EXTRACTOR v3")
    print("=" * 60, flush=True)

    output_dir = "/sessions/jolly-nice-clarke/pronorm-usa/public/data/diagrams"
    os.makedirs(output_dir, exist_ok=True)

    # Load existing mapping if processing single PDF
    map_path = os.path.join(output_dir, "_sku_image_map.json")
    if single and os.path.exists(map_path):
        with open(map_path) as f:
            sku_to_image = json.load(f)
    else:
        sku_to_image = {}
        # Clean existing images
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
    print(f"Total diagrams: {total}")
    print(f"SKUs mapped: {len(sku_to_image)}")

    # Show coverage
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
