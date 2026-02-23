import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Async',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return jsonResponse({ error: 'Missing authorization' }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: 'Invalid token' }, 401);

    if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured.' }, 500);

    const body = await req.json();
    const { imageUrls, intake, catalogSummary } = body;

    if (!imageUrls || !imageUrls.length) {
      return jsonResponse({ error: 'No images provided' }, 400);
    }

    // Check if the client supports async polling (new client sends X-Async header)
    const isAsyncClient = req.headers.get('x-async') === 'true';
    if (!isAsyncClient) {
      // Old cached client — tell user to refresh
      return jsonResponse({
        error: 'Your browser is running an outdated version. Please hard-refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) and try again.',
      }, 426); // 426 Upgrade Required
    }

    // 2. Generate job ID and store request payload in Supabase storage
    const jobId = randomUUID();
    const jobPayload = JSON.stringify({ imageUrls, intake, catalogSummary });

    const { error: uploadErr } = await supabase.storage
      .from('project-files')
      .upload(`analysis-jobs/${jobId}/request.json`, jobPayload, {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadErr) {
      console.error('Failed to store job:', uploadErr);
      return jsonResponse({ error: 'Failed to queue analysis job' }, 500);
    }

    // 3. Use waitUntil to process in background after returning response
    // This keeps the function alive for up to 15 min even after we return
    context.waitUntil(processAnalysisJob(jobId, supabase));

    // 4. Return the job ID immediately
    return jsonResponse({ jobId, status: 'processing' });

  } catch (err) {
    console.error('analyze-drawing error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
};

// --- Background processing (runs via waitUntil) ---

async function storeResult(supabase, jobId, result) {
  const { error } = await supabase.storage
    .from('project-files')
    .upload(`analysis-jobs/${jobId}/result.json`, JSON.stringify(result), {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) console.error('Failed to store result:', error);
}

async function processAnalysisJob(jobId, supabase) {
  try {
    // 1. Read the job payload
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('project-files')
      .download(`analysis-jobs/${jobId}/request.json`);

    if (dlErr || !fileData) {
      await storeResult(supabase, jobId, { error: 'Job payload not found' });
      return;
    }

    const jobPayload = JSON.parse(await fileData.text());
    const { imageUrls, intake } = jobPayload;

    // 2. Fetch images as base64
    const VALID_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    function detectMime(url, headerType) {
      if (headerType && VALID_MIME.includes(headerType)) return headerType;
      const u = (url || '').toLowerCase().split('?')[0];
      if (u.endsWith('.png')) return 'image/png';
      if (u.endsWith('.gif')) return 'image/gif';
      if (u.endsWith('.webp')) return 'image/webp';
      return 'image/jpeg';
    }

    const imageContents = [];
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB max per image — Claude Vision limit is 20MB but smaller is faster
    for (const imgInfo of imageUrls) {
      try {
        const resp = await fetch(imgInfo.url);
        const buffer = await resp.arrayBuffer();
        const headerType = resp.headers.get('content-type')?.split(';')[0]?.trim();
        if (headerType === 'application/pdf') continue;
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
          console.warn(`Image too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB), skipping: ${imgInfo.wallLabel || imgInfo.category}`);
          continue;
        }
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = detectMime(imgInfo.url, headerType);
        imageContents.push({ base64, mimeType, category: imgInfo.category, wallLabel: imgInfo.wallLabel });
      } catch (e) {
        console.error(`Failed to fetch image: ${imgInfo.url}`, e);
      }
    }

    if (!imageContents.length) {
      await storeResult(supabase, jobId, { error: 'Could not fetch any images' });
      return;
    }

    // 3. Build system prompt (shared across all per-wall calls)
    const systemPrompt = buildSystemPrompt(intake);

    // 4. Group elevation images by wall label for parallel analysis
    const floorplanImages = imageContents.filter(i => i.category === 'floorplan');
    const elevationImages = imageContents.filter(i => i.category === 'elevation');

    // Group elevations by wall label
    const wallGroups = new Map();
    for (const elev of elevationImages) {
      const label = elev.wallLabel || 'unknown';
      if (!wallGroups.has(label)) wallGroups.set(label, []);
      wallGroups.get(label).push(elev);
    }

    // Build wall info lookup
    const wallInfoMap = new Map();
    for (const w of (intake.walls || [])) {
      wallInfoMap.set(w.label, w);
    }

    const wallLabels = [...wallGroups.keys()];
    console.log(`Per-wall parallel analysis: ${wallLabels.length} walls [${wallLabels.join(', ')}], ${floorplanImages.length} floor plan(s), ${elevationImages.length} total elevations`);

    // 5. Launch parallel Claude API calls — one per wall
    const cleanKey = anthropicKey.trim();

    const wallPromises = wallLabels.map(async (wallLabel) => {
      const wallElevations = wallGroups.get(wallLabel);
      const wallInfo = wallInfoMap.get(wallLabel);

      try {
        const result = await analyzeOneWall({
          wallLabel,
          wallElevations,
          floorplanImages,
          wallInfo,
          intake,
          systemPrompt,
          apiKey: cleanKey,
        });
        console.log(`Wall ${wallLabel}: ${result.positions?.length || 0} positions found`);
        return { wallLabel, result, error: null };
      } catch (err) {
        console.error(`Wall ${wallLabel} analysis failed:`, err.message);
        return { wallLabel, result: null, error: err.message };
      }
    });

    const wallResults = await Promise.all(wallPromises);

    // 6. Merge per-wall results into a single analysis object
    const analysis = mergeWallResults(wallResults, intake);

    // 7. Normalize the merged analysis
    normalizeAnalysis(analysis);

    // 8. Store successful result
    await storeResult(supabase, jobId, analysis);

    // 9. Clean up the request payload
    await supabase.storage.from('project-files').remove([`analysis-jobs/${jobId}/request.json`]);

  } catch (err) {
    console.error('processAnalysisJob error:', err);
    await storeResult(supabase, jobId, { error: err.message || 'Background processing failed' });
  }
}

// --- Per-wall analysis ---

async function analyzeOneWall({ wallLabel, wallElevations, floorplanImages, wallInfo, intake, systemPrompt, apiKey }) {
  // Build wall-specific user message
  let wallDesc = `Wall ${wallLabel}`;
  if (wallInfo) {
    wallDesc += `: ${wallInfo.length}cm`;
    if (wallInfo.hasWindow) wallDesc += `, window ${wallInfo.windowWidth || '?'}cm at sill ${wallInfo.windowSillHeight || '?'}cm`;
    if (wallInfo.hasDoor) wallDesc += `, door ${wallInfo.doorWidth || '?'}cm`;
    if (wallInfo.notes) wallDesc += ` (${wallInfo.notes})`;
  }

  const userMsg = `Analyze Wall ${wallLabel} ONLY. Room: ${intake.roomWidth}x${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm.
${wallDesc}
${intake.notes ? `Notes: ${intake.notes}` : ''}

You are analyzing ONLY Wall ${wallLabel}. Output positions for this wall only.

STEP-BY-STEP PROCESS:
1. DETERMINE THE MEASUREMENT SYSTEM (mm or inches) by looking at the dimension annotations. Then READ ALL DIMENSION ANNOTATIONS and convert them to centimeters.
2. BEFORE identifying rows, look at the HEIGHTS of cabinets. Any cabinet that spans from floor to near-ceiling (~195-227cm or ~77-89 inches) is a TALL unit, NOT a base unit. A wall can be entirely tall units with zero base units.
3. For sections that are NOT tall units, identify base row (floor level, ~76cm) and wall/upper row (above countertop).
4. For each cabinet, determine: width (from converted annotations in cm), type (from visual appearance and height), door orientation.
5. Cross-check: each row's widths should sum to approximately the wall length (within 5-20cm for fillers). Tall unit widths + base unit widths should NOT exceed wall length — they share the same horizontal space.
6. Assign SKU suggestions using the PREFIX WIDTH-HEIGHT-VARIANT format. All widths and heights MUST be in centimeters.

CRITICAL RULES:
- READ dimension annotations from the drawing — do NOT guess widths from visual proportions alone.
- Every width MUST be a valid ProLine width. If an annotation shows e.g. 575mm, round to nearest valid: 60cm.
- For each row (base, upper, tall), the widths should sum to approximately the wall length (within 5-20cm for fillers).
- Tall units replace both base AND upper in their section of the wall. Do NOT double-count.
- Use these "type" values: base_unit, sink_base, corner_base, drawer_base, wall_unit, wall_flap, open_shelf, extractor_unit, tall_unit, mid_height_unit, appliance_housing, fridge_housing, larder, crockery_unit, hob_base, oven_base, pull_out_unit, towel_rail_unit, waste_bin_unit, bottle_unit, island_base.

Output ONLY valid JSON in this exact format (single wall):
{"label":"${wallLabel}","length_cm":${wallInfo?.length || 0},"positions":[...],"dimensionCheck":{"baseRow_cm":0,"upperRow_cm":0,"tallRow_cm":0,"wallLength_cm":${wallInfo?.length || 0},"valid":true},"notes":[]}`;

  // Build content blocks: floor plan (for context) + this wall's elevations
  const contentBlocks = [];

  // Include floor plan for spatial context (helps AI understand wall relationships)
  if (floorplanImages.length > 0) {
    contentBlocks.push({ type: 'text', text: `FLOOR PLAN (for context — you are analyzing Wall ${wallLabel} only):` });
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: floorplanImages[0].mimeType, data: floorplanImages[0].base64 } });
  }

  // Add this wall's elevation images
  for (const elev of wallElevations) {
    contentBlocks.push({ type: 'text', text: `ELEVATION Wall ${wallLabel}:` });
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: elev.mimeType, data: elev.base64 } });
  }

  contentBlocks.push({ type: 'text', text: userMsg });

  // Call Claude API
  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000, // single wall needs fewer tokens than all walls
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  });

  if (!claudeResp.ok) {
    const errBody = await claudeResp.text();
    throw new Error(`Claude API error ${claudeResp.status}: ${errBody.slice(0, 300)}`);
  }

  // Read SSE stream
  let fullText = '';
  const reader = claudeResp.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const d = line.slice(6).trim();
      if (d === '[DONE]') continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          fullText += ev.delta.text;
        }
      } catch {}
    }
  }

  if (!fullText.trim()) {
    throw new Error('No text received from AI');
  }

  // Parse JSON
  let jsonStr = fullText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse AI response for wall ${wallLabel}: ${fullText.slice(0, 300)}`);
  }

  // The AI might return { walls: [{ ... }] } or just { label, positions, ... }
  // Normalize to a single wall object
  if (parsed.walls && Array.isArray(parsed.walls) && parsed.walls.length > 0) {
    return parsed.walls[0];
  }
  return parsed;
}

// --- Merge per-wall results ---

function mergeWallResults(wallResults, intake) {
  const walls = [];
  const notes = [];
  const warnings = [];

  for (const wr of wallResults) {
    if (wr.error) {
      warnings.push(`Wall ${wr.wallLabel} analysis failed: ${wr.error}`);
      // Create an empty wall entry so the user can see something
      walls.push({
        label: wr.wallLabel,
        length_cm: 0,
        positions: [],
        dimensionCheck: { baseRow_cm: 0, upperRow_cm: 0, tallRow_cm: 0, wallLength_cm: 0, valid: false },
      });
      continue;
    }

    const wallData = wr.result;
    if (!wallData) continue;

    // Ensure the label is set correctly
    wallData.label = wallData.label || wr.wallLabel;

    walls.push(wallData);

    // Collect any notes/warnings from the per-wall analysis
    if (Array.isArray(wallData.notes)) {
      notes.push(...wallData.notes);
      delete wallData.notes; // move to top-level
    }
    if (Array.isArray(wallData.warnings)) {
      warnings.push(...wallData.warnings);
      delete wallData.warnings;
    }
  }

  // Sort walls by label for consistent ordering
  walls.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  const successCount = wallResults.filter(r => !r.error).length;
  const totalCount = wallResults.length;
  console.log(`Merge complete: ${successCount}/${totalCount} walls succeeded, ${walls.reduce((s, w) => s + (w.positions?.length || 0), 0)} total positions`);

  return { walls, notes, warnings };
}

// --- Normalization (same logic as before, applied to merged result) ---

function normalizeAnalysis(analysis) {
  // Log the raw structure for debugging
  console.log('Merged analysis structure:', JSON.stringify({
    wallCount: Array.isArray(analysis.walls) ? analysis.walls.length : 0,
    topLevelKeys: Object.keys(analysis),
    wallPositionCounts: Array.isArray(analysis.walls) ? analysis.walls.map(w => `${w.label}:${w.positions?.length || 0}`) : [],
  }));

  if (!Array.isArray(analysis.walls)) {
    if (analysis.walls && typeof analysis.walls === 'object') {
      analysis.walls = Object.values(analysis.walls);
    } else {
      analysis.walls = [];
    }
  }
  if (!Array.isArray(analysis.notes)) analysis.notes = [];
  if (!Array.isArray(analysis.warnings)) analysis.warnings = [];

  for (const wall of analysis.walls) {
    // Normalize wall-level fields
    if (!wall.label && wall.wall_label) { wall.label = wall.wall_label; }
    if (!wall.label && wall.wallLabel) { wall.label = wall.wallLabel; }
    if (!wall.label && wall.name) { wall.label = wall.name; }
    if (!wall.length_cm && wall.lengthCm) { wall.length_cm = wall.lengthCm; }
    if (!wall.length_cm && wall.length) { wall.length_cm = wall.length; }
    if (!wall.length_cm && wall.wall_length_cm) { wall.length_cm = wall.wall_length_cm; }

    // Robust normalization: AI may use different field names for positions
    if (!Array.isArray(wall.positions)) {
      // Try common alternative field names
      const altPositions = wall.items || wall.cabinets || wall.cabinet_positions || wall.cabinetPositions || wall.units;
      if (Array.isArray(altPositions)) {
        wall.positions = altPositions;
      } else if (altPositions && typeof altPositions === 'object') {
        wall.positions = Object.values(altPositions);
      } else {
        wall.positions = [];
      }
    }
    if (wall.dimension_check && !wall.dimensionCheck) {
      wall.dimensionCheck = wall.dimension_check;
      delete wall.dimension_check;
    }
    if (!wall.dimensionCheck) {
      // Build per-row dimension check
      const wl = wall.length_cm || 0;
      const base = wall.positions.filter(p => {
        const t = (p.type || '').toLowerCase();
        return t.includes('base') || t.includes('sink') || t.includes('drawer') || t.includes('corner');
      });
      const upper = wall.positions.filter(p => {
        const t = (p.type || '').toLowerCase();
        return t.includes('wall') || t.includes('flap');
      });
      const tall = wall.positions.filter(p => {
        const t = (p.type || '').toLowerCase();
        return t.includes('tall') || t.includes('larder') || t.includes('housing') || t.includes('pantry') || t.includes('fridge');
      });
      const baseTotal = base.reduce((s, p) => s + (p.width_cm || 0), 0);
      const upperTotal = upper.reduce((s, p) => s + (p.width_cm || 0), 0);
      const tallTotal = tall.reduce((s, p) => s + (p.width_cm || 0), 0);
      wall.dimensionCheck = {
        baseRow_cm: baseTotal,
        upperRow_cm: upperTotal,
        tallRow_cm: tallTotal,
        wallLength_cm: wl,
        valid: (baseTotal === 0 || Math.abs(wl - baseTotal) <= 20) &&
               (upperTotal === 0 || Math.abs(wl - upperTotal) <= 20) &&
               (tallTotal === 0 || Math.abs(wl - tallTotal) <= 20),
      };
    }
    for (const pos of wall.positions) {
      // Normalize all common field name variations (camelCase vs snake_case)
      if (pos.sku_suggestion && !pos.skuSuggestion) { pos.skuSuggestion = pos.sku_suggestion; delete pos.sku_suggestion; }
      if (pos.skusuggestion && !pos.skuSuggestion) { pos.skuSuggestion = pos.skusuggestion; delete pos.skusuggestion; }
      if (pos.sku && !pos.skuSuggestion) { pos.skuSuggestion = pos.sku; }
      if (pos.door_orientation && !pos.doorOrientation) { pos.doorOrientation = pos.door_orientation; delete pos.door_orientation; }
      if (pos.doororientation && !pos.doorOrientation) { pos.doorOrientation = pos.doororientation; delete pos.doororientation; }
      if (pos.hinge && !pos.doorOrientation) { pos.doorOrientation = pos.hinge; }
      if (pos.width && !pos.width_cm) { pos.width_cm = pos.width; }
      if (pos.widthCm && !pos.width_cm) { pos.width_cm = pos.widthCm; }
      if (pos.height && !pos.height_cm) { pos.height_cm = pos.height; }
      if (pos.heightCm && !pos.height_cm) { pos.height_cm = pos.heightCm; }
      if (pos.x && pos.x_cm === undefined) { pos.x_cm = pos.x; }
      if (pos.xCm && pos.x_cm === undefined) { pos.x_cm = pos.xCm; }
      if (!Array.isArray(pos.features)) pos.features = pos.features ? [pos.features] : [];
      if (!pos.id && pos.position_id) { pos.id = pos.position_id; }
      if (!pos.id && pos.positionId) { pos.id = pos.positionId; }
      if (!pos.id) { pos.id = `${wall.label}_${wall.positions.indexOf(pos) + 1}`; }
      pos.wallLabel = wall.label;
    }
  }
}

// --- System prompt builder ---

function buildSystemPrompt(intake) {
  return `You are an expert kitchen designer analyzing elevation and floor plan drawings for Pronorm kitchens (ProLine, X-Line, Y-Line ranges). Your task is to identify every cabinet position on a SINGLE WALL and map each to a Pronorm SKU pattern.

