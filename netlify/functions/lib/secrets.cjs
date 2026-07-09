// Backend-only secrets helper.
// ONLY import this file from Netlify Functions or backend-only modules under netlify/functions/.
// Never import from src/web/, client-side bundles, or browser code.
// Never log the values returned by these functions.

const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';

const SKIP_SIG_VERIFY =
  process.env.PAC_SKIP_SIG_VERIFY === 'true' && !IS_PRODUCTION;

function requireSecret(name) {
  const val = process.env[name];
  if (!val) {
    const msg = `Missing required secret: ${name}`;
    if (IS_PRODUCTION) throw new Error(msg);
    console.warn(`[secrets] ${msg}`);
    return '';
  }
  return val;
}

function getPacAdminToken()      { return requireSecret('PAC_ADMIN_TOKEN'); }
function getSlackBotToken()      { return requireSecret('PAC_SLACK_BOT_TOKEN'); }
function getSlackSigningSecret() { return requireSecret('PAC_SLACK_SIGNING_SECRET'); }

module.exports = { getPacAdminToken, getSlackBotToken, getSlackSigningSecret, SKIP_SIG_VERIFY, IS_PRODUCTION };
