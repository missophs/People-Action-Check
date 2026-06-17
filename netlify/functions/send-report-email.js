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

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in Netlify environment variables." }),
    };
  }

  let to, subject, text, attachments;
  try {
    ({ to, subject, text, attachments } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (!to || !subject || !text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing to, subject, or text" }) };
  }

  const payload = {
    sender: { name: "HR Action Check", email: senderEmail },
    to: [{ email: to }],
    subject,
    textContent: text,
  };
  if (Array.isArray(attachments) && attachments.length) {
    payload.attachment = attachments
      .filter((a) => a && a.filename && a.base64Content)
      .map((a) => ({ name: a.filename, content: a.base64Content }));
  }

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const resultText = await r.text();
    if (!r.ok) {
      return { statusCode: r.status, headers, body: JSON.stringify({ error: "Brevo error", detail: resultText }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
