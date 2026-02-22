#!/usr/bin/env python3
"""
Parse Pronorm price book PDFs to extract SKU data.
Memory-optimized: processes PDFs in small page batches.
"""

import pdfplumber
import json
import re
import gc
import sys
from pathlib import Path
from datetime import datetime

# Price columns: 10 values map to these groups
PRICE_GROUP_COLS = ["0","1","2","3","4","5","6","7","8","10"]
MATERIAL_COLS = ["K","KS","LU","L","H","H1","H2","F","FE","G"]

SKU_RE = re.compile(r'\b([A-Z]{1,4}(?:\s[A-Z]{1,4})?)\s+(\d{2,3}(?:-\d{2,3}){2,3})(\*)?')
CARCASE_RE = re.compile(r'Carcase height\s+(\d{3,4})\s+mm')

CATS = ["Base units","Wall units","Tall units","Wall shelf units","Countertop units",
        "Tall shelf units","Special constructions","Sliding door","Utility room",
        "Wardrobe","Dressing room","Single parts","Front material","Panel-",
        "Processing possibilities","Worktops","Bridging panels","Merchandise",
        "Spare parts","Fronts","Wall recess"]

def get_product_line(header, src):
    if src == "living": return "living"
    if src == "yx":
        for l in header.split('\n')[:5]:
            ls = l.strip()
            if ls.endswith(' Y') or ls.endswith(' Y '): return "y-line"
            if ls.endswith(' X') or ls.endswith(' X '): return "x-line"
            for c in CATS:
                if c in ls:
                    after = ls[ls.index(c)+len(c):].strip()
                    if after in ('Y','Y X'): return "y-line"
                    if after == 'X': return "x-line"
        return "y-line"
    if src == "pc":
        for l in header.split('\n')[:5]:
            ls = l.strip()
            if ls.endswith(' C'): return "classic"
            if ls.endswith(' P') or ls.endswith(' P+') or ls.endswith(' P -'): return "proline"
            if ' P C' in ls or ' P/C' in ls: return "proline"
            for c in CATS:
                if c in ls:
                    after = ls[ls.index(c)+len(c):].strip()
                    if after == 'C': return "classic"
                    if after in ('P','P+','P -','P C','P/C'): return "proline"
        return "proline"
    return None

def get_category(text):
    for c in CATS:
        if c in text: return c
    return "Other"

def parse_page(pg_num, text, src):
    if not text or len(text.strip()) < 50: return []
    lines = text.split('\n')
    header = '\n'.join(lines[:8])
    pl = get_product_line(header, src)
    if not pl or pl == "classic": return []

    hm = CARCASE_RE.search(header)
    ch = int(hm.group(1)) if hm else None
    cat = get_category(header)
    is_mat = 'classified by material' in text[:500]
    has_pg = 'Price groups' in text[:500]
    ptype = "material" if is_mat and not has_pg else "price_group"

    results = []
    desc_buf = []
    cur_desc = ""

    for line in lines:
        line = line.strip()
        if not line:
            if desc_buf: cur_desc = ', '.join(desc_buf)
            desc_buf = []
            continue

        if any(k in line for k in ['Planning and order','Price groups','classified by material',
            'Surcharges for carcase','register special','P/C -','Y/X -','= Prices are net']):
            if 'classified by material' in line: ptype = "material"
            elif 'Price groups' in line: ptype = "price_group"
            desc_buf = []
            continue

        if re.match(r'^[!\s]*cm\s+no\.', line) or re.match(r'^N\s+[0-9K]', line):
            continue

        m = SKU_RE.search(line)
        if m:
            sku = f"{m.group(1).strip()} {m.group(2)}"
            after = line[m.end():].strip().lstrip('*').strip()
            tokens = []
            for t in after.split():
                if t == '-' or re.match(r'^\d+\.?\d*$', t): tokens.append(t)
                else: break

            cols = MATERIAL_COLS if ptype == "material" else PRICE_GROUP_COLS
            prices = {}
            for i,t in enumerate(tokens):
                if i >= len(cols): break
                if t != '-':
                    try: prices[cols[i]] = float(t)
                    except: break

            if not prices:
                desc_buf.append(line)
                continue

            before = line[:m.start()].strip().split()
            w, door = None, None
            for j in range(len(before)-1, -1, -1):
                p = before[j]
                if p in ('L/R','L','R'): door = p
                elif re.match(r'^\d{2,3}$', p):
                    v = int(p)
                    if 15 <= v <= 200: w = v; break
                elif re.match(r'^\d+-\d+$', p):
                    w = int(p.split('-')[0]); break

            desc = cur_desc if cur_desc else ', '.join(desc_buf)
            desc = re.sub(r'\b(764|768|636|124|380|252|163|508|704|832|896|448|384|320)\b','',desc).strip()
            desc = re.sub(r'\s*,\s*,\s*',', ',desc).strip().strip(',').strip()

            results.append({
                "sku": sku, "description": desc, "width_cm": w, "door": door,
                "unit_category": cat, "carcase_height_mm": ch, "product_line": pl,
                "price_type": ptype, "prices": prices, "page_number": pg_num
            })
        else:
            if any(k in line for k in ['Model overview','Cabinet widths','Contents',
                'Explanation','thgieH','stinu','sllaw','In certain price groups',
                'Description Width','! cm no']): continue
            if re.match(r'^\d{3,4}$', line): continue
            if 3 < len(line) < 200: desc_buf.append(line)

    return results

