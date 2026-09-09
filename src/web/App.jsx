// PAC Web Application — JSX entry point.
// Loaded by index.html via <script type="text/babel" src="src/web/App.jsx">.
// Requires app-data.js and app-utils.js to have loaded first (global scope).
// All inline style values use CSS custom properties from tokens.css.

const { useState, useEffect, useRef, useCallback } = React;
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = docx;

const GOOGLE_CLIENT_ID = "457583731351-di8h6sl5hjpv5ek5daog5l6muqn2o9v5.apps.googleusercontent.com";

// ── Multi-scenario helpers ───────────────────────────────────────────────
// A check can span more than one situation type. Older records only ever
// had a single `scenario` string — treat that as a one-item list so every
// reader below works for both shapes.
function entryScenarios(e) { return (e && e.scenarios && e.scenarios.length) ? e.scenarios : (e && e.scenario ? [e.scenario] : []); }
function combinedQuestions(scenarioNames) { return scenarioNames.flatMap(name => (QS[name]||[]).map(q => ({ ...q, _scenario: name }))); }
function scenarioIcons(names) { return names.map(n => (META[n]||{}).icon || "").join(" "); }

// ── Inline SVG icon system ────────────────────────────────────────────────
const ICONS = {
  lock:          `<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  key:           `<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>`,
  folder:        `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,
  folderOpen:    `<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>`,
  inbox:         `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
  fileText:      `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  history:       `<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>`,
  calendar:      `<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  mail:          `<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`,
  check:         `<polyline points="20 6 9 17 4 12"/>`,
  alertTriangle: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  paperclip:     `<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>`,
  chevronDown:   `<polyline points="6 9 12 15 18 9"/>`,
  chevronUp:     `<polyline points="18 15 12 9 6 15"/>`,
};
function Icon({ name, size=16, color="currentColor", style={} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ display:"inline-block", flexShrink:0, verticalAlign:"middle", ...style }} dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }} aria-hidden="true" />
  );
}

// ── PIN Gate ──────────────────────────────────────────────────────────────
function PinGate({ onUnlock, mode }) {
  const [pin, setPin]            = useState("");
  const [newPin, setNewPin]      = useState("");
  const [confirmPin, setConfirm] = useState("");
  const [error, setError]        = useState("");
  const [shakeKey, setShakeKey]  = useState(0);
  const [changing, setChanging]  = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, [changing]);

  // The server (Netlify Blobs) is the source of truth so the PIN follows
  // you across devices. localStorage is only a fallback if the fetch fails.
  const getCurrentPinHash = async () => {
    try {
      const serverHash = await fetchPinHashFromServer();
      return serverHash || DEFAULT_PIN_HASH;
    } catch (e) {
      console.error("Couldn't reach server for PIN, using local copy", e);
      return loadPinHash();
    }
  };

  const triggerShake = () => { setShakeKey(k=>k+1); };

  const handleUnlock = async () => {
    const hash = await sha256(pin);
    const stored = await getCurrentPinHash();
    if (hash === stored) {
      if (stored === DEFAULT_PIN_HASH) {
        setError("Default PIN must be changed before first use.");
        setChanging(true); setPin("");
      } else { onUnlock(); }
    } else { setError("Incorrect PIN."); setPin(""); triggerShake(); }
  };

  const handleChange = async () => {
    if (newPin.length < 4) { setError("PIN must be at least 4 characters."); return; }
    if (newPin !== confirmPin) { setError("PINs do not match."); triggerShake(); return; }
    const currentHash = await sha256(pin);
    const stored = await getCurrentPinHash();
    if (currentHash !== stored) { setError("Current PIN is incorrect."); setPin(""); triggerShake(); return; }
    const newHash = await sha256(newPin);
    savePinHash(newHash);
    try { await savePinHashToServer(newHash); }
    catch (e) { console.error("Couldn't save PIN to server, saved locally only", e); }
    onUnlock();
  };

  const s = {
    wrap:     { padding:"24px 22px", textAlign:"center" },
    lockIcon: { marginBottom:12, display:"flex", justifyContent:"center" },
    title:    { fontSize:"0.9rem", fontWeight:700, color:"var(--pac-text)", marginBottom:6 },
    sub:      { fontSize:"0.78rem", color:"var(--pac-text-muted)", lineHeight:1.5, marginBottom:18 },
    input:    { width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid var(--pac-border-3)", borderRadius:"var(--pac-radius-md)", padding:"10px 14px", color:"var(--pac-text)", fontSize:"0.9rem", fontFamily:"inherit", outline:"none", textAlign:"center", letterSpacing:"0.2em", marginBottom:10 },
    btn:      (primary) => ({ width:"100%", padding:"10px", borderRadius:"var(--pac-radius-full)", border:primary?"1px solid var(--pac-accent-border)":"1px solid var(--pac-border-3)", background:primary?"var(--pac-accent-bg)":"var(--pac-surface-1)", color:primary?"var(--pac-accent)":"var(--pac-text)", cursor:"pointer", fontSize:"0.82rem", fontWeight:600, fontFamily:"inherit", marginBottom:8 }),
    err:      { fontSize:"0.77rem", color:"var(--pac-risk)", marginBottom:10, minHeight:18 },
    link:     { fontSize:"0.72rem", color:"var(--pac-accent-text-55)", cursor:"pointer", background:"none", border:"none", fontFamily:"inherit", padding:0, marginTop:4 },
  };

  if (!changing) return (
    <div style={s.wrap}>
      <div style={s.lockIcon}><Icon name="lock" size={32} color="var(--pac-accent)" /></div>
      <div style={s.title}>HR Access Only</div>
      <div style={s.sub}>Enter your admin PIN to manage company policies. You will be required to set a new PIN if you haven't already.</div>
      <div key={shakeKey} className={shakeKey ? "shake" : ""}>
        <input ref={inputRef} style={s.input} type="password" placeholder="Enter PIN" value={pin} onChange={e=>{ setPin(e.target.value); setError(""); }} onKeyDown={e=>e.key==="Enter"&&handleUnlock()} maxLength={20} />
      </div>
      <div style={s.err}>{error}</div>
      <button style={s.btn(true)} onClick={handleUnlock}>Unlock</button>
      <button style={s.link} onClick={()=>{ setChanging(true); setError(""); setPin(""); }}>Change PIN</button>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.lockIcon}><Icon name="key" size={32} color="var(--pac-accent)" /></div>
      <div style={s.title}>Change HR PIN</div>
      <div style={s.sub}>Enter your current PIN, then set a new one.</div>
      <input style={s.input} type="password" placeholder="Current PIN" value={pin} onChange={e=>{ setPin(e.target.value); setError(""); }} maxLength={20} />
      <input style={s.input} type="password" placeholder="New PIN (min 4 characters)" value={newPin} onChange={e=>{ setNewPin(e.target.value); setError(""); }} maxLength={20} />
      <div key={shakeKey} className={shakeKey ? "shake" : ""}>
        <input style={s.input} type="password" placeholder="Confirm new PIN" value={confirmPin} onChange={e=>{ setConfirm(e.target.value); setError(""); }} onKeyDown={e=>e.key==="Enter"&&handleChange()} maxLength={20} />
      </div>
      <div style={s.err}>{error}</div>
      <button style={s.btn(true)} onClick={handleChange}>Save new PIN</button>
      <button style={s.link} onClick={()=>{ setChanging(false); setError(""); }}>Back</button>
    </div>
  );
}

// ── Policy Library Modal ──────────────────────────────────────────────────
function PolicyLibrary({ policies, setPolicies, onClose, currentScenarios, hrEmail, onSaveHrEmail, slackWebhook, onSaveSlackWebhook, teamsWebhook, onSaveTeamsWebhook, unlocked, setUnlocked }) {
  const [tab, setTab]                     = useState("view");
  const [pasteText, setPasteText]         = useState("");
  const [pasteName, setPasteName]         = useState("");
  const [pasteCategory, setPasteCat]      = useState("handbook");
  const [dragActive, setDragActive]       = useState(false);
  const [viewDoc, setViewDoc]             = useState(null);
  const [docSearch, setDocSearch]         = useState("");
  const [docMatchIndex, setDocMatchIndex] = useState(0);
  const docMatchRefs                      = useRef([]);
  const [pdfPage, setPdfPage]             = useState(1);
  const [pdfNumPages, setPdfNumPages]     = useState(0);
  const [pdfLoadState, setPdfLoadState]   = useState("idle"); // idle | loading | ready | error
  const [pdfObjectUrl, setPdfObjectUrl]   = useState(null);
  const [editingId, setEditingId]         = useState(null);
  const [showReset, setShowReset]         = useState(false);
  const [unlockingInView, setUnlockingInView] = useState(false);
  const [hrEmailInput, setHrEmailInput]   = useState(hrEmail||"");
  const [hrEmailSaved, setHrEmailSaved]   = useState(false);
  const [hrEmailSaving, setHrEmailSaving] = useState(false);
  const [hrEmailError, setHrEmailError]   = useState(false);
  useEffect(() => { setHrEmailInput(hrEmail||""); }, [hrEmail]);
  const [slackInput, setSlackInput]       = useState(slackWebhook||"");
  const [slackSaved, setSlackSaved]       = useState(false);
  const [teamsInput, setTeamsInput]       = useState(teamsWebhook||"");
  const [teamsSaved, setTeamsSaved]       = useState(false);
  const [hrSubmissions, setHrSubmissions] = useState([]);
  const [viewingSub, setViewingSub]       = useState(null);
  const [allChecks, setAllChecks]         = useState([]);
  const [viewingCheck, setViewingCheck]   = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { fetchHrSubmissions().then(setHrSubmissions).catch(err => console.error("Couldn't load HR submissions", err)); }, []);
  useEffect(() => { fetchCheckHistory().then(setAllChecks).catch(err => console.error("Couldn't load all checks", err)); }, []);

  const readPdf = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
        const pageLines = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          let pageText = "";
          let lastY = null, lastEndX = null;
          for (const item of content.items) {
            const str = item.str;
            const x = item.transform[4], y = item.transform[5];
            const height = item.height || Math.abs(item.transform[3]) || 12;
            if (lastY !== null && Math.abs(y - lastY) > height * 0.4) {
              // Moved to a new line — a big vertical jump reads as a paragraph break.
              pageText += Math.abs(y - lastY) > height * 1.6 ? "\n\n" : "\n";
              lastEndX = null;
            } else if (lastEndX !== null && str) {
              // Same line: only insert a space if there's an actual visual gap,
              // otherwise adjacent glyph runs get smashed together or torn apart.
              const avgCharWidth = item.width && str.length ? item.width / str.length : height * 0.5;
              if (x - lastEndX > avgCharWidth * 0.3) pageText += " ";
            }
            pageText += str;
            if (str) { lastEndX = x + (item.width || 0); lastY = y; }
          }
          pageLines.push(pageText.trim().split("\n"));
        }

        // Running headers/footers (e.g. "Company Name | Modified by...") repeat
        // verbatim on nearly every page, and bare page numbers ("0", "1", "2"...)
        // show up as their own line since they sit apart from body text. Neither
        // reads as real content — left in, a handbook renders as the same header
        // line duplicated dozens of times with stray digits scattered through it.
        const lineCounts = new Map();
        for (const lines of pageLines) {
          const seenOnPage = new Set();
          for (const line of lines) {
            const t = line.trim();
            if (!t || seenOnPage.has(t)) continue;
            seenOnPage.add(t);
            lineCounts.set(t, (lineCounts.get(t) || 0) + 1);
          }
        }
        const pageCount = pageLines.length;
        const isPageNumber = (t) => /^(page\s*)?\d{1,4}(\s*(\/|of)\s*\d{1,4})?$/i.test(t);
        const isBoilerplate = (line) => {
          const t = line.trim();
          if (!t) return false;
          if (pageCount > 2 && lineCounts.get(t) >= Math.ceil(pageCount * 0.6)) return true;
          return isPageNumber(t) && t.length <= 12;
        };

        // One entry per real PDF page (index i = page i+1), kept in parallel with
        // the flattened `text` below — the page viewer renders actual page
        // images and needs search results mapped back to a page number, which
        // a single joined string can't give it.
        const pageTexts = pageLines.map((lines) =>
          lines.filter((l) => !isBoilerplate(l)).join("\n").trim().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
        );
        let text = pageTexts.filter(Boolean).join("\n\n").trim();
        resolve({
          name: file.name,
          text: text.substring(0,200000) || "[This PDF has no extractable text (likely a scanned image) — Find-in-document search won't return results, but the pages are still viewable below.]",
          pageTexts,
          size: file.size,
        });
      } catch (err) {
        console.error("PDF parse failed for", file.name, err);
        resolve({ name:file.name, text:"[PDF could not be parsed — use Paste Text instead.]", size:file.size });
      }
    };
    reader.onerror = () => {
      console.error("FileReader failed to read", file.name, reader.error);
      resolve({ name:file.name, text:"[Could not read file — use Paste Text instead.]", size:file.size });
    };
    reader.readAsArrayBuffer(file);
  });

  const isWordFile = (file) => /\.docx?$/i.test(file.name) || /wordprocessingml|msword/.test(file.type);
  const isPdfFile  = (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isTextish  = (file) => /\.(txt|md)$/i.test(file.name) || /^text\//.test(file.type);

  const readFile = (file) => new Promise((resolve) => {
    if (isWordFile(file) && !isPdfFile(file)) {
      resolve({ name:file.name, text:"[.doc/.docx files can't be read automatically yet — copy the text and use Paste Text instead.]", size:file.size });
      return;
    }
    if (isPdfFile(file)) {
      if (typeof pdfjsLib === "undefined") {
        resolve({ name:file.name, text:"[PDF reader failed to load — use Paste Text instead.]", size:file.size });
        return;
      }
      resolve(readPdf(file));
      return;
    }
    if (isTextish(file)) {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ name:file.name, text:e.target.result||"", size:file.size });
      reader.onerror = () => {
        console.error("FileReader failed to read", file.name, reader.error);
        resolve({ name:file.name, text:"", size:file.size });
      };
      reader.readAsText(file);
      return;
    }
    // Unrecognized name/MIME (e.g. a PDF dropped without a .pdf extension) — sniff the header bytes
    // rather than assume plain text, so raw binary never lands in the stored policy text.
    const sniffer = new FileReader();
    sniffer.onload = (e) => {
      const header = String.fromCharCode(...new Uint8Array(e.target.result.slice(0, 5)));
      if (header === "%PDF-") {
        if (typeof pdfjsLib === "undefined") {
          resolve({ name:file.name, text:"[PDF reader failed to load — use Paste Text instead.]", size:file.size });
        } else {
          resolve(readPdf(file));
        }
      } else {
        resolve({ name:file.name, text:new TextDecoder("utf-8").decode(e.target.result)||"", size:file.size });
      }
    };
    sniffer.onerror = () => {
      console.error("FileReader failed to read", file.name, sniffer.error);
      resolve({ name:file.name, text:"", size:file.size });
    };
    sniffer.readAsArrayBuffer(file);
  });

  const [uploading, setUploading] = useState(false);

  const bytesToBase64 = (bytes) => {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  const handleFiles = async (files) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5*1024*1024) { alert(`${file.name} is over 5MB. Please paste the text directly.`); continue; }
        const { name, text, pageTexts } = await readFile(file);
        const lower = (name+" "+text.substring(0,500)).toLowerCase();
        let autoCategory = "other";
        if (lower.match(/attendance|absent|tardiness|late|leave policy/)) autoCategory = "attendance";
        else if (lower.match(/performance|pip|improvement|coaching|discipline/)) autoCategory = "performance";
        else if (lower.match(/handbook|code of conduct|workplace policy/)) autoCategory = "handbook";
        else if (lower.match(/accommodat|ada|disability|reasonable/)) autoCategory = "accommodation";
        else if (lower.match(/termination|separation|severance|rif|layoff/)) autoCategory = "separation";
        else if (lower.match(/harassment|discrimination|eeoc|complaint/)) autoCategory = "conduct";
        let pdfBase64;
        if (Array.isArray(pageTexts)) {
          try { pdfBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer())); }
          catch (err) { console.error("Couldn't encode PDF bytes for", name, err); }
        }
        try {
          const meta = await createPolicy({ name, text, pageTexts: pdfBase64 ? pageTexts : undefined, pdfBase64, category: autoCategory });
          setPolicies(p => [...p, meta]);
        } catch (err) {
          console.error("Couldn't save policy", name, err);
          alert(`Couldn't save ${name}. Check your connection and try again.`);
        }
      }
      setTab("view");
    } finally {
      setUploading(false);
    }
  };

  const addPaste = async () => {
    if (!pasteText.trim()) return;
    try {
      const meta = await createPolicy({ name: pasteName.trim()||"Pasted policy "+(policies.length+1), text: pasteText.trim(), category: pasteCategory });
      setPolicies(p => [...p, meta]);
      setPasteText(""); setPasteName(""); setTab("view");
    } catch (err) {
      console.error("Couldn't save pasted policy", err);
      alert("Couldn't save. Check your connection and try again.");
    }
  };

  const removeDoc = async (id) => {
    if (viewDoc&&viewDoc.id===id) setViewDoc(null);
    setPolicies(p => p.filter(d=>d.id!==id));
    try { await deletePolicy(id); }
    catch (err) { console.error("Couldn't delete policy", id, err); }
  };

  const updateCategory = async (id, cat) => {
    setPolicies(p => p.map(d=>d.id===id?{...d,category:cat}:d));
    try { await updatePolicyCategory(id, cat); }
    catch (err) { console.error("Couldn't update category", id, err); }
  };

  const handleReset = async () => {
    if (!window.confirm("This will delete all stored policies and reset the PIN to 1234. This cannot be undone.")) return;
    setPolicies([]); savePinHash(DEFAULT_PIN_HASH);
    setShowReset(false); setUnlocked(false); setTab("view");
    try { await resetAllPolicies(); }
    catch (err) { console.error("Couldn't reset policies on the server", err); }
    try { await savePinHashToServer(DEFAULT_PIN_HASH); }
    catch (err) { console.error("Couldn't reset PIN on the server", err); }
  };

  const relevantDocs = currentScenarios && currentScenarios.length
    ? policies.filter(p=>{ const cat=POLICY_CATEGORIES.find(c=>c.id===p.category); return cat&&(currentScenarios.some(name=>cat.scenarios.includes(name))||cat.id==="other"); })
    : policies;

  const s = {
    overlay: { position:"fixed", inset:0, background:"var(--pac-overlay)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"20px 16px", overflowY:"auto" },
    modal:   { width:"100%", maxWidth:680, background:"linear-gradient(160deg,#0a1628,#060f1e)", border:"1px solid var(--pac-border-3)", borderRadius:18, overflow:"hidden", marginTop:8 },
    header:  { padding:"18px 22px", borderBottom:"1px solid var(--pac-border-1)", display:"flex", alignItems:"center", justifyContent:"space-between" },
    tab:     (active) => ({ padding:"7px 14px", borderRadius:"var(--pac-radius-full)", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600, fontFamily:"inherit", background:active?"var(--pac-accent-tab-bg)":"transparent", color:active?"var(--pac-accent)":"var(--pac-text-muted)", transition:"all .15s", position:"relative" }),
    btn:     (primary) => ({ padding:primary?"9px 18px":"7px 14px", borderRadius:"var(--pac-radius-full)", border:primary?"1px solid var(--pac-accent-border)":"1px solid var(--pac-border-3)", background:primary?"var(--pac-accent-bg)":"var(--pac-surface-1)", color:primary?"var(--pac-accent)":"var(--pac-text)", cursor:"pointer", fontSize:"0.8rem", fontWeight:600, fontFamily:"inherit" }),
    input:   { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid var(--pac-border-3)", borderRadius:"var(--pac-radius-sm)", padding:"9px 12px", color:"var(--pac-text)", fontSize:"0.83rem", fontFamily:"inherit", outline:"none" },
    select:  { background:"rgba(255,255,255,0.05)", border:"1px solid var(--pac-border-3)", borderRadius:"var(--pac-radius-sm)", padding:"7px 10px", color:"var(--pac-text)", fontSize:"0.8rem", fontFamily:"inherit", outline:"none", cursor:"pointer" },
  };

  const lockBadge = (
    <span style={{ fontSize:"0.6rem", verticalAlign:"middle", marginLeft:5, padding:"1px 5px", borderRadius:"var(--pac-radius-badge)", background:"var(--pac-risk-bg)", color:"var(--pac-risk)", border:"1px solid var(--pac-risk-border-alt)", fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>HR</span>
  );

  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Short, mostly-uppercase lines read as section headings in policy PDFs
  // (e.g. "1-12. IMMIGRATION POLICY") — bold them so the doc reads like a handbook, not a wall of text.
  const isHeadingLine = (line) => {
    const t = line.trim();
    if (t.length < 3 || t.length > 90) return false;
    const letters = t.replace(/[^A-Za-z]/g, "");
    return letters.length >= 3 && letters === letters.toUpperCase();
  };

  const countDocMatches = (text, query) => {
    const q = query.trim();
    if (!q) return 0;
    const re = new RegExp(escapeRegExp(q), "gi");
    return (text.match(re) || []).length;
  };

  // Same idea as countDocMatches, but for the real-page viewer: matches need a
  // page number to jump to (a rendered PDF page has no text nodes to scroll
  // to), so this returns one entry per match with its page and a bit of
  // surrounding text instead of just a count.
  const matchLocations = (pageTexts, query) => {
    const q = query.trim();
    if (!q || !Array.isArray(pageTexts)) return [];
    const out = [];
    pageTexts.forEach((pt, i) => {
      const re = new RegExp(escapeRegExp(q), "gi");
      let m;
      while ((m = re.exec(pt))) {
        const start = Math.max(0, m.index - 40);
        const end = Math.min(pt.length, m.index + q.length + 40);
        out.push({ page: i + 1, snippet: (start>0?"…":"") + pt.slice(start, end).trim() + (end<pt.length?"…":"") });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });
    return out;
  };

  // Renders doc text as individual lines (headings bolded) with search matches
  // wrapped in <mark>; collects one ref per match into refsHolder for scroll-to-match.
  const renderDocLines = (text, query, activeIndex, refsHolder) => {
    refsHolder.current = [];
    let counter = 0;
    const q = query.trim();
    const re = q ? new RegExp(`(${escapeRegExp(q)})`, "gi") : null;
    return text.split("\n").map((line, li) => {
      if (!line.trim()) return <div key={li} style={{ height:10 }} />;
      const headingStyle = isHeadingLine(line)
        ? { fontWeight:700, color:"var(--pac-text)", marginTop:li>0?14:0, marginBottom:4 }
        : { marginBottom:2 };
      if (!re) return <div key={li} style={headingStyle}>{line}</div>;
      const parts = line.split(re);
      return (
        <div key={li} style={headingStyle}>
          {parts.map((part, pi) => {
            if (pi % 2 !== 1) return <React.Fragment key={pi}>{part}</React.Fragment>;
            const idx = counter++;
            const isActive = idx === activeIndex;
            return (
              <mark
                key={pi}
                ref={el => { if (el) refsHolder.current[idx] = el; }}
                style={{ background: isActive ? "var(--pac-accent)" : "rgba(255,220,100,0.45)", color: isActive ? "#0a1628" : "inherit", borderRadius:3, padding:"0 1px" }}
              >{part}</mark>
            );
          })}
        </div>
      );
    });
  };

  useEffect(() => {
    if (docSearch.trim() && docMatchRefs.current[docMatchIndex]) {
      docMatchRefs.current[docMatchIndex].scrollIntoView({ block:"center", behavior:"smooth" });
    }
  }, [docMatchIndex, docSearch, viewDoc]);

  // Fetches the open document's full content (text + PDF bytes) from the
  // server — the policies list only carries light metadata, so this runs
  // once per doc switch. For a PDF, the bytes are then handed to the
  // browser's own PDF reader via an object URL, instead of redrawing pages
  // onto a canvas ourselves. pdf.js is still used here, but only to read
  // the page count for the Prev/Next controls below. Keyed on the doc id
  // (not the object) so merging the fetched content back into viewDoc below
  // doesn't re-trigger this effect.
  useEffect(() => {
    let cancelled = false;
    let url = null;
    setPdfNumPages(0);
    setPdfPage(1);
    setPdfObjectUrl(null);
    if (!viewDoc) { setPdfLoadState("idle"); return; }
    setPdfLoadState("loading");
    const docId = viewDoc.id;
    const wantsPdf = viewDoc.hasPdf;
    (async () => {
      try {
        const full = await fetchPolicyContent(docId);
        if (cancelled) return;
        setViewDoc(prev => prev && prev.id === docId ? { ...prev, text: full.text, pageTexts: full.pageTexts } : prev);
        if (wantsPdf) {
          if (!full.pdfBase64) throw new Error("no stored PDF for this document");
          const bin = atob(full.pdfBase64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
          if (cancelled) return;
          url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
          setPdfNumPages(pdf.numPages);
          setPdfObjectUrl(url);
        }
        setPdfLoadState("ready");
      } catch (err) {
        console.error("Couldn't load document content for", viewDoc && viewDoc.name, err);
        if (!cancelled) setPdfLoadState("error");
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [viewDoc?.id]);

  return (
    <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={s.modal} className="fade-in">
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={{ fontSize:"1rem", fontWeight:700 }}>Company Policies</div>
            <div style={{ fontSize:"0.78rem", color:"var(--pac-text-muted)", marginTop:2 }}>
              {policies.length===0 ? "No documents on file" : `${policies.length} document${policies.length!==1?"s":""} on file — shared across all devices`}
            </div>
          </div>
          <button onClick={onClose} style={s.btn(false)}>Close</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, padding:"12px 22px 0", borderBottom:"1px solid var(--pac-border-1)", flexWrap:"wrap" }}>
          <button style={s.tab(tab==="view")} onClick={()=>{ setTab("view"); setViewDoc(null); }}>
            View Policies {policies.length>0&&<span style={{ marginLeft:4, fontSize:"0.68rem", background:"rgba(255,255,255,0.1)", padding:"1px 5px", borderRadius:99 }}>{policies.length}</span>}
          </button>
          <button style={s.tab(tab==="upload")} onClick={()=>setTab("upload")}>
            Upload Files {lockBadge}
          </button>
          <button style={s.tab(tab==="paste")} onClick={()=>setTab("paste")}>
            Paste Text {lockBadge}
          </button>
          <button style={s.tab(tab==="dashboard")} onClick={()=>{ setTab("dashboard"); setViewingSub(null); }}>
            HR Dashboard {lockBadge}{hrSubmissions.length>0&&<span style={{ marginLeft:4, fontSize:"0.68rem", background:"rgba(255,255,255,0.1)", padding:"1px 5px", borderRadius:99 }}>{hrSubmissions.length}</span>}
          </button>
          <button style={s.tab(tab==="allChecks")} onClick={()=>{ setTab("allChecks"); setViewingCheck(null); }}>
            All Checks {lockBadge}{allChecks.length>0&&<span style={{ marginLeft:4, fontSize:"0.68rem", background:"rgba(255,255,255,0.1)", padding:"1px 5px", borderRadius:99 }}>{allChecks.length}</span>}
          </button>
        </div>

        <div style={{ padding:"20px 22px" }}>

          {/* VIEW TAB */}
          {tab==="view" && (
            <div>
              {policies.length===0 ? (
                <div style={{ textAlign:"center", padding:"32px 0", color:"var(--pac-text-muted)" }}>
                  <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}><Icon name="folder" size={40} color="var(--pac-text-dim)" /></div>
                  <div style={{ fontSize:"0.88rem" }}>No policies on file yet.</div>
                  <div style={{ fontSize:"0.79rem", marginTop:6, color:"var(--pac-text-dim)" }}>HR can add documents using the Upload or Paste tabs.</div>
                </div>
              ) : viewDoc ? (
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                    <button style={s.btn(false)} onClick={()=>{ setViewDoc(null); setDocSearch(""); setDocMatchIndex(0); }}>Back</button>
                    <div style={{ fontWeight:700, fontSize:"0.9rem" }}>{viewDoc.name}</div>
                  </div>

                  {pdfLoadState==="error" && (
                    <div style={{ background:"var(--pac-risk-bg)", border:"1px solid var(--pac-risk-border-alt)", borderRadius:"var(--pac-radius-md)", padding:"10px 13px", fontSize:"0.78rem", color:"var(--pac-risk)", marginBottom:12 }}>
                      Couldn't load the stored pages for this file (it may have been uploaded before page view was added, or browser storage was cleared) — showing the extracted text instead.
                    </div>
                  )}

                  {viewDoc.hasPdf && pdfLoadState!=="error" ? (
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <input
                          style={{ ...s.input, flex:1 }}
                          placeholder="Find in document..."
                          value={docSearch}
                          onChange={e=>{ setDocSearch(e.target.value); setDocMatchIndex(0); }}
                          onKeyDown={e=>{
                            const matches = matchLocations(viewDoc.pageTexts||[], docSearch);
                            if (e.key==="Enter" && matches.length>0) {
                              const ni = e.shiftKey ? (docMatchIndex-1+matches.length)%matches.length : (docMatchIndex+1)%matches.length;
                              setDocMatchIndex(ni); setPdfPage(matches[ni].page);
                            }
                          }}
                        />
                        {docSearch.trim() && (() => {
                          const matches = matchLocations(viewDoc.pageTexts||[], docSearch);
                          const total = matches.length;
                          return (
                            <>
                              <span style={{ fontSize:"0.75rem", color:"var(--pac-text-muted)", whiteSpace:"nowrap" }}>{total ? `${docMatchIndex+1} of ${total}` : "No matches"}</span>
                              <button style={s.btn(false)} disabled={!total} onClick={()=>{ const ni=(docMatchIndex-1+total)%total; setDocMatchIndex(ni); setPdfPage(matches[ni].page); }}>↑</button>
                              <button style={s.btn(false)} disabled={!total} onClick={()=>{ const ni=(docMatchIndex+1)%total; setDocMatchIndex(ni); setPdfPage(matches[ni].page); }}>↓</button>
                            </>
                          );
                        })()}
                      </div>
                      {docSearch.trim() && (() => {
                        const matches = matchLocations(viewDoc.pageTexts||[], docSearch);
                        const m = matches[docMatchIndex];
                        return m ? (
                          <div style={{ fontSize:"0.74rem", color:"var(--pac-text-muted)", marginBottom:8 }}>Page {m.page}: "{m.snippet}"</div>
                        ) : null;
                      })()}

                      {pdfLoadState==="loading" ? (
                        <div style={{ textAlign:"center", padding:"48px 0", color:"var(--pac-text-muted)", fontSize:"0.82rem" }}>Loading pages…</div>
                      ) : (
                        <div>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:8 }}>
                            <button style={s.btn(false)} disabled={pdfPage<=1} onClick={()=>setPdfPage(p=>Math.max(1,p-1))}>← Prev</button>
                            <span style={{ fontSize:"0.78rem", color:"var(--pac-text-muted)" }}>Page {pdfPage} of {pdfNumPages}</span>
                            <button style={s.btn(false)} disabled={pdfPage>=pdfNumPages} onClick={()=>setPdfPage(p=>Math.min(pdfNumPages,p+1))}>Next →</button>
                          </div>
                          <div style={{ background:"var(--pac-surface-2)", border:"1px solid var(--pac-border-1)", borderRadius:10, overflow:"hidden" }}>
                            {pdfObjectUrl && (
                              <iframe
                                key={pdfPage}
                                src={`${pdfObjectUrl}#page=${pdfPage}`}
                                title={viewDoc.name}
                                style={{ width:"100%", height:460, border:"none", display:"block", background:"#fff" }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : pdfLoadState==="loading" ? (
                    <div style={{ textAlign:"center", padding:"48px 0", color:"var(--pac-text-muted)", fontSize:"0.82rem" }}>Loading…</div>
                  ) : (
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <input
                          style={{ ...s.input, flex:1 }}
                          placeholder="Find in document..."
                          value={docSearch}
                          onChange={e=>{ setDocSearch(e.target.value); setDocMatchIndex(0); }}
                          onKeyDown={e=>{
                            const total = countDocMatches(viewDoc.text||"", docSearch);
                            if (e.key==="Enter" && total>0) setDocMatchIndex(i => e.shiftKey ? (i-1+total)%total : (i+1)%total);
                          }}
                        />
                        {docSearch.trim() && (() => {
                          const total = countDocMatches(viewDoc.text||"", docSearch);
                          return (
                            <>
                              <span style={{ fontSize:"0.75rem", color:"var(--pac-text-muted)", whiteSpace:"nowrap" }}>{total ? `${docMatchIndex+1} of ${total}` : "No matches"}</span>
                              <button style={s.btn(false)} disabled={!total} onClick={()=>setDocMatchIndex(i=>(i-1+total)%total)}>↑</button>
                              <button style={s.btn(false)} disabled={!total} onClick={()=>setDocMatchIndex(i=>(i+1)%total)}>↓</button>
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ background:"var(--pac-surface-2)", border:"1px solid var(--pac-border-1)", borderRadius:10, padding:"14px 16px", maxHeight:360, overflowY:"auto", fontSize:"0.8rem", lineHeight:1.65, color:"var(--pac-text-70)", wordBreak:"break-word" }}>
                        {renderDocLines(viewDoc.text||"", docSearch, docMatchIndex, docMatchRefs)}
                      </div>
                    </div>
                  )}
                </div>
              ) : unlockingInView ? (
                <div>
                  <PinGate onUnlock={()=>{ setUnlocked(true); setUnlockingInView(false); }} />
                  <button style={{ ...s.btn(false), width:"100%" }} onClick={()=>setUnlockingInView(false)}>Cancel</button>
                </div>
              ) : (
                <div>
                  {!unlocked && (
                    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
                      <button style={{ ...s.btn(false), fontSize:"0.74rem" }} onClick={()=>setUnlockingInView(true)}>Unlock to remove or edit</button>
                    </div>
                  )}
                  {currentScenarios && currentScenarios.length>0 && relevantDocs.length>0 && relevantDocs.length<policies.length && (
                    <div style={{ background:"var(--pac-good-bg-alt)", border:"1px solid var(--pac-good-border-alt)", borderRadius:"var(--pac-radius-md)", padding:"9px 13px", fontSize:"0.79rem", color:"var(--pac-good)", marginBottom:14 }}>
                      {relevantDocs.length} of {policies.length} documents are relevant to the current scenario{currentScenarios.length>1?"s":""}.
                    </div>
                  )}
                  {policies.map(doc=>{
                    const cat=POLICY_CATEGORIES.find(c=>c.id===doc.category);
                    const isRelevant=currentScenarios&&currentScenarios.length>0&&relevantDocs.find(d=>d.id===doc.id);
                    return (
                      <div key={doc.id} style={{ background:isRelevant?"var(--pac-accent-surface-alt)":"var(--pac-surface-2)", border:`1px solid ${isRelevant?"var(--pac-accent-border-2)":"var(--pac-border-1)"}`, borderRadius:10, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"flex-start", gap:12 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                            <span style={{ fontWeight:700, fontSize:"0.85rem" }}>{doc.name}</span>
                            {isRelevant && <span style={{ fontSize:"0.62rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", background:"var(--pac-accent-bg)", border:"1px solid var(--pac-accent-border-3)", color:"var(--pac-accent)", borderRadius:"var(--pac-radius-badge)", padding:"1px 6px" }}>Relevant</span>}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                            {unlocked && editingId===doc.id ? (
                              <select style={{ ...s.select, fontSize:"0.73rem", padding:"3px 8px" }} value={doc.category} onChange={e=>{ updateCategory(doc.id,e.target.value); setEditingId(null); }}>
                                {POLICY_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                              </select>
                            ) : (
                              <span onClick={()=>unlocked&&setEditingId(doc.id)} style={{ fontSize:"0.69rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.04em", padding:"2px 7px", borderRadius:5, cursor:unlocked?"pointer":"default", background:`${cat?.color}18`, color:cat?.color, border:`1px solid ${cat?.color}30` }}>{cat?.label}</span>
                            )}
                            <span style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)" }}>{(doc.chars/1000).toFixed(1)}k chars · {doc.addedAt}</span>
                          </div>
                          <div style={{ fontSize:"0.76rem", color:"var(--pac-text-60)", marginTop:5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {(doc.preview||"").replace(/\s+/g," ")}...
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                          <button style={s.btn(false)} onClick={()=>setViewDoc(doc)}>View</button>
                          {unlocked && <button style={{ ...s.btn(false), color:"var(--pac-risk)", borderColor:"var(--pac-risk-bg-alt)" }} onClick={()=>removeDoc(doc.id)}>Remove</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* UPLOAD TAB — PIN gated */}
          {tab==="upload" && (
            !unlocked ? <PinGate onUnlock={()=>setUnlocked(true)} /> : (
              <div>
                <div style={{ fontSize:"0.82rem", color:"var(--pac-text-65)", lineHeight:1.6, marginBottom:14 }}>
                  Upload policy documents, handbook sections, or any HR reference material. Supported: .txt, .pdf, .doc, .docx, .md up to 5MB. Saved to the company's shared library — visible from any device.
                </div>
                <div
                  style={{ border:`2px dashed ${dragActive?"rgba(34,193,255,0.6)":"rgba(255,255,255,0.12)"}`, background:dragActive?"var(--pac-accent-surface-2)":"var(--pac-surface-2)", borderRadius:12, padding:"32px 24px", textAlign:"center", cursor:"pointer", transition:"all .15s", marginBottom:14 }}
                  onClick={()=>fileRef.current.click()}
                  onDragOver={e=>{e.preventDefault();setDragActive(true);}}
                  onDragLeave={()=>setDragActive(false)}
                  onDrop={e=>{e.preventDefault();setDragActive(false);handleFiles(e.dataTransfer.files);}}
                >
                  <div style={{ marginBottom:10, display:"flex", justifyContent:"center" }}><Icon name="folderOpen" size={40} color={dragActive?"var(--pac-accent)":"var(--pac-text-muted)"} /></div>
                  <div style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--pac-text)", marginBottom:4 }}>Drop files here or click to browse</div>
                  <div style={{ fontSize:"0.76rem", color:"var(--pac-text-muted)" }}>.txt, .pdf, .doc, .docx, .md — up to 5MB each</div>
                  <input ref={fileRef} type="file" multiple accept=".txt,.pdf,.doc,.docx,.md,text/plain,application/pdf" style={{ display:"none" }} onChange={e=>handleFiles(e.target.files)} />
                </div>
                <div style={{ background:"var(--pac-accent-surface-2)", border:"1px solid var(--pac-accent-border-4)", borderRadius:"var(--pac-radius-md)", padding:"10px 14px", fontSize:"0.78rem", color:"var(--pac-accent-text-85)", lineHeight:1.5, marginBottom:16 }}>
                  PDF tip: every PDF still displays as real pages, including scanned/image-only ones. But scanned PDFs have no text layer to search — for a searchable copy of those, copy the text and use the Paste Text tab instead.
                </div>
                {/* Change PIN + Reset */}
                <div style={{ borderTop:"1px solid var(--pac-border-0)", paddingTop:14, display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button style={{ ...s.btn(false), fontSize:"0.74rem" }} onClick={()=>{ setUnlocked(false); }}>Change PIN</button>
                  {!showReset
                    ? <button style={{ ...s.btn(false), fontSize:"0.74rem", color:"var(--pac-risk)", borderColor:"var(--pac-risk-bg-alt)" }} onClick={()=>setShowReset(true)}>Reset all policies + PIN</button>
                    : <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:"0.76rem", color:"var(--pac-risk)" }}>This deletes everything.</span>
                        <button style={{ ...s.btn(false), fontSize:"0.74rem", color:"var(--pac-risk)", borderColor:"var(--pac-risk-border-deep)" }} onClick={handleReset}>Confirm reset</button>
                        <button style={{ ...s.btn(false), fontSize:"0.74rem" }} onClick={()=>setShowReset(false)}>Cancel</button>
                      </div>
                  }
                </div>
                {/* HR Settings */}
                <div style={{ borderTop:"1px solid var(--pac-border-0)", paddingTop:14, marginTop:6 }}>
                  <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6, fontWeight:700 }}>HR Email Address</div>
                  <div style={{ fontSize:"0.77rem", color:"rgba(248,250,252,0.55)", lineHeight:1.5, marginBottom:8 }}>Employees can send check results directly to this address using the "Send to HR" button on result screens.</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <input style={{ ...s.input, flex:1, minWidth:180, fontSize:"16px" }} type="email" placeholder="hr@yourcompany.com" value={hrEmailInput} onChange={e=>{ setHrEmailInput(e.target.value); setHrEmailSaved(false); setHrEmailError(false); }} />
                    <button style={{ ...s.btn(true), opacity:hrEmailSaving?0.6:1 }} disabled={hrEmailSaving} onClick={async()=>{
                      setHrEmailSaving(true); setHrEmailError(false);
                      try { await onSaveHrEmail(hrEmailInput.trim()); setHrEmailSaved(true); }
                      catch(e) { setHrEmailError(true); }
                      setHrEmailSaving(false);
                    }}>{hrEmailSaving?"Saving...":"Save"}</button>
                  </div>
                  {hrEmailSaved && <div style={{ fontSize:"0.77rem", color:"var(--pac-good)", marginTop:6 }}>Saved — applies to every device.</div>}
                  {hrEmailError && <div style={{ fontSize:"0.77rem", color:"var(--pac-risk)", marginTop:6 }}>Couldn't save. Check your connection and try again.</div>}
                </div>
                {/* Notifications */}
                <div style={{ borderTop:"1px solid var(--pac-border-0)", paddingTop:14, marginTop:6 }}>
                  <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6, fontWeight:700 }}>Channel Notifications</div>
                  <div style={{ fontSize:"0.77rem", color:"rgba(248,250,252,0.55)", lineHeight:1.5, marginBottom:12 }}>When a check is sent to HR, a notification card is posted to the configured channels. Paste the incoming webhook URL from Slack or Teams.</div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:"0.69rem", color:"var(--pac-text-muted)", marginBottom:5, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ background:"rgba(74,144,226,0.15)", border:"1px solid rgba(74,144,226,0.3)", color:"#4a90e2", borderRadius:"var(--pac-radius-badge)", padding:"1px 6px", fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.04em" }}>Slack</span>
                      Incoming Webhook URL
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <input style={{ ...s.input, flex:1, minWidth:180, fontSize:"16px" }} placeholder="https://hooks.slack.com/services/..." value={slackInput} onChange={e=>{ setSlackInput(e.target.value); setSlackSaved(false); }} />
                      <button style={s.btn(true)} onClick={()=>{ onSaveSlackWebhook(slackInput.trim()); setSlackSaved(true); }}>Save</button>
                    </div>
                    {slackSaved && <div style={{ fontSize:"0.77rem", color:"var(--pac-good)", marginTop:5 }}>Saved.</div>}
                  </div>
                  <div>
                    <div style={{ fontSize:"0.69rem", color:"var(--pac-text-muted)", marginBottom:5, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ background:"rgba(98,100,167,0.15)", border:"1px solid rgba(98,100,167,0.3)", color:"#9b9de8", borderRadius:"var(--pac-radius-badge)", padding:"1px 6px", fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.04em" }}>Teams</span>
                      Incoming Webhook URL
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <input style={{ ...s.input, flex:1, minWidth:180, fontSize:"16px" }} placeholder="https://outlook.office.com/webhook/..." value={teamsInput} onChange={e=>{ setTeamsInput(e.target.value); setTeamsSaved(false); }} />
                      <button style={s.btn(true)} onClick={()=>{ onSaveTeamsWebhook(teamsInput.trim()); setTeamsSaved(true); }}>Save</button>
                    </div>
                    {teamsSaved && <div style={{ fontSize:"0.77rem", color:"var(--pac-good)", marginTop:5 }}>Saved.</div>}
                  </div>
                </div>
              </div>
            )
          )}

          {/* PASTE TAB — PIN gated */}
          {tab==="paste" && (
            !unlocked ? <PinGate onUnlock={()=>setUnlocked(true)} /> : (
              <div>
                <div style={{ fontSize:"0.82rem", color:"var(--pac-text-65)", lineHeight:1.6, marginBottom:14 }}>
                  Paste policy text directly. Useful for PDFs, copied handbook sections, or any text-based reference material.
                </div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>Document name</div>
                  <input style={s.input} placeholder="e.g. Attendance Policy, Handbook Section 4..." value={pasteName} onChange={e=>setPasteName(e.target.value)} />
                </div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>Category</div>
                  <select style={s.select} value={pasteCategory} onChange={e=>setPasteCat(e.target.value)}>
                    {POLICY_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>Policy text</div>
                  <textarea rows={10} style={{ ...s.input, resize:"vertical" }} placeholder="Paste your policy text here..." value={pasteText} onChange={e=>setPasteText(e.target.value)} />
                </div>
                <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16 }}>
                  <button style={s.btn(true)} onClick={addPaste} disabled={!pasteText.trim()}>Save to library</button>
                  <span style={{ fontSize:"0.74rem", color:"var(--pac-text-muted)" }}>{pasteText.length.toLocaleString()} characters</span>
                </div>
                <div style={{ borderTop:"1px solid var(--pac-border-0)", paddingTop:14, display:"flex", gap:8 }}>
                  <button style={{ ...s.btn(false), fontSize:"0.74rem" }} onClick={()=>setUnlocked(false)}>Change PIN</button>
                </div>
              </div>
            )
          )}

          {/* HR DASHBOARD TAB — PIN gated */}
          {tab==="dashboard" && (
            !unlocked ? <PinGate onUnlock={()=>setUnlocked(true)} /> : (
              <div>
                {hrSubmissions.length===0 ? (
                  <div style={{ textAlign:"center", padding:"32px 0", color:"var(--pac-text-muted)" }}>
                    <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}><Icon name="inbox" size={40} color="var(--pac-text-dim)" /></div>
                    <div style={{ fontSize:"0.88rem" }}>No checks submitted to HR yet.</div>
                    <div style={{ fontSize:"0.79rem", marginTop:6, color:"var(--pac-text-dim)" }}>When someone uses "Send to HR" on their results screen, the check will appear here.</div>
                  </div>
                ) : viewingSub ? (()=>{
                  const sub = viewingSub;
                  const col = C[sub.level];
                  const subNames = entryScenarios(sub);
                  const eqs = combinedQuestions(subNames);
                  const labels = {good:"Low Risk",warn:"Elevated Risk",risk:"High Risk"};
                  const statusColors = {pending:"var(--pac-warn)",reviewing:"var(--pac-accent)",resolved:"var(--pac-good)"};
                  const statusLabels = {pending:"Pending Review",reviewing:"In Review",resolved:"Resolved"};
                  const updateSub = (patch) => {
                    const patched = {...sub,...patch};
                    setHrSubmissions(hrSubmissions.map(s=>s.id===sub.id?patched:s));
                    setViewingSub(patched);
                    updateHrSubmission(sub.id, patch).catch(err => console.error("Couldn't save HR submission update", err));
                  };
                  return (
                    <div>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                        <button style={{ padding:"7px 14px", borderRadius:"var(--pac-radius-full)", border:"1px solid var(--pac-border-3)", background:"var(--pac-surface-1)", color:"var(--pac-text)", cursor:"pointer", fontSize:"0.8rem", fontWeight:600, fontFamily:"inherit" }} onClick={()=>setViewingSub(null)}>Back</button>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:"0.9rem" }}>{scenarioIcons(subNames)} {subNames.join(", ")}</div>
                          {sub.employeeName && <div style={{ fontSize:"0.79rem", color:"var(--pac-accent)", marginTop:2 }}>{sub.employeeName}</div>}
                          <div style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)", marginTop:1 }}>{sub.sentDate} at {sub.sentTime}</div>
                        </div>
                        <span style={{ fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", padding:"3px 8px", borderRadius:5, background:col.bg, color:col.text, border:`1px solid ${col.border}`, flexShrink:0 }}>{labels[sub.level]}</span>
                      </div>
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:7 }}>Status</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {Object.entries(statusLabels).map(([k,v])=>(
                            <button key={k} style={{ padding:"5px 13px", borderRadius:"var(--pac-radius-full)", border:`1px solid ${(sub.status||"pending")===k?`${statusColors[k].replace("var(","").replace(")","")}-66`:"var(--pac-border-3)"}`, background:(sub.status||"pending")===k?`rgba(0,0,0,0)`:"transparent", color:(sub.status||"pending")===k?statusColors[k]:"var(--pac-text-muted)", outline:(sub.status||"pending")===k?`1px solid ${statusColors[k]}`:"none", cursor:"pointer", fontSize:"0.75rem", fontWeight:600, fontFamily:"inherit" }} onClick={()=>updateSub({status:k})}>{v}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>HR Notes</div>
                        <textarea rows={3} style={{ ...s.input, resize:"vertical", fontSize:"16px" }} placeholder="Add internal notes about this check..." value={sub.hrNotes||""} onChange={e=>updateSub({hrNotes:e.target.value})} />
                      </div>
                      <div style={{ borderTop:"1px solid var(--pac-border-1)", paddingTop:12, marginBottom:12 }}>
                        <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:9 }}>Submitted answers</div>
                        {eqs.map((item,i)=>{ const a=sub.answers[i]; const aLabel=a==="yes"?"Yes":a==="no"?"No":"Don't know"; const aColor=a==="yes"?"var(--pac-good)":a==="no"?"var(--pac-risk)":"var(--pac-warn)";
                          return (
                            <div key={i} style={{ borderTop:"1px solid var(--pac-border-0)", paddingTop:9, marginTop:9 }}>
                              <div style={{ fontSize:"0.82rem", lineHeight:1.45, color:"var(--pac-text-70)", marginBottom:3 }}>
                                {item.critical&&<span style={{ fontSize:"0.6rem", fontWeight:700, textTransform:"uppercase", background:"var(--pac-risk-bg)", border:"1px solid var(--pac-risk-border)", color:"var(--pac-risk)", borderRadius:"var(--pac-radius-badge)", padding:"1px 5px", marginRight:6 }}>Critical</span>}
                                {item.q}
                              </div>
                              <div style={{ fontSize:"0.78rem", fontWeight:700, color:aColor }}>{aLabel}</div>
                              {sub.notes[i] && <div style={{ fontSize:"0.76rem", color:"var(--pac-text-muted)", marginTop:3, fontStyle:"italic" }}>{sub.notes[i]}</div>}
                            </div>
                          );
                        })}
                      </div>
                      <button style={{ padding:"7px 14px", borderRadius:"var(--pac-radius-full)", border:"1px solid var(--pac-risk-bg-alt)", background:"transparent", color:"var(--pac-risk)", cursor:"pointer", fontSize:"0.74rem", fontWeight:600, fontFamily:"inherit" }} onClick={()=>{ setHrSubmissions(hrSubmissions.filter(s=>s.id!==sub.id)); setViewingSub(null); deleteHrSubmission(sub.id).catch(err => console.error("Couldn't delete HR submission", err)); }}>Delete this record</button>
                    </div>
                  );
                })() : (
                  <div>
                    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
                      <button style={{ fontSize:"0.72rem", color:"var(--pac-risk)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }} onClick={()=>{ if(!window.confirm("Delete all HR submissions? This cannot be undone."))return; setHrSubmissions([]); clearHrSubmissions().catch(err => console.error("Couldn't clear HR submissions", err)); }}>Clear all</button>
                    </div>
                    {hrSubmissions.map(sub=>{ const col=C[sub.level]; const labels={good:"Low Risk",warn:"Elevated Risk",risk:"High Risk"}; const statusColors={pending:"var(--pac-warn)",reviewing:"var(--pac-accent)",resolved:"var(--pac-good)"}; const statusLabels={pending:"Pending",reviewing:"In Review",resolved:"Resolved"}; const subNames=entryScenarios(sub);
                      return (
                        <div key={sub.id} onClick={()=>setViewingSub(sub)} style={{ background:"var(--pac-surface-2)", border:"1px solid var(--pac-border-1)", borderRadius:10, padding:"11px 14px", marginBottom:7, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:"0.85rem" }}>{scenarioIcons(subNames)} {subNames.join(", ")}</div>
                            <div style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)", marginTop:1 }}>{sub.employeeName?<span style={{ color:"var(--pac-text-70)", marginRight:6 }}>{sub.employeeName} ·</span>:null}{sub.sentDate}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                            <span style={{ fontSize:"0.63rem", fontWeight:700, textTransform:"uppercase", padding:"2px 6px", borderRadius:"var(--pac-radius-badge)", background:"rgba(0,0,0,0.0)", color:statusColors[sub.status||"pending"], border:`1px solid ${statusColors[sub.status||"pending"]}` }}>{statusLabels[sub.status||"pending"]}</span>
                            <span style={{ fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", padding:"2px 6px", borderRadius:"var(--pac-radius-badge)", background:col.bg, color:col.text, border:`1px solid ${col.border}` }}>{labels[sub.level]}</span>
                            <span style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)" }}>View →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          )}

          {/* ALL CHECKS TAB — HR-only, read-only, unfiltered across all managers */}
          {tab==="allChecks" && (
            !unlocked ? <PinGate onUnlock={()=>setUnlocked(true)} /> : (
              <div>
                {allChecks.length===0 ? (
                  <div style={{ textAlign:"center", padding:"32px 0", color:"var(--pac-text-muted)" }}>
                    <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}><Icon name="history" size={40} color="var(--pac-text-dim)" /></div>
                    <div style={{ fontSize:"0.88rem" }}>No checks completed yet.</div>
                    <div style={{ fontSize:"0.79rem", marginTop:6, color:"var(--pac-text-dim)" }}>Checks appear here once a signed-in manager completes one.</div>
                  </div>
                ) : viewingCheck ? (
                  <CheckHistoryDetail entry={viewingCheck} onClose={()=>setViewingCheck(null)} />
                ) : (
                  allChecks.map(entry => (
                    <CheckHistoryRow key={entry.id} entry={entry} showOwner onClick={()=>setViewingCheck(entry)} />
                  ))
                )}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
}

// ── Contextual policy snippet during questions ────────────────────────────
function PolicyHint({ policies, scenarios }) {
  const [expanded, setExpanded] = useState(false);
  const relevant = policies.filter(p=>{ const cat=POLICY_CATEGORIES.find(c=>c.id===p.category); return cat&&scenarios.some(name=>cat.scenarios.includes(name)); });
  if (relevant.length===0) return null;
  return (
    <div style={{ background:"var(--pac-accent-surface-alt)", border:"1px solid var(--pac-accent-border-4)", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="fileText" size={16} color="var(--pac-accent)" />
          <span style={{ fontSize:"0.8rem", fontWeight:600, color:"var(--pac-accent)" }}>{relevant.length} company document{relevant.length!==1?"s":""} on file for {scenarios.length>1?"these scenarios":"this scenario"}</span>
        </div>
        <button onClick={()=>setExpanded(v=>!v)} style={{ fontSize:"0.71rem", color:"var(--pac-accent-text-65)", cursor:"pointer", background:"none", border:"none", fontFamily:"inherit", padding:0, fontWeight:600 }}>
          {expanded?"Hide":"Show"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop:10 }}>
          {relevant.map(doc=>(
            <div key={doc.id} style={{ background:"var(--pac-surface-2)", borderRadius:8, padding:"9px 11px", marginBottom:6 }}>
              <div style={{ fontSize:"0.77rem", fontWeight:700, color:"var(--pac-text)", marginBottom:4 }}>{doc.name}</div>
              <div style={{ fontSize:"0.74rem", color:"var(--pac-text-60)", lineHeight:1.5, maxHeight:120, overflowY:"auto", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                {doc.text.substring(0,600)}{doc.text.length>600?"...":""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Check history row/detail — shared between a manager's own Session
// History and HR's read-only "All Checks" view ────────────────────────────
function CheckHistoryRow({ entry, onClick, onDelete, showOwner }) {
  const col = C[entry.level];
  const labels = { good:"Low Risk", warn:"Elevated Risk", risk:"High Risk" };
  const names = entryScenarios(entry);
  return (
    <div onClick={onClick} style={{ background:"var(--pac-surface-2)", border:"1px solid var(--pac-border-1)", borderRadius:10, padding:"11px 14px", marginBottom:7, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, cursor:"pointer" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:col.text, flexShrink:0 }} />
        <div>
          <div style={{ fontWeight:600, fontSize:"0.85rem" }}>{scenarioIcons(names)} {names.join(", ")}</div>
          <div style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)", marginTop:1 }}>
            {entry.employeeName ? <span style={{ color:"var(--pac-text-70)", marginRight:6 }}>{entry.employeeName} ·</span> : null}
            {showOwner && entry.ownerEmail ? <span style={{ marginRight:6 }}>{entry.ownerEmail} ·</span> : null}
            {entry.date} · {entry.time}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", padding:"2px 7px", borderRadius:"var(--pac-radius-badge)", background:col.bg, color:col.text, border:`1px solid ${col.border}`, whiteSpace:"nowrap" }}>{labels[entry.level]}</span>
        <span style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)" }}>View →</span>
        {onDelete && <button onClick={ev=>{ ev.stopPropagation(); onDelete(); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--pac-risk)", fontSize:"0.85rem", padding:"2px 4px", lineHeight:1, fontFamily:"inherit" }} title="Delete">×</button>}
      </div>
    </div>
  );
}

function CheckHistoryDetail({ entry, onClose }) {
  const names = entryScenarios(entry);
  const eqs = combinedQuestions(names);
  const col = C[entry.level];
  const labels = { good:"Low Risk", warn:"Elevated Risk", risk:"High Risk" };
  return (
    <div style={{ background:"var(--pac-surface-2)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:14, padding:"16px 18px", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:"0.95rem" }}>{scenarioIcons(names)} {names.join(", ")}</div>
          {entry.employeeName && <div style={{ fontSize:"0.8rem", color:"var(--pac-accent)", fontWeight:600, marginTop:2 }}>{entry.employeeName}</div>}
          {entry.ownerEmail && <div style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)", marginTop:1 }}>{entry.ownerName ? `${entry.ownerName} · ` : ""}{entry.ownerEmail}</div>}
          <div style={{ fontSize:"0.74rem", color:"var(--pac-text-muted)", marginTop:2 }}>{entry.date} at {entry.time}</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", padding:"3px 8px", borderRadius:5, background:col.bg, color:col.text, border:`1px solid ${col.border}` }}>{labels[entry.level]}</span>
          <button style={{ padding:"8px 16px", borderRadius:"var(--pac-radius-full)", border:"1px solid var(--pac-border-3)", background:"var(--pac-surface-1)", color:"var(--pac-text)", cursor:"pointer", fontSize:"var(--pac-text-md)", fontWeight:600, fontFamily:"var(--pac-font)" }} onClick={onClose}>Close</button>
        </div>
      </div>
      {eqs.map((item,i)=>{ const a=entry.answers[i]; const aLabel=a==="yes"?"Yes":a==="no"?"No":"Don't know"; const aColor=a==="yes"?"var(--pac-good)":a==="no"?"var(--pac-risk)":"var(--pac-warn)";
        return (
          <div key={i} style={{ borderTop:"1px solid var(--pac-border-0)", paddingTop:9, marginTop:9 }}>
            <div style={{ fontSize:"0.82rem", lineHeight:1.45, color:"var(--pac-text-70)", marginBottom:4 }}>{item.q}</div>
            <div style={{ fontSize:"0.78rem", fontWeight:700, color:aColor }}>{aLabel}</div>
            {entry.notes[i] && <div style={{ fontSize:"0.76rem", color:"var(--pac-text-muted)", marginTop:3, fontStyle:"italic" }}>{entry.notes[i]}</div>}
          </div>
        );
      })}
      <div style={{ marginTop:14, borderTop:"1px solid var(--pac-border-0)", paddingTop:12 }}>
        <div style={{ fontSize:"0.68rem", letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--pac-text-muted)", marginBottom:8 }}>Next steps from that check</div>
        {names.map(name=>(
          <div key={name} style={{ marginBottom:8 }}>
            {names.length>1 && <div style={{ fontSize:"0.74rem", fontWeight:700, color:"var(--pac-text-70)", marginBottom:4 }}>{META[name].icon} {name}</div>}
            {(STEPS[name][entry.level]||[]).map((st,i)=>(
              <div key={i} style={{ display:"flex", gap:8, fontSize:"0.81rem", lineHeight:1.5, color:"var(--pac-text-70)", marginBottom:5 }}>
                <span style={{ color:col.text, fontWeight:700, flexShrink:0 }}>{i+1}.</span><span>{st}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
function App() {
  const [step, setStep]               = useState("pick");
  const [scenarios, setScenarios]     = useState([]);
  const [answers, setAnswers]         = useState([]);
  const [notes, setNotes]             = useState([]);
  const [hints, setHints]             = useState([]);
  const [copied, setCopied]           = useState(false);
  const [showDocTips, setShowDocTips] = useState({});
  const [savedSession, setSavedSession]     = useState(null);
  const [showResumeBanner, setShowResume]   = useState(false);
  const [policies, setPolicies]       = useState([]);
  const [showPolicyLib, setShowPolicyLib]   = useState(false);
  const [policyLibUnlocked, setPolicyLibUnlocked] = useState(false);
  const [emailAddr, setEmailAddr]           = useState("");
  const [emailStatus, setEmailStatus]       = useState("idle");
  const [checkHistory, setCheckHistory]     = useState([]);
  const [viewingPast, setViewingPast]       = useState(null);
  const [identity, setIdentity]             = useState(() => loadIdentity());
  const [identityError, setIdentityError]   = useState("");
  const googleBtnRef                        = useRef(null);
  const [employeeName, setEmployeeName]     = useState("");
  const [hrEmail, setHrEmail]               = useState("");
  const [hrEmailStatus, setHrEmailStatus]   = useState("idle");
  const [attachments, setAttachments]       = useState([]);
  const fileInputRef                        = useRef(null);
  const [followups, setFollowups]           = useState([]);
  const [followupSaved, setFollowupSaved]   = useState(false);
  const [slackWebhook, setSlackWebhook]     = useState("");
  const [teamsWebhook, setTeamsWebhook]     = useState("");

  useEffect(() => {
    setHrEmail(loadHrEmail()); setFollowups(loadFollowups()); setSlackWebhook(loadSlackWebhook()); setTeamsWebhook(loadTeamsWebhook());
    fetchHrEmailFromServer().then(v => { setHrEmail(v); saveHrEmail(v); }).catch(() => {});
    fetchPolicies().then(setPolicies).catch(err => console.error("Couldn't load company policies", err));
  }, []);
  useEffect(() => { const s=loadSession(); if(s&&entryScenarios(s).length&&s.step&&s.step==="questions"){setSavedSession(s);setShowResume(true);} }, []);
  useEffect(() => { if(step==="pick"||step==="result")return; saveSession({step,scenarios,answers,notes}); }, [step,scenarios,answers,notes]);

  // Session History is per-manager, filtered to their verified Google identity.
  useEffect(() => {
    if (!identity) { setCheckHistory([]); return; }
    fetchCheckHistory(identity.email).then(setCheckHistory).catch(err => console.error("Couldn't load check history", err));
  }, [identity]);

  const handleGoogleCredential = async (response) => {
    try {
      const { email, name } = await verifyGoogleCredential(response.credential);
      saveIdentity({ email, name }); setIdentity({ email, name }); setIdentityError("");
    } catch (e) { setIdentityError("Sign-in failed. Please try again."); }
  };
  const signOut = () => { clearIdentity(); setIdentity(null); setCheckHistory([]); setViewingPast(null); };

  // GSI script loads async/defer — poll briefly for window.google to exist.
  useEffect(() => {
    if (identity) return;
    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      if (window.google && window.google.accounts && googleBtnRef.current) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
        window.google.accounts.id.renderButton(googleBtnRef.current, { theme: "outline", size: "medium" });
      } else {
        setTimeout(tryInit, 200);
      }
    };
    tryInit();
    return () => { cancelled = true; };
  }, [identity]);

  const resumeSession = () => {
    if (!savedSession) return;
    const resumedScenarios = entryScenarios(savedSession);
    const n=combinedQuestions(resumedScenarios).length;
    setScenarios(resumedScenarios); setStep(savedSession.step);
    setAnswers(savedSession.answers&&savedSession.answers.length===n?savedSession.answers:new Array(n).fill(null));
    setNotes(savedSession.notes&&savedSession.notes.length===n?savedSession.notes:new Array(n).fill(""));
    setHints(new Array(n).fill(false));
    setShowResume(false); setSavedSession(null);
  };
  const dismissResume = () => { setShowResume(false); setSavedSession(null); clearSession(); };

  const qs = combinedQuestions(scenarios);
  const answered = answers.filter(a=>a!==null).length;
  const allDone  = qs.length>0 && answered===qs.length;
  const sc       = allDone ? computeScore(qs,answers) : null;
  const liveLevel = () => { if(!answered)return"neutral"; return computeScore(qs,answers).level; };

  const buildReportLines = (forHR) => {
    const ll2 = sc.level==="good"?"Low Risk":sc.level==="warn"?"Elevated Risk":"High Risk";
    const lines = [forHR?`People Action Check — Submitted for Review`:`People Action Check`,`${scenarios.length>1?"Scenarios":"Scenario"}: ${scenarios.join(", ")}`,`Result: ${ll2}`,`Date: ${new Date().toLocaleDateString()}`,employeeName.trim()?`Employee: ${employeeName.trim()}`:"",""].filter((l,i,a)=>!(l===""&&a[i-1]===""));
    qs.forEach((item,i)=>{ const a=answers[i]; const label=a==="yes"?"Yes":a==="no"?"No":"Don't know"; lines.push(`Q${i+1}${item.critical?" [Critical]":""}${scenarios.length>1?` (${item._scenario})`:""}: ${item.q}`,`  Answer: ${label}`); if(notes[i])lines.push(`  Note: ${notes[i]}`); lines.push(""); });
    lines.push("---",forHR?"Recommended next steps:":"Next steps:");
    scenarios.forEach(name=>{
      if(scenarios.length>1) lines.push(`${META[name].icon} ${name}:`);
      STEPS[name][sc.level].forEach((st,i)=>lines.push(`${i+1}. ${st}`));
    });
    if(!forHR){
      const rel=policies.filter(p=>{ const cat=POLICY_CATEGORIES.find(c=>c.id===p.category); return cat&&scenarios.some(name=>cat.scenarios.includes(name)); });
      if(rel.length){ lines.push("","--- Company documents referenced:"); rel.forEach(p=>lines.push(`- ${p.name} (${POLICY_CATEGORIES.find(c=>c.id===p.category)?.label})`)); }
    }
    if(attachments.length){ lines.push("","--- Attached files:"); attachments.forEach(f=>lines.push(`- ${f.name}`)); }
    lines.push("","General guidance only — not legal advice.");
    return lines;
  };

  const buildReportDocxBase64 = async () => {
    const ll2 = sc.level==="good"?"Low Risk":sc.level==="warn"?"Elevated Risk":"High Risk";
    const children = [
      new Paragraph({ text: "People Action Check Report", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ children: [new TextRun({ text: `${scenarios.length>1?"Scenarios":"Scenario"}: ${scenarios.join(", ")}`, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: `Result: ${ll2}`, bold: true })] }),
      new Paragraph({ text: `Date: ${new Date().toLocaleDateString()}` }),
    ];
    if (employeeName.trim()) children.push(new Paragraph({ text: `Employee: ${employeeName.trim()}` }));
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "Questions & Answers", heading: HeadingLevel.HEADING_2 }));
    qs.forEach((item,i)=>{
      const a=answers[i]; const label=a==="yes"?"Yes":a==="no"?"No":"Don't know";
      children.push(new Paragraph({ children:[new TextRun({ text:`Q${i+1}${item.critical?" [Critical]":""}${scenarios.length>1?` (${item._scenario})`:""}: ${item.q}`, bold:true })] }));
      children.push(new Paragraph({ text:`Answer: ${label}` }));
      if (notes[i]) children.push(new Paragraph({ text:`Note: ${notes[i]}` }));
      children.push(new Paragraph({ text:"" }));
    });
    children.push(new Paragraph({ text: "Recommended Next Steps", heading: HeadingLevel.HEADING_2 }));
    scenarios.forEach(name=>{
      if (scenarios.length>1) children.push(new Paragraph({ children:[new TextRun({ text:`${META[name].icon} ${name}`, bold:true })] }));
      STEPS[name][sc.level].forEach((st,i)=> children.push(new Paragraph({ text:`${i+1}. ${st}` })));
    });
    const imageAttachments = attachments.filter(f=>f.type && f.type.startsWith("image/"));
    const otherAttachments = attachments.filter(f=>!(f.type && f.type.startsWith("image/")));
    if (imageAttachments.length) {
      children.push(new Paragraph({ text:"" }));
      children.push(new Paragraph({ text: "Attached Images", heading: HeadingLevel.HEADING_2 }));
      imageAttachments.forEach(f=>{
        children.push(new Paragraph({ text: f.name }));
        try { children.push(new Paragraph({ children: [ new ImageRun({ data: dataUrlToBytes(f.dataUrl), transformation: { width: 400, height: 300 } }) ] })); } catch(e) {}
        children.push(new Paragraph({ text:"" }));
      });
    }
    if (otherAttachments.length) {
      children.push(new Paragraph({ text:"" }));
      children.push(new Paragraph({ text: "Other Attached Files (sent separately with this email)", heading: HeadingLevel.HEADING_2 }));
      otherAttachments.forEach(f=> children.push(new Paragraph({ text: `- ${f.name}` })));
    }
    children.push(new Paragraph({ text:"" }));
    children.push(new Paragraph({ text: "General guidance only — not legal advice." }));
    const doc = new Document({ sections: [{ children }] });
    return Packer.toBase64String(doc);
  };

  const downloadReport = async () => {
    if (!sc) return;
    const base64 = await buildReportDocxBase64();
    const bytes = dataUrlToBytes(`data:application/octet-stream;base64,${base64}`);
    const blob = new Blob([bytes], { type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `People-Action-Check-${scenarios.map(n=>n.replace(/\s+/g,"-")).join("_")}-${new Date().toISOString().slice(0,10)}.docx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFilesSelected = (fileList) => {
    Array.from(fileList).forEach(file=>{
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, { name:file.name, type:file.type, size:file.size, dataUrl:reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  };
  const removeAttachment = (idx) => setAttachments(prev => prev.filter((_,i)=>i!==idx));

  const sendEmail = async (recipient) => {
    const to = recipient || emailAddr;
    if (!sc || !to.includes("@")) return;
    setEmailStatus("sending");
    try {
      const reportBase64 = await buildReportDocxBase64();
      const ll2 = sc.level==="good"?"Low Risk":sc.level==="warn"?"Elevated Risk":"High Risk";
      const fileAttachments = [
        { filename: `People-Action-Check-${scenarios.map(n=>n.replace(/\s+/g,"-")).join("_")}.docx`, base64Content: reportBase64 },
        ...attachments.map(f=>({ filename:f.name, base64Content:(f.dataUrl.split(",")[1]||"") }))
      ];
      const res = await fetch("/api/send-report-email", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ to, subject:`${scenarios.join(" + ")} — ${ll2}`, text:buildReportLines(false).join("\n"), attachments:fileAttachments })
      });
      if (!res.ok) throw new Error("send failed");
      setEmailStatus("sent");
    } catch(e) { setEmailStatus("error"); }
  };

  const notifyWebhook = (webhookUrl, data) => {
    if (!webhookUrl) return;
    const names = entryScenarios(data);
    const scenarioLabel = names.join(", ");
    const ll2 = data.level==="good"?"Low Risk":data.level==="warn"?"Elevated Risk":"High Risk";
    const emoji = data.level==="good"?"🟢":data.level==="warn"?"🟡":"🔴";
    const themeColor = data.level==="good"?"38A169":data.level==="warn"?"D69E2E":"E53E3E";
    const stepsText = names.map(name => (names.length>1?`${META[name].icon} ${name}:\n`:"")+STEPS[name][data.level].map((s,i)=>`${i+1}. ${s}`).join("\n")).join("\n\n");
    const isTeams = webhookUrl.includes("office.com") || webhookUrl.includes("webhook.office") || webhookUrl.includes("teams.microsoft");
    const payload = isTeams ? {
      "@type":"MessageCard", "@context":"https://schema.org/extensions",
      "summary":`People Action Check — ${scenarioLabel} — ${ll2}`,
      "themeColor":themeColor,
      "title":`People Action Check — ${scenarioLabel}`,
      "sections":[{ "facts":[
        {"name":"Result","value":`${emoji} ${ll2}`},
        ...(data.employeeName?[{"name":"Employee","value":data.employeeName}]:[]),
        {"name":"Date","value":data.sentDate},
        {"name":"Scenario","value":scenarioLabel}
      ], "text":`**Recommended next steps:**\n\n${stepsText}` }]
    } : {
      "text":`People Action Check — ${scenarioLabel} — ${ll2}`,
      "blocks":[
        {"type":"header","text":{"type":"plain_text","text":`People Action Check — ${scenarioLabel}`,"emoji":true}},
        {"type":"section","fields":[
          {"type":"mrkdwn","text":`*Result:*\n${emoji} ${ll2}`},
          ...(data.employeeName?[{"type":"mrkdwn","text":`*Employee:*\n${data.employeeName}`}]:[]),
          {"type":"mrkdwn","text":`*Date:*\n${data.sentDate}`}
        ]},
        {"type":"section","text":{"type":"mrkdwn","text":`*Recommended next steps:*\n${stepsText}`}},
        {"type":"divider"},
        {"type":"context","elements":[{"type":"mrkdwn","text":"People Action Check · General guidance only, not legal advice"}]}
      ]
    };
    fetch("/api/notify", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({webhookUrl,payload}) }).catch(()=>{});
  };

  const sendToHR = async () => {
    if (!sc || !hrEmail.includes("@")) return;
    setHrEmailStatus("sending");
    try {
      const reportBase64 = await buildReportDocxBase64();
      const ll2 = sc.level==="good"?"Low Risk":sc.level==="warn"?"Elevated Risk":"High Risk";
      const fileAttachments = [
        { filename: `People-Action-Check-${scenarios.map(n=>n.replace(/\s+/g,"-")).join("_")}.docx`, base64Content: reportBase64 },
        ...attachments.map(f=>({ filename:f.name, base64Content:(f.dataUrl.split(",")[1]||"") }))
      ];
      const res = await fetch("/api/send-report-email", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ to:hrEmail, subject:`${scenarios.join(" + ")} — ${ll2} — People Action Check submitted`, text:buildReportLines(true).join("\n"), attachments:fileAttachments })
      });
      if (!res.ok) throw new Error("send failed");
      // `scenario` (first-selected) is kept for the server's required-field validation
      // and for any code that hasn't been updated to read the full `scenarios` list.
      const submission = { scenario:scenarios[0], scenarios, level:sc.level, employeeName:employeeName.trim(), sentDate:new Date().toLocaleDateString(), sentTime:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}), answers:[...answers], notes:[...notes], status:"pending", hrNotes:"" };
      await createHrSubmission(submission);
      notifyWebhook(slackWebhook, submission);
      notifyWebhook(teamsWebhook, submission);
      setHrEmailStatus("sent");
    } catch(e) { setHrEmailStatus("error"); }
  };

  // Sending is an explicit action on the result screen — one button fires both
  // the employee copy (to the signed-in identity) and the HR copy (when an HR
  // address is configured) at the same time.
  const sendAll = () => {
    if (identity) sendEmail(identity.email);
    if (hrEmail.includes("@")) sendToHR();
  };

  // Toggles a card in/out of the selection while still on the picker.
  const toggleScenario = (name) => { setScenarios(prev => prev.includes(name) ? prev.filter(n=>n!==name) : [...prev, name]); };
  // Advances past the picker with whatever's currently selected.
  const goToContext = () => { setStep("context"); setAnswers([]); setNotes([]); setHints([]); setShowDocTips({}); setShowResume(false); setAttachments([]); };
  // Quick single-scenario switch, used when the grid is clicked outside the picker step.
  const pick  = (name) => { setScenarios([name]); goToContext(); };
  const start = () => { const n=qs.length; setAnswers(new Array(n).fill(null)); setNotes(new Array(n).fill("")); setHints(new Array(n).fill(false)); setStep("questions"); setEmailStatus("idle"); };
  const ans   = (idx,val) => {
    const next=[...answers]; next[idx]=val; setAnswers(next);
    if(next.every(a=>a!==null)){
      const{level}=computeScore(qs,next);
      if (identity) {
        const entry={ scenario:scenarios[0], scenarios, answers:next, notes, level, date:new Date().toLocaleDateString(), time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}), employeeName:employeeName.trim(), ownerEmail:identity.email, ownerName:identity.name };
        createCheckHistoryEntry(entry).then(saved => setCheckHistory(h=>[saved,...h])).catch(err => console.error("Couldn't save check history", err));
      }
      clearSession();
      setStep("result");
    }
  };
  const startNew = () => { clearSession(); setScenarios([]); setStep("pick"); setAnswers([]); setNotes([]); setHints([]); setShowDocTips({}); setEmailAddr(""); setEmailStatus("idle"); setHrEmailStatus("idle"); setEmployeeName(""); setFollowupSaved(false); setShowResume(false); setSavedSession(null); setAttachments([]); };

  const ll = liveLevel();
  const liveColors = {neutral:"var(--pac-text-muted)",good:"var(--pac-good)",warn:"var(--pac-warn)",risk:"var(--pac-risk)"};
  const liveBg     = {neutral:"var(--pac-surface-1)",good:"var(--pac-good-bg-light)",warn:"var(--pac-warn-bg-light)",risk:"var(--pac-risk-bg-light)"};
  const liveBorder = {neutral:"var(--pac-border-1)",good:"rgba(52,211,153,0.25)",warn:"rgba(251,191,36,0.25)",risk:"rgba(251,113,133,0.25)"};
  const liveMsgs   = {neutral:"Answer each question to see your risk level update.",good:"Tracking as routine so far.",warn:"Some risk indicators present — finish all questions.",risk:"High-risk signals detected. Review carefully."};

  const s = {
    wrap:  { fontFamily:"var(--pac-font)", background:"var(--pac-bg-gradient)", minHeight:"100vh", color:"var(--pac-text)", padding:"var(--pac-page-padding)" },
    card:  { background:"var(--pac-surface-0)", border:"1px solid var(--pac-border-1)", borderRadius:"var(--pac-radius-card)", padding:"var(--pac-card-padding)", marginBottom:20 },
    label: { fontSize:"var(--pac-text-xs)", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--pac-text)", marginBottom:10, display:"block" },
    grid:  { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginBottom:22 },
    scard: (active) => ({ background:active?"var(--pac-accent-card-gradient)":"var(--pac-surface-1)", border:`1px solid ${active?"rgba(34,193,255,0.6)":"var(--pac-border-1)"}`, borderRadius:"var(--pac-radius-2xl)", padding:"13px 12px", cursor:"pointer", display:"flex", flexDirection:"column", gap:6, transition:"var(--pac-transition-fast)" }),
    badge: (level) => ({ fontSize:"var(--pac-text-xxs)", fontWeight:700, letterSpacing:"0.05em", padding:"2px 7px", borderRadius:"var(--pac-radius-badge)", width:"fit-content", textTransform:"uppercase", background:level==="high"?"rgba(251,113,133,0.15)":"rgba(251,191,36,0.12)", color:level==="high"?"var(--pac-risk)":"var(--pac-warn)", border:`1px solid ${level==="high"?"var(--pac-risk-border-alt)":"var(--pac-warn-border-alt)"}` }),
    btn:   (primary) => ({ padding:primary?"10px 20px":"8px 16px", borderRadius:"var(--pac-radius-full)", border:primary?"1px solid var(--pac-accent-border)":"1px solid var(--pac-border-3)", background:primary?"var(--pac-accent-bg)":"var(--pac-surface-1)", color:primary?"var(--pac-accent)":"var(--pac-text)", cursor:"pointer", fontSize:"var(--pac-text-md)", fontWeight:600, fontFamily:"var(--pac-font)" }),
  };

  const copySum = () => {
    if (!sc) return;
    const ll2=sc.level==="good"?"Low Risk":sc.level==="warn"?"Elevated Risk":"High Risk";
    const lines=[`People Action Check`,`${scenarios.length>1?"Scenarios":"Scenario"}: ${scenarios.join(", ")}`,`Result: ${ll2}`,`Date: ${new Date().toLocaleDateString()}`,""];
    qs.forEach((item,i)=>{ const a=answers[i]; const label=a==="yes"?"Yes":a==="no"?"No":"Don't know"; lines.push(`Q${i+1}${item.critical?" [Critical]":""}${scenarios.length>1?` (${item._scenario})`:""}: ${item.q}`,`  Answer: ${label}`); if(notes[i])lines.push(`  Note: ${notes[i]}`); lines.push(""); });
    lines.push("---","Next steps:");
    scenarios.forEach(name=>{
      if(scenarios.length>1) lines.push(`${META[name].icon} ${name}:`);
      STEPS[name][sc.level].forEach((st,i)=>lines.push(`${i+1}. ${st}`));
    });
    const rel=policies.filter(p=>{ const cat=POLICY_CATEGORIES.find(c=>c.id===p.category); return cat&&scenarios.some(name=>cat.scenarios.includes(name)); });
    if(rel.length){ lines.push("","--- Company documents referenced:"); rel.forEach(p=>lines.push(`- ${p.name} (${POLICY_CATEGORIES.find(c=>c.id===p.category)?.label})`)); }
    lines.push("","General guidance only — not legal advice.");
    navigator.clipboard.writeText(lines.join("\n")).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  return (
    <div style={s.wrap}>
      {showPolicyLib && <PolicyLibrary policies={policies} setPolicies={setPolicies} onClose={()=>setShowPolicyLib(false)} currentScenarios={scenarios} hrEmail={hrEmail} onSaveHrEmail={async v=>{await saveHrEmailToServer(v);saveHrEmail(v);setHrEmail(v);}} slackWebhook={slackWebhook} onSaveSlackWebhook={v=>{saveSlackWebhook(v);setSlackWebhook(v);}} teamsWebhook={teamsWebhook} onSaveTeamsWebhook={v=>{saveTeamsWebhook(v);setTeamsWebhook(v);}} unlocked={policyLibUnlocked} setUnlocked={setPolicyLibUnlocked} />}

      <div style={{ maxWidth:"var(--pac-content-width)", margin:"0 auto" }} role="main" aria-label="People Action Check">

        {/* Header */}
        <div style={{ ...s.card }}>
          <div className="hdr-row" style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:46, height:46, flexShrink:0, borderRadius:12, background:"var(--pac-accent-gradient)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#02111a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"1.25rem", fontWeight:700 }}>People Action Check</div>
              <div className="hdr-desc" style={{ fontSize:"0.83rem", color:"var(--pac-text-muted)", marginTop:3 }}>A private confidence check for people-management decisions. Sign in to sync your check history across devices.</div>
            </div>
            <button className="hdr-pol" onClick={()=>setShowPolicyLib(true)} style={{ ...s.btn(false), flexShrink:0, display:"flex", alignItems:"center", gap:7, whiteSpace:"nowrap", ...(policies.length>0?{borderColor:"var(--pac-accent-border-alt)",color:"var(--pac-accent)",background:"var(--pac-accent-surface)"}:{}) }}>
              <Icon name="folder" size={14} />
              <span>Company Policies{policies.length>0?` (${policies.length})`:""}</span>
            </button>
          </div>
        </div>

        {!identity ? (
          <div style={{ background:"var(--pac-surface-1)", border:"1px solid var(--pac-border-3)", borderRadius:12, padding:"22px 18px", textAlign:"center" }}>
            <Icon name="history" size={22} color="var(--pac-text)" />
            <div style={{ fontWeight:700, fontSize:"0.95rem", marginTop:8 }}>Sign in to use People Action Check</div>
            <div style={{ fontSize:"0.8rem", color:"var(--pac-text-muted)", marginTop:6, marginBottom:14 }}>Your checks are tied to your account so you can always find your history, and results are emailed to you automatically.</div>
            <div ref={googleBtnRef} style={{ display:"flex", justifyContent:"center" }}></div>
            {identityError && <div style={{ fontSize:"0.76rem", color:"var(--pac-risk)", marginTop:10 }}>{identityError}</div>}
          </div>
        ) : (
        <>

        {/* Resume banner */}
        {showResumeBanner && savedSession && (
          <div style={{ background:"var(--pac-accent-surface)", border:"1px solid var(--pac-accent-border-alt)", borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:"0.85rem", fontWeight:700, color:"var(--pac-accent)", marginBottom:3 }}>You have a saved session</div>
              <div style={{ fontSize:"0.79rem", color:"var(--pac-text-muted)" }}>{scenarioIcons(entryScenarios(savedSession))} {entryScenarios(savedSession).join(", ")} — {savedSession.step==="result"?"completed":"in progress"}</div>
            </div>
            <div className="pac-resume-actions" style={{ display:"flex", gap:8, flexShrink:0 }}>
              <button style={s.btn(true)} onClick={resumeSession}>Resume</button>
              <button style={s.btn(false)} onClick={dismissResume}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Scenario grid */}
        <span style={s.label} id="step1-label">Step 1 — select your situation{step==="pick"?" (choose one or more)":""}</span>
        <div className="pac-scenario-grid" style={s.grid} role="list" aria-labelledby="step1-label">
          {Object.keys(META).map(name=>{
            const mm=META[name];
            const active = scenarios.includes(name);
            const onActivate = () => step==="pick" ? toggleScenario(name) : pick(name);
            return (
              <div key={name} role="listitem">
                <div style={s.scard(active)} onClick={onActivate} role="button" tabIndex={0} aria-pressed={active} aria-label={`${mm.icon} ${name} — ${mm.riskLabel}`} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&onActivate()}>
                  <div style={{ fontSize:"1.3rem" }} aria-hidden="true">{mm.icon}</div>
                  <div style={{ fontSize:"0.85rem", fontWeight:600, lineHeight:1.25 }}>{name}</div>
                  <div style={s.badge(mm.riskLevel)}>{mm.riskLabel}</div>
                </div>
              </div>
            );
          })}
        </div>

        {step==="pick" && scenarios.length>0 && (
          <div style={{ background:"var(--pac-accent-surface)", border:"1px solid var(--pac-accent-border-alt)", borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div style={{ fontSize:"0.85rem", fontWeight:600, color:"var(--pac-accent)" }}>{scenarios.length} situation{scenarios.length!==1?"s":""} selected</div>
            <button style={s.btn(true)} onClick={goToContext}>Continue</button>
          </div>
        )}

        {/* Session History Box — identity is guaranteed here, sign-in gates the whole app now */}
        {step==="pick" && (
          <div style={{ marginBottom:18 }}>
            <div style={{ background:"var(--pac-surface-1)", border:"1px solid var(--pac-border-3)", borderRadius:"12px 12px 0 0", padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Icon name="history" size={20} color="var(--pac-text)" />
                <div>
                  <div style={{ fontWeight:700, fontSize:"0.9rem" }}>Session History</div>
                  <div style={{ fontSize:"0.76rem", color:"var(--pac-text-muted)", marginTop:1 }}>{checkHistory.length===0?"No past checks yet":`${checkHistory.length} saved check${checkHistory.length!==1?"s":""}`}</div>
                </div>
              </div>
              <button style={{ fontSize:"0.72rem", color:"var(--pac-text-muted)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0, flexShrink:0 }} onClick={signOut}>Signed in as {identity.email} · Sign out</button>
            </div>
            <div style={{ background:"var(--pac-surface-2)", border:"1px solid var(--pac-border-1)", borderTop:"none", borderRadius:"0 0 12px 12px", padding:"14px 16px" }}>
              {checkHistory.length===0 ? (
                <div style={{ textAlign:"center", padding:"16px 0", color:"var(--pac-text-muted)", fontSize:"0.83rem" }}>No past checks saved yet. Complete a check to see it here.</div>
              ) : (
                <div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
                    <button style={{ fontSize:"0.72rem", color:"var(--pac-risk)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }} onClick={()=>{ setCheckHistory([]); setViewingPast(null); clearCheckHistory(identity.email).catch(err => console.error("Couldn't clear check history", err)); }}>Clear my history</button>
                  </div>
                  {viewingPast!==null && checkHistory[viewingPast] ? (
                    <CheckHistoryDetail entry={checkHistory[viewingPast]} onClose={()=>setViewingPast(null)} />
                  ) : (
                    checkHistory.map((e,i)=>(
                      <CheckHistoryRow key={e.id} entry={e} onClick={()=>setViewingPast(i)} onDelete={()=>{ const updated=checkHistory.filter((_,idx)=>idx!==i); setCheckHistory(updated); deleteCheckHistoryEntry(e.id).catch(err => console.error("Couldn't delete check history entry", err)); }} />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Follow-up reminders */}
        {step==="pick" && followups.filter(f=>!f.dismissed).length>0 && (()=>{
          const active = followups.filter(f=>!f.dismissed).sort((a,b)=>new Date(a.dueDate+`T00:00:00`)-new Date(b.dueDate+`T00:00:00`));
          const today = new Date(); today.setHours(0,0,0,0);
          return (
            <div style={{ background:"var(--pac-warn-surface)", border:"1px solid var(--pac-warn-border-alt)", borderRadius:12, padding:"14px 18px", marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
                <Icon name="calendar" size={18} color="var(--pac-warn)" />
                <div style={{ fontWeight:700, fontSize:"0.9rem", color:"var(--pac-warn)" }}>Follow-up reminders</div>
              </div>
              {active.map(f=>{
                const dueDate = new Date(f.dueDate+`T00:00:00`);
                const isOverdue = dueDate < today;
                const fNames = entryScenarios(f);
                return (
                  <div key={f.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"var(--pac-surface-2)", border:`1px solid ${isOverdue?"var(--pac-risk-bg-alt)":"var(--pac-warn-border-deep)"}`, borderRadius:"var(--pac-radius-md)", padding:"9px 12px", marginBottom:6, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:"0.84rem", fontWeight:600 }}>{scenarioIcons(fNames)} {fNames.join(", ")}{f.employeeName?` · ${f.employeeName}`:""}</div>
                      <div style={{ fontSize:"0.73rem", color:isOverdue?"var(--pac-risk)":"var(--pac-warn)", marginTop:1 }}>{isOverdue?"Overdue — was due":"Due"} {new Date(f.dueDate+`T00:00:00`).toLocaleDateString()}</div>
                    </div>
                    <button style={{ fontSize:"0.71rem", color:"var(--pac-text-muted)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }} onClick={()=>{ const updated=followups.map(fu=>fu.id===f.id?{...fu,dismissed:true}:fu); setFollowups(updated); saveFollowups(updated); }}>Dismiss</button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Email nudge on pick screen */}
        {step==="pick" && (
          <div style={{ background:"var(--pac-accent-surface)", border:"1px solid var(--pac-accent-border-alt)", borderRadius:12, padding:"13px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:12 }}>
            <Icon name="mail" size={20} color="var(--pac-accent)" style={{ flexShrink:0 }} />
            <div style={{ fontSize:"0.83rem", color:"var(--pac-text-70)", lineHeight:1.5 }}>
              When you finish your check, you can <strong style={{ color:"var(--pac-accent)", fontWeight:600 }}>email the full results to yourself</strong> — add your own notes and bring it to HR.
            </div>
          </div>
        )}

        {/* Context panel — one card per selected scenario */}
        {step!=="pick" && scenarios.map((name, idx) => {
          const mm = META[name];
          const isLast = idx === scenarios.length - 1;
          return (
            <div key={name} style={{ ...s.card, marginBottom:18 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ fontSize:"1rem", fontWeight:700 }}>{mm.icon} {name}</div>
                <div style={s.badge(mm.riskLevel)}>{mm.riskLabel}</div>
              </div>
              <div style={{ fontSize:"0.88rem", color:"var(--pac-text-70)", lineHeight:1.6, marginBottom:14 }}>{mm.description}</div>
              <div style={{ fontSize:"0.68rem", fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--pac-text-muted)", marginBottom:9 }}>Common examples</div>
              {mm.examples.map((ex,i)=>(
                <div key={i} style={{ display:"flex", gap:9, background:"var(--pac-surface-2)", border:"1px solid var(--pac-border-0)", borderRadius:"var(--pac-radius-md)", padding:"9px 12px", fontSize:"0.82rem", lineHeight:1.5, color:"var(--pac-text-70)", marginBottom:6 }}>
                  <span style={{ color:"var(--pac-text-muted)", flexShrink:0 }}>→</span><span>{ex}</span>
                </div>
              ))}
              <div style={{ marginTop:14, marginBottom:4 }}>
                <button style={{ fontSize:"0.71rem", color:"var(--pac-accent-text-75)", cursor:"pointer", background:"none", border:"none", fontFamily:"inherit", padding:0, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }} onClick={()=>setShowDocTips(v=>({...v,[name]:!v[name]}))}>
                  {showDocTips[name]?"Hide documentation tips":"+ How to document this situation"}
                </button>
              </div>
              {showDocTips[name] && (
                <div style={{ background:"var(--pac-accent-surface-alt)", border:"1px solid var(--pac-accent-border-4)", borderRadius:"var(--pac-radius-md)", padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ fontSize:"0.68rem", letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--pac-accent-text-70)", marginBottom:8, fontWeight:700 }}>Documentation guidance</div>
                  {mm.docTips.map((tip,i)=>(
                    <div key={i} style={{ display:"flex", gap:9, fontSize:"0.81rem", lineHeight:1.5, color:"var(--pac-text-70)", marginBottom:6 }}>
                      <span style={{ color:"rgba(34,193,255,0.5)", flexShrink:0, fontWeight:700 }}>{i+1}.</span><span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background:"var(--pac-warn-surface)", border:"1px solid var(--pac-warn-border-deep)", borderRadius:"var(--pac-radius-md)", padding:"10px 13px", fontSize:"0.82rem", color:"var(--pac-warn-text-90)", lineHeight:1.5, margin:"10px 0 10px" }}>
                <strong>Watch for:</strong> {mm.watch}
              </div>
              <div style={{ background:"var(--pac-good-bg-alt)", border:"1px solid var(--pac-good-border-alt)", borderRadius:"var(--pac-radius-md)", padding:"10px 13px", fontSize:"0.82rem", color:"var(--pac-good)", lineHeight:1.5, marginBottom:isLast?16:0 }}>
                <strong>Not sure? Contact HR:</strong> {mm.contactHR}
              </div>
              {isLast && step==="context" && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:"0.7rem", color:"var(--pac-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6, fontWeight:600 }}>Employee name <span style={{ color:"var(--pac-text-dim)", fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span></div>
                  <input type="text" placeholder="e.g. Alex Johnson" value={employeeName} onChange={e=>setEmployeeName(e.target.value)} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid var(--pac-border-3)", borderRadius:"var(--pac-radius-md)", padding:"10px 13px", color:"var(--pac-text)", fontSize:"0.88rem", fontFamily:"inherit", outline:"none" }} />
                  <div style={{ fontSize:"0.73rem", color:"var(--pac-text-dim)", marginTop:5 }}>If added, this name will appear in Session History so you can identify this check later.</div>
                </div>
              )}
              {isLast && (step==="context" ? <button style={s.btn(true)} onClick={start}>Start the check</button> : <button style={s.btn(false)} onClick={()=>setStep("context")}>Back to overview</button>)}
            </div>
          );
        })}

        {/* Questions */}
        {(step==="questions"||step==="result") && (
          <div style={{ marginBottom:18 }}>
            <span style={s.label}>Step 2 — {scenarios.length>1?`${scenarios.length}-situation combined`:scenarios[0]} check</span>
            <div style={{ marginBottom:14 }}>
              <div role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={qs.length} aria-label={`${answered} of ${qs.length} questions answered`} style={{ height:3, background:"var(--pac-border-1)", borderRadius:99, marginBottom:5 }}>
                <div style={{ height:"100%", borderRadius:99, background:"var(--pac-accent-gradient)", width:`${qs.length?(answered/qs.length)*100:0}%`, transition:"var(--pac-transition-slow)" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.74rem", color:"var(--pac-text-muted)" }} aria-hidden="true">
                <span>{answered} of {qs.length} answered</span><span>{qs.length?Math.round((answered/qs.length)*100):0}%</span>
              </div>
            </div>
            <PolicyHint policies={policies} scenarios={scenarios} />
            <div role="status" aria-live="polite" aria-label={`Current risk level: ${liveMsgs[ll]}`} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 13px", borderRadius:"var(--pac-radius-md)", fontSize:"0.82rem", fontWeight:600, marginBottom:16, border:`1px solid ${liveBorder[ll]}`, background:liveBg[ll], color:liveColors[ll], transition:"var(--pac-transition-base)" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"currentColor", flexShrink:0 }} aria-hidden="true" />
              {liveMsgs[ll]}
            </div>
            {qs.map((item,idx)=>{
              const a=answers[idx];
              const rowBg=a==="yes"?"var(--pac-good-bg-alt)":a==="no"?"var(--pac-risk-bg-alt)":a==="unknown"?"var(--pac-warn-bg-light)":"var(--pac-surface-1)";
              const rowBorder=a==="yes"?"var(--pac-good-border-deep)":a==="no"?"var(--pac-risk-border-deep)":a==="unknown"?"var(--pac-warn-border-deep)":"var(--pac-border-1)";
              return (
                <div key={idx} style={{ background:rowBg, border:`1px solid ${rowBorder}`, borderRadius:11, padding:"13px 15px", marginBottom:9, transition:"var(--pac-transition-fast)" }}>
                  <div className="pac-question-row">
                    <div style={{ flex:1 }} id={`q-label-${idx}`}>
                      <div style={{ fontSize:"0.68rem", color:"var(--pac-text-muted)", fontWeight:600, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.04em" }}>Question {idx+1} of {qs.length}{scenarios.length>1?` · ${META[item._scenario].icon} ${item._scenario}`:""}</div>
                      <div style={{ fontSize:"0.88rem", lineHeight:1.5, display:"flex", alignItems:"center", flexWrap:"wrap", gap:6 }}>
                        {item.q}
                        {item.critical && <span style={{ fontSize:"0.62rem", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", background:"var(--pac-risk-bg)", border:"1px solid var(--pac-risk-border)", color:"var(--pac-risk)", borderRadius:5, padding:"2px 6px", whiteSpace:"nowrap" }} aria-label="Critical question">Critical</span>}
                      </div>
                      <button style={{ fontSize:"0.71rem", color:"var(--pac-accent-text-65)", cursor:"pointer", marginTop:5, background:"none", border:"none", fontFamily:"inherit", padding:0 }} aria-expanded={!!hints[idx]} onClick={()=>{const h=[...hints];h[idx]=!h[idx];setHints(h);}}>
                        {hints[idx]?"Hide":"+ Why this matters"}
                      </button>
                      {hints[idx] && <div style={{ fontSize:"0.77rem", color:"var(--pac-text-muted)", marginTop:5, lineHeight:1.45 }}>{item.hint}</div>}
                    </div>
                    <div className="pac-ans-group" role="group" aria-labelledby={`q-label-${idx}`}>
                      {[["Yes","yes"],["No","no"],["?","unknown"]].map(([label,val])=>{
                        const on=a===val;
                        const onBg=val==="yes"?"var(--pac-good-bg-strong)":val==="no"?"var(--pac-risk-bg-strong)":"var(--pac-warn-bg-strong)";
                        const onBorder=val==="yes"?"var(--pac-good-border-strong)":val==="no"?"var(--pac-risk-border-strong)":"var(--pac-warn-border-strong)";
                        const onColor=val==="yes"?"var(--pac-good)":val==="no"?"var(--pac-risk)":"var(--pac-warn)";
                        const ariaLabel=val==="yes"?"Yes":val==="no"?"No":"Don't know";
                        return <button key={val} className="ans-btn" aria-label={ariaLabel} aria-pressed={on} style={{ padding:"5px 12px", borderRadius:"var(--pac-radius-full)", border:`1px solid ${on?onBorder:"var(--pac-border-3)"}`, background:on?onBg:"transparent", color:on?onColor:"var(--pac-text)", cursor:"pointer", fontWeight:600, fontSize:"0.77rem", minWidth:46, fontFamily:"inherit" }} onClick={()=>ans(idx,val)}>{label}</button>;
                      })}
                    </div>
                  </div>
                  {a!==null && <textarea rows={2} className="notes-ta" placeholder="Add context or notes (optional)..." style={{ width:"100%", marginTop:9, background:"var(--pac-surface-1)", border:"1px solid var(--pac-border-2)", borderRadius:7, padding:"7px 10px", color:"var(--pac-text)", fontSize:"0.79rem", fontFamily:"inherit", resize:"none", outline:"none" }} value={notes[idx]||""} onChange={e=>{const n=[...notes];n[idx]=e.target.value;setNotes(n);}} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Result */}
        {step==="result" && sc && (()=>{
          const col=C[sc.level];
          const titles={good:"Routine management action — proceed carefully.",warn:"Elevated risk — pause and address gaps before acting.",risk:"High risk — do not proceed without HR or legal review."};
          const summaries={good:"Your answers indicate this situation is within standard management scope. Document each step you take.",warn:"One or more answers reveal gaps in process, documentation, or legal review. Resolve these before taking action.",risk:"Critical risk factors are present. Acting without HR or legal involvement exposes you and the organization significantly."};
          const labels={good:"Low Risk",warn:"Elevated Risk",risk:"High Risk"};
          const dn=qs.length-sc.yes-sc.no;
          const rel=policies.filter(p=>{ const cat=POLICY_CATEGORIES.find(c=>c.id===p.category); return cat&&scenarios.some(name=>cat.scenarios.includes(name)); });
          return (
            <div role="region" aria-label="Assessment result">
              <div style={{ background:"var(--pac-accent-surface-2)", border:"1px solid var(--pac-accent-border-2)", borderRadius:11, padding:"12px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:11 }}>
                <Icon name="mail" size={20} color="var(--pac-accent)" style={{ flexShrink:0 }} />
                <div style={{ fontSize:"0.83rem", color:"var(--pac-text-70)", lineHeight:1.5 }}>When you're done reviewing, <strong style={{ color:"var(--pac-accent)" }}>enter your email at the bottom of this page</strong> to send yourself a copy — add your own notes or context directly in the email before bringing it to HR.</div>
              </div>
              <span style={s.label}>Assessment</span>
              {sc.crit && <div style={{ background:"var(--pac-risk-bg-light)", border:"1px solid var(--pac-risk-border-med)", borderRadius:11, padding:"12px 14px", fontSize:"0.84rem", color:"var(--pac-risk-text-90)", lineHeight:1.55, marginBottom:11 }}><strong>Critical question not confirmed.</strong> One or more questions marked Critical were answered No or Don't Know. These carry significant legal exposure. HR and legal review is required before any action.</div>}
              {sc.unk>0 && <div style={{ background:"var(--pac-warn-surface)", border:"1px solid var(--pac-warn-border-deep)", borderRadius:10, padding:"10px 13px", fontSize:"0.82rem", color:"var(--pac-warn-text-85)", lineHeight:1.5, marginBottom:11 }}>{sc.unk} question{sc.unk>1?"s were":" was"} answered "Don't know." Uncertainty is a risk signal and has been factored into the score.</div>}
              <div style={{ background:col.bg, border:`1px solid ${col.border}`, borderRadius:14, padding:"18px 20px", marginBottom:12 }}>
                <div style={{ fontSize:"0.68rem", letterSpacing:"0.09em", textTransform:"uppercase", fontWeight:700, color:col.text, marginBottom:4, opacity:0.85 }}>{labels[sc.level]}</div>
                <div style={{ fontSize:"1rem", fontWeight:700, color:col.light, marginBottom:6 }}>{titles[sc.level]}</div>
                <div style={{ fontSize:"0.86rem", lineHeight:1.6, opacity:0.84, marginBottom:14 }}>{summaries[sc.level]}</div>
                <div style={{ fontSize:"0.68rem", letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--pac-text-muted)", marginBottom:9 }}>Recommended next steps</div>
                {scenarios.map(name=>(
                  <div key={name} style={{ marginBottom:10 }}>
                    {scenarios.length>1 && <div style={{ fontSize:"0.72rem", fontWeight:700, color:col.text, marginBottom:6 }}>{META[name].icon} {name}</div>}
                    {STEPS[name][sc.level].map((st,i)=>(
                      <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:9, fontSize:"0.84rem", lineHeight:1.5, padding:"8px 11px", background:"var(--pac-surface-1)", borderRadius:8, border:"1px solid var(--pac-border-0)", marginBottom:6 }}>
                        <span style={{ fontSize:"0.68rem", fontWeight:700, width:18, height:18, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1, background:`${col.text}22`, color:col.text }}>{i+1}</span>
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {rel.length>0 && (
                <div style={{ background:"var(--pac-accent-surface-alt)", border:"1px solid var(--pac-accent-border-4)", borderRadius:11, padding:"13px 16px", marginBottom:12 }}>
                  <div style={{ fontSize:"0.7rem", letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--pac-accent-text-70)", marginBottom:9, fontWeight:700 }}>Company documents on file for {scenarios.length>1?"these scenarios":"this scenario"}</div>
                  {rel.map(doc=>{ const cat=POLICY_CATEGORIES.find(c=>c.id===doc.category); return (
                    <div key={doc.id} style={{ display:"flex", alignItems:"center", gap:10, background:"var(--pac-surface-2)", borderRadius:8, padding:"8px 11px", marginBottom:6 }}>
                      <Icon name="fileText" size={18} color="var(--pac-accent)" />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"0.82rem", fontWeight:700 }}>{doc.name}</div>
                        <div style={{ fontSize:"0.71rem", color:"var(--pac-text-muted)" }}>{cat?.label} · {(doc.chars/1000).toFixed(1)}k chars</div>
                      </div>
                      <button style={{ ...s.btn(false), padding:"4px 10px", fontSize:"0.73rem" }} onClick={()=>setShowPolicyLib(true)}>View</button>
                    </div>
                  );})}
                </div>
              )}
              {scenarios.map(name=>(
                <div key={name} style={{ background:"var(--pac-good-bg-alt)", border:"1px solid var(--pac-good-border-alt)", borderRadius:10, padding:"10px 14px", fontSize:"0.82rem", color:"var(--pac-good)", lineHeight:1.55, marginBottom:12 }}>
                  <strong>Still not sure?{scenarios.length>1?` (${name})`:""}</strong> {META[name].contactHR}
                </div>
              ))}
              <div style={{ background:"var(--pac-surface-1)", border:"1px solid var(--pac-border-1)", borderRadius:11, padding:"14px 16px", marginBottom:12 }}>
                <div style={{ fontSize:"0.68rem", letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--pac-text-muted)", marginBottom:10 }}>Answer breakdown</div>
                {[["Yes",sc.yes,"var(--pac-good)"],["No",sc.no,"var(--pac-risk)"],["Don't know",dn,"var(--pac-warn)"]].map(([label,count,color])=>(
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                    <div style={{ fontSize:"0.78rem", width:90, flexShrink:0, color:"var(--pac-text-70)" }}>{label}</div>
                    <div style={{ flex:1, height:5, background:"var(--pac-border-1)", borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%", background:color, borderRadius:99, width:`${qs.length?(count/qs.length)*100:0}%`, transition:"var(--pac-transition-slow)" }} />
                    </div>
                    <div style={{ fontSize:"0.77rem", color:"var(--pac-text-muted)", width:20, textAlign:"right" }}>{count}</div>
                  </div>
                ))}
              </div>
              <div className="pac-result-actions">
                <button style={s.btn(true)} onClick={start}>Run again</button>
                <button style={s.btn(false)} onClick={startNew}>New situation</button>
                <button style={s.btn(false)} onClick={copySum}>{copied?"Copied!":"Copy summary"}</button>
                <button style={s.btn(false)} onClick={downloadReport}>Download report (.docx)</button>
              </div>
              {/* 30-day follow-up */}
              {(()=>{
                const due = new Date(); due.setDate(due.getDate()+30);
                const dueDateISO = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,"0")}-${String(due.getDate()).padStart(2,"0")}`;
                const dueDateDisplay = due.toLocaleDateString();
                return (
                  <div style={{ marginTop:12, background:"var(--pac-warn-surface)", border:"1px solid var(--pac-warn-border-deep)", borderRadius:14, padding:"18px 18px" }}>
                    <div style={{ fontSize:"1rem", fontWeight:700, color:"var(--pac-text)", marginBottom:4, display:"flex", alignItems:"center", gap:8 }}><Icon name="calendar" size={18} color="var(--pac-warn)" /> Set a 30-day follow-up</div>
                    <div style={{ fontSize:"0.83rem", color:"var(--pac-text-65)", lineHeight:1.55, marginBottom:14 }}>Come back on <strong style={{ color:"var(--pac-warn)" }}>{dueDateDisplay}</strong> to review progress on this situation. A reminder will appear on your home screen.</div>
                    {followupSaved ? (
                      <div style={{ background:"var(--pac-good-bg)", border:"1px solid var(--pac-good-border)", borderRadius:"var(--pac-radius-md)", padding:"10px 14px", fontSize:"0.84rem", color:"var(--pac-good)", fontWeight:600 }}>✓ Reminder saved for {dueDateDisplay}</div>
                    ) : (
                      <button style={{ ...s.btn(false), borderColor:"var(--pac-warn-border-deep)", color:"var(--pac-warn)" }} onClick={()=>{
                        const entry = { id:Date.now(), scenario:scenarios[0], scenarios, level:sc.level, employeeName:employeeName.trim(), checkDate:new Date().toLocaleDateString(), dueDate:dueDateISO, dismissed:false };
                        const updated = [entry, ...followups]; setFollowups(updated); saveFollowups(updated); setFollowupSaved(true);
                      }}>Save reminder</button>
                    )}
                  </div>
                );
              })()}

              {/* Attach supporting files */}
              <div style={{ marginTop:12, background:"var(--pac-surface-2)", border:"1px solid var(--pac-border-2)", borderRadius:14, padding:"18px 18px" }}>
                <div style={{ fontSize:"0.72rem", color:"var(--pac-accent)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>Attach supporting files (optional)</div>
                <div style={{ fontSize:"0.8rem", color:"var(--pac-text-60)", lineHeight:1.5, marginBottom:12 }}>Tip: before attaching, consider combining emails, Slack/Teams messages, and other documentation into one Word document — it'll come through more cleanly. Screenshots and photos are embedded directly into the report below; other file types are attached separately and sent alongside it.</div>
                <input ref={fileInputRef} type="file" multiple style={{ display:"none" }} onChange={e=>{ if(e.target.files&&e.target.files.length) handleFilesSelected(e.target.files); e.target.value=""; }} />
                <button style={s.btn(false)} onClick={()=>fileInputRef.current&&fileInputRef.current.click()}>+ Attach files</button>
                {attachments.length>0 && (
                  <div style={{ marginTop:12 }}>
                    {attachments.map((f,i)=>(
                      <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"var(--pac-surface-1)", border:"1px solid var(--pac-border-1)", borderRadius:8, padding:"7px 11px", marginBottom:6 }}>
                        <div style={{ fontSize:"0.79rem", color:"var(--pac-text-70)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name} <span style={{ color:"var(--pac-text-muted)" }}>({Math.round(f.size/1024)} KB)</span></div>
                        <button onClick={()=>removeAttachment(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--pac-risk)", fontSize:"0.9rem", padding:"2px 4px", lineHeight:1, fontFamily:"inherit", flexShrink:0 }} title="Remove">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Combined send card */}
              <div style={{ marginTop:12, background:"var(--pac-accent-panel-gradient)", border:"1px solid var(--pac-accent-border-alt)", borderRadius:14, padding:"20px 18px" }}>
                <div style={{ fontSize:"0.72rem", color:"var(--pac-accent)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>Send your results</div>
                <div style={{ fontSize:"0.82rem", color:"var(--pac-text-60)", lineHeight:1.5, marginBottom:14 }}>
                  One click sends the full check, a Word doc report, and any attached files to <strong style={{ color:"var(--pac-text-70)" }}>{identity && identity.email}</strong>{hrEmail ? <> and to HR at <strong style={{ color:"var(--pac-text-70)" }}>{hrEmail}</strong> (logged in the HR Dashboard)</> : " — HR email isn't configured yet, so only your copy will send; an admin can set it in Company Policies → Upload Files"}. Add notes to your copy before bringing it to HR.
                </div>

                {emailStatus==="idle" && hrEmailStatus==="idle" ? (
                  <button style={{ ...s.btn(true), width:"100%", justifyContent:"center", display:"flex" }} onClick={sendAll}>Send to {hrEmail ? "me and HR" : "me"}</button>
                ) : (
                  <>
                    {/* Email to self */}
                    <div style={{ fontSize:"0.68rem", color:"var(--pac-text-muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5 }}>Your copy</div>
                    {emailStatus==="sent" ? (
                      <div style={{ background:"var(--pac-good-bg)", border:"1px solid var(--pac-good-border)", borderRadius:"var(--pac-radius-md)", padding:"10px 14px", fontSize:"0.84rem", color:"var(--pac-good)", fontWeight:600, marginBottom:0 }}>✓ Sent to your inbox</div>
                    ) : emailStatus==="error" ? (
                      <div>
                        <div style={{ fontSize:"0.78rem", color:"var(--pac-risk)" }}>Something went wrong sending to your inbox.</div>
                        <button style={{ ...s.btn(false), marginTop:8 }} onClick={()=>sendEmail(identity && identity.email)}>Try again</button>
                      </div>
                    ) : (
                      <div style={{ fontSize:"0.82rem", color:"var(--pac-text-muted)" }}>Sending...</div>
                    )}

                    {hrEmail.includes("@") && (
                      <>
                        <div style={{ borderTop:"1px solid var(--pac-border-2)", margin:"16px 0" }} />
                        <div style={{ fontSize:"0.68rem", color:"var(--pac-text-muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5 }}>HR's copy</div>
                        {hrEmailStatus==="sent" ? (
                          <div style={{ background:"var(--pac-good-bg)", border:"1px solid var(--pac-good-border)", borderRadius:"var(--pac-radius-md)", padding:"10px 14px", fontSize:"0.84rem", color:"var(--pac-good)", fontWeight:600 }}>✓ Sent to HR</div>
                        ) : hrEmailStatus==="error" ? (
                          <div>
                            <div style={{ fontSize:"0.78rem", color:"var(--pac-risk)" }}>Something went wrong sending to HR.</div>
                            <button style={{ ...s.btn(false), marginTop:8 }} onClick={sendToHR}>Try again</button>
                          </div>
                        ) : (
                          <div style={{ fontSize:"0.82rem", color:"var(--pac-text-muted)" }}>Sending...</div>
                        )}
                      </>
                    )}
                  </>
                )}

                <div style={{ borderTop:"1px solid var(--pac-border-2)", marginTop:16, paddingTop:16 }}>
                  <button style={{ ...s.btn(true), width:"100%", justifyContent:"center", display:"flex" }} onClick={startNew}>Start a new check</button>
                </div>
              </div>
            </div>
          );
        })()}

        </>
        )}

        <div style={{ marginTop:28, textAlign:"center", fontSize:"0.74rem", color:"var(--pac-text-muted)", lineHeight:1.8 }}>
          General guidance only — not legal advice.<br />
          Your progress saves automatically to this browser. Company policies are shared across every device.<br />
          © 2026 Melissa A. Weiss. All rights reserved.
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
