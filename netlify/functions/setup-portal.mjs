// One-time setup function — DELETE AFTER USE
// Accesses the Supabase service_role key from Netlify env vars
// to confirm users, create dealer records, and set up the portal

export default async (request) => {
  // Simple protection
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (secret !== 'pronorm-setup-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
    || process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || 'https://zsbzyazabqtjamhzqqxn.supabase.co';

  // Try common env var names for the service role key
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_ADMIN_KEY
    || process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

  // Also grab the anon key for reference
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // List all env var NAMES (not values) containing SUPABASE for debugging
  const supabaseEnvVars = Object.keys(process.env)
    .filter(k => k.toLowerCase().includes('supabase'))
    .map(k => `${k} = ${k.toLowerCase().includes('service') || k.toLowerCase().includes('secret') ? '[REDACTED - exists]' : process.env[k]?.substring(0, 30) + '...'}`);

  if (!serviceRoleKey) {
    return new Response(JSON.stringify({
      error: 'No service_role key found in env vars',
      supabase_url: supabaseUrl,
      anon_key_found: !!anonKey,
      env_vars_found: supabaseEnvVars,
      all_env_keys: Object.keys(process.env).filter(k =>
        k.includes('SUPA') || k.includes('supa') || k.includes('SERVICE') || k.includes('SECRET') || k.includes('PRIVATE')
      ),
    }, null, 2), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const results = { steps: [], errors: [] };
  const headers = {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // Step 1: Disable email confirmation
    results.steps.push('Disabling email confirmation...');
    const configRes = await fetch(`${supabaseUrl}/auth/v1/admin/config`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ mailer_autoconfirm: true }),
    });
    const configData = await configRes.json();
    if (configRes.ok) {
      results.steps.push('✓ Email autoconfirm enabled');
    } else {
      results.errors.push(`Config update failed: ${JSON.stringify(configData)}`);
    }

    // Step 2: List existing auth users
    results.steps.push('Listing auth users...');
    const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=50`, { headers });
    const usersData = await usersRes.json();
    const users = usersData.users || [];
    results.steps.push(`Found ${users.length} auth users`);

    // Find our test users
    const adminUser = users.find(u => u.email === 'admin@pronormusa.com');
    const dealerUser = users.find(u => u.email === 'dealer@pronormusa.com');
    let designerUser = users.find(u => u.email === 'designer@pronormusa.com');

    // Step 3: Confirm existing unconfirmed users
    for (const user of [adminUser, dealerUser, designerUser].filter(Boolean)) {
      if (!user.email_confirmed_at) {
        results.steps.push(`Confirming ${user.email}...`);
        const confirmRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ email_confirmed_at: new Date().toISOString() }),
        });
        if (confirmRes.ok) {
          results.steps.push(`✓ ${user.email} confirmed`);
        } else {
          const err = await confirmRes.json();
          results.errors.push(`Failed to confirm ${user.email}: ${JSON.stringify(err)}`);
        }
      } else {
        results.steps.push(`✓ ${user.email} already confirmed`);
      }
    }

    // Step 4: Create designer user if doesn't exist (was rate limited earlier)
    if (!designerUser) {
      results.steps.push('Creating designer@pronormusa.com...');
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: 'designer@pronormusa.com',
          password: 'PronormDesign2026!',
          email_confirm: true,
        }),
      });
      const createData = await createRes.json();
      if (createRes.ok) {
        designerUser = createData;
        results.steps.push(`✓ designer@pronormusa.com created (${createData.id})`);
      } else {
        results.errors.push(`Failed to create designer: ${JSON.stringify(createData)}`);
      }
    }

    // Step 5: Check if dealers table has the role column
    results.steps.push('Checking dealers table schema...');
    const schemaRes = await fetch(`${supabaseUrl}/rest/v1/dealers?select=*&limit=0`, {
      headers: { ...headers, 'Prefer': 'count=exact' },
    });
    const schemaHeaders = Object.fromEntries(schemaRes.headers.entries());
    results.steps.push(`Dealers table accessible, count: ${schemaHeaders['content-range'] || 'unknown'}`);

    // Step 6: Create dealer records
    // First check if records already exist
    const existingRes = await fetch(`${supabaseUrl}/rest/v1/dealers?select=*`, { headers });
    const existing = await existingRes.json();
    results.steps.push(`Existing dealer records: ${existing.length}`);

    const existingEmails = existing.map(d => d.email);

    // Create admin dealer record
    if (adminUser && !existingEmails.includes('admin@pronormusa.com')) {
      results.steps.push('Creating admin dealer record...');
      const res = await fetch(`${supabaseUrl}/rest/v1/dealers`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: adminUser.id,
          company_name: 'Pronorm USA',
          contact_name: 'Ben Miller',
          email: 'admin@pronormusa.com',
          phone: '303-555-0100',
          role: 'admin',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        results.steps.push(`✓ Admin dealer record created (${data[0]?.id || 'ok'})`);
      } else {
        const err = await res.text();
        // Maybe role column doesn't exist yet — try without it
        results.errors.push(`Admin dealer failed: ${err}`);
        results.steps.push('Trying without role column...');
        const res2 = await fetch(`${supabaseUrl}/rest/v1/dealers`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            user_id: adminUser.id,
            company_name: 'Pronorm USA',
            contact_name: 'Ben Miller',
            email: 'admin@pronormusa.com',
            phone: '303-555-0100',
          }),
        });
        const data2 = await res2.text();
        results.steps.push(`Without role: ${res2.ok ? '✓ ok' : data2}`);
      }
    }

    // Create dealer record
    let dealerRowId = existing.find(d => d.email === 'dealer@pronormusa.com')?.id;
    if (dealerUser && !existingEmails.includes('dealer@pronormusa.com')) {
      results.steps.push('Creating dealer record...');
      const res = await fetch(`${supabaseUrl}/rest/v1/dealers`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: dealerUser.id,
          company_name: 'Elmhurst Kitchen & Bath',
          contact_name: 'Test Dealer',
          email: 'dealer@pronormusa.com',
          phone: '303-555-0300',
          role: 'dealer',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        dealerRowId = data[0]?.id;
        results.steps.push(`✓ Dealer record created (${dealerRowId})`);
      } else {
        const err = await res.text();
        results.errors.push(`Dealer record failed: ${err}`);
        // Try without role
        const res2 = await fetch(`${supabaseUrl}/rest/v1/dealers`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            user_id: dealerUser.id,
            company_name: 'Elmhurst Kitchen & Bath',
            contact_name: 'Test Dealer',
            email: 'dealer@pronormusa.com',
            phone: '303-555-0300',
          }),
        });
        if (res2.ok) {
          const data2 = await res2.json();
          dealerRowId = data2[0]?.id;
          results.steps.push(`✓ Dealer record created without role (${dealerRowId})`);
        }
      }
    }

    // Create designer record (linked to dealer)
    if (designerUser && !existingEmails.includes('designer@pronormusa.com')) {
      results.steps.push('Creating designer record...');
      const designerPayload = {
        user_id: designerUser.id,
        company_name: 'Elmhurst Kitchen & Bath',
        contact_name: 'Kitchen Designer',
        email: 'designer@pronormusa.com',
        phone: '303-555-0200',
        role: 'designer',
      };
      if (dealerRowId) {
        designerPayload.parent_dealer_id = dealerRowId;
      }
      const res = await fetch(`${supabaseUrl}/rest/v1/dealers`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(designerPayload),
      });
      if (res.ok) {
        const data = await res.json();
        results.steps.push(`✓ Designer record created (${data[0]?.id}), parent: ${dealerRowId || 'none'}`);
      } else {
        const err = await res.text();
        results.errors.push(`Designer record failed: ${err}`);
      }
    }

    // Step 7: Verify final state
    results.steps.push('Verifying final state...');
    const finalRes = await fetch(`${supabaseUrl}/rest/v1/dealers?select=id,email,role,parent_dealer_id`, { headers });
    const finalDealers = await finalRes.json();
    results.final_dealers = finalDealers;

  } catch (err) {
    results.errors.push(`Unexpected error: ${err.message}`);
  }

  results.summary = results.errors.length === 0
    ? '🎉 Setup complete! Test credentials should now work.'
    : `Completed with ${results.errors.length} error(s). Check details above.`;

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: "/.netlify/functions/setup-portal",
};
