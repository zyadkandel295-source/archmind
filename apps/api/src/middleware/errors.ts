import type { ErrorRequestHandler, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`, "ROUTE_NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const correlationId = randomUUID();
  let isInternal = true;
  let status = 500;
  let message = error instanceof Error ? error.message : "Unknown error";

  if (error instanceof ZodError) {
    isInternal = false;
    status = 400;
    message = "Request validation failed";
  } else if (error instanceof HttpError) {
    isInternal = error.status >= 500;
    status = error.status;
    message = error.message;
  } else if (typeof error === "object" && error && "code" in error && error.code === "LIMIT_FILE_SIZE") {
    isInternal = false;
    status = 413;
    message = "File is too large. Maximum size is 15 MB.";
  }

  const errorCode = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
  const databaseUnavailable = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "08001", "08006", "57P01"].includes(errorCode ?? "");
  const migrationRequired = ["42P01", "42703"].includes(errorCode ?? "");
  if (databaseUnavailable || migrationRequired) {
    isInternal = false;
    status = 503;
    message = databaseUnavailable ? "The platform data service is temporarily unavailable." : "The platform database migration is required.";
  }

  if (isInternal || databaseUnavailable || migrationRequired) {
    console.error("[API Error]", { correlationId, method: req.method, path: req.path, error });
  } else {
    // Log concisely for client errors
    if (message === "Invalid or expired access token") {
      console.warn("[Auth] Access token expired; refresh expected");
    } else {
      console.warn(`[API Client Error] ${req.method} ${req.path} ${status} - ${message}`);
    }
  }

  res.setHeader("X-Correlation-Id", correlationId);

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten(),
        correlationId,
        retryable: false
      }
    });
  }

  if (databaseUnavailable || migrationRequired) {
    return res.status(503).json({
      error: {
        code: databaseUnavailable ? "PLATFORM_STORE_UNAVAILABLE" : "MIGRATION_REQUIRED",
        message,
        correlationId,
        retryable: databaseUnavailable
      }
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        code: isInternal ? "INTERNAL_SERVER_ERROR" : error.code,
        message: isInternal ? "We couldn't process your request." : error.message,
        correlationId,
        retryable: error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504,
        ...(isInternal ? {} : { details: error.details })
      }
    });
  }

  if (typeof error === "object" && error && "code" in error && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: {
      code: "FILE_TOO_LARGE",
        message,
        correlationId,
        retryable: false
      }
    });
  }

  // Obfuscate standard exceptions (database error, runtime TypeError, etc.)
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "We couldn't process your request.",
      correlationId,
      retryable: false
    }
  });
};
