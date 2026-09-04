const { hrConfigStore } = require("./lib/blob-store");

// No PAC_ADMIN_TOKEN check here: the browser client (src/web/app-utils.js
// savePinHashToServer) has no way to hold that server secret, and never
// sends it — a token check here always 401s regardless of configuration.
// This setting is gated the same way the rest of Company Policies is: the
// app's own client-side PIN prompt, matching get-pin.js and save-hr-email.js
// next door, which already write with no auth at all. The value stored is
// a SHA-256 hash of the PIN, never the PIN itself.

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

  let pinHash;
  try {
    ({ pinHash } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (typeof pinHash !== "string" || !/^[0-9a-f]{64}$/i.test(pinHash)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid PIN hash" }) };
  }

  try {
    const store = hrConfigStore();
    await store.set("pinHash", pinHash);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
