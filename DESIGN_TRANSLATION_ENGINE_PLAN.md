# Design Translation Engine — Implementation Plan (v2)

## What It Does

A designer uploads kitchen drawings (floor plan + wall elevations) along with a brief intake form. The tool uses Claude Vision via a Netlify Function to interpret the drawings, identifies cabinet positions/types/sizes, maps each element to the closest **ProLine** SKU from the catalog, generates clean labeled 2D line drawings, and produces an itemized price sheet. The designer gets a complete Pronorm proposal — drawings + pricing — in one workflow.

---

## Key Decisions

| Question | Decision | Implication |
|----------|----------|-------------|
| Product line | **ProLine first** | Only match against ProLine catalog (~6,800 items). Other lines later. |
| AI hosting | **Netlify Functions** | 60s timeout, 6MB response, already 3 production functions with JWT auth and env secrets. No 150KB limit like Supabase Edge Functions. |
| Accuracy target | **99%** | AI alone won't hit 99%. The system must: (a) use multi-pass AI analysis, (b) validate against real catalog constraints, (c) provide an excellent review UI so designer catches any remaining errors, (d) never auto-submit — always human-verified. |
| Anthropic API key | **Need to set up** | Create key at console.anthropic.com, add as `ANTHROPIC_API_KEY` env var in Netlify dashboard. |
| Input format | **Floor plan always, elevations usually** | System should handle both: floor plan for room layout, elevations for per-wall cabinet detail. When only floor plan is provided, AI extracts what it can and flags walls needing elevation uploads. |

---

## Accuracy Strategy: How We Hit 99%

AI vision alone will realistically hit 70-85% accuracy on cabinet identification. To get to 99%, we layer multiple validation steps:

### Layer 1: Multi-Pass AI Analysis
- **Pass 1 — Layout extraction**: Identify room shape, walls, windows, doors from floor plan
- **Pass 2 — Cabinet identification**: For each wall elevation, identify every cabinet position, type, and approximate dimensions
- **Pass 3 — Cross-validation**: Send the results back to Claude with the catalog constraints and ask it to verify: "Given that ProLine base units only come in widths [300, 400, 450, 500, 550, 600, 750, 800, 900, 1000, 1200], does this layout make sense? Do the cabinet widths sum to the wall width minus windows/doors?"

### Layer 2: Constraint Validation Engine (deterministic)
After AI analysis, run hard rules:
- Cabinet widths must exist in the ProLine catalog (snap to nearest valid width)
- Cabinets along a wall must sum to wall width (±tolerance for fillers)
- Corner units must be at wall junctions
- Sink base must be under window (if window present)
- Tall units shouldn't be under wall units
- Heights must match ProLine options (768mm or 852mm for base units)
- Flag any violations for designer review

### Layer 3: Smart Review UI
- Every item shown with confidence indicator (green/yellow/red)
- Red items (low confidence or constraint violations) are highlighted and require explicit confirmation
- Side-by-side view: original drawing on left, mapped items on right
- Click any item to see alternatives and the AI's reasoning
- "Quick fix" suggestions: "Did you mean 600mm instead of 580mm? The closest ProLine width is 600."
- Wall-by-wall review with running dimension check
- **Cannot generate proposal until all red items are resolved**

### Layer 4: Dimension Reconciliation
- Sum of cabinet widths per wall must equal wall dimension (from intake form)
- If they don't match, show the gap: "Wall A is 3400mm but cabinets total 3200mm. Add a 200mm filler?"
- Interactive tool to adjust widths or add fillers until dimensions reconcile

This means the AI does the heavy lifting (~80-85%), constraint validation catches obvious errors (~10-12%), and the review UI catches the last few percent. The designer confirms every item before proposal generation → 99%+ accuracy on final output.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│                                                          │
│  IntakeForm → UploadDrawings → AIReview → ProposalView  │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │  Constraint │                             │
│              │  Validator  │                             │
│              └─────────────┘                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               Netlify Function                           │
│                                                          │
│  /analyze-drawing     - Multi-pass Claude Vision         │
│                         (60s timeout, 6MB response)      │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
              Claude Vision API
              (Anthropic)
