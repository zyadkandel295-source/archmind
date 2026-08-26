/* Materialize only vetted runtime assets; user input never becomes a file path. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "apps", "desktop", "assets");
const output = process.env.ARCHMIND_ASSET_OUT;
if (!output) throw new Error("ARCHMIND_ASSET_OUT is required.");

fs.mkdirSync(output, { recursive: true });
for (const name of ["archmind-assistant.ico", "installer-header.bmp", "installer-sidebar.bmp"]) {
  const from = path.join(source, name);
  const to = path.join(output, name);
  if (!fs.existsSync(from)) throw new Error(`Required desktop asset is missing: ${name}`);
  fs.copyFileSync(from, to);
}
