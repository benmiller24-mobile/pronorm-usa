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

    const systemPrompt = `You are an expert kitchen designer analyzing elevation and floor plan drawings for Pronorm ProLine kitchens. Your task is to identify every cabinet position and map each to a ProLine SKU pattern.

CRITICAL ELEVATION READING RULES:
- An elevation drawing shows a wall from the FRONT. Cabinets are arranged in HORIZONTAL ROWS stacked vertically.
- IDENTIFY each horizontal row separately:
  * BASE ROW (bottom ~76-87cm): base units (U), sink bases (US), drawer bases (DT), corner bases (UE)
  * UPPER ROW (mounted above countertop, ~60-90cm tall): wall units (O), flap doors (OR)
  * TALL UNITS (floor to near ceiling, ~200-230cm): larders (HG), appliance housings (HS/AH), fridge housings (HSP), tall units (H)
- IMPORTANT: Tall units occupy the SAME wall space as base+upper would. A wall may have ONLY tall units, or a MIX of tall units plus base+upper sections. Do NOT double-count tall units as base units.
- Fillers are narrow panels (usually 2-10cm) at the ends of runs or between cabinets. Note them in "notes" but do NOT create positions for fillers.
- The sum of widths within EACH ROW should approximately equal the wall length (minus fillers and appliance gaps).
- If a wall has only tall units, there should be NO base or wall unit positions on that wall segment.

DIMENSIONS: All in CENTIMETERS. Width 60 = 600mm, height 76 = 768mm.
Valid base widths: 15,20,27,30,40,45,50,55,60,75,80,90,100,120cm
Valid wall widths: 20,25,27,30,35,40,45,50,55,60,65,75,80,90,100,120cm
Valid tall widths: 27,30,45,55,60,75,80,90,120cm
Base height: ${intake.baseUnitHeight || 76}cm

SKU PREFIXES: U=base, US=sink base, UE=corner base, DT=drawer base, O=wall unit, OR=wall flap, H=tall, HS=tall appliance, HSP=fridge housing, HG=larder, AH=appliance housing
FORMAT: PREFIX WIDTH-HEIGHT-VARIANT (e.g. U 60-76-01, H 60-207-01)

Output ONLY valid JSON. No markdown, no explanation.`;

    const userMsg = `Analyze these drawings. Room: ${intake.roomWidth}x${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm.
Walls:\n${wallSummary}
${intake.notes ? `Notes: ${intake.notes}` : ''}

Output JSON: {"walls":[{"label":"A","length_cm":340,"positions":[{"id":"A_1","type":"tall_unit","skuSuggestion":"HG 60-207-01","width_cm":60,"height_cm":207,"x_cm":0,"doorOrientation":"R","features":["larder"],"confidence":0.85,"reasoning":"Full-height pantry unit, leftmost position"}],"dimensionCheck":{"baseRow_cm":0,"upperRow_cm":0,"tallRow_cm":340,"wallLength_cm":340,"valid":true}}],"notes":["2cm filler panel on left end"],"warnings":[]}

IMPORTANT:
- Every width MUST be a valid ProLine width from the lists above.
- For each row (base, upper, tall), the widths should sum to approximately the wall length.
- Do NOT add base units where you see tall units — tall units go floor to ceiling and replace both base and upper.
- Use "type" values: base_unit, sink_base, corner_base, drawer_base, wall_unit, wall_flap, tall_unit, appliance_housing, fridge_housing, larder.`;

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
