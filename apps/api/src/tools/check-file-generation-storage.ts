// Opt-in production infrastructure acceptance. Never prints credentials.
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { loadEnv } from "../config/env";
import { createSupabaseServerClient } from "../services/supabase-server";
import { FILE_BUCKET } from "../services/files/repository";
import { MAX_FILE_BYTES, MIME } from "../services/files/types";

async function main() {
  const env = loadEnv();
  if (!env.databaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Database and service-role credentials are required.");
  const pool = new Pool({ connectionString: env.databaseUrl });
  try {
    const result = await pool.query(
      "select current_user as role, has_schema_privilege(current_user, 'public', 'create') as can_migrate, to_regclass('public.generated_files') is not null as migrated",
    );
    console.log("Database readiness:", result.rows[0]);
    const storage = createSupabaseServerClient().storage;
    const bucket = await storage.getBucket(FILE_BUCKET);
    if (bucket.error) {
      if (!process.argv.includes("--prepare-storage"))
        throw new Error(
          "Private bucket is unavailable; use --prepare-storage to create it after deployment approval.",
        );
      const existing = await storage.listBuckets();
      if (existing.error)
        throw new Error(`Cannot inspect storage: ${existing.error.message}`);
      if (existing.data.some((b) => b.id === FILE_BUCKET))
        throw new Error(
          "Existing bucket could not be inspected; refusing to change it.",
        );
      const created = await storage.createBucket(FILE_BUCKET, {
        public: false,
        fileSizeLimit: MAX_FILE_BYTES,
        allowedMimeTypes: Object.values(MIME),
      });
      if (created.error)
        throw new Error(
          `Private bucket creation failed: ${created.error.message}`,
        );
      console.log("Created private generated-files bucket.");
    } else
      assert.equal(
        bucket.data.public,
        false,
        "Generated file bucket must be private",
      );
    const argument = process.argv.find((a) => a.startsWith("--file="));
    if (!argument)
      throw new Error(
        "Supply --file=<real generated PDF> for storage roundtrip verification.",
      );
    const bytes = await fs.readFile(argument.slice(7));
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    const key = `acceptance/${randomUUID()}/Storage_Acceptance.pdf`;
    let uploaded = false;
    try {
      const upload = await storage
        .from(FILE_BUCKET)
        .upload(key, bytes, { contentType: MIME.pdf, upsert: false });
      if (upload.error)
        throw new Error(`Storage upload failed: ${upload.error.message}`);
      uploaded = true;
      const download = await storage.from(FILE_BUCKET).download(key);
      if (download.error)
        throw new Error(`Storage read failed: ${download.error.message}`);
      assert(Buffer.from(await download.data.arrayBuffer()).equals(bytes));
      const { data } = storage.from(FILE_BUCKET).getPublicUrl(key);
      const denied = await fetch(data.publicUrl);
      assert(!denied.ok, "Unauthenticated public access must be denied");
      console.log(
        `PASS private persistent upload/readback (${bytes.length} bytes), public URL denied (${denied.status}).`,
      );
    } finally {
      if (uploaded) {
        const cleanup = await storage.from(FILE_BUCKET).remove([key]);
        if (cleanup.error)
          throw new Error(
            `Acceptance object cleanup failed: ${cleanup.error.message}`,
          );
        console.log(
          "Removed only this run's temporary storage object; private bucket retained.",
        );
      }
    }
    if (!result.rows[0]?.migrated) {
      process.exitCode = 2;
      console.log(
        "BLOCKED: migration 016 must be applied using a database administrator connection before production end-to-end testing.",
      );
    }
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
