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
    for (const imgInfo of imageUrls) {
      try {
        const resp = await fetch(imgInfo.url);
        const buffer = await resp.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const headerType = resp.headers.get('content-type')?.split(';')[0]?.trim();
        if (headerType === 'application/pdf') continue;
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

    // 3. Build prompt
    const wallSummary = (intake.walls || []).map(w => {
      let d = `Wall ${w.label}: ${w.length}cm`;
      if (w.hasWindow) d += `, window ${w.windowWidth || '?'}cm at sill ${w.windowSillHeight || '?'}cm`;
      if (w.hasDoor) d += `, door ${w.doorWidth || '?'}cm`;
      if (w.notes) d += ` (${w.notes})`;
      return d;
    }).join('\n');

    const systemPrompt = `You are an expert kitchen designer analyzing elevation and floor plan drawings for Pronorm kitchens (ProLine, X-Line, Y-Line ranges). Your task is to identify every cabinet position and map each to a Pronorm SKU pattern.

HOW TO READ KITCHEN ELEVATION DRAWINGS:
- An elevation drawing shows a wall from the FRONT, as if you are standing in front of it looking straight at it.
- Cabinets are arranged in HORIZONTAL ROWS stacked vertically on the wall.
- READ THE DIMENSION ANNOTATIONS carefully. Drawings typically have dimension lines with numbers showing widths and heights in millimeters. ALWAYS use these annotated dimensions — do NOT guess widths from visual proportions.
- Convert mm annotations to cm: 300mm=30cm, 400mm=40cm, 450mm=45cm, 550mm=55cm, 600mm=60cm, 800mm=80cm, 900mm=90cm, 1000mm=100cm, 1100mm=110cm, 1200mm=120cm.
- If no dimension annotations are visible, estimate from the total wall length and the proportional widths of each cabinet.

CABINET ROWS — Identify each horizontal row separately:
  * BASE ROW (bottom ~76cm): These sit on the floor behind the plinth. Look for door fronts, drawer fronts, appliance panels.
    - U = standard base unit (1 or 2 doors, or with shelves)
    - US = sink base (usually under the sink, identified by pipe symbols or sink outline)
    - UG = base for hob/cooktop OR built-in oven (60-100cm wide). Suffix -31/-38=hob, -45=oven
    - UE = corner base unit. Two types: L-shaped (-01, 105-125cm) or diagonal/pentagon (-03-P, 91cm)
    - UV = base-height larder/bottle pull-out (narrow, 30cm wide)
    - DT = drawer/front panel for integrated appliance (dishwasher DT...-14, under-counter fridge DT...-13)
    - Variant suffixes: -01=standard doors, -03=diagonal corner, -04=155° hinge, -22=flap door, -32=2 drawers, -34=multi-drawer, -38=pull-out with internal drawer, -41=bottle/larder pull-out, -45=oven housing, -48=single panel sink, -90=waste bin
  * UPPER/WALL ROW (mounted above countertop): Wall-hung cabinets above the worktop.
    - O = wall unit with door(s). Heights: 38cm, 51cm (most common), 64cm, 76cm, 89cm, 90cm. Variant -22=flap door
    - OE = corner wall unit (90° configuration, 81cm wide)
    - OR = open wall shelf (often 38cm tall) OR wall unit with flap/lift-up door(s)
    - OG = wall unit for extractor/rangehood, typically 76cm tall, sits directly above hob
    - Glass-door wall units use OR prefix with -601 variant suffix
    - 38cm height flap units (O...-38-22) are common above tall units/utility areas
  * TALL UNITS (floor to near ceiling, ~207-227cm tall): Full-height cabinets spanning from floor to top.
    - HP = larder/pantry with internal pull-outs (most common tall unit)
    - HGP = larder with pull-outs (similar to HP)
    - HSP = tall housing for fridge/freezer (has appliance niche)
    - HS = tall housing for oven/appliance
    - HG = larder with shelves (no pull-outs), also used for integrated fridge housings (HG...-181)
    - H = standard larder/tall unit (with shelves, 155° hinges common)
    - AH = appliance housing

CRITICAL LAYOUT RULES:
- Tall units occupy the SAME horizontal wall space as base+upper would. Where you see a tall unit, there are NO base or wall units behind it.
- A wall commonly has: tall unit(s) on one or both ends, with base+upper cabinets in the middle section.
- Fillers (narrow panels 2-10cm) appear at ends of runs or between cabinets. Note them in "notes" but do NOT create positions for fillers, panels, or plinths.
- Side panels (16mm or 25mm decorative panels on exposed cabinet sides) are NOT cabinets — skip them.
- Corner filler panels (PHX, POE, POEX) are NOT cabinets — skip them.
- The sum of cabinet widths in EACH ROW should approximately equal the wall length (minus fillers/gaps).
- A kitchen can have multiple wall unit heights on different walls (e.g., 89cm on one wall, 51cm on another).

DIMENSIONS — All in CENTIMETERS:
Valid base/drawer widths: 15, 20, 27, 30, 40, 45, 50, 55, 60, 75, 80, 90, 100, 120
Valid corner base widths: 80, 91, 100, 105, 110, 125 (L-shaped) or 91 (diagonal/pentagon)
Valid wall unit widths:   20, 25, 27, 30, 35, 40, 45, 50, 55, 60, 65, 75, 80, 81, 90, 100, 120
Valid corner wall widths: 65, 80, 81, 90 (corner wall units)
Valid tall unit widths:   27, 30, 45, 55, 60, 75, 76, 80, 90, 120
Common base height: ${intake.baseUnitHeight || 76}cm (768mm)
Common wall unit heights: 38cm (open shelf), 51cm (standard), 64cm (glass flap), 72cm, 76cm (extractor/tall wall), 89cm, 90cm
Common tall heights: 195cm, 207cm, 221cm, 227cm

MOST COMMON WIDTHS (by frequency across real kitchens): 60, 40, 90, 100, 80, 50, 55, 120, 45, 30
If a dimension annotation says 600 → width is 60cm. If it says 400 → 40cm. If it says 900 → 90cm. If it says 1000 → 100cm.

SKU FORMAT: PREFIX + WIDTH - HEIGHT - VARIANT
Examples: U 60-76-01, US 80-76-01, UG 60-76-45, UE 105-76-01, UE 91-76-03, UV 30-76-41, DT 60-76-14, O 60-51-01, O 40-89-01, O 60-38-22, OE 81-89-12, OR 90-38, OG 100-76-01, H 60-195-08, HP 60-227-09, HG 60-195-181, HGP 60-227-601, HSP 76-227-065

DOOR ORIENTATION:
- "L" = left-hinged (opens to the left)
- "R" = right-hinged (opens to the right)
- Drawers/pull-outs typically have no hinge direction
- On paired tall units (e.g., two larders flanking a section), the left one is usually "L" and the right one "R"
- 1-door base/wall units always have a hinge direction. 2-door units usually don't need one.

Output ONLY valid JSON. No markdown, no explanation.`;

    const userMsg = `Analyze these kitchen drawings carefully. Room: ${intake.roomWidth}x${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm.
Walls:\n${wallSummary}
${intake.notes ? `Notes: ${intake.notes}` : ''}

STEP-BY-STEP PROCESS:
1. For each elevation drawing, first READ ALL DIMENSION ANNOTATIONS (numbers on dimension lines). These tell you exact widths in mm.
2. Identify the horizontal rows: which sections are tall units (floor to ceiling), which are base+upper.
3. For each cabinet in each row, determine: width (from annotations), type (from visual appearance), door orientation.
4. Cross-check: row widths should sum to approximately the wall length.
5. Assign SKU suggestions using the PREFIX WIDTH-HEIGHT-VARIANT format.

EXAMPLE OUTPUT for a wall with 2 larders flanking base+upper cabinets:
{"walls":[{"label":"A","length_cm":369,"positions":[
  {"id":"A_1","type":"larder","skuSuggestion":"HP 60-227-09","width_cm":60,"height_cm":227,"x_cm":0,"doorOrientation":"L","features":["larder","pull-outs"],"confidence":0.85,"reasoning":"Full-height larder with internal pull-outs, leftmost position"},
  {"id":"A_2","type":"wall_unit","skuSuggestion":"O 60-51-01","width_cm":60,"height_cm":51,"x_cm":60,"doorOrientation":"L","features":[],"confidence":0.80,"reasoning":"Wall unit above base section"},
  {"id":"A_3","type":"base_unit","skuSuggestion":"U 90-76-38","width_cm":90,"height_cm":76,"x_cm":60,"doorOrientation":"","features":["pull-out"],"confidence":0.80,"reasoning":"Pull-out base unit below wall cabinet"},
  {"id":"A_4","type":"base_unit","skuSuggestion":"UG 100-76-31","width_cm":100,"height_cm":76,"x_cm":150,"doorOrientation":"","features":["hob"],"confidence":0.85,"reasoning":"Hob/cooktop base unit, wider unit in center"},
  {"id":"A_5","type":"fridge_housing","skuSuggestion":"HSP 76-227-065","width_cm":76,"height_cm":227,"x_cm":293,"doorOrientation":"L","features":["fridge"],"confidence":0.80,"reasoning":"Tall fridge housing, right side"},
  {"id":"A_6","type":"larder","skuSuggestion":"HP 60-227-09","width_cm":60,"height_cm":227,"x_cm":309,"doorOrientation":"R","features":["larder","pull-outs"],"confidence":0.85,"reasoning":"Full-height larder, rightmost position"}
],"dimensionCheck":{"baseRow_cm":190,"upperRow_cm":60,"tallRow_cm":196,"wallLength_cm":369,"valid":true}}],
"notes":["Side panels on exposed ends not included as positions"],
"warnings":[]}

CRITICAL RULES:
- READ dimension annotations from the drawing — do NOT guess widths from visual proportions alone.
- Every width MUST be a valid ProLine width. If an annotation shows e.g. 575mm, round to nearest valid: 60cm.
- For each row (base, upper, tall), the widths should sum to approximately the wall length (within 5-20cm for fillers).
- Tall units replace both base AND upper in their section of the wall. Do NOT double-count.
- Use these "type" values: base_unit, sink_base, corner_base, drawer_base, wall_unit, wall_flap, open_shelf, extractor_unit, tall_unit, appliance_housing, fridge_housing, larder, hob_base, pull_out_unit, waste_bin_unit.
- UG prefix = hob/cooktop base. HP/HGP prefix = larder with pull-outs. HSP = fridge housing.
- DT prefix = front panel for integrated appliance (dishwasher DT...-14, under-counter fridge DT...-13).
- OG prefix = extractor/rangehood housing (wall unit above hob). OR can be open shelf (38cm tall) or flap door.
- UE prefix = corner base unit, often 125cm with offset specification.`;

    // Build image blocks
    const contentBlocks = [];
    const fp = imageContents.find(i => i.category === 'floorplan');
    if (fp) {
      contentBlocks.push({ type: 'text', text: 'FLOOR PLAN:' });
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: fp.mimeType, data: fp.base64 } });
    }
    for (const elev of imageContents.filter(i => i.category === 'elevation')) {
      contentBlocks.push({ type: 'text', text: `ELEVATION Wall ${elev.wallLabel}:` });
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: elev.mimeType, data: elev.base64 } });
    }
    contentBlocks.push({ type: 'text', text: userMsg });

    // 4. Call Claude with streaming to collect text
    const cleanKey = anthropicKey.trim();
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    });

    if (!claudeResp.ok) {
      const errBody = await claudeResp.text();
      await storeResult(supabase, jobId, { error: `Claude API error: ${claudeResp.status}`, detail: errBody.slice(0, 500) });
      return;
    }

    // 5. Read the stream and collect all text
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
      await storeResult(supabase, jobId, { error: 'No text received from AI' });
      return;
    }

    // 6. Parse Claude's JSON response
    let jsonStr = fullText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      await storeResult(supabase, jobId, { error: 'Failed to parse AI response', raw: fullText.slice(0, 1000) });
      return;
    }

    // 7. Normalize — ensure walls is always an array
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
      if (!Array.isArray(wall.positions)) {
        wall.positions = [];
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
        if (pos.sku_suggestion && !pos.skuSuggestion) { pos.skuSuggestion = pos.sku_suggestion; delete pos.sku_suggestion; }
        if (pos.door_orientation && !pos.doorOrientation) { pos.doorOrientation = pos.door_orientation; delete pos.door_orientation; }
        if (!Array.isArray(pos.features)) pos.features = [];
        pos.wallLabel = wall.label;
      }
    }

    // 8. Store successful result
    await storeResult(supabase, jobId, analysis);

    // 9. Clean up the request payload
    await supabase.storage.from('project-files').remove([`analysis-jobs/${jobId}/request.json`]);

  } catch (err) {
    console.error('processAnalysisJob error:', err);
    await storeResult(supabase, jobId, { error: err.message || 'Background processing failed' });
  }
}
