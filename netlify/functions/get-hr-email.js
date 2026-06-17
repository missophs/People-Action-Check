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
    const hrEmail = (await store.get("hrEmail")) || "";
    return { statusCode: 200, headers, body: JSON.stringify({ hrEmail }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
