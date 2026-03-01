import { asyncHandler } from "../../src/utils/asyncHandler";
import { Request, Response, NextFunction } from "express";

describe("asyncHandler", () => {
  it("calls the wrapped async function and resolves normally", async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const req = {} as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("catches thrown errors and forwards to next()", async () => {
    const err = new Error("boom");
    const handler = asyncHandler(async () => {
      throw err;
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
