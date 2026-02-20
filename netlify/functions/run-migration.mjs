import pg from 'pg';
const { Client } = pg;

export const handler = async function(event) {
  if (event.queryStringParameters?.secret !== 'pronorm-migrate-2026') {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const dbpass = event.queryStringParameters?.dbpass || process.env.SUPABASE_DB_PASSWORD;
  if (!dbpass) {
    return { statusCode: 400, body: JSON.stringify({ error: 'dbpass parameter required' }) };
  }

  const ref = 'zsbzyazabqtjamhzqqxn';
  const hosts = [
    { host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres' },
    { host: `aws-0-us-west-1.pooler.supabase.com`, port: 6543, user: `postgres.${ref}` },
    { host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, user: `postgres.${ref}` },
    { host: `aws-0-us-west-2.pooler.supabase.com`, port: 6543, user: `postgres.${ref}` },
  ];

  let client;
  let connected = false;
  const steps = [];

  for (const h of hosts) {
    try {
      client = new Client({
        host: h.host, port: h.port, database: 'postgres',
        user: h.user, password: dbpass,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      await client.connect();
      connected = true;
      steps.push('Connected via ' + h.host);
      break;
    } catch (e) {
      steps.push(h.host + ': ' + e.message);
      try { await client.end(); } catch {}
    }
  }

  if (!connected) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Could not connect', steps }, null, 2) };
  }

  try {
    // 1. Add designer to enum
    const typeCheck = await client.query("SELECT 1 FROM pg_type WHERE typname = 'dealer_role'");
    if (typeCheck.rows.length === 0) {
      await client.query("CREATE TYPE dealer_role AS ENUM ('dealer', 'admin', 'designer')");
      steps.push('Created dealer_role enum');
    } else {
      const valCheck = await client.query("SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dealer_role') AND enumlabel = 'designer'");
      if (valCheck.rows.length === 0) {
        await client.query("ALTER TYPE dealer_role ADD VALUE IF NOT EXISTS 'designer'");
        steps.push('Added designer to enum');
      } else { steps.push('designer value exists'); }
    }

    // 2. Add parent_dealer_id column
    const colCheck = await client.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'dealers' AND column_name = 'parent_dealer_id'");
    if (colCheck.rows.length === 0) {
      await client.query("ALTER TABLE dealers ADD COLUMN parent_dealer_id uuid REFERENCES dealers(id) ON DELETE SET NULL DEFAULT NULL");
      steps.push('Added parent_dealer_id column');
    } else { steps.push('parent_dealer_id exists'); }

    // 3. Drop old check constraint
    try { await client.query("ALTER TABLE dealers DROP CONSTRAINT IF EXISTS dealers_role_check"); steps.push('Dropped check constraint'); } catch (e) { steps.push('No check constraint'); }

    // 4. Drop old + new policies (idempotent)
    const policyDrops = [
      ['Projects: read own','projects'],['Projects: insert own','projects'],['Projects: update own','projects'],
      ['Projects: elevated read all','projects'],['Projects: elevated update all','projects'],
      ['Project files: read own','project_files'],['Project files: insert own','project_files'],
      ['Project files: elevated read all','project_files'],['Project files: elevated insert all','project_files'],
      ['Orders: read own','orders'],['Orders: update own','orders'],
      ['Orders: admin read all','orders'],['Orders: admin update all','orders'],
      ['Order files: read own','order_files'],['Order files: insert own','order_files'],
      ['Order files: admin read all','order_files'],['Order files: admin insert all','order_files'],
      ['Order updates: read own','order_status_updates'],['Order updates: admin read all','order_status_updates'],
      ['Warranty: read own','warranty_claims'],['Warranty: insert own','warranty_claims'],['Warranty: admin read all','warranty_claims'],
      ['Warranty files: read own','warranty_files'],['Warranty files: insert own','warranty_files'],['Warranty files: admin read all','warranty_files'],
      ['Projects: read accessible','projects'],['Projects: insert accessible','projects'],['Projects: update accessible','projects'],
      ['Project files: read accessible','project_files'],['Project files: insert accessible','project_files'],
      ['Orders: read accessible','orders'],['Orders: update accessible','orders'],
      ['Order files: read accessible','order_files'],['Order files: insert accessible','order_files'],
      ['Order updates: read accessible','order_status_updates'],
      ['Warranty: read accessible','warranty_claims'],['Warranty: insert accessible','warranty_claims'],
      ['Warranty files: read accessible','warranty_files'],['Warranty files: insert accessible','warranty_files'],
    ];
    for (const [name, table] of policyDrops) {
      try { await client.query(`DROP POLICY IF EXISTS "${name}" ON ${table}`); } catch {}
    }
    steps.push('Old policies dropped');

    // 5. Create unified RLS policies
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects','project_files','orders','order_files','order_status_updates','warranty_claims','warranty_files')");
    const existing = tablesRes.rows.map(r => r.table_name);
    steps.push('Tables: ' + existing.join(', '));

    if (existing.includes('projects')) {
      const c = `EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND (d.role = 'admin' OR d.id = projects.dealer_id OR d.parent_dealer_id = projects.dealer_id))`;
      await client.query(`CREATE POLICY "Projects: read accessible" ON projects FOR SELECT USING (${c})`);
      await client.query(`CREATE POLICY "Projects: insert accessible" ON projects FOR INSERT WITH CHECK (${c})`);
      await client.query(`CREATE POLICY "Projects: update accessible" ON projects FOR UPDATE USING (${c})`);
      steps.push('Projects policies OK');
    }
    if (existing.includes('project_files')) {
      const c = `EXISTS (SELECT 1 FROM projects p JOIN dealers d ON d.user_id = auth.uid() WHERE p.id = project_files.project_id AND (d.role = 'admin' OR d.id = p.dealer_id OR d.parent_dealer_id = p.dealer_id))`;
      await client.query(`CREATE POLICY "Project files: read accessible" ON project_files FOR SELECT USING (${c})`);
      await client.query(`CREATE POLICY "Project files: insert accessible" ON project_files FOR INSERT WITH CHECK (${c})`);
      steps.push('Project files policies OK');
    }
    if (existing.includes('orders')) {
      const c = `EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND (d.role = 'admin' OR d.id = orders.dealer_id OR d.parent_dealer_id = orders.dealer_id))`;
      await client.query(`CREATE POLICY "Orders: read accessible" ON orders FOR SELECT USING (${c})`);
      await client.query(`CREATE POLICY "Orders: update accessible" ON orders FOR UPDATE USING (${c})`);
      steps.push('Orders policies OK');
    }
    if (existing.includes('order_files')) {
      const c = `EXISTS (SELECT 1 FROM orders o JOIN dealers d ON d.user_id = auth.uid() WHERE o.id = order_files.order_id AND (d.role = 'admin' OR d.id = o.dealer_id OR d.parent_dealer_id = o.dealer_id))`;
      await client.query(`CREATE POLICY "Order files: read accessible" ON order_files FOR SELECT USING (${c})`);
      await client.query(`CREATE POLICY "Order files: insert accessible" ON order_files FOR INSERT WITH CHECK (${c})`);
      steps.push('Order files policies OK');
    }
    if (existing.includes('order_status_updates')) {
      const c = `EXISTS (SELECT 1 FROM orders o JOIN dealers d ON d.user_id = auth.uid() WHERE o.id = order_status_updates.order_id AND (d.role = 'admin' OR d.id = o.dealer_id OR d.parent_dealer_id = o.dealer_id))`;
      await client.query(`CREATE POLICY "Order updates: read accessible" ON order_status_updates FOR SELECT USING (${c})`);
      steps.push('Order updates policy OK');
    }
    if (existing.includes('warranty_claims')) {
      const c = `EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND (d.role = 'admin' OR d.id = warranty_claims.dealer_id OR d.parent_dealer_id = warranty_claims.dealer_id))`;
      await client.query(`CREATE POLICY "Warranty: read accessible" ON warranty_claims FOR SELECT USING (${c})`);
      await client.query(`CREATE POLICY "Warranty: insert accessible" ON warranty_claims FOR INSERT WITH CHECK (${c})`);
      steps.push('Warranty policies OK');
    }
    if (existing.includes('warranty_files')) {
      const c = `EXISTS (SELECT 1 FROM warranty_claims w JOIN dealers d ON d.user_id = auth.uid() WHERE w.id = warranty_files.warranty_id AND (d.role = 'admin' OR d.id = w.dealer_id OR d.parent_dealer_id = w.dealer_id))`;
      await client.query(`CREATE POLICY "Warranty files: read accessible" ON warranty_files FOR SELECT USING (${c})`);
      await client.query(`CREATE POLICY "Warranty files: insert accessible" ON warranty_files FOR INSERT WITH CHECK (${c})`);
      steps.push('Warranty files policies OK');
    }

    // 6. Update designer record
    const dealerRow = await client.query("SELECT id FROM dealers WHERE email = 'dealer@pronormusa.com'");
    const designerRow = await client.query("SELECT id FROM dealers WHERE email = 'designer@pronormusa.com'");
    if (dealerRow.rows.length && designerRow.rows.length) {
      await client.query("UPDATE dealers SET role = 'designer', parent_dealer_id = $1 WHERE email = 'designer@pronormusa.com'", [dealerRow.rows[0].id]);
      steps.push('Designer linked to parent dealer');
    }

    const final = await client.query("SELECT id, email, role, parent_dealer_id FROM dealers ORDER BY created_at");
    await client.end();

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: 'Migration complete!', steps, dealers: final.rows }, null, 2) };
  } catch (err) {
    try { await client.end(); } catch {}
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message, steps, stack: err.stack }, null, 2) };
  }
};
