// Gemini render proxy for the public /estimator/ AI Kitchen Render tool.
// Called unauthenticated from marketing pages — abuse mitigation is Origin
// check + body-size cap, not Supabase auth. If this is ever moved behind the
// dealer portal, swap the Origin check for Bearer + supabase.auth.getUser().

const ALLOWED_ORIGINS = new Set([
  "https://pronormusa.com",
  "https://www.pronormusa.com",
]);

// ~5 MB of JSON covers a reasonable image payload with room for prompts.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const CORS_BASE = {
  "Access-Control-Allow-Origin": "https://pronormusa.com",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function corsFor(origin) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://pronormusa.com";
  return { ...CORS_BASE, "Access-Control-Allow-Origin": allowed };
}

function jsonResponse(statusCode, body, cors) {
  return { statusCode, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

exports.handler = async function(event) {
  const origin = event.headers.origin || event.headers.Origin || "";
  const cors = corsFor(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, cors);
  }

  // Require a known Origin header. Browsers send this automatically; curl/scripts
  // typically don't. This blocks the simplest forms of quota abuse without
  // breaking the public estimator tool.
  if (!ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(403, { error: "Forbidden" }, cors);
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return jsonResponse(500, { error: "API key not configured" }, cors);
  }

  // Reject oversized bodies before parsing.
  const rawBody = event.body || "";
  const rawSize = event.isBase64Encoded
    ? Math.floor(rawBody.length * 0.75)
    : Buffer.byteLength(rawBody, "utf8");
  if (rawSize > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "Payload too large" }, cors);
  }

  let body;
  try { body = JSON.parse(rawBody); } catch(e) {
    return jsonResponse(400, { error: "Invalid JSON" }, cors);
  }

  const model = body.model || "gemini-2.5-flash-image";
  const payload = body.payload;
  if (!payload) {
    return jsonResponse(400, { error: "Missing payload" }, cors);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return jsonResponse(resp.status, { error: (data && data.error && data.error.message) || "Gemini API error", status: resp.status }, cors);
    }

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch(e) {
    return jsonResponse(502, { error: e.message }, cors);
  }
};
