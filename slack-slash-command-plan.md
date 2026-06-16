# Slack Slash Command — `/hrcheck`

**Goal:** Employees type `/hrcheck` in any Slack channel or DM and receive a private link to the HR Action Check app. One tap to open.

**Estimated build time:** 30 minutes

---

## What it does

- Employee types `/hrcheck` anywhere in Slack
- Slack sends them a private (ephemeral) message: "Run your HR Action Check here: https://hr-action-check.vercel.app"
- Only visible to the person who typed the command — no channel clutter
- Works on desktop and mobile Slack

---

## How to build it

### Step 1 — Slack app setup (already done if webhook is configured)
If the Slack incoming webhook app already exists, skip to Step 2. Otherwise:
1. Go to https://api.slack.com/apps
2. Create New App → From scratch → name it `HR Action Check`
3. Select your workspace → Create App

### Step 2 — Add a slash command
1. In your Slack app settings, click **Slash Commands** in the left sidebar
2. Click **Create New Command**
3. Fill in:
   - Command: `/hrcheck`
   - Request URL: `https://hr-action-check.vercel.app/api/slack-command`
   - Short description: `Run an HR Action Check`
   - Usage hint: (leave blank)
4. Click **Save**

### Step 3 — Create the serverless function
Create `/api/slack-command.js` in the HR Sanity check folder:

```js
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  // Slack sends form-encoded body for slash commands
  res.status(200).json({
    response_type: "ephemeral",
    text: "Run your HR Action Check here: https://hr-action-check.vercel.app",
  });
};
```

### Step 4 — Reinstall the Slack app
1. In Slack app settings → **Install App** → **Reinstall to Workspace**
2. Authorize

### Step 5 — Deploy
```
cp hr-action-check-final-5.26.html index.html
npx vercel --prod
```

### Step 6 — Test
Type `/hrcheck` in any Slack channel. You should get a private message with the link.

---

## Notes

- The function just returns a static link — no auth, no database, no secrets needed
- `response_type: "ephemeral"` means only the person who typed the command sees the response
- Slack does send a verification token with slash commands; for production you'd want to verify it, but for internal use it's fine to skip
- If the Slack app is already set up for the incoming webhook, the slash command can be added to the same app — no new app needed

---

## Optional upgrade

Instead of just a link, the ephemeral message could include a formatted card with a button:

```js
res.status(200).json({
  response_type: "ephemeral",
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*HR Action Check*\nRun a private confidence check before taking HR action."
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Open HR Action Check" },
        url: "https://hr-action-check.vercel.app",
        action_id: "open_app"
      }
    }
  ]
});
```
