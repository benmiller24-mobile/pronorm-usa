import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured.' }, 500);
    }

    const body = await req.json();
    const { imageUrls, intake, catalogSummary } = body;

    if (!imageUrls || !imageUrls.length) {
      return jsonResponse({ error: 'No images provided' }, 400);
    }

    // 2. Generate job ID and store the request payload in Supabase storage
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

    // 3. Trigger the background worker
    const siteUrl = process.env.URL || `https://${process.env.DEPLOY_PRIME_URL || 'pronormusawebsite.netlify.app'}`;
    fetch(`${siteUrl}/.netlify/functions/process-analysis-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch(err => console.error('Failed to trigger background worker:', err));

    // 4. Return the job ID immediately
    return jsonResponse({ jobId, status: 'processing' });

  } catch (err) {
    console.error('analyze-drawing error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
};
