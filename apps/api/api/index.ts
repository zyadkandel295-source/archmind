import { createApp } from "../src/app";

const { app } = createApp();

export default function handler(req: any, res: any) {
  return new Promise<void>((resolve, reject) => {
    res.on("finish", resolve);
    res.on("error", reject);
    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = handler;
module.exports.default = handler;
