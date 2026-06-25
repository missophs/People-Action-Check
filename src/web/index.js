// Web layer entry point — scaffold for Phase 3.
//
// Currently the web app lives in index.html (single file, React + Babel in-browser).
// Phase 3 will migrate components here using a Vite build pipeline.
//
// Planned migration order:
//   1. Storage helpers       → already extracted: src/services/storage.js
//   2. Scoring logic         → already extracted: src/core/scoring.js
//   3. Scenario data         → already extracted: src/core/scenarios.js
//   4. Service wrappers      → already extracted: src/services/
//   5. React components      → migrate one at a time, keeping index.html working throughout
//   6. Final cutover         → switch Netlify publish from root index.html to dist/ output

export const WEB_SCAFFOLD_STATUS = 'pending-phase-3';
