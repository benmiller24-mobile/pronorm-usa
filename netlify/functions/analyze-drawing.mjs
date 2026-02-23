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
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Add it in Netlify dashboard → Site settings → Environment variables.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trim any whitespace that may have been pasted with the key
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
    const imageContents = [];
    for (const imgInfo of imageUrls) {
      try {
        const resp = await fetch(imgInfo.url);
        const buffer = await resp.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = resp.headers.get('content-type') || 'image/jpeg';
        imageContents.push({
          base64,
          mimeType,
          category: imgInfo.category,
          wallLabel: imgInfo.wallLabel,
        });
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
- U = Standard base unit
- US = Sink base unit
- UE = Corner base unit
- UG = Base with internal fittings
- DT = Worktop/drawer base unit
- O = Standard wall unit
- OR = Wall unit with flap door
- OG = Wall with internal fittings
- H = Standard tall unit
- HS = Tall appliance housing
- HSP = Tall fridge/freezer housing
- HG = Tall larder unit
- HGP = Tall larder with pull-outs
- AH = Appliance housing unit

SKU FORMAT: PREFIX WIDTH-HEIGHT-VARIANT (e.g., U 60-76-01, HS 60-195-527)

You MUST output valid JSON only. No markdown, no explanation outside the JSON.`;

    const userMessage = `Analyze these kitchen drawings and identify every cabinet position.

ROOM INFORMATION:
- Room: ${intake.roomWidth}cm × ${intake.roomDepth}cm, ceiling ${intake.ceilingHeight}cm
- Product line: ProLine
- Base unit height code: ${intake.baseUnitHeight}cm

WALL DEFINITIONS:
${wallSummary}

${intake.notes ? `DESIGNER NOTES: ${intake.notes}` : ''}

CATALOG REFERENCE (ProLine available widths and SKU prefixes):
${JSON.stringify(catalogSummary?.categories || {}, null, 0).slice(0, 8000)}

For each wall, identify every cabinet position and output this EXACT JSON structure:
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
          "features": ["appliance housing", "oven"],
          "confidence": 0.85,
          "reasoning": "Tall unit at left edge, appears to house an oven"
        }
      ],
      "dimensionCheck": {
        "totalCabinets_cm": 340,
        "wallLength_cm": 340,
        "gap_cm": 0,
        "valid": true
      }
    }
  ],
  "notes": ["Wall B appears to have no cabinets - just a doorway"],
  "warnings": ["Could not clearly see Wall C elevation - using floor plan only"]
}

IMPORTANT:
- Every cabinet width MUST be a valid ProLine width from the list above
- Cabinet widths on each wall should approximately sum to the wall length
- If there's a gap, note it in the dimensionCheck
- Be specific about door orientation (L, R, LR, or none for drawers)
- Set confidence 0-1 based on how clear the drawing is for that position
- Include reasoning for each position to help the designer verify`;

    // Build image content blocks for Claude
    const contentBlocks = [];

    // Add floor plan first
    const floorplan = imageContents.find(i => i.category === 'floorplan');
    if (floorplan) {
      contentBlocks.push({
        type: 'text',
        text: 'FLOOR PLAN:',
      });
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: floorplan.mimeType,
          data: floorplan.base64,
        },
      });
    }

    // Add elevation images
    const elevations = imageContents.filter(i => i.category === 'elevation');
    for (const elev of elevations) {
      contentBlocks.push({
        type: 'text',
        text: `ELEVATION - Wall ${elev.wallLabel}:`,
      });
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: elev.mimeType,
          data: elev.base64,
        },
      });
    }

    // Add the text prompt after images
    contentBlocks.push({
      type: 'text',
      text: userMessage,
    });

    // 5. Call Claude Vision API
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
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errBody);
      const keyPrefix = cleanKey.slice(0, 10) + '...';
      return new Response(JSON.stringify({
        error: `Claude API error: ${claudeResponse.status}`,
        detail: errBody.slice(0, 500),
        keyPrefix,
        hint: claudeResponse.status === 401
          ? 'The API key was rejected. Check: (1) no extra whitespace in Netlify env var, (2) key starts with "sk-ant-", (3) key is active at console.anthropic.com'
          : undefined,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claudeResult = await claudeResponse.json();
    const textContent = claudeResult.content?.find(c => c.type === 'text');
    if (!textContent) {
      return new Response(JSON.stringify({ error: 'No text response from Claude' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Parse the JSON response
    let analysis;
    try {
      // Claude might wrap in markdown code blocks
      let jsonStr = textContent.text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', textContent.text.slice(0, 500));
      return new Response(JSON.stringify({
        error: 'Failed to parse AI response',
        rawResponse: textContent.text.slice(0, 2000),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Ensure required structure
    if (!analysis.walls) analysis.walls = [];
    if (!analysis.notes) analysis.notes = [];
    if (!analysis.warnings) analysis.warnings = [];

    // Normalize field names (camelCase)
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
        // Ensure wallLabel is set on each position
        pos.wallLabel = wall.label;
      }
    }

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('analyze-drawing error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
