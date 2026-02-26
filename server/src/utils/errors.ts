import { Request, Response, NextFunction } from "express";

interface AppErrorOptions {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status: number;
}

export function sendError(res: Response, opts: AppErrorOptions): void {
  res.status(opts.status).json({
    error: {
      code: opts.code,
      message: opts.message,
      details: opts.details ?? {},
    },
    timestamp: new Date().toISOString(),
  });
}

export const send400 = (
  res: Response,
  message: string,
  code = "VALIDATION_ERROR",
  details?: Record<string, unknown>,
) => sendError(res, { code, message, details, status: 400 });

export const send401 = (res: Response, message = "Unauthorized") =>
  sendError(res, { code: "UNAUTHORIZED", message, details: {}, status: 401 });

export const send403 = (
  res: Response,
  message = "Forbidden",
  code = "FORBIDDEN",
) => sendError(res, { code, message, details: {}, status: 403 });

export const send404 = (res: Response, message = "Resource not found") =>
  sendError(res, { code: "NOT_FOUND", message, details: {}, status: 404 });

export const send409 = (res: Response, message: string, code = "CONFLICT") =>
  sendError(res, { code, message, details: {}, status: 409 });

export const send500 = (
  res: Response,
  message = "An unexpected error occurred",
) =>
  sendError(res, { code: "INTERNAL_ERROR", message, details: {}, status: 500 });

// Global Express error handler — must be registered last in app.ts
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("[Unhandled Error]", err.message, err.stack);
  send500(res);
}
