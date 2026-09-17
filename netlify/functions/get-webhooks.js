const { hrConfigStore } = require("./lib/blob-store");

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: "" };
  }

  try {
    const store = hrConfigStore();
    const [slackWebhook, teamsWebhook] = await Promise.all([
      store.get("slackWebhook"),
      store.get("teamsWebhook"),
    ]);
    return { statusCode: 200, headers, body: JSON.stringify({ slackWebhook: slackWebhook || "", teamsWebhook: teamsWebhook || "" }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
