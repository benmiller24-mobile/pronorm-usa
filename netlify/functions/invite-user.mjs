import { createClient } from '@supabase/supabase-js';

export const handler = async function (event) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Server misconfigured — missing Supabase credentials' }),
    };
  }

  // Verify the caller's JWT
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing authorization token' }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify the caller is a valid user
  const anonClient = createClient(supabaseUrl, process.env.PUBLIC_SUPABASE_ANON_KEY || serviceRoleKey);
  const { data: { user: callerUser }, error: authErr } = await anonClient.auth.getUser(token);

  if (authErr || !callerUser) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Look up the caller's dealer record
  const { data: callerDealer, error: callerErr } = await supabaseAdmin
    .from('dealers').select('*').eq('user_id', callerUser.id).single();

  if (callerErr || !callerDealer) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Caller has no dealer profile' }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { email, password, contact_name, phone, address, company_name, role } = body;

  // Validate required fields
  if (!email || !password || !contact_name) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'email, password, and contact_name are required' }),
    };
  }

  if (password.length < 8) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
  }

  // Authorization rules
  if (role === 'dealer') {
    // Only admins can invite dealers
    if (callerDealer.role !== 'admin') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only admins can invite dealers' }) };
    }
    if (!company_name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'company_name is required for dealers' }) };
    }
  } else if (role === 'designer') {
    // Admins and dealers can invite designers
    if (callerDealer.role !== 'admin' && callerDealer.role !== 'dealer') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only admins and dealers can invite designers' }) };
    }
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'role must be "dealer" or "designer"' }) };
  }

  // Determine parent_dealer_id for designers
  let parent_dealer_id = null;
  if (role === 'designer') {
    if (body.parent_dealer_id) {
      // Admin is inviting on behalf of a dealer
      parent_dealer_id = body.parent_dealer_id;
    } else if (callerDealer.role === 'dealer') {
      // Dealer is inviting their own designer
      parent_dealer_id = callerDealer.id;
    } else {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: 'parent_dealer_id is required when admin invites a designer' }),
      };
    }
  }

  try {
    // 1. Create auth user
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Auto-confirm the email
    });

    if (createErr) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: `Failed to create user: ${createErr.message}` }),
      };
    }

    // 2. Insert dealer record
    const dealerRecord = {
      user_id: newUser.user.id,
      email: email.trim().toLowerCase(),
      company_name: role === 'designer'
        ? (company_name || callerDealer.company_name)
        : company_name.trim(),
      contact_name: contact_name.trim(),
      phone: (phone || '').trim(),
      address: role === 'designer'
        ? (address || callerDealer.address || '')
        : (address || '').trim(),
      role,
      parent_dealer_id,
    };

    const { data: newDealer, error: insertErr } = await supabaseAdmin
      .from('dealers').insert(dealerRecord).select().single();

    if (insertErr) {
      // Clean up: delete the auth user if dealer insert fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: `Failed to create dealer record: ${insertErr.message}` }),
      };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        message: `${role === 'dealer' ? 'Dealer' : 'Designer'} account created successfully`,
        dealer: newDealer,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: `Unexpected error: ${err.message}` }),
    };
  }
};
