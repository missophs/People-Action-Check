// Centralized Slack API client for backend-only use.
// Import this instead of reading PAC_SLACK_BOT_TOKEN directly.

const { getSlackBotToken } = require('./secrets.cjs');

async function slackApi(method, body) {
  const token = getSlackBotToken();
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Slack ${method} error:`, data.error, JSON.stringify(body).slice(0, 200));
  }
  return data;
}

module.exports = { slackApi };
