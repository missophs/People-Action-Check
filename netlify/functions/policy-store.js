const { hrConfigStore } = require("./lib/blob-store");

// Web-app Company Policies library, server-side. Previously this lived only
// in the uploading browser's localStorage/IndexedDB, which the Slack app
// (server-side, no browser) could never read. Gated by the app's own
// client-side PIN prompt, same as get-hr-email.js/save-hr-email.js — no
// PAC_ADMIN_TOKEN here, for the same reason it was wrong on those.
//
// Storage: index key "pac_web_policies_index" holds an array of metadata
// (no text/bytes, kept small so listing is one cheap read); each document's
// text + PDF bytes (base64) live under their own key "pac_web_policy_<id>",
// fetched only when a document is actually opened.

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const INDEX_KEY = "pac_web_policies_index";
const docKey = (id) => `pac_web_policy_${id}`;

function ok(body) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
}
function fail(status, msg) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) };
}

async function loadIndex(store) {
  const raw = await store.get(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveIndex(store, index) {
  await store.set(INDEX_KEY, JSON.stringify(index));
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };

  const { id } = event.queryStringParameters || {};
  const store = hrConfigStore();

  try {
    if (event.httpMethod === "GET") {
      if (id) {
        const raw = await store.get(docKey(id));
        if (!raw) return fail(404, "Not found");
        const index = await loadIndex(store);
        const meta = index.find((p) => p.id === id);
        if (!meta) return fail(404, "Not found");
        return ok({ ...meta, ...JSON.parse(raw) });
      }
      const index = await loadIndex(store);
      return ok({ policies: index });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return fail(400, "Invalid JSON");
      }
      const index = await loadIndex(store);

      if (body.id) {
        // Partial update (e.g. category change from the View tab) — merge
        // onto the existing entry rather than requiring the full document.
        const i = index.findIndex((p) => p.id === body.id);
        if (i === -1) return fail(404, "Not found");
        index[i] = { ...index[i], ...(body.category !== undefined ? { category: body.category } : {}) };
        await saveIndex(store, index);
        return ok(index[i]);
      }

      if (typeof body.name !== "string" || typeof body.text !== "string") {
        return fail(400, "name and text are required");
      }
      const id2 = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const meta = {
        id: id2,
        name: body.name,
        category: body.category || "other",
        addedAt: new Date().toLocaleDateString(),
        chars: body.text.length,
        hasPdf: !!body.pdfBase64,
        preview: body.text.slice(0, 150),
      };
      await store.set(docKey(id2), JSON.stringify({ text: body.text, pageTexts: body.pageTexts || null, pdfBase64: body.pdfBase64 || null }));
      index.push(meta);
      await saveIndex(store, index);
      return ok(meta);
    }

    if (event.httpMethod === "DELETE") {
      const index = await loadIndex(store);
      if (id) {
        await store.delete(docKey(id));
        await saveIndex(store, index.filter((p) => p.id !== id));
        return ok({ ok: true });
      }
      // No id — reset the whole library.
      await Promise.all(index.map((p) => store.delete(docKey(p.id))));
      await saveIndex(store, []);
      return ok({ ok: true });
    }

    return fail(405, "Method not allowed");
  } catch (e) {
    return fail(500, e.message);
  }
};
