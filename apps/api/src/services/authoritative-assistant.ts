import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import type { AssistantRecord } from "../types";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "./supabase-server";

function fromSupabase(row: Record<string, unknown>, userId: string): AssistantRecord {
  return {
    id: String(row.id),
    userId,
    createdByUserId: userId,
    name: String(row.name ?? "AGENTIA Assistant"),
    description: String(row.description ?? ""),
    systemPrompt: String(row.instructions ?? row.system_prompt ?? ""),
    tone: (row.tone ?? "professional") as AssistantRecord["tone"],
    visibility: row.is_public ? "public" : "private",
    version: Number(row.version ?? 1),
    isPublic: Boolean(row.is_public),
    publicSlug: row.public_slug ? String(row.public_slug) : undefined,
    slug: String(row.slug ?? row.public_slug ?? row.id),
    model: String(row.model_name ?? row.model ?? "standard"),
    temperature: Number(row.temperature ?? 0.7),
    icon: String(row.icon ?? "Bot"),
    color: String(row.color ?? "#06b6d4"),
    starterPrompts: Array.isArray(row.starter_prompts) ? row.starter_prompts.map(String) : [],
    enabledTools: Array.isArray(row.enabled_tools) ? row.enabled_tools.map(String) : [],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString())
  };
}

export async function resolveAuthoritativeAssistant(env: Env, store: MemoryStore, assistantId: string, userId: string) {
  if (env.nodeEnv !== "test" && isSupabaseServerConfigured()) {
    const { data, error } = await createSupabaseServerClient()
      .from("assistants")
      .select("*")
      .eq("id", assistantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return fromSupabase(data, userId);
    return undefined;
  }
  return store.getAssistantForUser(assistantId, userId);
}
