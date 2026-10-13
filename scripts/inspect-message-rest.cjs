const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../.env");
const local = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
const url = process.env.SUPABASE_URL || local.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || local.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase URL and service role key are required for REST inspection");

async function main() {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/openapi+json"
    },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Supabase REST inspection returned HTTP ${response.status}`);
  const spec = await response.json();
  const relevant = Object.entries(spec.definitions || {})
    .filter(([name]) => /message|chat|conversation|generated_file/i.test(name))
    .map(([name, definition]) => ({
      name,
      columns: Object.entries(definition.properties || {}).map(([column, details]) => ({
        name: column,
        type: details.type,
        format: details.format,
        description: details.description
      }))
    }));
  console.log(JSON.stringify({ tables: relevant }, null, 2));
}

main().catch((error) => {
  console.error(`REST inspection failed: ${error.message}`);
  process.exitCode = 1;
});
