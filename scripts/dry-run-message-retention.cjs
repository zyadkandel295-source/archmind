const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.resolve(__dirname, "../.env");
const local = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
const url = process.env.SUPABASE_URL || local.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || local.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase URL and service role key are required for dry run");

async function main() {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const cutoff5 = new Date(Date.now() - 5 * 86400000).toISOString();
  const cutoff3 = new Date(Date.now() - 3 * 86400000).toISOString();
  const count = async (label, query) => {
    const { count: value, error } = await query;
    if (error) throw new Error(`${label}: ${error.message}`);
    return value;
  };
  const result = {
    inspectedAt: new Date().toISOString(),
    totalMessages: await count("messages", client.from("messages").select("id", { count: "exact", head: true })),
    messagesOlderThan5DaysBeforeExemptions: await count("old5", client.from("messages").select("id", { count: "exact", head: true }).lt("created_at", cutoff5)),
    messagesOlderThan3DaysBeforeExemptions: await count("old3", client.from("messages").select("id", { count: "exact", head: true }).lt("created_at", cutoff3)),
    messagesNewerThan5Days: await count("new5", client.from("messages").select("id", { count: "exact", head: true }).gte("created_at", cutoff5)),
    favoriteChats: await count("favorite chats", client.from("chats").select("id", { count: "exact", head: true }).eq("is_favorite", true)),
    archivedChats: await count("archived chats", client.from("chats").select("id", { count: "exact", head: true }).eq("is_archived", true)),
    generatedFiles: await count("generated files", client.from("generated_files").select("id", { count: "exact", head: true }))
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(`Retention dry run failed: ${error.message}`);
  process.exitCode = 1;
});
