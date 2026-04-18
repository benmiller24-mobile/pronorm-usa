import { createClient } from "@supabase/supabase-js";

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

  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Verify the requesting dealer exists
    const { data: dealer, error: dealerErr } = await supabase
      .from("dealers")
      .select("id, role")
      .eq("id", dealerId)
      .single();

    if (dealerErr || !dealer) {
      return new Response(JSON.stringify({ error: "Dealer not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Non-admin dealers can only delete their own projects, and not if approved
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
      if (project.dealer_id !== dealerId) {
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

    // Delete the project
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
