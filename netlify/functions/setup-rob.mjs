export default async (req) => {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }
  const headers = {
    'Content-Type': 'application/json',
    'apikey': serviceRoleKey,
    'Authorization': 'Bearer ' + serviceRoleKey
  };
  // List users to find Rob
  const listResp = await fetch(supabaseUrl + '/auth/v1/admin/users?page=1&per_page=500', { headers });
  const listData = await listResp.json();
  const existingUser = listData?.users?.find(u => u.email === 'rob.kooijman@pronorm.de');
  let userId;
  if (existingUser) {
    // Update user via REST API
    const updateResp = await fetch(supabaseUrl + '/auth/v1/admin/users/' + existingUser.id, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password: 'Pronorm2026', email_confirm: true })
    });
    const updateData = await updateResp.json();
    if (!updateResp.ok) return new Response(JSON.stringify({ error: updateData, step: 'update' }), { status: 500 });
    userId = existingUser.id;
  } else {
    // Create user via REST API
    const createResp = await fetch(supabaseUrl + '/auth/v1/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'rob.kooijman@pronorm.de', password: 'Pronorm2026', email_confirm: true })
    });
    const createData = await createResp.json();
    if (!createResp.ok) return new Response(JSON.stringify({ error: createData, step: 'create' }), { status: 500 });
    userId = createData.id;
  }
  // Check for dealer record via PostgREST
  const dealerResp = await fetch(supabaseUrl + '/rest/v1/dealers?user_id=eq.' + userId + '&select=*', {
    headers: { ...headers, 'Prefer': 'return=representation' }
  });
  const dealers = await dealerResp.json();
  if (!dealers || dealers.length === 0) {
    const insertResp = await fetch(supabaseUrl + '/rest/v1/dealers', {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        company_name: 'Pronorm GmbH',
        contact_name: 'Rob Kooijman',
        email: 'rob.kooijman@pronorm.de',
        role: 'admin'
      })
    });
    if (!insertResp.ok) {
      const err = await insertResp.text();
      return new Response(JSON.stringify({ error: err, step: 'dealer_insert', userId }), { status: 500 });
    }
  }
  return new Response(JSON.stringify({ success: true, userId, action: existingUser ? 'updated' : 'created' }));
};

export const config = { path: '/api/setup-rob' };
