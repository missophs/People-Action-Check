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

// ── Policies ──────────────────────────────────────────────────────────────
function savePolicies(d)   { try { localStorage.setItem(POLICIES_KEY, JSON.stringify(d)); } catch(e) {} }
function loadPolicies()    { try { var d=localStorage.getItem(POLICIES_KEY); return d?JSON.parse(d):[]; } catch(e){return[];} }

// ── Uploaded PDF pages (IndexedDB, not localStorage) ────────────────────────
// Policy metadata (name/extracted text/category) is small and stays in
// localStorage above. The original PDF bytes are what real page rendering
// needs, and those can run several MB — well past localStorage's ~5-10MB
// per-origin cap once a couple of handbooks are uploaded. IndexedDB has no
// such practical limit, so the raw file blob lives here, keyed by policy id.
var PDF_DB_NAME = "pac_files";
var PDF_STORE   = "pdfs";
function openPdfDb() {
  return new Promise(function(resolve, reject) {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB not available")); return; }
    var req = indexedDB.open(PDF_DB_NAME, 1);
    req.onupgradeneeded = function() { req.result.createObjectStore(PDF_STORE); };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror   = function() { reject(req.error); };
  });
}
async function savePdfBlob(id, file) {
  // Stored as raw bytes, not the File/Blob object itself — Safari's IndexedDB
  // can silently fail to structured-clone a File, which left uploads stuck on
  // the plain-text fallback with no error shown. ArrayBuffers clone reliably
  // everywhere.
  var buf = await file.arrayBuffer();
  var db = await openPdfDb();
  return new Promise(function(resolve, reject) {
    var tx = db.transaction(PDF_STORE, "readwrite");
    tx.objectStore(PDF_STORE).put(buf, id);
    tx.oncomplete = function() { resolve(); };
    tx.onerror    = function() { reject(tx.error); };
  });
}
async function loadPdfBlob(id) {
  var db = await openPdfDb();
  return new Promise(function(resolve, reject) {
    var tx = db.transaction(PDF_STORE, "readonly");
    var req = tx.objectStore(PDF_STORE).get(id);
    req.onsuccess = function() { resolve(req.result || null); };
    req.onerror   = function() { reject(req.error); };
  });
}
async function deletePdfBlob(id) {
  var db = await openPdfDb();
  return new Promise(function(resolve, reject) {
    var tx = db.transaction(PDF_STORE, "readwrite");
    tx.objectStore(PDF_STORE).delete(id);
    tx.oncomplete = function() { resolve(); };
    tx.onerror    = function() { reject(tx.error); };
  });
}
async function clearAllPdfBlobs() {
  var db = await openPdfDb();
  return new Promise(function(resolve, reject) {
    var tx = db.transaction(PDF_STORE, "readwrite");
    tx.objectStore(PDF_STORE).clear();
    tx.oncomplete = function() { resolve(); };
    tx.onerror    = function() { reject(tx.error); };
  });
}

// ── Check history ─────────────────────────────────────────────────────────
function loadCheckHistory(){ try { var d=localStorage.getItem(HISTORY_KEY); return d?JSON.parse(d):[]; } catch(e){return[];} }
function saveCheckHistory(d){ try { localStorage.setItem(HISTORY_KEY, JSON.stringify(d)); } catch(e) {} }

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

// ── HR submissions ────────────────────────────────────────────────────────
function loadHrSubmissions() { try { var d=localStorage.getItem(HR_SUBMISSIONS_KEY); return d?JSON.parse(d):[]; } catch(e){return[];} }
function saveHrSubmissions(d){ try { localStorage.setItem(HR_SUBMISSIONS_KEY, JSON.stringify(d.slice(0,50))); } catch(e) {} }

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
