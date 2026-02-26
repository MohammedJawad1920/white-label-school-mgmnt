/**
 * asyncHandler
 *
 * Wraps an async Express route handler so any thrown error is forwarded
 * to next(err) → globalErrorHandler, instead of hanging the request silently.
 *
 * WHY: Without this, an unhandled promise rejection in an async handler
 * silently drops the request. Every async route handler must be wrapped.
 *
 * Usage:
 *   router.post('/', asyncHandler(async (req, res) => { ... }));
 */

import { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
