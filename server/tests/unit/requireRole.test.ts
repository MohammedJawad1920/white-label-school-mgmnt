import { requireRole } from "../../src/middleware/requireRole";
import { Request, Response, NextFunction } from "express";

function mockReqRes(userRoles: string[]) {
  const req = { userRoles } as unknown as Request;
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

describe("requireRole", () => {
  it("calls next() when user has the required role", () => {
    const { req, res, next } = mockReqRes(["Admin"]);
    requireRole("Admin")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next() when user has any of the required roles", () => {
    const { req, res, next } = mockReqRes(["Teacher"]);
    requireRole("Teacher", "Admin")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 FORBIDDEN when user lacks all required roles", () => {
    const { req, res, next } = mockReqRes(["Teacher"]);
    requireRole("Admin")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect((res as any).body.error.code).toBe("FORBIDDEN");
    // timestamp inside error
    expect((res as any).body.error).toHaveProperty("timestamp");
    expect((res as any).body).not.toHaveProperty("timestamp");
  });

  it("returns 403 when userRoles is undefined/empty", () => {
    const { req, res, next } = mockReqRes([]);
    requireRole("Admin")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("passes multi-role user with Admin+Teacher for Admin-only route", () => {
    const { req, res, next } = mockReqRes(["Teacher", "Admin"]);
    requireRole("Admin")(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
