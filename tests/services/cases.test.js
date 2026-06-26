import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCase, listCases, saveCase, deleteCase } from "../../src/services/cases.js";

function makeFetch(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

const CASE = { id: "c1", managerId: "mgr1", state: "NOT_STARTED", scenario: "performance" };

describe("getCase", () => {
  it("returns case on 200", async () => {
    global.fetch = makeFetch(200, { case: CASE });
    const result = await getCase("mgr1", "c1");
    expect(result).toEqual(CASE);
    expect(fetch).toHaveBeenCalledWith(
      "/api/case-store?managerId=mgr1&caseId=c1"
    );
  });

  it("returns null on 404", async () => {
    global.fetch = makeFetch(404, { error: "Not found" });
    const result = await getCase("mgr1", "missing");
    expect(result).toBeNull();
  });

  it("throws on server error", async () => {
    global.fetch = makeFetch(500, { error: "DB error" });
    await expect(getCase("mgr1", "c1")).rejects.toThrow("DB error");
  });
});

describe("listCases", () => {
  it("fetches manager-scoped URL when managerId given", async () => {
    global.fetch = makeFetch(200, { cases: [CASE] });
    const result = await listCases("mgr1");
    expect(result).toEqual([CASE]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/case-store?managerId=mgr1",
      { headers: {} }
    );
  });

  it("fetches root URL with auth token when no managerId", async () => {
    global.fetch = makeFetch(200, { cases: [CASE] });
    const result = await listCases(undefined, "tok123");
    expect(result).toEqual([CASE]);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/case-store");
    expect(opts.headers.Authorization).toBe("Bearer tok123");
  });

  it("returns empty array on null response", async () => {
    global.fetch = makeFetch(404, { error: "Not found" });
    const result = await listCases("mgr1");
    expect(result).toEqual([]);
  });
});

describe("saveCase", () => {
  it("POSTs case and returns ok+key", async () => {
    global.fetch = makeFetch(200, { ok: true, key: "case/mgr1/c1" });
    const result = await saveCase(CASE, "tok123");
    expect(result).toEqual({ ok: true, key: "case/mgr1/c1" });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/case-store");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ case: CASE });
    expect(opts.headers.Authorization).toBe("Bearer tok123");
  });

  it("omits Authorization header when no token", async () => {
    global.fetch = makeFetch(200, { ok: true, key: "case/mgr1/c1" });
    await saveCase(CASE);
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it("throws on 401", async () => {
    global.fetch = makeFetch(401, { error: "Unauthorized" });
    await expect(saveCase(CASE)).rejects.toThrow("Unauthorized");
  });
});

describe("deleteCase", () => {
  it("sends DELETE with correct params", async () => {
    global.fetch = makeFetch(200, { ok: true });
    const result = await deleteCase("mgr1", "c1", "tok123");
    expect(result).toEqual({ ok: true });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/case-store?managerId=mgr1&caseId=c1");
    expect(opts.method).toBe("DELETE");
    expect(opts.headers.Authorization).toBe("Bearer tok123");
  });

  it("throws on 401", async () => {
    global.fetch = makeFetch(401, { error: "Unauthorized" });
    await expect(deleteCase("mgr1", "c1")).rejects.toThrow("Unauthorized");
  });
});
