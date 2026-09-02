const { hrConfigStore } = require("./lib/blob-store");

// No PAC_ADMIN_TOKEN check here: the browser client (src/web/app-utils.js
// saveHrEmailToServer) has no way to hold that server secret, and never
// sends it — a token check here always 401s regardless of configuration.
// This setting is gated the same way the rest of Company Policies is: the
// app's own client-side PIN prompt, matching get-hr-email.js next door,
// which already reads with no auth at all.

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
