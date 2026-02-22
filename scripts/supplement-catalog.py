#!/usr/bin/env python3
"""
Supplement the pricing catalog with SKUs that were missed by the original parser.
The original parser only matched 3-part number formats (xx-xx-xx).
This script finds all SKUs including 2-part (RW 30-76), 4-part (KH 60-195-00-063),
and no-space formats (PFGSM450-32-56), then adds the missing ones to the catalog.
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from collections import defaultdict

# Regexes matching all SKU formats
# Standard: 2-4 dash-separated number groups, with letter prefix
SKU_RE = re.compile(r'([A-Z]{1,6}(?:\s[A-Z]{1,6})?)\s+(\d{1,4}(?:-\d{2,4}){1,4})')
# No-space: PFGSM450-32-56
NOSPACE_RE = re.compile(r'([A-Z]{2,6}\d{2,4})-(\d{2,4}(?:-\d{2,4}){0,3})')
# Price pattern: sequence of numbers (with optional dash for "not available")
PRICE_RE = re.compile(r'[\d]+(?:\.\d+)?')

CARCASE_RE = re.compile(r'Carcase height\s+(\d+)\s+mm')

PRICE_COLS = ["N", "0", "1", "2", "3", "4", "5", "6", "7", "8", "10"]

PDFS = [
    ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF_GB_proline-classic 09-2025.pdf", "proline"),
    ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF_GB_Y-line-X-line 09-2025.pdf", "yx"),
    ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF-Living-09-2025_GB.pdf", "living"),
]

# Categories
CATEGORIES = [
    "Base units", "Wall units", "Tall units", "Corner units",
    "End panels", "Accessories", "Shelf units", "Open shelf units",
    "Bridging units"
]

def determine_product_line(text, pdf_label):
    """Determine product line from page header text."""
    t = text.upper()
    if "Y-LINE" in t or "Y LINE" in t:
        return "y-line"
    elif "X-LINE" in t or "X LINE" in t:
        return "x-line"
    elif "LIVING" in t or pdf_label == "living":
        return "living"
    elif " C " in text and " P " not in text:
        return None  # classic, skip
    else:
        return "proline"

def extract_prices_after_sku(line, sku_end_pos):
    """Extract prices from the remainder of a line after the SKU."""
    remaining = line[sku_end_pos:].strip()
    # Replace tabs with spaces
    remaining = remaining.replace('\t', ' ')
    tokens = remaining.split()

    prices = {}
    for i, token in enumerate(tokens):
        if i >= len(PRICE_COLS):
            break
        if token == "-" or token == "–":
            continue
        try:
            val = float(token.replace(',', ''))
            if 0 < val < 100000:  # Sanity check
                prices[PRICE_COLS[i]] = val
        except ValueError:
            break  # Stop at first non-numeric token

    return prices if prices else None

def parse_page_text(text, page_num, pdf_label):
    """Parse a single page's text to find all SKUs with prices."""
    if not text or len(text.strip()) < 50:
        return []

    lines = text.split('\n')
    header = '\n'.join(lines[:10])

    product_line = determine_product_line(header, pdf_label)
    if product_line is None:  # classic
        return []

    # For yx PDFs, determine y-line vs x-line from page header
    if pdf_label == "yx":
        if product_line not in ("y-line", "x-line"):
            product_line = "y-line"  # default for yx pdf

    carcase_match = CARCASE_RE.search(header)
    carcase_height = int(carcase_match.group(1)) if carcase_match else None

    category = "Accessories"
    for cat in CATEGORIES:
        if cat in header:
            category = cat
            break

    results = []
    desc_lines = []

    for line_idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            desc_lines = []
            continue

        # Skip header/metadata lines
        if any(kw in stripped for kw in ["Planning and order", "Price groups",
               "classified by material", "N  0  1  2", "N  K  KS",
               "Carcase height", "Description", "Width", "Door"]):
            desc_lines = []
            continue

        found_skus = []

        # Try standard SKU regex
        for m in SKU_RE.finditer(stripped):
            sku = f"{m.group(1).strip()} {m.group(2)}"
            prices = extract_prices_after_sku(stripped, m.end())
            found_skus.append((sku, m, prices))

        # Try no-space SKU regex
        for m in NOSPACE_RE.finditer(stripped):
            sku = f"{m.group(1)}-{m.group(2)}"
            prices = extract_prices_after_sku(stripped, m.end())
            found_skus.append((sku, m, prices))

        if found_skus:
            # Use the first SKU match (usually only one per line)
            sku, match, prices = found_skus[0]

            # If no prices on this line, check next line (pdftotext wraps long lines)
            if not prices and line_idx + 1 < len(lines):
                next_line = lines[line_idx + 1].strip()
                # Next line should be all numbers/dashes (prices)
                if next_line and not SKU_RE.search(next_line) and not NOSPACE_RE.search(next_line):
                    tokens = next_line.replace('\t', ' ').split()
                    test_prices = {}
                    for i, tok in enumerate(tokens):
                        if i >= len(PRICE_COLS):
                            break
                        if tok in ("-", "–"):
                            continue
                        try:
                            val = float(tok.replace(',', ''))
                            if 0 < val < 100000:
                                test_prices[PRICE_COLS[i]] = val
                        except ValueError:
                            break
                    if test_prices:
                        prices = test_prices

            # Extract width from beginning of line
            width = None
            pre_sku = stripped[:match.start()].strip()
            tokens = pre_sku.split()
            for tok in tokens:
                try:
                    val = int(tok.replace(',', '').replace('.', ''))
                    if 1 <= val <= 200:
                        width = val
                except ValueError:
                    pass

            # Door type
            door = None
            if "L/R" in stripped:
                door = "L/R"
            elif " L " in f" {stripped} ":
                door = "L"
            elif " R " in f" {stripped} ":
                door = "R"

            description = " ".join(desc_lines).strip() or "N/A"

            results.append({
                'sku': sku,
                'description': description,
                'width': width,
                'door': door,
                'category': category,
                'carcase_height': carcase_height,
                'product_line': product_line,
                'prices': prices,
                'page': page_num
            })
            desc_lines = []
        else:
            # Collect as description
            skip_kws = ["Surcharges", "register special", "Available", "Please advise",
                        "available in:", "Not available", "Glass types",
                        "Cabinet widths", "Model overview", "!"]
            if stripped and not any(kw in stripped for kw in skip_kws) and len(desc_lines) < 5:
                desc_lines.append(stripped)

    return results


