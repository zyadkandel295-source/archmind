import { z } from "zod";

/**
 * The portable, non-secret contract between Agentia Cloud, build workers, and
 * installed runtimes. It deliberately contains configuration only: credentials
 * are acquired at runtime from the OS vault or an authenticated Agentia proxy.
 */
export const AGENTIA_APP_MANIFEST_SCHEMA_VERSION = 1 as const;

const packageIdentifier = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/;
const sha256 = /^[a-f0-9]{64}$/;

export const appPlatformSchema = z.enum(["windows", "macos", "linux", "web"]);
export const appArchitectureSchema = z.enum(["x64", "arm64", "universal"]);
export const appAuthenticationModeSchema = z.enum(["agentia_account", "private", "public"]);
export const appInferenceModeSchema = z.enum(["cloud", "local", "hybrid"]);
export const appToolEnvironmentSchema = z.enum(["runtime", "cloud_proxy", "local_process"]);
export const appPermissionSchema = z.enum(["filesystem", "microphone", "camera", "clipboard", "notifications", "network", "local_applications"]);

const jsonSchema = z.record(z.unknown());
const toolSchema = z.object({
  id: z.string().min(1).max(120),
  version: z.string().min(1).max(64),
  permissions: z.array(appPermissionSchema).default([]),
  inputSchema: jsonSchema.default({}),
  outputSchema: jsonSchema.default({}),
  executionEnvironment: appToolEnvironmentSchema,
  networkRequired: z.boolean().default(false)
}).strict();

export const agentiaAppManifestSchema = z.object({
  format: z.literal("agentia.app-manifest"),
  schemaVersion: z.literal(AGENTIA_APP_MANIFEST_SCHEMA_VERSION),
  manifestId: z.string().uuid(),
  createdAt: z.string().datetime(),
  application: z.object({
    id: z.string().regex(packageIdentifier, "Package identifier must use reverse-domain notation."),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2_000).default(""),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, "Version must be semantic versioning."),
    publisher: z.string().trim().min(1).max(120),
    copyright: z.string().max(500).optional(),
    authenticationMode: appAuthenticationModeSchema,
    targets: z.array(z.object({ platform: appPlatformSchema, architecture: appArchitectureSchema }).strict()).min(1)
  }).strict(),
  assistant: z.object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    systemPrompt: z.string().max(32_000),
    model: z.object({ provider: z.string().min(1).max(100), model: z.string().min(1).max(200), temperature: z.number().min(0).max(2).default(0.7) }).strict(),
    starterPrompts: z.array(z.string().max(1_000)).max(20).default([])
  }).strict(),
  runtime: z.object({
    minimumVersion: z.string().min(1).max(64),
    inferenceMode: appInferenceModeSchema,
    cloudEndpoint: z.string().url().optional(),
    localProvider: z.object({ id: z.string().min(1).max(100), model: z.string().min(1).max(200) }).strict().optional()
  }).strict(),
  tools: z.array(toolSchema).max(100).default([]),
  knowledge: z.object({ mode: z.enum(["local", "cloud", "hybrid"]), references: z.array(z.object({ id: z.string().uuid(), checksum: z.string().regex(sha256), mode: z.enum(["local", "cloud"]) }).strict()).max(1_000).default([]) }).strict(),
  memory: z.object({ conversation: z.boolean().default(true), session: z.boolean().default(true), longTerm: z.boolean().default(false), localEncryptionRequired: z.boolean().default(true) }).strict(),
  permissions: z.object({ requested: z.array(appPermissionSchema).default([]), required: z.array(appPermissionSchema).default([]), rationale: z.record(z.string().max(500)).default({}) }).strict(),
  sync: z.object({ enabled: z.boolean().default(false), endpoint: z.string().url().optional(), conflictStrategy: z.enum(["server_wins", "client_wins", "manual"]).default("manual") }).strict(),
  branding: z.object({ accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563EB"), iconChecksum: z.string().regex(sha256).optional(), theme: z.enum(["system", "light", "dark"]).default("system") }).strict(),
  integrity: z.object({ canonicalSha256: z.string().regex(sha256), signature: z.string().min(16), keyId: z.string().min(1).max(120) }).strict()
}).strict();

export type AgentiaAppManifest = z.infer<typeof agentiaAppManifestSchema>;

const forbiddenKey = /(secret|token|password|authorization|cookie|private.?key|service.?role|api.?key)/i;

export function containsManifestSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsManifestSecret);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => forbiddenKey.test(key) || containsManifestSecret(nested));
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

/** Validates strict shape and rejects configuration that could leak a secret. */
export function parseAgentiaAppManifest(value: unknown): AgentiaAppManifest {
  if (containsManifestSecret(value)) throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: [], message: "Manifests cannot contain credentials or secrets." }]);
  return agentiaAppManifestSchema.parse(value);
}
