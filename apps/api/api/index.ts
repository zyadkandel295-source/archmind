import { createApp } from "../src/app";

let appInstance: any;

function getApp() {
  if (!appInstance) {
    const { app } = createApp();
    appInstance = app;
  }
  return appInstance;
}

export default function handler(req: any, res: any) {
  try {
    if (!req.url || req.url === "/" || req.url === "") {
      req.url = "/api";
    }
    const app = getApp();
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Serverless Function Error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || "An unexpected error occurred."
    });
  }
}

module.exports = handler;
module.exports.default = handler;
