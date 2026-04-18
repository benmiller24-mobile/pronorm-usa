import { createClient } from "@supabase/supabase-js";

// Server-side proxy for the estimator's admin-users endpoint.
//
// Why: the estimator admin API uses a shared bearer secret. Callers on this
// repo used to embed that secret in the React bundle (EstimatorUsers.tsx).
// This proxy lets the client authenticate as themselves (Supabase session),
// we verify they are an admin dealer, then we forward the request to the
// estimator using the real secret from env — never exposing it to the
// browser.
//
// Contract with the client (EstimatorUsers.tsx):
//   GET    /.netlify/functions/estimator-admin-users           → list users
//   POST   /.netlify/functions/estimator-admin-users           → create
//   PUT    /.netlify/functions/estimator-admin-users           → update
//   DELETE /.netlify/functions/estimator-admin-users           → delete
// All requests require `Authorization: Bearer <supabase access_token>`.
// Request body (if any) is forwarded verbatim to the estimator.

const ESTIMATOR_API = "https://estimator.pronormusa.com/.netlify/functions/admin-users";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (!ALLOWED_METHODS.has(req.method)) {
    return json(405, { error: "Method not allowed" });
  }

  const estimatorSecret = process.env.ESTIMATOR_API_SECRET;
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!estimatorSecret || !supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { error: "Server misconfigured" });
  }

  // 1. Require a Supabase bearer token.
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json(401, { error: "Missing authorization token" });
  }
  const token = authHeader.slice("Bearer ".length);

  // 2. Resolve the caller.
  const anon = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) {
    return json(401, { error: "Invalid token" });
  }

  // 3. Admin-only.
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: dealer, error: dealerErr } = await supabase
    .from("dealers")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (dealerErr || !dealer) {
    return json(403, { error: "Dealer profile not found" });
  }
  if (dealer.role !== "admin") {
    return json(403, { error: "Admin role required" });
  }

  // 4. Read the body for methods that carry one. GET has none.
  let forwardedBody;
  if (req.method !== "GET") {
    try {
      forwardedBody = JSON.stringify(await req.json());
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }
  }

  // 5. Forward to the estimator using the real secret.
  let upstream;
  try {
    upstream = await fetch(ESTIMATOR_API, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${estimatorSecret}`,
      },
      body: forwardedBody,
    });
  } catch (e) {
    return json(502, { error: `Estimator upstream unreachable: ${e.message}` });
  }

  // 6. Relay status + body. We don't re-expose any upstream headers beyond
  //    Content-Type — no reason to leak server identifiers or cookies.
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
};
