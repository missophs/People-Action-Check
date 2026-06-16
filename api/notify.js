module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { webhookUrl, payload } = req.body || {};
  if (!webhookUrl) return res.status(400).json({ error: "Missing webhookUrl" });

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    res.status(200).json({ ok: r.ok, status: r.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
