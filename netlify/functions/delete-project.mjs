import pg from "pg";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { projectId, dealerId } = body;
  if (!projectId || !dealerId) {
    return new Response(JSON.stringify({ error: "projectId and dealerId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

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

    const adminCheck = await client.query(
      "SELECT role FROM dealers WHERE id = $1",
      [dealerId]
    );
    if (!adminCheck.rows.length || adminCheck.rows[0].role !== "admin") {
      await client.end();
      return new Response(JSON.stringify({ error: "Only admins can delete projects" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await client.query(
      "DELETE FROM projects WHERE id = $1 RETURNING id, job_name",
      [projectId]
    );
    await client.end();

    if (!result.rows.length) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, deleted: result.rows[0] }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    try { await client.end(); } catch (_) {}
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
