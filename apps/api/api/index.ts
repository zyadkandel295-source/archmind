import { createApp } from "../src/app";

const { app } = createApp();

export default function handler(req: any, res: any) {
  try {
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
