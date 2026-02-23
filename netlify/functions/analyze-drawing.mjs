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

    const isAsyncClient = req.headers.get('x-async') === 'true';
    if (!isAsyncClient) {
      return jsonResponse({
        error: 'Your browser is running an outdated version. Please hard-refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) and try again.',
      }, 426);
    }

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

    context.waitUntil(processAnalysisJob(jobId, supabase));
    return jsonResponse({ jobId, status: 'processing' });

  } catch (err) {
    console.error('analyze-drawing error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
};

// ============================================================
// Background processing (runs via waitUntil)
// ============================================================

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
    const imageContents = await fetchAllImages(imageUrls);

    if (!imageContents.length) {
      await storeResult(supabase, jobId, { error: 'Could not fetch any images' });
      return;
    }

    // 3. Separate floor plans from elevations
    const floorplanImages = imageContents.filter(i => i.category === 'floorplan');
    const elevationImages = imageContents.filter(i => i.category === 'elevation');

    // Group elevations by wall label
    const wallGroups = new Map();
    for (const elev of elevationImages) {
      const label = elev.wallLabel || 'unknown';
      if (!wallGroups.has(label)) wallGroups.set(label, []);
      wallGroups.get(label).push(elev);
    }

    const wallInfoMap = new Map();
    for (const w of (intake.walls || [])) {
      wallInfoMap.set(w.label, w);
    }

    const wallLabels = [...wallGroups.keys()];
    const cleanKey = anthropicKey.trim();

    console.log(`=== ANALYSIS START: ${wallLabels.length} walls [${wallLabels.join(', ')}], ${floorplanImages.length} floor plan(s) ===`);

    // ─── PASS 1: Floor plan pre-analysis (extracts structured spatial context) ───
    let floorPlanContext = null;
    if (floorplanImages.length > 0) {
      console.log('Pass 1: Analyzing floor plan for spatial context...');
      try {
        floorPlanContext = await analyzeFloorPlan(floorplanImages[0], intake, cleanKey);
        console.log('Pass 1 complete:', JSON.stringify(floorPlanContext).slice(0, 300));
      } catch (err) {
        console.warn('Floor plan pre-analysis failed (non-fatal):', err.message);
        // Non-fatal — we continue without the context
      }
    }

    // ─── PASS 2: Per-wall parallel analysis with extended thinking ───
    const systemPrompt = buildSystemPrompt(intake);

    console.log('Pass 2: Launching parallel per-wall analysis with extended thinking...');
    const wallPromises = wallLabels.map(async (wallLabel) => {
      const wallElevations = wallGroups.get(wallLabel);
      const wallInfo = wallInfoMap.get(wallLabel);

      try {
        const result = await analyzeOneWall({
          wallLabel,
          wallElevations,
          wallInfo,
          intake,
          systemPrompt,
          apiKey: cleanKey,
          floorPlanContext, // structured text from pass 1 (no image needed)
        });
        console.log(`Wall ${wallLabel}: ${result.positions?.length || 0} positions found`);
        return { wallLabel, result, error: null };
      } catch (err) {
        console.error(`Wall ${wallLabel} analysis failed:`, err.message);
        return { wallLabel, result: null, error: err.message };
      }
    });

    let wallResults = await Promise.all(wallPromises);

    // ─── CONFIDENCE-BASED RETRY: Re-run walls with issues ───
    wallResults = await retryLowConfidenceWalls(wallResults, {
      wallGroups, wallInfoMap, intake, systemPrompt, apiKey: cleanKey, floorPlanContext,
    });

    // ─── MERGE & NORMALIZE ───
    const analysis = mergeWallResults(wallResults, intake);
    normalizeAnalysis(analysis);

    console.log(`=== ANALYSIS COMPLETE: ${analysis.walls.length} walls, ${analysis.walls.reduce((s, w) => s + (w.positions?.length || 0), 0)} total positions ===`);

    await storeResult(supabase, jobId, analysis);
    await supabase.storage.from('project-files').remove([`analysis-jobs/${jobId}/request.json`]);

  } catch (err) {
    console.error('processAnalysisJob error:', err);
    await storeResult(supabase, jobId, { error: err.message || 'Background processing failed' });
  }
}

