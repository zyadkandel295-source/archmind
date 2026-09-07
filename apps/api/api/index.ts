import { createApp } from "../src/app";
import type { Express } from "express";

let app: Express | undefined;

function safeReturnPath(value: unknown) {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return "/dashboard";
  return path;
}

function appUrlFromEnv() {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    return new URL(configured).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function sendBootFailure(req: any, res: any, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown server startup error";
  console.error("[API Boot Error]", message);

  const requestUrl = new URL(req.url ?? "/", "https://agentia.local");
  if (requestUrl.pathname === "/api/auth/google") {
    const redirect = new URL("/auth/login", appUrlFromEnv());
    redirect.searchParams.set("error", "server_config");
    redirect.searchParams.set("returnTo", safeReturnPath(requestUrl.searchParams.get("state")));
    res.statusCode = 302;
    res.setHeader("Location", redirect.toString());
    res.end();
    return;
  }

  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({
    error: {
      code: "API_BOOT_FAILED",
      message: "The API is not configured correctly. Ask the administrator to check the deployment environment.",
      retryable: false
    }
  }));
}

export default function handler(req: any, res: any) {
  return new Promise<void>((resolve, reject) => {
    res.on("finish", resolve);
    res.on("error", reject);
    try {
      app ??= createApp().app;
      app(req, res);
    } catch (err) {
      sendBootFailure(req, res, err);
    }
  });
}

module.exports = handler;
module.exports.default = handler;
