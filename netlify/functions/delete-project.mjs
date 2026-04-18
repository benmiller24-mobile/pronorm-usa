import { createClient } from "@supabase/supabase-js";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Require a valid Supabase session. The dealerId used for ownership checks
  // is derived from the authenticated user — never trusted from the body.
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const token = authHeader.slice("Bearer ".length);

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { projectId } = body;
  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const anon = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Resolve the caller's dealer record from their auth user id.
    const { data: dealer, error: dealerErr } = await supabase
      .from("dealers")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (dealerErr || !dealer) {
      return new Response(JSON.stringify({ error: "Dealer profile not found" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Non-admin dealers can only delete their own projects, and not if approved.
    if (dealer.role !== "admin") {
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .select("dealer_id, status")
        .eq("id", projectId)
        .single();

      if (projErr || !project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (project.dealer_id !== dealer.id) {
        return new Response(JSON.stringify({ error: "You can only delete your own projects" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (project.status === "approved") {
        return new Response(JSON.stringify({ error: "Approved projects cannot be deleted. Please contact an admin." }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Delete the project.
    const { data, error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, deleted: data[0] }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