// ============================================================
// Image fetching
// ============================================================

async function fetchAllImages(imageUrls) {
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
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
  return imageContents;
}

// ============================================================
// PASS 1: Floor plan pre-analysis
// Extracts structured spatial context so per-wall calls don't need the image
// ============================================================

async function analyzeFloorPlan(floorplanImage, intake, apiKey) {
  const wallSummary = (intake.walls || []).map(w => {
    let d = `Wall ${w.label}: ${w.length}cm`;
    if (w.hasWindow) d += `, window`;
    if (w.hasDoor) d += `, door`;
    return d;
  }).join(', ');

  const contentBlocks = [
    { type: 'text', text: 'FLOOR PLAN:' },
    { type: 'image', source: { type: 'base64', media_type: floorplanImage.mimeType, data: floorplanImage.base64 } },
    { type: 'text', text: `Analyze this kitchen floor plan. Room: ${intake.roomWidth}x${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm.
User-declared walls: ${wallSummary}

Extract the spatial layout as JSON. For each wall, identify:
- Which appliances are on it (sink, hob/cooktop, fridge, dishwasher, oven)
- Whether it has a corner connection to another wall (and which wall)
- The approximate run of cabinets visible
- Any windows or doors visible on the floor plan

Output ONLY valid JSON in this format:
{"walls":[{"label":"A","appliances":["sink","dishwasher"],"corner_connections":["B"],"has_window":false,"has_door":false,"layout_notes":"L-shaped run connecting to wall B"},...],"room_shape":"L-shaped/U-shaped/galley/straight","measurement_system":"metric/imperial","general_notes":["any observations"]}` },
  ];

  const resp = await callClaudeAPI({
    apiKey,
    contentBlocks,
    system: 'You are a kitchen layout analyst. Extract spatial information from floor plans. Output ONLY valid JSON.',
    maxTokens: 2000,
    enableThinking: false, // floor plan pass is quick — no thinking needed
  });

  return resp;
}

// ============================================================
// PASS 2: Per-wall analysis with extended thinking + strict schema
// ============================================================

