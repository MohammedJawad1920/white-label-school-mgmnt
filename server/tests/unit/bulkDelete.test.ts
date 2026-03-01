/**
 * bulkSoftDelete unit tests
 *
 * Strategy: mock pg Pool so no real DB is needed. We simulate
 * NOT_FOUND, HAS_REFERENCES, and successful soft-deletes.
 */

import { bulkSoftDelete } from "../../src/utils/bulkDelete";
import { Pool } from "pg";

// Helper: build a mocked Pool where `.query()` delegates to `fn`
function mockPool(
  fn: (
    text: string,
    params: unknown[],
  ) => { rowCount: number; rows: unknown[] },
): Pool {
  return { query: jest.fn(fn) } as unknown as Pool;
}

describe("bulkSoftDelete", () => {
  it("deletes records that exist and have no refs", async () => {
    const pool = mockPool((text) => {
      if (text.startsWith("SELECT id"))
        return { rowCount: 1, rows: [{ id: "1" }] };
      // UPDATE (soft delete)
      return { rowCount: 1, rows: [] };
    });

    const result = await bulkSoftDelete(pool, "students", ["s1", "s2"], "T1");
    expect(result.deleted).toEqual(["s1", "s2"]);
    expect(result.failed).toEqual([]);
  });

  it("marks records as NOT_FOUND when they don't exist", async () => {
    const pool = mockPool(() => ({ rowCount: 0, rows: [] }));

    const result = await bulkSoftDelete(pool, "students", ["s1"], "T1");
    expect(result.deleted).toEqual([]);
    expect(result.failed).toEqual([
      { id: "s1", reason: "NOT_FOUND", message: "Record not found" },
    ]);
  });

  it("marks records as HAS_REFERENCES when refCheck returns a reason", async () => {
    const pool = mockPool((text) => {
      if (text.startsWith("SELECT id"))
        return { rowCount: 1, rows: [{ id: "1" }] };
      return { rowCount: 1, rows: [] };
    });

    const refCheck = jest.fn().mockResolvedValue("has active timeslots");

    const result = await bulkSoftDelete(
      pool,
      "subjects",
      ["sub1"],
      "T1",
      refCheck,
    );
    expect(result.deleted).toEqual([]);
    expect(result.failed).toEqual([
      { id: "sub1", reason: "HAS_REFERENCES", message: "has active timeslots" },
    ]);
  });

  it("handles mixed results (partial success)", async () => {
    let callCount = 0;
    const pool = mockPool((text) => {
      if (text.startsWith("SELECT id")) {
        callCount++;
        // First two exist, third doesn't
        if (callCount <= 2) return { rowCount: 1, rows: [{ id: "x" }] };
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    });

    const refCheck = jest
      .fn()
      .mockResolvedValueOnce(null) // first record: safe
      .mockResolvedValueOnce("has refs"); // second record: blocked

    const result = await bulkSoftDelete(
      pool,
      "classes",
      ["c1", "c2", "c3"],
      "T1",
      refCheck,
    );
    expect(result.deleted).toEqual(["c1"]);
    expect(result.failed).toHaveLength(2);
    expect(result.failed).toContainEqual({
      id: "c2",
      reason: "HAS_REFERENCES",
      message: "has refs",
    });
    expect(result.failed).toContainEqual({
      id: "c3",
      reason: "NOT_FOUND",
      message: "Record not found",
    });
  });
});
