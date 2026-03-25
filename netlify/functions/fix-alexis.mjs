import pg from "pg";

export default async () => {
  const client = new pg.Client({
    host: "db.zsbzyazabqtjamhzqqxn.supabase.co",
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(
      "UPDATE dealers SET company_name = $1 WHERE id = $2 RETURNING id, company_name, contact_name",
      ["27 Diamonds", "a9d2a500-72b4-4cfb-82e4-01e515cc4638"]
    );
    await client.end();
    return new Response(JSON.stringify({ success: true, rows: result.rows }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
