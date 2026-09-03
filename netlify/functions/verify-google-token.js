// Verifies a Google Identity Services credential (ID token JWT) server-side,
// so a manager's identity for Session History is a real verified email, not
// a spoofable free-text name. Uses Google's tokeninfo endpoint directly —
// lightweight, no JWT library dependency, Google's own recommended approach
// for low-volume verification.

const GOOGLE_CLIENT_ID = "457583731351-di8h6sl5hjpv5ek5daog5l6muqn2o9v5.apps.googleusercontent.com";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function ok(body) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
}
function fail(status, msg) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed");

  let credential;
  try {
    ({ credential } = JSON.parse(event.body || "{}"));
  } catch {
    return fail(400, "Invalid JSON");
  }
  if (typeof credential !== "string" || !credential) return fail(401, "Missing credential");

  try {
    const res = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
    if (!res.ok) return fail(401, "Token verification failed");
    const info = await res.json();
    if (info.aud !== GOOGLE_CLIENT_ID) return fail(401, "Token not issued for this app");
    if (info.email_verified !== "true") return fail(401, "Email not verified");
    return ok({ email: info.email, name: info.name || "" });
  } catch (e) {
    return fail(401, "Token verification failed");
  }
};
