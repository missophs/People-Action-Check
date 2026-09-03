const { hrConfigStore } = require("./lib/blob-store");

// HR Dashboard submissions, server-side. Previously localStorage-only, so
// only the browser that clicked "Send to HR" ever saw it — different HR
// staff on different devices/browsers each had their own empty inbox.
// Gated by the app's own client-side PIN prompt, same as the rest of
// Company Policies — no PAC_ADMIN_TOKEN (see save-hr-email.js for why that
// doesn't work for a browser-called endpoint).

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const KEY = "pac_hr_submissions";
const MAX_SUBMISSIONS = 50;

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
  await store.set(KEY, JSON.stringify(list.slice(0, MAX_SUBMISSIONS)));
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };

  const { id } = event.queryStringParameters || {};
  const store = hrConfigStore();

  try {
    if (event.httpMethod === "GET") {
      return ok({ submissions: await loadAll(store) });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return fail(400, "Invalid JSON");
      }
      const list = await loadAll(store);

      if (body.id) {
        // Status/notes update from the HR Dashboard.
        const i = list.findIndex((s) => s.id === body.id);
        if (i === -1) return fail(404, "Not found");
        list[i] = { ...list[i], ...body };
        await saveAll(store, list);
        return ok(list[i]);
      }

      if (typeof body.scenario !== "string") return fail(400, "scenario is required");
      const submission = { ...body, id: body.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      await saveAll(store, [submission, ...list]);
      return ok(submission);
    }

    if (event.httpMethod === "DELETE") {
      const list = await loadAll(store);
      if (id) {
        await saveAll(store, list.filter((s) => String(s.id) !== String(id)));
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