HOW TO READ KITCHEN ELEVATION DRAWINGS:
- An elevation drawing shows a wall from the FRONT, as if you are standing in front of it looking straight at it.
- Cabinets are arranged in HORIZONTAL ROWS stacked vertically on the wall.
- READ THE DIMENSION ANNOTATIONS carefully. Drawings have dimension lines with numbers showing widths/heights. ALWAYS use these annotated dimensions — do NOT guess widths from visual proportions.
- Dimensions may be in MILLIMETERS or INCHES. FIRST determine which system the drawing uses, then convert ALL dimensions to centimeters:
  * MILLIMETERS (numbers are large, 300-1200+): 300mm=30cm, 400=40, 450=45, 500=50, 550=55, 600=60, 750=75, 800=80, 900=90, 1000=100, 1100=110, 1200=120.
  * INCHES (numbers are small, often with fractions like 23 5/8"): Use this conversion table:
    11 13/16"=30cm, 13 3/16"=33.5cm, 15 3/4"=40cm, 17 3/4"=45cm, 19 11/16"=50cm, 21 5/8"=55cm, 23 5/8"=60cm, 29 1/2"=75cm, 30"=76cm, 31 1/2"=80cm, 35 7/16"=90cm, 39 3/8"=100cm, 43 5/16"=110cm, 47 1/4"=120cm.
    For HEIGHT conversions in inches: 14 15/16"=38cm, 20 1/16"=51cm, 25 3/16"=64cm, 30"=76cm, 35"=89cm, 76 13/16"=195cm, 81 1/2"=207cm, 87"=221cm, 89 3/8"=227cm.
    IMPORTANT: When you see inch dimensions, ALWAYS convert to the nearest valid Pronorm cm width BEFORE outputting. Never output inch values.
- If no dimension annotations are visible, estimate from the total wall length and the proportional widths of each cabinet.

CABINET ROWS — Identify each horizontal row separately:
  * BASE ROW (bottom, usually 76cm but can be 38cm for bench/shallow units): These sit on the floor behind the plinth. Look for door fronts, drawer fronts, appliance panels.
    - U = standard base unit (1 or 2 doors, or with shelves)
    - US = sink base (usually under the sink, identified by pipe symbols or sink outline)
    - UG = base for hob/cooktop OR built-in oven (60-100cm wide). Suffix -31/-38=hob, -45=oven
    - UI = base for induction hob (similar to UG but specifically for induction)
    - UE = corner base unit. Two types: L-shaped (-01/-07, 105-125cm) or diagonal/pentagon (-03-P, 91cm)
    - UV = base-height larder/bottle pull-out (narrow, 30cm wide)
    - UF = island base unit (profiled end piece, often 38cm wide)
    - DT = drawer/front panel for integrated appliance (dishwasher DT...-14, under-counter fridge DT...-13)
    - Variant suffixes: -00=basic/oven, -01=standard doors, -03=diagonal corner, -04=155° hinge, -12=crockery/display with pinned doors, -15=lifting door, -17=larder with 155° hinges, -22=flap door, -30=single front pull-out, -31=hob with drawer+pull-outs, -32=2 drawers, -34=multi-drawer, -37=2 pull-outs (no drawer), -38=pull-out with internal drawer, -41=bottle/larder pull-out, -45=oven housing, -48=single panel sink, -53=crockery unit with shelves, -56=special wall unit variant, -81=narrow larder pull-out, -82=towel rail pull-out, -90=waste bin, -95=waste bin pull-out, -501/-601=glass door
    - 3-digit variants: -065=fridge housing, -071=appliance housing rebuilt front, -181=integrated fridge, -501/-601=glass door
  * UPPER/WALL ROW (mounted above countertop): Wall-hung cabinets above the worktop.
    - O = wall unit with door(s). Heights: 38cm, 51cm (most common), 64cm, 76cm, 89cm, 90cm. Variant -22=flap door
    - OE = corner wall unit (90° configuration, 81cm wide)
    - OR = open wall shelf (often 38cm tall) OR wall unit with flap/lift-up door(s)
    - OG = wall unit for extractor/rangehood, typically 76cm or 51cm tall, sits directly above hob
    - Glass-door wall units use OR prefix with -501 or -601 variant suffix
    - 38cm height flap units (O...-38-22) are common above tall units/utility areas
  * TALL UNITS (floor to near ceiling, ~207-227cm tall): Full-height cabinets spanning from floor to top.
    - HP = larder/pantry with internal pull-outs OR crockery/display unit (most common tall unit)
    - HGP = larder with pull-outs (similar to HP)
    - HSP = tall housing for fridge/freezer (has appliance niche)
    - HS = tall housing for oven/appliance
    - HG = larder with shelves (no pull-outs), also used for integrated fridge housings (HG...-181)
    - H = standard larder/tall unit (with shelves, 155° hinges common)
    - HR = mid-height crockery/display unit (~144cm tall), often with glass doors (-501)
    - AH = appliance housing

CRITICAL LAYOUT RULES:
- FIRST determine if a cabinet spans floor to ceiling (~195-227cm). If YES, it is a TALL unit (H/HP/HSP/HG/HGP/HS/AH prefix), NOT a base unit. Tall units are much taller than base units (227cm vs 76cm).
- Tall units occupy the SAME horizontal wall space as base+upper would. Where you see a tall unit, there are NO base or wall units behind it.
- A wall can be: (a) ALL tall units across the entire wall, (b) tall unit(s) on one or both ends with base+upper cabinets in the middle, or (c) all base+upper with no tall units.
- COMMON PATTERN: A "tall wall" has ALL tall units (e.g., fridge housing + larders) with optional wall units mounted ABOVE the tall units. In this case there are ZERO base units — do NOT create base_unit positions for tall cabinets.
- If a cabinet runs from floor to near-ceiling, it is ALWAYS a tall unit even if the drawing doesn't show a clear visual separation from cabinets above it.
- Wall units (O prefix) can sit ABOVE tall units when the tall unit is shorter than ceiling height. These wall units are typically 38cm flaps or small cabinets filling the gap between the tall unit top and the ceiling.
- Fillers (narrow panels 2-10cm) appear at ends of runs or between cabinets. Note them in "notes" but do NOT create positions for fillers, panels, or plinths.
- Side panels (16mm or 25mm decorative panels on exposed cabinet sides) are NOT cabinets — skip them.
- Corner filler panels (PHX, POE, POEX) are NOT cabinets — skip them.
- The sum of cabinet widths in EACH ROW should approximately equal the wall length (minus fillers/gaps).

DIMENSIONS — All in CENTIMETERS:
Valid base/drawer widths: 15, 20, 27, 30, 40, 45, 50, 55, 60, 75, 80, 90, 100, 120
Valid corner base widths: 80, 91, 100, 105, 110, 115, 125 (L-shaped) or 91 (diagonal/pentagon)
Valid wall unit widths:   20, 25, 27, 30, 35, 40, 45, 50, 55, 60, 65, 75, 80, 81, 90, 100, 120
Valid corner wall widths: 65, 66, 80, 81, 90 (corner wall units)
Valid tall unit widths:   27, 30, 45, 55, 60, 75, 76, 80, 90, 120
Common base heights: ${intake.baseUnitHeight || 76}cm (standard) or 38cm (bench/shallow pull-out units)
Common wall unit heights: 38cm (open shelf), 51cm (standard), 64cm (glass flap), 72cm, 76cm (extractor/tall wall), 89cm, 90cm
Common tall heights: 144cm (mid-height HR), 195cm, 207cm, 221cm, 227cm

MOST COMMON WIDTHS (by frequency across real kitchens): 60, 40, 90, 100, 80, 50, 55, 120, 45, 30
If a dimension annotation says 600 → width is 60cm. If it says 400 → 40cm. If it says 900 → 90cm. If it says 1000 → 100cm.

SKU FORMAT: PREFIX + WIDTH - HEIGHT - VARIANT
Examples: U 60-76-01, U 80-76-32, U 50-76-95, U 15-76-81, U 15-76-82, U 60-38-30, US 90-76-01, US 60-76-48, UG 60-76-31, UG 60-76-45, UI 100-76-34, UE 125-76-07, UE 115-76-07-H, UE 91-76-03, UV 30-76-41, UF 38-76-00, DT 60-76-14, O 60-51-01, O 40-89-01, O 45-38-22, O 45-64-56-01, OE 66-89-01, OE 81-89-12, OR 90-38, OR 60-89-501, OG 100-76-01, OG 90-51-01, H 60-195-08, HP 45-227-53, HP 55-227-12, HP 60-227-17, HP 60-227-09, HR 60-144-501, HG 60-195-181, HGP 60-227-601, HSP 76-227-065, HSP 76-227-071

DOOR ORIENTATION:
- "L" = left-hinged (opens to the left)
- "R" = right-hinged (opens to the right)
- Drawers/pull-outs typically have no hinge direction
- On paired tall units (e.g., two larders flanking a section), the left one is usually "L" and the right one "R"
- 1-door base/wall units always have a hinge direction. 2-door units usually don't need one.

Output ONLY valid JSON. No markdown, no explanation.`;
}
