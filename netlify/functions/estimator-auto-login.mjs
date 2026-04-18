import { createClient } from "@supabase/supabase-js";

// Returns a signed auto-login URL for the Pronorm Estimator, derived from
// the caller's authenticated Supabase session. The shared estimator secret
// stays in `process.env.ESTIMATOR_API_SECRET` — it is not embedded in the
// React bundle and the client never sees a value it could forge.
//
// Contract with the client (PortalLayout.tsx):
//   POST /.netlify/functions/estimator-auto-login
//     headers: Authorization: Bearer <supabase access_token>
//   → 200 { url: 'https://estimator.pronormusa.com/.netlify/functions/auto-login?email=<...>&token=<...>' }
//
// The caller is expected to open `url` in a new tab (or navigate a pre-
// opened blank tab) so the estimator can set its own session cookies on
// its own origin.
//
// SECURITY NOTE — partial remediation.
// The estimator currently authenticates auto-login by a shared static
// token. Even with this proxy in place, the token still appears in the
// resulting URL the browser navigates to (address bar, history,
// referrer, estimator access logs). What this proxy does fix is the
// bundle leak: the token no longer ships in the React bundle and is
// scoped to authenticated portal users who actually click the button.
// Full remediation requires the estimator to accept short-lived signed
// per-user tokens instead of a shared static secret.

const ESTIMATOR_AUTO_LOGIN = "https://estimator.pronormusa.com/.netlify/functions/auto-login";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const estimatorSecret = process.env.ESTIMATOR_API_SECRET;
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!estimatorSecret || !supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { error: "Server misconfigured" });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json(401, { error: "Missing authorization token" });
  }
  const token = authHeader.slice("Bearer ".length);

  const anon = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user || !user.email) {
    return json(401, { error: "Invalid token" });
  }

  // Confirm the caller has a portal dealer profile. We don't restrict by
  // role here — any authenticated portal user (dealer, designer, admin)
  // can open the Estimator tab, which matches the current UX.
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: dealer, error: dealerErr } = await supabase
    .from("dealers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (dealerErr || !dealer) {
    return json(403, { error: "Dealer profile not found" });
  }

  // Server-derived email — do NOT trust a client-supplied email.
  const email = user.email;
  const url = `${ESTIMATOR_AUTO_LOGIN}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(estimatorSecret)}`;
  return json(200, { url });
};