async function analyzeOneWall({ wallLabel, wallElevations, wallInfo, intake, systemPrompt, apiKey, floorPlanContext }) {
  // Build wall-specific context from floor plan pre-analysis
  let floorPlanText = '';
  if (floorPlanContext && Array.isArray(floorPlanContext.walls)) {
    const fpWall = floorPlanContext.walls.find(w => w.label === wallLabel);
    if (fpWall) {
      const parts = [`FLOOR PLAN CONTEXT for Wall ${wallLabel}:`];
      if (fpWall.appliances?.length) parts.push(`  Appliances: ${fpWall.appliances.join(', ')}`);
      if (fpWall.corner_connections?.length) parts.push(`  Corner connections: ${fpWall.corner_connections.join(', ')}`);
      if (fpWall.has_window) parts.push('  Has window');
      if (fpWall.has_door) parts.push('  Has door');
      if (fpWall.layout_notes) parts.push(`  Layout: ${fpWall.layout_notes}`);
      floorPlanText = parts.join('\n');
    }
    if (floorPlanContext.measurement_system) {
      floorPlanText += `\nDrawing measurement system detected: ${floorPlanContext.measurement_system}`;
    }
  }

  let wallDesc = `Wall ${wallLabel}`;
  if (wallInfo) {
    wallDesc += `: ${wallInfo.length}cm`;
    if (wallInfo.hasWindow) wallDesc += `, window ${wallInfo.windowWidth || '?'}cm at sill ${wallInfo.windowSillHeight || '?'}cm`;
    if (wallInfo.hasDoor) wallDesc += `, door ${wallInfo.doorWidth || '?'}cm`;
    if (wallInfo.notes) wallDesc += ` (${wallInfo.notes})`;
  }

  // ─── STRICT JSON SCHEMA (Feature #3) ───
  const userMsg = `Analyze Wall ${wallLabel} ONLY. Room: ${intake.roomWidth}x${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm.
${wallDesc}
${intake.notes ? `Notes: ${intake.notes}` : ''}
${floorPlanText ? `\n${floorPlanText}` : ''}

You are analyzing ONLY Wall ${wallLabel}. Output positions for this wall only.

STEP-BY-STEP PROCESS:
1. DETERMINE THE MEASUREMENT SYSTEM (mm or inches) by looking at the dimension annotations. Then READ ALL DIMENSION ANNOTATIONS and convert them to centimeters.
2. BEFORE identifying rows, look at the HEIGHTS of cabinets. Any cabinet that spans from floor to near-ceiling (~195-227cm or ~77-89 inches) is a TALL unit, NOT a base unit.
3. For sections that are NOT tall units, identify base row (floor level, ~76cm) and wall/upper row (above countertop).
4. For each cabinet, determine: width (from converted annotations in cm), type, door orientation.
5. Cross-check: each row's widths should sum to approximately the wall length (within 5-20cm for fillers).
6. Assign SKU suggestions using the PREFIX WIDTH-HEIGHT-VARIANT format. All widths and heights MUST be in centimeters.

CRITICAL RULES:
- READ dimension annotations from the drawing — do NOT guess widths from visual proportions alone.
- Every width MUST be a valid ProLine width. Round to nearest valid if needed.
- Tall units replace both base AND upper in their section. Do NOT double-count.

Output ONLY valid JSON matching this EXACT schema — use these EXACT field names:
{
  "label": "${wallLabel}",
  "length_cm": ${wallInfo?.length || 0},
  "positions": [
    {
      "id": "string",
      "type": "string (one of: base_unit, sink_base, corner_base, drawer_base, wall_unit, wall_flap, open_shelf, extractor_unit, tall_unit, mid_height_unit, appliance_housing, fridge_housing, larder, crockery_unit, hob_base, oven_base, pull_out_unit, towel_rail_unit, waste_bin_unit, bottle_unit, island_base)",
      "skuSuggestion": "string (e.g. U 60-76-01)",
      "width_cm": "number",
      "height_cm": "number",
      "x_cm": "number (position from left edge)",
      "doorOrientation": "string (L, R, or empty)",
      "features": ["string array"],
      "confidence": "number 0.0-1.0",
      "reasoning": "string"
    }
  ],
  "dimensionCheck": {
    "baseRow_cm": "number (sum of base unit widths)",
    "upperRow_cm": "number (sum of wall unit widths)",
    "tallRow_cm": "number (sum of tall unit widths)",
    "wallLength_cm": ${wallInfo?.length || 0},
    "valid": "boolean"
  },
  "notes": ["string array"]
}`;

  // Build content blocks — NO floor plan image (replaced by structured text from pass 1)
  const contentBlocks = [];
  for (const elev of wallElevations) {
    contentBlocks.push({ type: 'text', text: `ELEVATION Wall ${wallLabel}:` });
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: elev.mimeType, data: elev.base64 } });
  }
  contentBlocks.push({ type: 'text', text: userMsg });

  // Call Claude with extended thinking enabled (Feature #1)
  const parsed = await callClaudeAPI({
    apiKey,
    contentBlocks,
    system: systemPrompt,
    maxTokens: 16000, // extended thinking needs headroom: budget_tokens + output tokens
    enableThinking: true,
    thinkingBudget: 4000, // enough to reason through a wall's layout
  });

  // The AI might return { walls: [{ ... }] } or just { label, positions, ... }
  if (parsed.walls && Array.isArray(parsed.walls) && parsed.walls.length > 0) {
    return parsed.walls[0];
  }
  return parsed;
}

