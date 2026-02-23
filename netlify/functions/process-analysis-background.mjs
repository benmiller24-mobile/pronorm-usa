import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

// Background functions get 15 minutes on Netlify
// The "-background" suffix in the filename tells Netlify to run this asynchronously

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('', { status: 405 });

  let jobId;
  try {
    const body = await req.json();
    jobId = body.jobId;
    if (!jobId) return new Response('Missing jobId', { status: 400 });

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Read the job payload from Supabase storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('project-files')
      .download(`analysis-jobs/${jobId}/request.json`);

    if (dlErr || !fileData) {
      await storeResult(supabase, jobId, { error: 'Job payload not found' });
      return new Response('', { status: 200 });
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
      return new Response('', { status: 200 });
    }

    // 3. Build prompt
    const wallSummary = (intake.walls || []).map(w => {
      let d = `Wall ${w.label}: ${w.length}cm`;
      if (w.hasWindow) d += `, window ${w.windowWidth || '?'}cm at sill ${w.windowSillHeight || '?'}cm`;
      if (w.hasDoor) d += `, door ${w.doorWidth || '?'}cm`;
      if (w.notes) d += ` (${w.notes})`;
      return d;
    }).join('\n');

    const systemPrompt = `You are an expert kitchen designer analyzing drawings for Pronorm ProLine kitchens.
Identify every cabinet position and map to ProLine SKU patterns.

RULES: All dimensions in CENTIMETERS. Width 60 = 600mm, height 76 = 768mm.
Valid base widths: 15,20,27,30,40,45,50,55,60,75,80,90,100,120cm
Valid wall widths: 20,25,27,30,35,40,45,50,55,60,65,75,80,90,100,120cm
Valid tall widths: 27,30,45,55,60,75,80,90,120cm
Base height: ${intake.baseUnitHeight || 76}cm

SKU PREFIXES: U=base, US=sink base, UE=corner base, DT=drawer base, O=wall unit, OR=wall flap, H=tall, HS=tall appliance, HSP=fridge housing, HG=larder, AH=appliance housing
FORMAT: PREFIX WIDTH-HEIGHT-VARIANT (e.g. U 60-76-01)

Output ONLY valid JSON. No markdown, no explanation.`;

    const userMsg = `Analyze these drawings. Room: ${intake.roomWidth}x${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm.
Walls:\n${wallSummary}
${intake.notes ? `Notes: ${intake.notes}` : ''}

Output JSON: {"walls":[{"label":"A","length_cm":340,"positions":[{"id":"A_1","type":"base_unit","skuSuggestion":"U 60-76-01","width_cm":60,"height_cm":76,"x_cm":0,"doorOrientation":"R","features":[],"confidence":0.85,"reasoning":"..."}],"dimensionCheck":{"totalCabinets_cm":340,"wallLength_cm":340,"gap_cm":0,"valid":true}}],"notes":[],"warnings":[]}

Every width MUST be valid ProLine width. Widths per wall should sum to ~wall length.`;

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
      return new Response('', { status: 200 });
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
      return new Response('', { status: 200 });
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
      return new Response('', { status: 200 });
    }

    // 7. Normalize
    if (!analysis.walls) analysis.walls = [];
    if (!analysis.notes) analysis.notes = [];
    if (!analysis.warnings) analysis.warnings = [];

    for (const wall of analysis.walls) {
      if (wall.dimension_check && !wall.dimensionCheck) {
        wall.dimensionCheck = wall.dimension_check;
        delete wall.dimension_check;
      }
      if (!wall.dimensionCheck) {
        const total = (wall.positions || []).reduce((s, p) => s + (p.width_cm || 0), 0);
        wall.dimensionCheck = { totalCabinets_cm: total, wallLength_cm: wall.length_cm || 0, gap_cm: (wall.length_cm || 0) - total, valid: Math.abs((wall.length_cm || 0) - total) <= 10 };
      }
      for (const pos of wall.positions || []) {
        if (pos.sku_suggestion && !pos.skuSuggestion) { pos.skuSuggestion = pos.sku_suggestion; delete pos.sku_suggestion; }
        if (pos.door_orientation && !pos.doorOrientation) { pos.doorOrientation = pos.door_orientation; delete pos.door_orientation; }
        pos.wallLabel = wall.label;
      }
    }

    // 8. Store successful result
    await storeResult(supabase, jobId, analysis);

    // 9. Clean up the request payload
    await supabase.storage.from('project-files').remove([`analysis-jobs/${jobId}/request.json`]);

    return new Response('', { status: 200 });

  } catch (err) {
    console.error('process-analysis-background error:', err);
    if (jobId) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await storeResult(supabase, jobId, { error: err.message || 'Background processing failed' });
      } catch {}
    }
    return new Response('', { status: 200 });
  }
};

async function storeResult(supabase, jobId, result) {
  const { error } = await supabase.storage
    .from('project-files')
    .upload(`analysis-jobs/${jobId}/result.json`, JSON.stringify(result), {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) console.error('Failed to store result:', error);
}
