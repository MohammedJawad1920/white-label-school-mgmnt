import { featureGuard } from "../../src/middleware/featureGuard";
import { Request, Response, NextFunction } from "express";

// Mock the pool module
jest.mock("../../src/db/pool", () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from "../../src/db/pool";
const mockQuery = pool.query as jest.Mock;

function mockReqRes(tenantId = "T1") {
  const req = { tenantId } as unknown as Request;
  const res: any = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(obj: unknown) {
      res.body = obj;
      return res;
    },
  };
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe("featureGuard", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("calls next() when feature is enabled", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ enabled: true }] });
    const { req, res, next } = mockReqRes();

    await featureGuard("timetable")(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("tenant_features"),
      ["T1", "timetable"],
    );
  });

  it("returns 403 FEATURE_DISABLED when feature is disabled", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ enabled: false }] });
    const { req, res, next } = mockReqRes();

    await featureGuard("attendance")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect((res as any).body.error.code).toBe("FEATURE_DISABLED");
    expect((res as any).body.error.details).toEqual({
      featureKey: "attendance",
    });
    // timestamp inside error object
    expect((res as any).body.error).toHaveProperty("timestamp");
    expect((res as any).body).not.toHaveProperty("timestamp");
  });

  it("returns 403 when no tenant_features row exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { req, res, next } = mockReqRes();

    await featureGuard("timetable")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
