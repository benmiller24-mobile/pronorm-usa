import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { email, company_name } = await req.json();
    if (!email || !company_name) {
      return new Response(JSON.stringify({ error: 'email and company_name required' }), { status: 400 });
    }

    const supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('dealers')
      .update({ company_name })
      .eq('email', email)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, updated: data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const config = { path: '/.netlify/functions/update-dealer' };
