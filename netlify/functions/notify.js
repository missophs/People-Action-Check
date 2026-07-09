// Outbound webhook proxy — authenticated and domain-scoped.
// Requires: Authorization: Bearer <PAC_ADMIN_TOKEN>
// Requires: NOTIFY_ALLOWED_DOMAINS env var (comma-separated hostnames, e.g. "hooks.slack.com")
//   If NOTIFY_ALLOWED_DOMAINS is not set the request is rejected — no open proxy.

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "" };
  }

  // Auth — Bearer token must match PAC_ADMIN_TOKEN
  const adminToken = process.env.PAC_ADMIN_TOKEN;
  if (!adminToken) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: "PAC_ADMIN_TOKEN not configured" }) };
  }
  const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (bearer !== adminToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  // Domain allowlist — must be configured explicitly; no open proxy by default
  const allowedDomains = (process.env.NOTIFY_ALLOWED_DOMAINS || "")
    .split(",")
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowedDomains.length === 0) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: "NOTIFY_ALLOWED_DOMAINS not configured" }) };
  }

  let webhookUrl, payload;
  try {
    ({ webhookUrl, payload } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (!webhookUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing webhookUrl" }) };
  }

  // Validate URL scheme and hostname against allowlist
  let parsedUrl;
  try { parsedUrl = new URL(webhookUrl); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid webhookUrl" }) };
  }
  if (parsedUrl.protocol !== "https:") {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Only https webhookUrls are allowed" }) };
  }
  if (!allowedDomains.includes(parsedUrl.hostname.toLowerCase())) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "webhookUrl hostname not in allowlist" }) };
  }

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: r.ok, status: r.status }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
