const { getStore } = require("@netlify/blobs");

function hrConfigStore() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "hr-action-check-config", siteID, token });
  }
  return getStore("hr-action-check-config");
}

module.exports = { hrConfigStore };
