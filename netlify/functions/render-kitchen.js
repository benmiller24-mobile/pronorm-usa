exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" }, body: "" };
  }

  // Debug endpoint - GET request shows env status
  if (event.httpMethod === "GET") {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const keyLen = hasKey ? process.env.GEMINI_API_KEY.length : 0;
    const envKeys = Object.keys(process.env).filter(k => k.includes("GEMINI") || k.includes("API")).join(", ");
    return { 
      statusCode: 200, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasKey, keyLength: keyLen, matchingEnvVars: envKeys || "none" })
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured. Set GEMINI_API_KEY in Netlify Environment Variables and redeploy." }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const model = body.model || "gemini-2.5-flash-image";
  const payload = body.payload;
  if (!payload) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing payload" }) };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data.error?.message || "Gemini API error", status: resp.status })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data)
    };
  } catch(e) {
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }
};