```

### Why Netlify Functions (not Supabase Edge Functions)?

- **60-second timeout** vs Supabase's 2 seconds (free) / 150 seconds (pro)
- **6MB response body** vs Supabase's 150KB
- **Already running 3 production functions** with JWT auth, env secrets, outbound API calls
- **Same deployment pipeline** — push to GitHub, Netlify builds and deploys
- **Node.js 22** runtime with native fetch — perfect for calling Anthropic API

---

## Phase 1: Foundation (MVP)

Goal: Working end-to-end flow with AI analysis, SKU mapping, and a thorough review UI. ProLine only.

### 1.1 Database Schema

```sql
-- Design translation projects
CREATE TABLE design_translations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
    -- draft | uploading | analyzing | review | validated | proposal_generated
  intake_data jsonb NOT NULL DEFAULT '{}',
    -- room_width, room_depth, ceiling_height, wall_definitions[], product_line, style_notes
  ai_analysis jsonb,
    -- Raw Claude Vision responses (all passes)
  mapped_items jsonb,
    -- Array of per-wall items: { wall, position, sku, description, confidence, alternatives, userOverride }
  validation_results jsonb,
    -- Constraint check results: { wall, issues[], resolved }
  proposal_data jsonb,
    -- Final proposal: items, totals, discount, freight
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Uploaded source drawings + generated outputs
CREATE TABLE design_translation_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  translation_id uuid REFERENCES design_translations(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'source',
    -- source_floorplan | source_elevation | generated_drawing | proposal_pdf
  wall_label text,
    -- For elevations: 'A', 'B', 'C', 'D' etc.
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS policies
ALTER TABLE design_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_translation_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own translations"
  ON design_translations FOR SELECT
  USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own translations"
  ON design_translations FOR INSERT
  WITH CHECK (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own translations"
  ON design_translations FOR UPDATE
  USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));

-- Same pattern for design_translation_files via translation_id join
```

### 1.2 Netlify Function: `analyze-drawing`

Location: `netlify/functions/analyze-drawing.mjs`

```
Authentication: JWT Bearer token (same pattern as send-notification.mjs)
Environment: ANTHROPIC_API_KEY, PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Input (POST body):
{
  translationId: string,
  imageUrls: string[],          // Signed URLs to uploaded drawings
  intake: {
    roomWidth: number,          // mm
    roomDepth: number,          // mm
    ceilingHeight: number,      // mm
    walls: [
      { label: "A", length: 3400, hasWindow: true, windowWidth: 1200, windowHeight: 900 },
      { label: "B", length: 2800, hasDoor: true, doorWidth: 900 }
    ],
    productLine: "proline",
    notes: string
  },
  catalogSummary: object        // Condensed ProLine reference
}

Process:
  1. Verify JWT token
  2. Fetch images from signed URLs as base64
  3. PASS 1 — Layout extraction (if floor plan provided):
     "Analyze this floor plan. Identify room dimensions, wall positions,
      windows, doors, and any labeled dimensions."
  4. PASS 2 — Cabinet identification (per elevation):
     "Analyze this kitchen elevation drawing. For each cabinet position, identify:
      - Type (base unit, wall unit, tall unit, corner base, corner wall, sink base, etc.)
      - Width in mm (must be one of: [300, 400, 450, 500, 550, 600, 750, 800, 900, 1000, 1200])
      - Height in mm (base units: 768 or 852, wall units: 360/576/720/900, tall units: 1950/2100/2250)
      - Door orientation (L, R, LR, none)
      - Features (drawers, pull-out, glass door, open shelf)
      - Position on wall (mm from left edge)
      Here is the ProLine catalog reference: {catalogSummary}"
  5. PASS 3 — Cross-validation:
     "Review these extracted cabinets against the room dimensions.
      Wall A is 3400mm. Cabinets on Wall A total {sum}mm.
      Are there fillers or gaps? Does this layout make sense?"
  6. Return structured JSON analysis
  7. Update design_translations.ai_analysis via Supabase

