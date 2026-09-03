// Browser-global utilities — loaded via <script src> before App.jsx.
// Mirrors src/services/storage.js and src/core/scoring.js for in-browser use
// until the Vite build migration. All declarations use function/var for global scope.

// ── Crypto ────────────────────────────────────────────────────────────────
function dataUrlToBytes(dataUrl) {
  var base64 = dataUrl.split(",")[1] || "";
  var bin = atob(base64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function sha256(str) {
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
}

// ── Session ───────────────────────────────────────────────────────────────
function saveSession(d)    { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch(e) {} }
function loadSession()     { try { var d=localStorage.getItem(SAVE_KEY); return d?JSON.parse(d):null; } catch(e){return null;} }
function clearSession()    { try { localStorage.removeItem(SAVE_KEY); } catch(e) {} }

// ── Policies (server-synced Netlify Blobs — Slack needs to read these too,
// so browser-only storage isn't an option; see netlify/functions/policy-store.js) ─
async function fetchPolicies() {
  var res = await fetch("/api/policy-store");
  if (!res.ok) throw new Error("fetch failed");
  var data = await res.json();
  return data.policies || [];
}
async function fetchPolicyContent(id) {
  var res = await fetch("/api/policy-store?id=" + encodeURIComponent(id));
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}
async function createPolicy(doc) {
  var res = await fetch("/api/policy-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}
async function updatePolicyCategory(id, category) {
  var res = await fetch("/api/policy-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, category: category }),
  });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}
async function deletePolicy(id) {
  var res = await fetch("/api/policy-store?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (!res.ok) throw new Error("delete failed");
}
async function resetAllPolicies() {
  var res = await fetch("/api/policy-store", { method: "DELETE" });
  if (!res.ok) throw new Error("reset failed");
}

// ── Check history (server-synced — private per manager, filtered by their
// verified Google email; see netlify/functions/check-history-store.js) ────
async function fetchCheckHistory(email) {
  var res = await fetch("/api/check-history-store" + (email ? "?email=" + encodeURIComponent(email) : ""));
  if (!res.ok) throw new Error("fetch failed");
  var data = await res.json();
  return data.history || [];
}
async function createCheckHistoryEntry(entry) {
  var res = await fetch("/api/check-history-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}
async function deleteCheckHistoryEntry(id) {
  var res = await fetch("/api/check-history-store?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (!res.ok) throw new Error("delete failed");
}
async function clearCheckHistory(email) {
  var res = await fetch("/api/check-history-store" + (email ? "?email=" + encodeURIComponent(email) : ""), { method: "DELETE" });
  if (!res.ok) throw new Error("clear failed");
}

// ── Identity (Sign in with Google) ──────────────────────────────────────
function loadIdentity()    { try { var d=localStorage.getItem(IDENTITY_KEY); return d?JSON.parse(d):null; } catch(e){return null;} }
function saveIdentity(v)   { try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(v)); } catch(e) {} }
function clearIdentity()   { try { localStorage.removeItem(IDENTITY_KEY); } catch(e) {} }

async function verifyGoogleCredential(credential) {
  var res = await fetch("/api/verify-google-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: credential }),
  });
  if (!res.ok) throw new Error("verification failed");
  return res.json();
}

// ── PIN ───────────────────────────────────────────────────────────────────
function loadPinHash()      { try { return localStorage.getItem(PIN_KEY) || DEFAULT_PIN_HASH; } catch(e){return DEFAULT_PIN_HASH;} }
function savePinHash(h)     { try { localStorage.setItem(PIN_KEY, h); } catch(e) {} }

// ── HR email (local + server-synced) ──────────────────────────────────────
function loadHrEmail()      { try { return localStorage.getItem(HR_EMAIL_KEY)||""; } catch(e){return "";} }
function saveHrEmail(v)     { try { localStorage.setItem(HR_EMAIL_KEY, v); } catch(e) {} }

async function fetchHrEmailFromServer() {
  var res = await fetch("/api/get-hr-email");
  if (!res.ok) throw new Error("fetch failed");
  var data = await res.json();
  return data.hrEmail || "";
}

async function saveHrEmailToServer(v) {
  var res = await fetch("/api/save-hr-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hrEmail: v }),
  });
  if (!res.ok) throw new Error("save failed");
}

// ── HR submissions (server-synced — different HR staff on different devices
// need the same shared inbox, not one each; see netlify/functions/hr-submissions.js) ─
async function fetchHrSubmissions() {
  var res = await fetch("/api/hr-submissions");
  if (!res.ok) throw new Error("fetch failed");
  var data = await res.json();
  return data.submissions || [];
}
async function createHrSubmission(sub) {
  var res = await fetch("/api/hr-submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}
async function updateHrSubmission(id, patch) {
  var res = await fetch("/api/hr-submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...patch, id: id }),
  });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}
async function deleteHrSubmission(id) {
  var res = await fetch("/api/hr-submissions?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (!res.ok) throw new Error("delete failed");
}
async function clearHrSubmissions() {
  var res = await fetch("/api/hr-submissions", { method: "DELETE" });
  if (!res.ok) throw new Error("clear failed");
}

// ── Follow-ups ────────────────────────────────────────────────────────────
function loadFollowups()     { try { var d=localStorage.getItem(HR_FOLLOWUPS_KEY); return d?JSON.parse(d):[]; } catch(e){return[];} }
function saveFollowups(d)    { try { localStorage.setItem(HR_FOLLOWUPS_KEY, JSON.stringify(d)); } catch(e) {} }

// ── Webhooks ──────────────────────────────────────────────────────────────
function loadSlackWebhook()  { try { return localStorage.getItem(SLACK_WEBHOOK_KEY)||""; } catch(e){return "";} }
function saveSlackWebhook(v) { try { localStorage.setItem(SLACK_WEBHOOK_KEY, v); } catch(e) {} }
function loadTeamsWebhook()  { try { return localStorage.getItem(TEAMS_WEBHOOK_KEY)||""; } catch(e){return "";} }
function saveTeamsWebhook(v) { try { localStorage.setItem(TEAMS_WEBHOOK_KEY, v); } catch(e) {} }

// ── Scoring — mirrors src/core/scoring.js ─────────────────────────────────
function computeScore(qs, answers) {
  var wNo=0, total=0, crit=false, unk=0, yes=0, no=0;
  qs.forEach(function(item, i) {
    var a=answers[i];
    total += item.weight;
    if(a==="yes") yes++;
    if(a==="no")  { no++;  wNo+=item.weight;        if(item.critical) crit=true; }
    if(a==="unknown") { unk++; wNo+=item.weight*0.75; if(item.critical) crit=true; }
  });
  var ratio = total > 0 ? wNo/total : 0;
  return { level:crit?"risk":ratio<=0.15?"good":ratio<=0.45?"warn":"risk", crit:crit, unk:unk, yes:yes, no:no };
}
