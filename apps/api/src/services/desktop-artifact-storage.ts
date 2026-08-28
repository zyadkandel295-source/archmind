import fs from "node:fs/promises";
import path from "node:path";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "./supabase-server";

const storageScheme = "supabase://";
const defaultBucket = "desktop-build-artifacts";

function shouldUseSupabaseArtifactStorage() {
  // MemoryStore is the local-development/test backend.  Its build records
  // reference local artifacts, so forwarding them to a configured developer
  // Supabase project can leave the queue waiting on an unrelated remote
  // upload and strand an otherwise completed installer in "packaging".
  return process.env.ARCHMIND_PLATFORM_STORE !== "memory" && isSupabaseServerConfigured();
}

function artifactBucket() {
  return (process.env.DESKTOP_ARTIFACT_BUCKET || defaultBucket).trim() || defaultBucket;
}

export function isSupabaseArtifactPath(artifactPath: string | undefined) {
  return Boolean(artifactPath?.startsWith(storageScheme));
}

function parseSupabaseArtifactPath(artifactPath: string) {
  if (!isSupabaseArtifactPath(artifactPath)) throw new Error("Artifact path is not a Supabase storage path.");
  const withoutScheme = artifactPath.slice(storageScheme.length);
  const slash = withoutScheme.indexOf("/");
  if (slash <= 0 || slash === withoutScheme.length - 1) throw new Error("Invalid Supabase artifact path.");
  return { bucket: withoutScheme.slice(0, slash), key: withoutScheme.slice(slash + 1) };
}

async function ensureBucket(bucket: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.createBucket(bucket, { public: false });
  if (error && !/already exists|already owned|duplicate/i.test(error.message)) throw error;
  return supabase;
}

export async function uploadDesktopArtifact(localArtifactPath: string, buildId: string) {
  if (!shouldUseSupabaseArtifactStorage()) return localArtifactPath;
  const bucket = artifactBucket();
  const filename = path.basename(localArtifactPath);
  const key = `desktop-builds/${buildId}/${filename}`;
  const supabase = await ensureBucket(bucket);
  const data = await fs.readFile(localArtifactPath);
  const { error } = await supabase.storage.from(bucket).upload(key, data, {
    cacheControl: "31536000",
    contentType: "application/vnd.microsoft.portable-executable",
    upsert: true
  });
  if (error) throw error;
  return `${storageScheme}${bucket}/${key}`;
}

export async function downloadDesktopArtifact(artifactPath: string) {
  const { bucket, key } = parseSupabaseArtifactPath(artifactPath);
  const { data, error } = await createSupabaseServerClient().storage.from(bucket).download(key);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
