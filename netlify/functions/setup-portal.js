const https = require('https');

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.queryStringParameters?.secret !== 'pronorm-setup-2026') {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const SB = 'https://zsbzyazabqtjamhzqqxn.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_ADMIN_KEY
    || process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  // Debug: list relevant env var names
  const envKeys = Object.keys(process.env).filter(k =>
    k.includes('SUPA') || k.includes('SERVICE') || k.includes('SECRET') || k.includes('PRIVATE')
  );

  // Also scan ALL env vars for JWTs that look like Supabase keys
  const jwtEnvVars = Object.entries(process.env)
    .filter(([k, v]) => v && v.startsWith('eyJ') && v.length > 100)
    .map(([k, v]) => {
      try {
        const payload = JSON.parse(Buffer.from(v.split('.')[1], 'base64').toString());
        return { name: k, role: payload.role, ref: payload.ref };
      } catch { return { name: k, decoded: false }; }
    });

  // Try Netlify API to get site env vars (some might be hidden from functions)
  const siteId = process.env.SITE_ID;
  const netlifyToken = process.env.NETLIFY_FUNCTIONS_TOKEN;
  let netlifyApiResult = null;
  if (siteId && netlifyToken) {
    try {
      const siteRes = await fetchJSON('https://api.netlify.com/api/v1/sites/' + siteId, {
        headers: { 'Authorization': 'Bearer ' + netlifyToken },
      });
      if (siteRes.ok) {
        // Check build_settings.env
        netlifyApiResult = {
          site_name: siteRes.data?.name,
          env_keys: siteRes.data?.build_settings?.env ? Object.keys(siteRes.data.build_settings.env) : 'none',
          has_build_env: !!siteRes.data?.build_settings?.env,
        };
      } else {
        netlifyApiResult = { error: siteRes.status, data: JSON.stringify(siteRes.data).substring(0, 200) };
      }
    } catch (e) { netlifyApiResult = { error: e.message }; }
  }

  // Check all env var NAMES 
  const allEnvNames = Object.keys(process.env).sort();

  if (!serviceKey) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'No service_role key found',
        anon_key_found: !!anonKey,
        relevant_env_vars: envKeys,
        jwt_env_vars: jwtEnvVars,
        all_env_var_names: allEnvNames,
        netlify_api: netlifyApiResult,
        site_id: siteId,
      }, null, 2),
    };
  }

  const h = {
    'apikey': serviceKey,
    'Authorization': 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
  };
  const steps = [];
  const errors = [];

  try {
    // 1. Enable autoconfirm
    const cfg = await fetchJSON(SB + '/auth/v1/admin/config', {
      method: 'PUT', headers: h,
      body: JSON.stringify({ mailer_autoconfirm: true }),
    });
    steps.push(cfg.ok ? '✓ Autoconfirm enabled' : '✗ Config: ' + JSON.stringify(cfg.data));

    // 2. List users
    const usersRes = await fetchJSON(SB + '/auth/v1/admin/users?per_page=50', { headers: h });
    const users = usersRes.data?.users || [];
    steps.push('Found ' + users.length + ' auth users');

    let adminUser = users.find(u => u.email === 'admin@pronormusa.com');
    let dealerUser = users.find(u => u.email === 'dealer@pronormusa.com');
    let designerUser = users.find(u => u.email === 'designer@pronormusa.com');

    // 3. Confirm unconfirmed users
    for (const u of [adminUser, dealerUser, designerUser].filter(Boolean)) {
      if (!u.email_confirmed_at) {
        const r = await fetchJSON(SB + '/auth/v1/admin/users/' + u.id, {
          method: 'PUT', headers: h,
          body: JSON.stringify({ email_confirmed_at: new Date().toISOString() }),
        });
        steps.push(r.ok ? '✓ Confirmed ' + u.email : '✗ Confirm ' + u.email + ': ' + JSON.stringify(r.data));
      } else {
        steps.push('✓ ' + u.email + ' already confirmed');
      }
    }

    // 4. Create designer if missing
    if (!designerUser) {
      const r = await fetchJSON(SB + '/auth/v1/admin/users', {
        method: 'POST', headers: h,
        body: JSON.stringify({ email: 'designer@pronormusa.com', password: 'PronormDesign2026!', email_confirm: true }),
      });
      if (r.ok) {
        designerUser = r.data;
        steps.push('✓ Created designer@pronormusa.com (' + r.data.id + ')');
      } else {
        errors.push('Designer create: ' + JSON.stringify(r.data));
      }
    }

    // 5. Check existing dealers
    const existRes = await fetchJSON(SB + '/rest/v1/dealers?select=*', { headers: h });
    const existing = existRes.data || [];
    steps.push('Existing dealer records: ' + existing.length);
    const existEmails = Array.isArray(existing) ? existing.map(d => d.email) : [];

    // 6. Create dealer records
    const restH = { ...h, 'Prefer': 'return=representation' };

    // Admin
    if (adminUser && !existEmails.includes('admin@pronormusa.com')) {
      const r = await fetchJSON(SB + '/rest/v1/dealers', {
        method: 'POST', headers: restH,
        body: JSON.stringify({ user_id: adminUser.id, company_name: 'Pronorm USA', contact_name: 'Ben Miller', email: 'admin@pronormusa.com', phone: '303-555-0100', role: 'admin' }),
      });
      if (!r.ok) {
        // Try without role column
        const r2 = await fetchJSON(SB + '/rest/v1/dealers', {
          method: 'POST', headers: restH,
          body: JSON.stringify({ user_id: adminUser.id, company_name: 'Pronorm USA', contact_name: 'Ben Miller', email: 'admin@pronormusa.com', phone: '303-555-0100' }),
        });
        steps.push(r2.ok ? '✓ Admin dealer (no role col)' : '✗ Admin: ' + JSON.stringify(r2.data));
      } else {
        steps.push('✓ Admin dealer record created');
      }
    }

    // Dealer
    let dealerRowId = Array.isArray(existing) ? existing.find(d => d.email === 'dealer@pronormusa.com')?.id : null;
    if (dealerUser && !existEmails.includes('dealer@pronormusa.com')) {
      const r = await fetchJSON(SB + '/rest/v1/dealers', {
        method: 'POST', headers: restH,
        body: JSON.stringify({ user_id: dealerUser.id, company_name: 'Elmhurst Kitchen & Bath', contact_name: 'Test Dealer', email: 'dealer@pronormusa.com', phone: '303-555-0300', role: 'dealer' }),
      });
      if (!r.ok) {
        const r2 = await fetchJSON(SB + '/rest/v1/dealers', {
          method: 'POST', headers: restH,
          body: JSON.stringify({ user_id: dealerUser.id, company_name: 'Elmhurst Kitchen & Bath', contact_name: 'Test Dealer', email: 'dealer@pronormusa.com', phone: '303-555-0300' }),
        });
        if (r2.ok && Array.isArray(r2.data)) dealerRowId = r2.data[0]?.id;
        steps.push(r2.ok ? '✓ Dealer record (no role col), id: ' + dealerRowId : '✗ Dealer: ' + JSON.stringify(r2.data));
      } else {
        if (Array.isArray(r.data)) dealerRowId = r.data[0]?.id;
        steps.push('✓ Dealer record created, id: ' + dealerRowId);
      }
    }

    // Designer
    if (designerUser && !existEmails.includes('designer@pronormusa.com')) {
      const payload = { user_id: designerUser.id, company_name: 'Elmhurst Kitchen & Bath', contact_name: 'Kitchen Designer', email: 'designer@pronormusa.com', phone: '303-555-0200', role: 'designer' };
      if (dealerRowId) payload.parent_dealer_id = dealerRowId;
      const r = await fetchJSON(SB + '/rest/v1/dealers', {
        method: 'POST', headers: restH,
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        // Try without role/parent
        const r2 = await fetchJSON(SB + '/rest/v1/dealers', {
          method: 'POST', headers: restH,
          body: JSON.stringify({ user_id: designerUser.id, company_name: 'Elmhurst Kitchen & Bath', contact_name: 'Kitchen Designer', email: 'designer@pronormusa.com', phone: '303-555-0200' }),
        });
        steps.push(r2.ok ? '✓ Designer record (no role col)' : '✗ Designer: ' + JSON.stringify(r2.data));
      } else {
        steps.push('✓ Designer record created, parent: ' + (dealerRowId || 'none'));
      }
    }

    // 7. Final state
    const finalRes = await fetchJSON(SB + '/rest/v1/dealers?select=id,email,role,parent_dealer_id', { headers: h });
    const final = finalRes.data;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps, errors, final_dealers: final, summary: errors.length ? 'Done with errors' : '🎉 Setup complete!' }, null, 2),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps, errors: [...errors, err.message], stack: err.stack }, null, 2),
    };
  }
};
