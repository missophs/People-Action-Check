// Generates export data from PAC case records.
// Backend-only — never expose to browser bundles.
// ESM module so it can be tested directly and required via createRequire in CJS callers.

const EXPORT_HEADERS = ['id', 'scenario', 'risk', 'state', 'managerId', 'refName', 'createdAt', 'updatedAt', 'hrNotified'];

function escCsv(val) {
  const s = String(val ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(cases) {
  const rows = cases.map(c => EXPORT_HEADERS.map(h => escCsv(c[h])).join(','));
  return [EXPORT_HEADERS.join(','), ...rows].join('\n');
}

function toTsv(cases) {
  const rows = cases.map(c => EXPORT_HEADERS.map(h => String(c[h] ?? '')).join('\t'));
  return [EXPORT_HEADERS.join('\t'), ...rows].join('\n');
}

function toJson(cases) {
  return JSON.stringify(cases, null, 2);
}

const FORMAT_META = {
  csv:  { mime: 'text/csv',                  ext: 'csv'  },
  tsv:  { mime: 'text/tab-separated-values', ext: 'tsv'  },
  json: { mime: 'application/json',          ext: 'json' },
  word: { mime: 'text/csv',                  ext: 'csv'  }, // Word not supported; falls back to CSV
};

export function generateExport(cases, format) {
  const meta = FORMAT_META[format] || FORMAT_META.csv;
  let content;
  switch (format) {
    case 'tsv':  content = toTsv(cases);  break;
    case 'json': content = toJson(cases); break;
    default:     content = toCsv(cases);  break;
  }
  return { content, mime: meta.mime, ext: meta.ext };
}