def main():
    # Load existing catalog
    with open('public/data/pricing-search.json') as f:
        search_data = json.load(f)
    with open('public/data/pricing-catalog.json') as f:
        catalog_data = json.load(f)

    existing_skus = {}
    for item in search_data:
        key = f"{item['s']}|{item['pl']}"
        existing_skus[key] = item

    print(f"Existing catalog: {len(search_data)} items")

    new_items = []

    for pdf_path, pdf_label in PDFS:
        print(f"\nParsing: {Path(pdf_path).name}")

        # Get page count
        result = subprocess.run(['pdfinfo', pdf_path], capture_output=True, text=True)
        pages = int(re.search(r'Pages:\s+(\d+)', result.stdout).group(1))

        found = 0
        added = 0

        # Process one page at a time for reliable text extraction
        for page_num in range(1, pages + 1):
            result = subprocess.run(
                ['pdftotext', '-f', str(page_num), '-l', str(page_num), pdf_path, '-'],
                capture_output=True, text=True, timeout=15
            )

            items = parse_page_text(result.stdout, page_num, pdf_label)
            found += len(items)

            for item in items:
                key = f"{item['sku']}|{item['product_line']}"
                if key not in existing_skus:
                    new_items.append(item)
                    existing_skus[key] = True
                    added += 1

            if page_num % 100 == 0:
                print(f"  Page {page_num}/{pages} — {found} found, {added} new", flush=True)

        print(f"  Found {found} SKU entries, {added} new")

    print(f"\nTotal new items to add: {len(new_items)}")

    if not new_items:
        print("No new items to add!")
        return

    # Add to search data
    for item in new_items:
        s = item['sku']
        # Build compact format matching existing catalog
        search_entry = {
            's': s,
            'd': item['description'],
            'w': item['width'],
            'pl': item['product_line'],
            'cat': item['category'],
            'ch': str(item['carcase_height']) if item['carcase_height'] else '',
            'pt': 'price_group',
            'p': item['prices'] or {},
            'dr': item['door'] or '',
            'pg': item['page']
        }
        search_data.append(search_entry)

    # Add to catalog (hierarchical)
    for item in new_items:
        pl = item['product_line']
        cat = item['category']
        ch = str(item['carcase_height']) if item['carcase_height'] else '0'

        if pl not in catalog_data:
            catalog_data[pl] = {}
        if cat not in catalog_data[pl]:
            catalog_data[pl][cat] = {}
        if ch not in catalog_data[pl][cat]:
            catalog_data[pl][cat][ch] = []

        catalog_entry = {
            's': item['sku'],
            'd': item['description'],
            'w': item['width'],
            'dr': item['door'] or '',
            'pt': 'price_group',
            'p': item['prices'] or {},
            'pg': item['page']
        }
        catalog_data[pl][cat][ch].append(catalog_entry)

    # Save
    with open('public/data/pricing-search.json', 'w') as f:
        json.dump(search_data, f, separators=(',', ':'))

    with open('public/data/pricing-catalog.json', 'w') as f:
        json.dump(catalog_data, f, separators=(',', ':'))

    print(f"\nUpdated catalog: {len(search_data)} total items")
    print("Done!")


if __name__ == '__main__':
    main()
