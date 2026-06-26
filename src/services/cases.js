// Client for /api/case-store — shared by web surface and pac-slack Netlify function (Phase 4).
// Web: import directly (ES module).
// Slack function: require via .cjs wrapper or set "type": "module" in package.json.

const BASE = "/api/case-store";

async function handle(res) {
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch a single case. Returns null if not found.
 * @param {string} managerId
 * @param {string} caseId
 * @returns {Promise<object|null>}
 */
export async function getCase(managerId, caseId) {
  const res = await fetch(
    `${BASE}?managerId=${encodeURIComponent(managerId)}&caseId=${encodeURIComponent(caseId)}`
  );
  const data = await handle(res);
  return data ? data.case : null;
}

/**
 * List cases for a manager, or all cases if no managerId given (admin only).
 * @param {string} [managerId]
 * @param {string} [token]  PAC_ADMIN_TOKEN — required for listing all
 * @returns {Promise<object[]>}
 */
export async function listCases(managerId, token) {
  const url = managerId
    ? `${BASE}?managerId=${encodeURIComponent(managerId)}`
    : BASE;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const data = await handle(await fetch(url, { headers }));
  return data ? data.cases : [];
}

/**
 * Create or update a case record.
 * @param {object} caseRecord  Must have .id and .managerId
 * @param {string} [token]     PAC_ADMIN_TOKEN
 * @returns {Promise<{ ok: boolean, key: string }>}
 */
export async function saveCase(caseRecord, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return handle(
    await fetch(BASE, {
      method: "POST",
      headers,
      body: JSON.stringify({ case: caseRecord }),
    })
  );
}

/**
 * Delete a case.
 * @param {string} managerId
 * @param {string} caseId
 * @param {string} [token]  PAC_ADMIN_TOKEN
 */
export async function deleteCase(managerId, caseId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return handle(
    await fetch(
      `${BASE}?managerId=${encodeURIComponent(managerId)}&caseId=${encodeURIComponent(caseId)}`,
      { method: "DELETE", headers }
    )
  );
}