def parse_pdf_batched(pdf_path, src, out_file, batch=25):
    name = Path(pdf_path).name
    print(f"\nProcessing: {name}", flush=True)
    total = 0
    counts = {}

    with pdfplumber.open(pdf_path) as pdf:
        num = len(pdf.pages)
        print(f"  {num} pages", flush=True)

    for start in range(0, num, batch):
        end = min(start + batch, num)
        with pdfplumber.open(pdf_path) as pdf:
            for idx in range(start, end):
                try:
                    text = pdf.pages[idx].extract_text_simple()
                    if text:
                        entries = parse_page(idx+1, text, src)
                        if entries:
                            with open(out_file, 'a') as f:
                                for e in entries:
                                    f.write(json.dumps(e) + '\n')
                            total += len(entries)
                            for e in entries:
                                counts[e['product_line']] = counts.get(e['product_line'], 0) + 1
                except Exception as ex:
                    pass
        gc.collect()
        if (end % 100 == 0) or end == num:
            print(f"  Page {end}/{num} — {total} SKUs", flush=True)

    return total, counts

def main():
    print("="*60)
    print("PRONORM PRICE BOOK PARSER v2")
    print("="*60, flush=True)

    out_dir = Path("/sessions/jolly-nice-clarke/pronorm-usa/scripts")
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = str(out_dir / "parsed-skus-temp.jsonl")
    open(tmp, 'w').close()

    pdfs = [
        ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF_GB_proline-classic 09-2025.pdf", "pc"),
        ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF_GB_Y-line-X-line 09-2025.pdf", "yx"),
        ("/sessions/jolly-nice-clarke/mnt/uploads/Gesamt-PDF-Living-09-2025_GB.pdf", "living"),
    ]

    total = 0
    all_counts = {}
    for path, src in pdfs:
        if Path(path).exists():
            c, counts = parse_pdf_batched(path, src, tmp)
            total += c
            for k,v in counts.items(): all_counts[k] = all_counts.get(k,0) + v
        else:
            print(f"  NOT FOUND: {path}")

    # Build final output
    print(f"\nBuilding final JSON ({total} SKUs)...", flush=True)
    skus = []
    pt_counts = {}
    cat_counts = {}
    verify = None

    with open(tmp) as f:
        for line in f:
            if line.strip():
                e = json.loads(line)
                skus.append(e)
                pt_counts[e['price_type']] = pt_counts.get(e['price_type'],0)+1
                cat_counts[e['unit_category']] = cat_counts.get(e['unit_category'],0)+1
                if e['sku'] == 'UR 45-76-601' and e.get('width_cm') == 45:
                    verify = e

    out = str(out_dir / "parsed-skus.json")
    with open(out, 'w') as f:
        json.dump({"metadata":{"date":datetime.now().isoformat(),"total":len(skus),
            "by_line":all_counts,"by_type":pt_counts,"by_cat":cat_counts},"skus":skus}, f)

    print(f"\nSaved {len(skus)} SKUs to {out}")
    print(f"\nBy product line: {all_counts}")
    print(f"By price type: {pt_counts}")
    print(f"By category: {cat_counts}")

    if verify:
        pg6 = verify['prices'].get('6')
        print(f"\nVERIFY UR 45-76-601: group 6 = {pg6} {'✓' if pg6==1002.0 else '✗'}")
        print(f"  All prices: {verify['prices']}")
        print(f"  Desc: {verify['description']}")
    else:
        print("\nUR 45-76-601 NOT FOUND")

    Path(tmp).unlink(missing_ok=True)
    print("Done!", flush=True)

if __name__ == "__main__":
    main()
