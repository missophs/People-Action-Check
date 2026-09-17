const { hrConfigStore } = require("./lib/blob-store");

// No PAC_ADMIN_TOKEN check here, for the same reason as save-hr-email.js next
// door: the browser client (src/web/app-utils.js) never holds that server
// secret, so a token check here always 401s. Gated by the app's own PIN
// prompt in Company Policies instead.

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (body.slackWebhook !== undefined && typeof body.slackWebhook !== "string") {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid slackWebhook" }) };
  }
  if (body.teamsWebhook !== undefined && typeof body.teamsWebhook !== "string") {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid teamsWebhook" }) };
  }

  try {
    const store = hrConfigStore();
    if (body.slackWebhook !== undefined) await store.set("slackWebhook", body.slackWebhook.trim());
    if (body.teamsWebhook !== undefined) await store.set("teamsWebhook", body.teamsWebhook.trim());
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
