#!/usr/bin/env python3
"""Extract special construction images from ProLine PDF pages 147-149.
Creates cropped images for each special construction group."""

import subprocess
import json
import os
import sys
from PIL import Image
import numpy as np

DPI = 150
SCALE = DPI / 72.0

PDF_PATH = sys.argv[1] if len(sys.argv) > 1 else "../mnt/uploads/Gesamt-PDF_GB_proline-classic 09-2025.pdf"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "diagrams")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def find_rule_lines(img_array):
    """Find horizontal rule lines by scanning for rows where >70% pixels are dark."""
    h, w = img_array.shape
    margin = int(w * 0.05)
    middle = img_array[:, margin:w - margin]
    rule_rows = []
    for i in range(h):
        dark_frac = (middle[i] < 128).mean()
        if dark_frac > 0.70:
            rule_rows.append(i)
    lines = []
    if rule_rows:
        start = rule_rows[0]
        prev = rule_rows[0]
        for r in rule_rows[1:]:
            if r - prev > 3:
                lines.append((start + prev) // 2)
                start = r
            prev = r
        lines.append((start + prev) // 2)
    return lines

def extract_page_groups(pdf_path, page_num):
    """Render a page and crop between rule lines."""
    # Render page
    result = subprocess.run(
        ["pdftoppm", "-f", str(page_num), "-l", str(page_num),
         "-r", str(DPI), "-jpeg", pdf_path, "/tmp/sc_extract"],
        capture_output=True
    )

    # Find the output file
    img_path = f"/tmp/sc_extract-{page_num:03d}.jpg"
    if not os.path.exists(img_path):
        img_path = f"/tmp/sc_extract-{page_num}.jpg"
    if not os.path.exists(img_path):
        # Try without padding
        import glob
        files = glob.glob("/tmp/sc_extract*.jpg")
        if files:
            img_path = files[0]
        else:
            print(f"  No image found for page {page_num}")
            return []

    img = Image.open(img_path)
    gray = np.array(img.convert('L'))
    rule_lines = find_rule_lines(gray)

    print(f"  Page {page_num}: {len(rule_lines)} rule lines found at rows: {rule_lines[:20]}")

    groups = []
    # Create bands between consecutive rule lines
    for i in range(len(rule_lines) - 1):
        top = rule_lines[i]
        bottom = rule_lines[i + 1]
        height = bottom - top
        if height < 30:  # Skip tiny bands (just lines close together)
            continue
        groups.append((top, bottom))

    return groups, img

# Process pages 147-149
all_groups = []
for page_num in [147, 148, 149]:
    print(f"\nProcessing page {page_num}...")
    result = extract_page_groups(PDF_PATH, page_num)
    if result:
        groups, img = result
        print(f"  Found {len(groups)} bands")
        for i, (top, bottom) in enumerate(groups):
            height = bottom - top
            # Skip very small bands (headers, footers)
            if height < 40:
                continue
            # Crop and save
            cropped = img.crop((0, top, img.width, bottom))
            filename = f"sc_p{page_num}_g{i}.jpg"
            filepath = os.path.join(OUTPUT_DIR, filename)
            cropped.save(filepath, "JPEG", quality=75)
            print(f"  Saved {filename} ({cropped.width}x{cropped.height})")
            all_groups.append({
                "page": page_num,
                "group": i,
                "top": top,
                "bottom": bottom,
                "height": height,
                "filename": filename
            })

print(f"\nTotal groups extracted: {len(all_groups)}")
# Save index
with open(os.path.join(OUTPUT_DIR, "_sc_groups.json"), "w") as f:
    json.dump(all_groups, f, indent=2)
