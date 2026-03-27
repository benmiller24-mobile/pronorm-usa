import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: listData } = await supabase.auth.admin.listUsers();
  const existingUser = listData?.users?.find(u => u.email === 'rob.kooijman@pronorm.de');
  let userId;
  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUser(existingUser.id, {
      password: 'Pronorm2026',
      email_confirm: true
    });
    if (error) return new Response(JSON.stringify({ error: error.message, step: 'update' }), { status: 500 });
    userId = existingUser.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'rob.kooijman@pronorm.de',
      password: 'Pronorm2026',
      email_confirm: true
    });
    if (error) return new Response(JSON.stringify({ error: error.message, step: 'create' }), { status: 500 });
    userId = data.user.id;
  }
  const { data: existingDealer } = await supabase.from('dealers').select('*').eq('user_id', userId).single();
  if (!existingDealer) {
    const { error: dealerError } = await supabase.from('dealers').insert({
      user_id: userId,
      company_name: 'Pronorm GmbH',
      contact_name: 'Rob Kooijman',
      email: 'rob.kooijman@pronorm.de',
      role: 'admin'
    });
    if (dealerError) return new Response(JSON.stringify({ error: dealerError.message, step: 'dealer_insert', userId }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true, userId, action: existingUser ? 'updated' : 'created' }));
};

export const config = { path: '/api/setup-rob' };
