const { hrConfigStore } = require("./lib/blob-store");

// In-progress ("saved for later") check session, server-side. Previously
// localStorage-only, so Resume/Save for later never crossed devices — unlike
// Check History and Policies, which already sync via blobs (see
// check-history-store.js, policy-store.js). One saved session per manager,
// keyed by their verified Google email.

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const KEY_PREFIX = "pac_saved_session/";

function ok(body) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
}
function fail(status, msg) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };

  const { email } = event.queryStringParameters || {};
  if (!email) return fail(400, "email is required");
  const store = hrConfigStore();
  const key = KEY_PREFIX + email;

  try {
    if (event.httpMethod === "GET") {
      const raw = await store.get(key);
      return ok({ session: raw ? JSON.parse(raw) : null });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return fail(400, "Invalid JSON");
      }
      await store.set(key, JSON.stringify(body));
      return ok({ ok: true });
    }

    if (event.httpMethod === "DELETE") {
      await store.delete(key);
      return ok({ ok: true });
    }

    return fail(405, "Method not allowed");
  } catch (e) {
    return fail(500, e.message);
  }
};
