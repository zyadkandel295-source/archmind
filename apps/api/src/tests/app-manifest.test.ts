import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { canonicalJson, parseAgentiaAppManifest } from "@archmind/shared";

function validManifest() {
  return {
    format: "agentia.app-manifest", schemaVersion: 1, manifestId: randomUUID(), createdAt: new Date().toISOString(),
    application: { id: "com.agentia.test", name: "Test", description: "", version: "1.0.0", publisher: "Agentia", authenticationMode: "agentia_account", targets: [{ platform: "windows", architecture: "x64" }] },
    assistant: { id: randomUUID(), version: 1, name: "Test", systemPrompt: "Be helpful.", model: { provider: "agentia-cloud", model: "default", temperature: 0.7 }, starterPrompts: [] },
    runtime: { minimumVersion: "1", inferenceMode: "cloud", cloudEndpoint: "https://api.example.test" }, tools: [],
    knowledge: { mode: "cloud", references: [] }, memory: { conversation: true, session: true, longTerm: false, localEncryptionRequired: true },
    permissions: { requested: ["network"], required: [], rationale: {} }, sync: { enabled: true, endpoint: "https://api.example.test", conflictStrategy: "manual" },
    branding: { accentColor: "#2563EB", theme: "system" }, integrity: { canonicalSha256: "a".repeat(64), signature: "signed-manifest-value", keyId: "test" }
  };
}

describe("Agentia App Manifest", () => {
  test("accepts a strict portable manifest", () => {
    const parsed = parseAgentiaAppManifest(validManifest());
    expect(parsed.application.id).toBe("com.agentia.test");
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test("rejects credentials and non-semantic versions", () => {
    expect(() => parseAgentiaAppManifest({ ...validManifest(), apiKey: "do-not-ship" })).toThrow("credentials or secrets");
    expect(() => parseAgentiaAppManifest({ ...validManifest(), application: { ...validManifest().application, version: "release-one" } })).toThrow();
  });
});
