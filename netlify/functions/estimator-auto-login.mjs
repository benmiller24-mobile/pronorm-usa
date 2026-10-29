import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Returns a single-use, 60-second auto-login URL for the Pronorm Estimator,
// derived from the caller's authenticated Supabase session.
//
// Contract with the client (PortalLayout.tsx):
//   POST /.netlify/functions/estimator-auto-login
//     headers: Authorization: Bearer <supabase access_token>
//   → 200 { url: 'https://estimator.pronormusa.com/.netlify/functions/auto-login?t=<token>' }
//
// token = base64url(JSON {e: email, x: expiry (epoch s), n: nonce}) + "." +
//         base64url(HMAC-SHA256(AUTO_LOGIN_SIGNING_SECRET, payload))
// The signing secret never leaves the server and never appears in a URL. The
// estimator verifies the signature, the 60 s expiry, and burns the nonce, so
// a captured URL is useless after first use or one minute. (Replaces the old
// shared static token, which could sign in as any user.)

const TOKEN_TTL_S = 60;

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signAutoLoginToken(email, secret) {
  const payload = b64url(
    JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + TOKEN_TTL_S, n: b64url(randomBytes(24)) })
  );
  const sig = b64url(createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

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

  const signingSecret = process.env.AUTO_LOGIN_SIGNING_SECRET;
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!signingSecret || signingSecret.length < 32 || !supabaseUrl || !serviceRoleKey || !anonKey) {
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
  const url = `${ESTIMATOR_AUTO_LOGIN}?t=${encodeURIComponent(signAutoLoginToken(email, signingSecret))}`;
  return json(200, { url });
};
