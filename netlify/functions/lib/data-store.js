// Data store router — switches backend via PAC_DATA_STORE env var.
// Values: 'netlify-blobs' (default), 'supabase', 'airtable'
//
// All backends implement the same interface:
//   getCase(managerId, caseId)    → record | null
//   saveCase(rec)                 → void
//   findCaseById(caseId)          → record | null
//   listCasesForManager(managerId)→ record[]
//   listAllCases()                → record[]

function getBackend() {
  const name = (process.env.PAC_DATA_STORE || 'netlify-blobs').toLowerCase();
  if (name === 'supabase')       return require('./stores/supabase');
  if (name === 'airtable')       return require('./stores/airtable');
  return require('./stores/netlify-blobs');
}

const backend = getBackend();

module.exports = {
  getCase:              (...args) => backend.getCase(...args),
  saveCase:             (...args) => backend.saveCase(...args),
  findCaseById:         (...args) => backend.findCaseById(...args),
  listCasesForManager:  (...args) => backend.listCasesForManager(...args),
  listAllCases:         (...args) => backend.listAllCases(...args),
  deleteCase:           (...args) => backend.deleteCase(...args),
};
