/* Publish one signed, immutable Windows runtime for fast assistant installs. */
const { createHash, randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertValidAuthenticodeSignature(file) {
  if (process.platform !== "win32") throw new Error("Windows is required to verify an Authenticode signature.");
  const command = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:AGENTIA_RUNTIME_ARTIFACT;",
    "if ($signature.Status -ne 'Valid') { Write-Error ('Authenticode status: ' + $signature.Status); exit 1 };",
    "if (-not $signature.SignerCertificate) { Write-Error 'Missing signing certificate'; exit 1 };",
    "Write-Output $signature.SignerCertificate.Thumbprint"
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
    env: { ...process.env, AGENTIA_RUNTIME_ARTIFACT: file }
  });
  if (result.status !== 0) {
    throw new Error(`Refusing to publish an unsigned or invalid installer. ${(result.stderr || result.stdout || "Signature validation failed.").trim()}`);
  }
  return result.stdout.trim();
}

async function main() {
  const input = process.argv[2] || process.env.DESKTOP_RUNTIME_ARTIFACT;
  const version = required("DESKTOP_RUNTIME_VERSION");
  if (!input) throw new Error("Provide an installer path: npm run publish:desktop-runtime -- <installer.exe>");
  if (!/^[0-9A-Za-z._-]+$/.test(version)) throw new Error("DESKTOP_RUNTIME_VERSION may contain only letters, numbers, dots, underscores, and dashes.");

  const artifact = path.resolve(input);
  const stat = fs.statSync(artifact);
  if (!stat.isFile() || path.extname(artifact).toLowerCase() !== ".exe") throw new Error("The runtime artifact must be a Windows .exe installer file.");

  const thumbprint = assertValidAuthenticodeSignature(artifact);
  const bucket = (process.env.DESKTOP_ARTIFACT_BUCKET || "desktop-build-artifacts").trim();
  const filename = path.basename(artifact);
  const artifactKey = `desktop-runtime/windows/x64/stable/${version}/${filename}`;
  const checksum = sha256(artifact);
  const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const created = await supabase.storage.createBucket(bucket, { public: false });
  if (created.error && !/already exists|already owned|duplicate/i.test(created.error.message)) throw created.error;
  const uploaded = await supabase.storage.from(bucket).upload(artifactKey, fs.readFileSync(artifact), {
    cacheControl: "31536000",
    contentType: "application/vnd.microsoft.portable-executable",
    upsert: true
  });
  if (uploaded.error) throw uploaded.error;

  const pool = new Pool({ connectionString: required("DATABASE_URL") });
  try {
    await pool.query(
      `insert into desktop_runtime_releases(
         id, version, platform, architecture, channel, status, artifact_key, artifact_path, filename,
         mime_type, byte_size, sha256, signature_status, minimum_api_version, manifest_schema_version, created_at, published_at
       ) values ($1, $2, 'windows', 'x64', 'stable', 'ready', $3, $4, $5, $6, $7, $8, 'signed', '0.1.0', 1, now(), now())
       on conflict(version, platform, architecture, channel) do update set
         status = excluded.status, artifact_key = excluded.artifact_key, artifact_path = excluded.artifact_path,
         filename = excluded.filename, mime_type = excluded.mime_type, byte_size = excluded.byte_size,
         sha256 = excluded.sha256, signature_status = excluded.signature_status,
         minimum_api_version = excluded.minimum_api_version, manifest_schema_version = excluded.manifest_schema_version,
         published_at = excluded.published_at, retired_at = null`,
      [randomUUID(), version, artifactKey, `supabase://${bucket}/${artifactKey}`, filename, "application/vnd.microsoft.portable-executable", stat.size, checksum]
    );
  } finally {
    await pool.end();
  }
  console.log(`Published signed Windows runtime ${version} (${stat.size} bytes, ${checksum.slice(0, 12)}..., certificate ${thumbprint.slice(-8)}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