Output:
{
  walls: [
    {
      label: "A",
      length_mm: 3400,
      positions: [
        {
          id: "A_1",
          type: "tall_unit",
          sku_suggestion: "HS 600-2250-60",
          width_mm: 600,
          height_mm: 2250,
          x_mm: 0,
          door_orientation: "R",
          features: ["pull-out pantry"],
          confidence: 0.92,
          reasoning: "Tall unit with pull-out shelves at left edge of wall, 600mm wide"
        },
        ...
      ],
      dimension_check: {
        total_cabinets_mm: 3400,
        wall_length_mm: 3400,
        gap_mm: 0,
        valid: true
      }
    }
  ],
  notes: ["Wall B has a door opening — no cabinets on this wall"],
  warnings: ["Could not determine height for wall C unit 3 — defaulted to 768mm"]
}
```

### 1.3 Catalog Summary Generator

Script to create a condensed ProLine reference for the AI prompt. Run once, output to `public/data/proline-catalog-summary.json`:

```python
# scripts/generate_catalog_summary.py
# Reads pricing-catalog.json, extracts:
# - Every unique width per category
# - Every unique height per category
# - SKU naming patterns
# - Door orientation options
# - Common features/types
# Output: ~5-10KB JSON that gives Claude enough context to match correctly
```

### 1.4 SKU Matching Engine

Location: `src/lib/sku-matcher.ts`

After AI returns position data, the client-side matcher:
1. Takes each AI-suggested position with type + dimensions
2. Filters ProLine catalog by category
3. Finds exact or nearest width/height match
4. Scores candidates by: width match (40%), height match (20%), door orientation (20%), features (20%)
5. Returns best match + top 5 alternatives
6. Flags items where no good match exists (confidence < 0.7)

### 1.5 Constraint Validator

Location: `src/lib/constraint-validator.ts`

Deterministic validation rules:
- **Wall fit**: Sum of item widths per wall ≤ wall length
- **Gap detection**: If cabinets don't fill wall, suggest filler sizes
- **Height consistency**: All base units on a wall should be same height
- **Corner rules**: Corner units only at wall junctions
- **Stacking rules**: Wall units above base units, not overlapping tall units
- **Appliance clearances**: Space for fridge, oven, dishwasher
- **Window clearance**: No wall units overlapping windows

Returns list of issues per wall, each with severity (error/warning) and suggested fix.

### 1.6 Frontend Components

**New route:** `/dealer-portal/design-engine`

```
src/components/portal/design-engine/
├── DesignEngine.tsx              # Main container (wizard steps)
├── IntakeForm.tsx                # Step 1: Room dimensions, wall definitions, product line
├── DrawingUpload.tsx             # Step 2: Upload floor plan + elevations per wall
├── AnalysisProgress.tsx          # Step 3: Loading state during AI analysis
├── AnalysisReview.tsx            # Step 4: Review & edit AI results
│   ├── WallReview.tsx            # Per-wall review with drawing overlay
│   ├── PositionCard.tsx          # Individual cabinet card (confidence indicator)
│   ├── SKUSelector.tsx           # Dropdown with alternatives + search
│   ├── DimensionBar.tsx          # Visual bar showing wall fill (cabinets vs. gaps)
│   └── ValidationPanel.tsx       # Constraint violations + suggested fixes
├── ProposalView.tsx              # Step 5: Final proposal
│   ├── ItemizedPriceTable.tsx    # Price sheet (reuse PricingOrder patterns)
│   └── ProposalActions.tsx       # Download PDF, send to pricing tool, edit
└── DesignEngineHistory.tsx       # List of past translations
```

### 1.7 IntakeForm Fields

```
Room Information:
  - Project name (text)
  - Room type (kitchen / bathroom / laundry / closet / other)
  - Room width (mm)
  - Room depth (mm)
  - Ceiling height (mm)