// ============================================================
// FEATURE #5: Confidence-based retry
// Re-runs walls that have low confidence or failed dimension checks
// ============================================================

async function retryLowConfidenceWalls(wallResults, ctx) {
  const RETRY_THRESHOLD = 0.65;
  const wallsToRetry = [];

  for (let i = 0; i < wallResults.length; i++) {
    const wr = wallResults[i];
    if (wr.error) {
      // Failed walls always get a retry
      wallsToRetry.push({ index: i, reason: 'failed', wallLabel: wr.wallLabel });
      continue;
    }

    const wall = wr.result;
    if (!wall || !Array.isArray(wall.positions) || wall.positions.length === 0) {
      wallsToRetry.push({ index: i, reason: 'no positions', wallLabel: wr.wallLabel });
      continue;
    }

    // Check average confidence
    const confidences = wall.positions.map(p => p.confidence || 0);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    if (avgConfidence < RETRY_THRESHOLD) {
      wallsToRetry.push({ index: i, reason: `low confidence (${avgConfidence.toFixed(2)})`, wallLabel: wr.wallLabel });
      continue;
    }

    // Check dimension validity
    const dc = wall.dimensionCheck || wall.dimension_check;
    if (dc && dc.valid === false) {
      wallsToRetry.push({ index: i, reason: 'dimension check failed', wallLabel: wr.wallLabel });
      continue;
    }
  }

  if (wallsToRetry.length === 0) {
    console.log('Confidence check: all walls passed — no retries needed');
    return wallResults;
  }

  console.log(`Confidence-based retry: ${wallsToRetry.length} wall(s) need re-analysis: ${wallsToRetry.map(r => `${r.wallLabel} (${r.reason})`).join(', ')}`);

  // Retry in parallel
  const retryPromises = wallsToRetry.map(async ({ index, reason, wallLabel }) => {
    const wallElevations = ctx.wallGroups.get(wallLabel);
    const wallInfo = ctx.wallInfoMap.get(wallLabel);

    if (!wallElevations) return { index, result: wallResults[index] }; // can't retry without images

    try {
      const result = await analyzeOneWall({
        wallLabel,
        wallElevations,
        wallInfo,
        intake: ctx.intake,
        systemPrompt: ctx.systemPrompt,
        apiKey: ctx.apiKey,
        floorPlanContext: ctx.floorPlanContext,
        isRetry: true, // flag for enhanced retry prompt
      });
      console.log(`Retry wall ${wallLabel}: ${result.positions?.length || 0} positions (was: ${reason})`);
      return { index, result: { wallLabel, result, error: null } };
    } catch (err) {
      console.error(`Retry wall ${wallLabel} failed again:`, err.message);
      return { index, result: wallResults[index] }; // keep original
    }
  });

  const retryResults = await Promise.all(retryPromises);

  // Merge retry results back — only replace if retry is better
  const updatedResults = [...wallResults];
  for (const { index, result } of retryResults) {
    if (result.error === null && result.result) {
      // Retry succeeded — check if it's actually better
      const original = wallResults[index];
      const origPositions = original.result?.positions?.length || 0;
      const retryPositions = result.result.positions?.length || 0;

      if (retryPositions >= origPositions) {
        updatedResults[index] = result;
        console.log(`Wall ${result.wallLabel}: retry accepted (${retryPositions} positions vs ${origPositions} original)`);
      } else {
        console.log(`Wall ${result.wallLabel}: retry rejected (${retryPositions} positions vs ${origPositions} original) — keeping original`);
      }
    }
  }

  return updatedResults;
}

// ============================================================
// Claude API caller (shared by floor plan + per-wall analysis)
// Handles SSE streaming + extended thinking
// ============================================================

