const { hrConfigStore } = require("./lib/blob-store");

// Follow-up reminders, server-side. Previously localStorage-only, so a
// manager's reminders never crossed devices and "clear" only ever cleared
// the browser they happened to be on. Each record carries ownerEmail
// (verified via Google Sign-In, see verify-google-token.js) so a manager's
// view is always filtered to their own reminders.

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const KEY = "pac_followups";
const MAX_RECORDS = 200;

function ok(body) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
}
function fail(status, msg) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) };
}

async function loadAll(store) {
  const raw = await store.get(KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveAll(store, list) {
  await store.set(KEY, JSON.stringify(list.slice(0, MAX_RECORDS)));
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };

  const { id, email } = event.queryStringParameters || {};
  const store = hrConfigStore();

  try {
    if (event.httpMethod === "GET") {
      const list = await loadAll(store);
      return ok({ followups: email ? list.filter((r) => r.ownerEmail === email) : list });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return fail(400, "Invalid JSON");
      }
      if (typeof body.ownerEmail !== "string" || !body.ownerEmail) return fail(400, "ownerEmail is required");
      if (typeof body.dueDate !== "string" || !body.dueDate) return fail(400, "dueDate is required");

      const list = await loadAll(store);
      const record = { ...body, id: body.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      const withoutExisting = list.filter((r) => String(r.id) !== String(record.id));
      await saveAll(store, [record, ...withoutExisting]);
      return ok(record);
    }

    if (event.httpMethod === "DELETE") {
      const list = await loadAll(store);
      if (id) {
        await saveAll(store, list.filter((r) => String(r.id) !== String(id)));
        return ok({ ok: true });
      }
      if (email) {
        await saveAll(store, list.filter((r) => r.ownerEmail !== email));
        return ok({ ok: true });
      }
      await saveAll(store, []);
      return ok({ ok: true });
    }

    return fail(405, "Method not allowed");
  } catch (e) {
    return fail(500, e.message);
  }
};