Wall Definitions (dynamic list):
  For each wall:
  - Label (A, B, C, D...)
  - Length (mm)
  - Has window? → window width, height, sill height
  - Has door? → door width, position
  - Notes (e.g., "plumbing on this wall")

Preferences:
  - Product line: ProLine (locked for Phase 1, show others as "coming soon")
  - Base unit height: 768mm / 852mm
  - Style notes (free text)
```

### 1.8 DrawingUpload Component

- Required: Floor plan image
- Per wall: elevation drawing (optional but recommended)
- Label each upload with wall letter
- Show upload status per wall
- Warning if any wall is missing an elevation: "Wall C has no elevation — AI accuracy will be lower for this wall"
- Accepted formats: PDF, JPG, PNG, DWG (image extraction for DWG)
- Max 10MB per file

### 1.9 AnalysisReview Component (the critical piece)

This is where 99% accuracy happens. Layout:

```
┌─────────────────────────────────────────────────────┐
│  Wall A (3400mm)                    [✓ Validated]   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Original Elevation Drawing                   │   │
│  │  (with AI overlay: colored boxes per cabinet) │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Dimension Bar:  [600] [600] [400] [1200] [600]│  │
│  │                  Total: 3400mm ✓              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │HS 600  │ │U 600   │ │U 400   │ │QUSP 1200│      │
│  │Tall    │ │Base    │ │Base    │ │Sink base│       │
│  │●●●○○   │ │●●●●○   │ │●●●●●   │ │●●●○○   │      │
│  │[Edit]  │ │[Edit]  │ │[Edit]  │ │[Edit]  │       │
│  └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                      │
│  ⚠ Warning: Gap of 200mm between items 3 and 4.    │
│    [Add 200mm filler] [Adjust widths] [Ignore]      │
└─────────────────────────────────────────────────────┘
```

Confidence indicators:
- ●●●●● Green: High confidence, exact catalog match
- ●●●○○ Yellow: Decent confidence, verify dimensions
- ●○○○○ Red: Low confidence, needs manual selection

---

## Phase 2: 2D Drawing Generation

Goal: Generate clean SVG elevation drawings with Pronorm SKU labels.

### 2.1 SVG Elevation Renderer

Location: `src/components/portal/design-engine/ElevationRenderer.tsx`

Renders each wall as an SVG:
- Scale: 1px = 1mm (zoomed to fit viewport)
- Base cabinets drawn from floor line up to counter height
- Wall cabinets drawn from wall-cabinet-bottom to ceiling
- Tall units drawn full height
- Labels: SKU code centered on each unit
- Dimension lines: width under each unit, total wall width at top
- Window/door openings shown as dashed outlines
- Color coding: base = #e8e0d8, wall = #d4cdc5, tall = #b5aca3

Interactive features:
- Click unit → highlight + show detail panel
- Hover → tooltip with full description and price
- Zoom/pan controls

### 2.2 Floor Plan View

Top-down SVG showing room layout:
- Walls as thick lines
- Cabinet depth shown along walls
- Counter line
- Appliance positions
- Door swings, window indicators
- Room dimensions

---

## Phase 3: Polish & Integration

### 3.1 Proposal PDF
- Cover page with Pronorm branding
- Room summary
- SVG elevation drawings (rendered to canvas → PDF)
- Itemized price table
- Totals with optional discount/freight

### 3.2 "Send to Pricing Tool" Integration
- One-click pushes all mapped items into PricingTool order state
- Each item becomes an OrderLineItem with SKU, price group, unit price pre-filled
- Designer can then add special constructions, adjust quantities

### 3.3 Save/Load + History
- Auto-save to Supabase on every change
- History list showing past translations with status badges
- Resume any in-progress translation

---

## Implementation Order

### Sprint 1: Skeleton + AI Pipeline
1. Database migration (run via existing run-migration.mjs pattern)
2. Nav gating + route + DesignEngine shell with wizard steps
3. IntakeForm component
4. DrawingUpload component (reuse FileUploader patterns)
5. `analyze-drawing` Netlify Function (multi-pass Claude Vision)
6. `generate_catalog_summary.py` script + `proline-catalog-summary.json`
7. AnalysisProgress component (loading state with status updates)

### Sprint 2: Review UI + Matching
8. `sku-matcher.ts` — catalog matching engine
9. `constraint-validator.ts` — deterministic validation
10. AnalysisReview component with WallReview, PositionCard, SKUSelector
11. DimensionBar component
12. ValidationPanel with fix suggestions
13. Edit capabilities: swap SKU, adjust width, add/remove items, add filler

### Sprint 3: Proposal + Drawings
14. SVG ElevationRenderer
15. Floor plan view
16. ProposalView with ItemizedPriceTable
17. PDF proposal generation
18. "Send to Pricing Tool" integration

### Sprint 4: Persistence + Polish
19. Save/load translations to Supabase
20. DesignEngineHistory list
21. Auto-save on changes
22. Error handling, loading states, edge cases
23. Mobile responsive adjustments

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `netlify/functions/analyze-drawing.mjs` | Multi-pass Claude Vision analysis |
| `src/components/portal/design-engine/DesignEngine.tsx` | Main wizard container |
| `src/components/portal/design-engine/IntakeForm.tsx` | Room + wall definitions |
| `src/components/portal/design-engine/DrawingUpload.tsx` | File upload per wall |
| `src/components/portal/design-engine/AnalysisProgress.tsx` | AI analysis loading |
| `src/components/portal/design-engine/AnalysisReview.tsx` | Review container |
| `src/components/portal/design-engine/WallReview.tsx` | Per-wall review |
| `src/components/portal/design-engine/PositionCard.tsx` | Cabinet position card |
| `src/components/portal/design-engine/SKUSelector.tsx` | SKU alternatives dropdown |
| `src/components/portal/design-engine/DimensionBar.tsx` | Visual wall fill bar |
| `src/components/portal/design-engine/ValidationPanel.tsx` | Constraint check results |
| `src/components/portal/design-engine/ProposalView.tsx` | Final proposal |
| `src/components/portal/design-engine/ItemizedPriceTable.tsx` | Price sheet |
| `src/components/portal/design-engine/ElevationRenderer.tsx` | SVG drawing generator |
| `src/components/portal/design-engine/FloorPlanRenderer.tsx` | Top-down room view |
| `src/components/portal/design-engine/DesignEngineHistory.tsx` | Past translations |
| `src/lib/sku-matcher.ts` | Catalog matching algorithm |
| `src/lib/constraint-validator.ts` | Deterministic validation rules |
| `public/data/proline-catalog-summary.json` | Condensed catalog for AI |
| `scripts/generate_catalog_summary.py` | Generates the summary |

### Modified Files
| File | Change |
|------|--------|
| `src/components/portal/PortalApp.tsx` | Add /design-engine route, gated to ben.miller24@gmail.com |
| `src/components/portal/PortalLayout.tsx` | Add "Design Engine" nav item, gated to ben.miller24@gmail.com |
| `src/lib/types.ts` | Add DesignTranslation, DesignTranslationFile, CabinetPosition, MappedItem types |

---

## Setup Requirements

Before we start coding:

1. **Anthropic API Key**
   - Go to https://console.anthropic.com
   - Create an API key
   - In Netlify dashboard → Site settings → Environment variables
   - Add `ANTHROPIC_API_KEY` = your key

2. **No other infrastructure needed** — everything else (Supabase, Netlify, GitHub) is already configured.

---

## What We Build First

I recommend we start with Sprint 1 items 2-4 (the frontend skeleton) since those don't need the API key, plus item 6 (catalog summary generator) which we can run locally. That gives you something visible immediately while we wait for the API key setup.

Once you add the key, we wire up the Netlify Function and the whole pipeline connects.