async function callClaudeAPI({ apiKey, contentBlocks, system, maxTokens, enableThinking, thinkingBudget }) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const body = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens || 4000,
    stream: true,
    system,
    messages: [{ role: 'user', content: contentBlocks }],
  };

  // Feature #1: Extended thinking
  if (enableThinking) {
    headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
    body.thinking = {
      type: 'enabled',
      budget_tokens: thinkingBudget || 3000,
    };
  }

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!claudeResp.ok) {
    const errBody = await claudeResp.text();
    throw new Error(`Claude API error ${claudeResp.status}: ${errBody.slice(0, 300)}`);
  }

  // Read SSE stream — collect only text blocks (skip thinking blocks)
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
        // Collect text_delta events (skip thinking_delta — that's internal reasoning)
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          fullText += ev.delta.text;
        }
      } catch {}
    }
  }

  if (!fullText.trim()) {
    throw new Error('No text received from AI');
  }

  // Parse JSON response
  let jsonStr = fullText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse AI JSON: ${fullText.slice(0, 300)}`);
  }
}

// ============================================================
// Merge per-wall results
// ============================================================

function mergeWallResults(wallResults, intake) {
  const walls = [];
  const notes = [];
  const warnings = [];

  for (const wr of wallResults) {
    if (wr.error) {
      warnings.push(`Wall ${wr.wallLabel} analysis failed: ${wr.error}`);
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

    wallData.label = wallData.label || wr.wallLabel;
    walls.push(wallData);

    if (Array.isArray(wallData.notes)) {
      notes.push(...wallData.notes);
      delete wallData.notes;
    }
    if (Array.isArray(wallData.warnings)) {
      warnings.push(...wallData.warnings);
      delete wallData.warnings;
    }
  }

  walls.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  const successCount = wallResults.filter(r => !r.error).length;
  console.log(`Merge: ${successCount}/${wallResults.length} walls succeeded, ${walls.reduce((s, w) => s + (w.positions?.length || 0), 0)} total positions`);

  return { walls, notes, warnings };
}

// ============================================================
// Normalization (handles AI field name variations)
// ============================================================

function normalizeAnalysis(analysis) {
  console.log('Normalizing:', JSON.stringify({
    wallCount: Array.isArray(analysis.walls) ? analysis.walls.length : 0,
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
    // Wall-level field normalization
    if (!wall.label && wall.wall_label) { wall.label = wall.wall_label; }
    if (!wall.label && wall.wallLabel) { wall.label = wall.wallLabel; }
    if (!wall.label && wall.name) { wall.label = wall.name; }
    if (!wall.length_cm && wall.lengthCm) { wall.length_cm = wall.lengthCm; }
    if (!wall.length_cm && wall.length) { wall.length_cm = wall.length; }
    if (!wall.length_cm && wall.wall_length_cm) { wall.length_cm = wall.wall_length_cm; }

    // Position array normalization
    if (!Array.isArray(wall.positions)) {
      const alt = wall.items || wall.cabinets || wall.cabinet_positions || wall.cabinetPositions || wall.units;
      if (Array.isArray(alt)) {
        wall.positions = alt;
      } else if (alt && typeof alt === 'object') {
        wall.positions = Object.values(alt);
      } else {
        wall.positions = [];
      }
    }

    // Dimension check normalization
    if (wall.dimension_check && !wall.dimensionCheck) {
      wall.dimensionCheck = wall.dimension_check;
      delete wall.dimension_check;
    }
    if (!wall.dimensionCheck) {
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

    // Position-level field normalization
    for (const pos of wall.positions) {
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

// ============================================================
// System prompt builder
// ============================================================

function buildSystemPrompt(intake) {
  return `You are an expert kitchen designer analyzing elevation drawings for Pronorm kitchens (ProLine, X-Line, Y-Line ranges). You will analyze a SINGLE WALL and identify every cabinet position, mapping each to a Pronorm SKU.

