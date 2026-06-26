const { hrConfigStore } = require("./lib/blob-store");

// PAC_ADMIN_TOKEN: required env var. All write requests must include
// "Authorization: Bearer <token>" — set this in Netlify site environment variables.
// Missing or mismatched token → 401.
const ADMIN_TOKEN = process.env.PAC_ADMIN_TOKEN;

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

  if (!ADMIN_TOKEN) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: "PAC_ADMIN_TOKEN not configured" }) };
  }
  const auth = (event.headers["authorization"] || event.headers["Authorization"] || "").replace("Bearer ", "");
  if (auth !== ADMIN_TOKEN) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let hrEmail;
  try {
    ({ hrEmail } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (typeof hrEmail !== "string" || (hrEmail.length > 0 && !hrEmail.includes("@"))) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid email" }) };
  }

  try {
    const store = hrConfigStore();
    await store.set("hrEmail", hrEmail.trim());
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
