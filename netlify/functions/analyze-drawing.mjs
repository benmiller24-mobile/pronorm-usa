import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async (req, context) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanKey = anthropicKey.trim();

    // 2. Parse request
    const body = await req.json();
    const { imageUrls, intake, catalogSummary } = body;

    if (!imageUrls || !imageUrls.length) {
      return new Response(JSON.stringify({ error: 'No images provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch images as base64
    const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    function detectMimeType(url, headerType) {
      // If the header gives a valid type, use it
      if (headerType && VALID_MIME_TYPES.includes(headerType)) return headerType;
      // Try to detect from URL/filename
      const urlLower = (url || '').toLowerCase().split('?')[0];
      if (urlLower.endsWith('.png')) return 'image/png';
      if (urlLower.endsWith('.gif')) return 'image/gif';
      if (urlLower.endsWith('.webp')) return 'image/webp';
      if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) return 'image/jpeg';
      // Default to jpeg
      return 'image/jpeg';
    }

    const imageContents = [];
    for (const imgInfo of imageUrls) {
      try {
        const resp = await fetch(imgInfo.url);
        const buffer = await resp.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const headerType = resp.headers.get('content-type')?.split(';')[0]?.trim();
        const mimeType = detectMimeType(imgInfo.url, headerType);
        // Skip PDFs — Claude Vision only accepts images
        if (headerType === 'application/pdf') {
          console.warn(`Skipping PDF file: ${imgInfo.url}`);
          continue;
        }
        imageContents.push({ base64, mimeType, category: imgInfo.category, wallLabel: imgInfo.wallLabel });
      } catch (e) {
        console.error(`Failed to fetch image: ${imgInfo.url}`, e);
      }
    }

    if (imageContents.length === 0) {
      return new Response(JSON.stringify({ error: 'Could not fetch any images' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Build the AI prompt
    const wallSummary = (intake.walls || []).map(w => {
      let desc = `Wall ${w.label}: ${w.length}cm`;
      if (w.hasWindow) desc += `, window ${w.windowWidth || '?'}cm wide at sill height ${w.windowSillHeight || '?'}cm`;
      if (w.hasDoor) desc += `, door ${w.doorWidth || '?'}cm wide`;
      if (w.notes) desc += ` (${w.notes})`;
      return desc;
    }).join('\n');

    const systemPrompt = `You are an expert kitchen designer analyzing cabinet drawings for Pronorm ProLine kitchens.
Your task is to identify every cabinet position from the uploaded drawings and map them to ProLine SKU patterns.

CRITICAL RULES:
- All dimensions are in CENTIMETERS
- ProLine dimensions use cm codes: width 60 = 600mm, height 76 = 768mm
- Valid base unit widths: 15, 20, 27, 30, 40, 45, 50, 55, 60, 75, 80, 90, 100, 120cm
- Valid wall unit widths: 20, 25, 27, 30, 35, 40, 45, 50, 55, 60, 65, 75, 80, 90, 100, 120cm
- Valid tall unit widths: 27, 30, 45, 55, 60, 75, 80, 90, 120cm
- Base unit heights: ${intake.baseUnitHeight || 76}cm (${intake.baseUnitHeight === 85 ? '852mm' : '768mm'})

SKU PREFIX GUIDE:
- U = Standard base unit, US = Sink base, UE = Corner base, UG = Base with fittings
- DT = Worktop/drawer base
- O = Standard wall unit, OR = Wall flap door, OG = Wall with fittings
- H = Standard tall, HS = Tall appliance housing, HSP = Tall fridge/freezer
- HG = Tall larder, HGP = Tall larder pull-outs, AH = Appliance housing

SKU FORMAT: PREFIX WIDTH-HEIGHT-VARIANT (e.g., U 60-76-01, HS 60-195-527)

You MUST output valid JSON only. No markdown, no explanation outside the JSON.`;

    const userMessage = `Analyze these kitchen drawings and identify every cabinet position.

ROOM: ${intake.roomWidth}cm x ${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm
Base unit height: ${intake.baseUnitHeight}cm

WALLS:
${wallSummary}
${intake.notes ? `NOTES: ${intake.notes}` : ''}

CATALOG WIDTHS: ${JSON.stringify(catalogSummary?.categories || {}, null, 0).slice(0, 6000)}

Output this EXACT JSON:
{
  "walls": [
    {
      "label": "A",
      "length_cm": 340,
      "positions": [
        {
          "id": "A_1",
          "type": "tall_unit",
          "skuSuggestion": "HS 60-195-527",
          "width_cm": 60,
          "height_cm": 195,
          "x_cm": 0,
          "doorOrientation": "R",
          "features": ["appliance housing"],
          "confidence": 0.85,
          "reasoning": "Tall unit at left edge"
        }
      ],
      "dimensionCheck": { "totalCabinets_cm": 340, "wallLength_cm": 340, "gap_cm": 0, "valid": true }
    }
  ],
  "notes": [],
  "warnings": []
}

RULES:
- Every width MUST be a valid ProLine width
- Widths on each wall should sum to ~wall length
- Set confidence 0-1 based on drawing clarity
- Include reasoning for each position`;

    // Build image content blocks
    const contentBlocks = [];
    const floorplan = imageContents.find(i => i.category === 'floorplan');
    if (floorplan) {
      contentBlocks.push({ type: 'text', text: 'FLOOR PLAN:' });
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: floorplan.mimeType, data: floorplan.base64 } });
    }
    const elevations = imageContents.filter(i => i.category === 'elevation');
    for (const elev of elevations) {
      contentBlocks.push({ type: 'text', text: `ELEVATION - Wall ${elev.wallLabel}:` });
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: elev.mimeType, data: elev.base64 } });
    }
    contentBlocks.push({ type: 'text', text: userMessage });

    // 5. Call Claude Vision API with STREAMING to avoid inactivity timeout
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errBody);
      return new Response(JSON.stringify({
        error: `Claude API error: ${claudeResponse.status}`,
        detail: errBody.slice(0, 500),
        keyPrefix: cleanKey.slice(0, 10) + '...',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Stream the response — collect text and forward SSE events to keep connection alive
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = '';
          const reader = claudeResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                // Extract text deltas
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  fullText += event.delta.text;
                  // Send a keepalive progress event to the client
                  controller.enqueue(encoder.encode(`data: {"type":"progress","chars":${fullText.length}}\n\n`));
                }

                // Message complete
                if (event.type === 'message_stop') {
                  // Parse and normalize the result
                  let jsonStr = fullText.trim();
                  if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                  }

                  let analysis;
                  try {
                    analysis = JSON.parse(jsonStr);
                  } catch (parseErr) {
                    controller.enqueue(encoder.encode(`data: {"type":"error","error":"Failed to parse AI response","raw":${JSON.stringify(jsonStr.slice(0, 1000))}}\n\n`));
                    controller.close();
                    return;
                  }

                  // Normalize structure
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
                      wall.dimensionCheck = {
                        totalCabinets_cm: total,
                        wallLength_cm: wall.length_cm || 0,
                        gap_cm: (wall.length_cm || 0) - total,
                        valid: Math.abs((wall.length_cm || 0) - total) <= 10,
                      };
                    }
                    for (const pos of wall.positions || []) {
                      if (pos.sku_suggestion && !pos.skuSuggestion) {
                        pos.skuSuggestion = pos.sku_suggestion;
                        delete pos.sku_suggestion;
                      }
                      if (pos.door_orientation && !pos.doorOrientation) {
                        pos.doorOrientation = pos.door_orientation;
                        delete pos.door_orientation;
                      }
                      pos.wallLabel = wall.label;
                    }
                  }

                  // Send final result
                  controller.enqueue(encoder.encode(`data: {"type":"result","data":${JSON.stringify(analysis)}}\n\n`));
                }
              } catch (e) {
                // Skip unparseable SSE lines
              }
            }
          }

          // If we got text but no message_stop event, try to parse what we have
          if (fullText && !fullText.includes('"message_stop"')) {
            let jsonStr = fullText.trim();
            if (jsonStr.startsWith('```')) {
              jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            try {
              const analysis = JSON.parse(jsonStr);
              if (!analysis.walls) analysis.walls = [];
              if (!analysis.notes) analysis.notes = [];
              if (!analysis.warnings) analysis.warnings = [];
              controller.enqueue(encoder.encode(`data: {"type":"result","data":${JSON.stringify(analysis)}}\n\n`));
            } catch (e) {
              controller.enqueue(encoder.encode(`data: {"type":"error","error":"Incomplete response from AI"}\n\n`));
            }
          }

          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: {"type":"error","error":${JSON.stringify(err.message)}}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err) {
    console.error('analyze-drawing error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