HOW TO READ KITCHEN ELEVATION DRAWINGS:
- An elevation drawing shows a wall from the FRONT.
- Cabinets are arranged in HORIZONTAL ROWS stacked vertically.
- READ THE DIMENSION ANNOTATIONS carefully — ALWAYS use annotated dimensions, do NOT guess from visual proportions.
- Dimensions may be in MILLIMETERS or INCHES. FIRST determine which system, then convert ALL to centimeters:
  * MILLIMETERS (large numbers 300-1200+): 300mm=30cm, 400=40, 450=45, 500=50, 550=55, 600=60, 750=75, 800=80, 900=90, 1000=100, 1100=110, 1200=120.
  * INCHES (small numbers with fractions like 23 5/8"):
    Widths: 11 13/16"=30cm, 15 3/4"=40cm, 17 3/4"=45cm, 19 11/16"=50cm, 21 5/8"=55cm, 23 5/8"=60cm, 29 1/2"=75cm, 31 1/2"=80cm, 35 7/16"=90cm, 39 3/8"=100cm, 43 5/16"=110cm, 47 1/4"=120cm.
    Heights: 14 15/16"=38cm, 20 1/16"=51cm, 25 3/16"=64cm, 30"=76cm, 35"=89cm, 76 13/16"=195cm, 81 1/2"=207cm, 87"=221cm, 89 3/8"=227cm.
    Convert to nearest valid Pronorm cm value BEFORE outputting.

CABINET ROWS:
  * BASE ROW (bottom, usually ${intake.baseUnitHeight || 76}cm, or 38cm for bench units):
    U=standard, US=sink, UG=hob/oven, UI=induction, UE=corner, UV=bottle pull-out, UF=island, DT=appliance panel
    Variants: -01=doors, -03=diagonal corner, -12=crockery, -22=flap, -30=pull-out, -31=hob+drawers, -32=2 drawers, -34=multi-drawer, -37=2 pull-outs, -38=pull-out+drawer, -41=bottle, -45=oven, -48=sink panel, -81=narrow larder, -82=towel rail, -90/-95=waste bin, -501/-601=glass
    3-digit: -065=fridge, -071=rebuilt front, -181=integrated fridge
  * UPPER/WALL ROW (above countertop):
    O=wall unit (38/51/64/76/89/90cm tall), OE=corner wall, OR=open shelf or flap, OG=extractor housing
    -22=flap door, -501/-601=glass door
  * TALL UNITS (floor to ceiling, ~195-227cm):
    HP=larder w/pull-outs, HGP=larder w/pull-outs, HSP=fridge housing, HS=oven housing, HG=larder w/shelves, H=standard larder, HR=mid-height crockery (~144cm), AH=appliance housing

CRITICAL LAYOUT RULES:
- FIRST check if any cabinet spans floor to ceiling (~195-227cm). If YES → TALL unit, NOT base.
- Tall units replace both base AND upper in their section — do NOT double-count.
- A wall can be: (a) all tall, (b) tall ends + base/upper middle, (c) all base/upper.
- Wall units (O) can sit ABOVE shorter tall units.
- Do NOT create positions for fillers, side panels, plinths, or corner filler panels (PHX, POE, POEX).

VALID DIMENSIONS (cm):
Base widths: 15, 20, 27, 30, 40, 45, 50, 55, 60, 75, 80, 90, 100, 120
Corner base: 80, 91, 100, 105, 110, 115, 125
Wall widths: 20, 25, 27, 30, 35, 40, 45, 50, 55, 60, 65, 75, 80, 81, 90, 100, 120
Tall widths: 27, 30, 45, 55, 60, 75, 76, 80, 90, 120

SKU FORMAT: PREFIX WIDTH-HEIGHT-VARIANT
Examples: U 60-76-01, US 90-76-01, UG 60-76-31, UE 125-76-07, DT 60-76-14, O 60-51-01, O 45-38-22, OG 100-76-01, OR 60-89-501, HP 60-227-09, HSP 76-227-065, HR 60-144-501, HG 60-195-181

DOOR ORIENTATION: "L"=left-hinged, "R"=right-hinged, ""=drawers/pull-outs/2-door units.

Output ONLY valid JSON. No markdown, no explanation.`;
}
