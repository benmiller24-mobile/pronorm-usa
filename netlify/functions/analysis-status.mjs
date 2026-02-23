import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) return jsonResponse({ error: 'Missing jobId' }, 400);

  // Validate UUID format to prevent path traversal
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return jsonResponse({ error: 'Invalid jobId' }, 400);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Try to download the result file
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('project-files')
      .download(`analysis-jobs/${jobId}/result.json`);

    if (dlErr || !fileData) {
      // No result yet — still processing
      return jsonResponse({ status: 'processing' });
    }

    const result = JSON.parse(await fileData.text());

    // Check if it's an error result
    if (result.error) {
      // Clean up
      await supabase.storage.from('project-files').remove([
        `analysis-jobs/${jobId}/result.json`,
        `analysis-jobs/${jobId}/request.json`,
      ]);
      return jsonResponse({ status: 'error', error: result.error, detail: result.detail || null });
    }

    // Success — return the analysis result and clean up
    await supabase.storage.from('project-files').remove([
      `analysis-jobs/${jobId}/result.json`,
      `analysis-jobs/${jobId}/request.json`,
    ]);

    return jsonResponse({ status: 'complete', result });

  } catch (err) {
    console.error('analysis-status error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
};
