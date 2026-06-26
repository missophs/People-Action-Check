const { caseStore } = require("./lib/blob-store");

// PAC_ADMIN_TOKEN: required env var. Guards all write (POST/DELETE) endpoints and list-all GET.
// Missing → 503 (misconfiguration). Wrong token → 401.
// Read endpoints scoped to a managerId are public (Slack users can list their own cases).
const ADMIN_TOKEN = process.env.PAC_ADMIN_TOKEN;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function ok(body) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
}
function fail(status, msg) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) };
}
function checkWriteAuth(event) {
  if (!ADMIN_TOKEN) return "misconfigured";
  const auth = (event.headers["authorization"] || event.headers["Authorization"] || "").replace("Bearer ", "");
  return auth === ADMIN_TOKEN ? "ok" : "unauthorized";
}
function blobKey(managerId, caseId) {
  return `case/${managerId}/${caseId}`;
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };

  const store = caseStore();
  const { managerId, caseId } = event.queryStringParameters || {};

  try {
    if (event.httpMethod === "GET") {
      if (managerId && caseId) {
        const raw = await store.get(blobKey(managerId, caseId));
        if (raw === null) return fail(404, "Not found");
        return ok({ case: JSON.parse(raw) });
      }
      if (managerId) {
        const { blobs } = await store.list({ prefix: `case/${managerId}/` });
        const cases = (
          await Promise.all(blobs.map((b) => store.get(b.key)))
        )
          .filter(Boolean)
          .map((raw) => JSON.parse(raw));
        return ok({ cases });
      }
      // list all — admin only
      const authResult = checkWriteAuth(event);
      if (authResult === "misconfigured") return fail(503, "PAC_ADMIN_TOKEN not configured");
      if (authResult === "unauthorized") return fail(401, "Unauthorized");
      const { blobs } = await store.list({ prefix: "case/" });
      const cases = (
        await Promise.all(blobs.map((b) => store.get(b.key)))
      )
        .filter(Boolean)
        .map((raw) => JSON.parse(raw));
      return ok({ cases });
    }

    if (event.httpMethod === "POST") {
      const authResult = checkWriteAuth(event);
      if (authResult === "misconfigured") return fail(503, "PAC_ADMIN_TOKEN not configured");
      if (authResult === "unauthorized") return fail(401, "Unauthorized");
      let caseRecord;
      try {
        ({ case: caseRecord } = JSON.parse(event.body || "{}"));
      } catch {
        return fail(400, "Invalid JSON");
      }
      if (!caseRecord || !caseRecord.id || !caseRecord.managerId) {
        return fail(400, "case.id and case.managerId required");
      }
      const key = blobKey(caseRecord.managerId, caseRecord.id);
      await store.set(key, JSON.stringify(caseRecord));
      return ok({ ok: true, key });
    }

    if (event.httpMethod === "DELETE") {
      const authResult = checkWriteAuth(event);
      if (authResult === "misconfigured") return fail(503, "PAC_ADMIN_TOKEN not configured");
      if (authResult === "unauthorized") return fail(401, "Unauthorized");
      if (!managerId || !caseId) return fail(400, "managerId and caseId required");
      await store.delete(blobKey(managerId, caseId));
      return ok({ ok: true });
    }

    return fail(405, "Method not allowed");
  } catch (e) {
    return fail(500, e.message);
  }
};
