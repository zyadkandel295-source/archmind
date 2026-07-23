export type RiskLevel =
  | "read_only"
  | "low_risk_reversible"
  | "sensitive_data_access"
  | "external_communication"
  | "financial_or_account"
  | "destructive_filesystem"
  | "irreversible_external"
  | "blocked";

export type WorkflowStatus = "draft" | "active" | "paused" | "deleted";
export type WorkflowRunStatus =
  | "queued"
  | "validating"
  | "waiting_for_permission"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "undo_requested"
  | "undone"
  | "undo_failed";

export interface WorkflowAction {
  id: string;
  type: string;
  name: string;
  input: Record<string, unknown>;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
}

export interface WorkflowDefinition {
  trigger: { type: "manual" | "schedule" | "file_created" | "file_modified" | "webhook"; config: Record<string, unknown> };
  conditions: Array<{ field: string; operator: string; value: unknown }>;
  actions: WorkflowAction[];
  requiredConnections: string[];
  requiredPermissions: string[];
  approvalPolicy: "risk_based" | "always_ask";
  errorBehavior: "stop" | "continue";
  retryPolicy: { maxRetries: number; backoffMs: number };
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  limits: { maxActions: number; maxRuntimeMs: number; maxModelCalls: number; maxDataBytes: number };
}

export interface WorkflowRecord {
  id: string;
  ownerId: string;
  organizationId?: string;
  assistantId: string;
  name: string;
  purpose: string;
  status: WorkflowStatus;
  createdVersion: number;
  activeVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionRecord {
  id: string;
  workflowId: string;
  version: number;
  definition: WorkflowDefinition;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  createdBy: string;
  createdAt: string;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  workflowVersion: number;
  ownerId: string;
  assistantId: string;
  status: WorkflowRunStatus;
  idempotencyKey: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  traceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepRecord {
  id: string;
  ownerId: string;
  assistantId: string;
  workflowId: string;
  runId: string;
  actionId: string;
  actionType: string;
  status: "pending" | "waiting_for_permission" | "completed" | "failed" | "undone";
  preview?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionGrantRecord {
  id: string;
  ownerId: string;
  assistantId?: string;
  workflowId?: string;
  actionType: string;
  resource: string;
  mode: "once" | "workflow" | "assistant" | "resource" | "until" | "deny";
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface ApprovalRequestRecord {
  id: string;
  ownerId: string;
  assistantId: string;
  workflowId: string;
  runId: string;
  action: WorkflowAction;
  preview: Record<string, unknown>;
  status: "pending" | "approved" | "denied" | "expired";
  decidedBy?: string;
  decidedAt?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  ownerId: string;
  organizationId?: string;
  assistantId?: string;
  workflowId?: string;
  runId?: string;
  actionType: string;
  riskLevel: RiskLevel;
  decision?: string;
  status: string;
  preview?: Record<string, unknown>;
  details: Record<string, unknown>;
  traceId: string;
  previousHash: string;
  hash: string;
  createdAt: string;
}

export interface UndoRecord {
  id: string;
  ownerId: string;
  auditEventId: string;
  actionType: string;
  payload: Record<string, unknown>;
  expectedResourceHash?: string;
  status: "available" | "undone" | "conflict" | "failed";
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRecord {
  id: string;
  ownerId: string;
  scope: "conversation" | "assistant" | "user" | "workflow" | "session";
  assistantId?: string;
  workflowId?: string;
  source: string;
  category: string;
  content: string;
  confidence: number;
  sensitivity: "normal" | "sensitive" | "highly_sensitive";
  assistantVisibility: string[];
  provenance: Record<string, unknown>;
  expiresAt?: string;
  lastUsedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySettingRecord {
  ownerId: string;
  assistantId?: string;
  memoryEnabled: boolean;
  defaultSensitivity: "normal" | "sensitive";
  retentionDays?: number;
  updatedAt: string;
}

export interface AssistantPackageRecord {
  id: string;
  ownerId: string;
  assistantId: string;
  productName: string;
  description: string;
  publisherName: string;
  category: string;
  pricingType: "private" | "invitation" | "free" | "one_time" | "subscription" | "organization" | "trial" | "unlisted";
  status: "draft" | "published" | "deprecated" | "revoked";
  currentVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackageVersionRecord {
  id: string;
  packageId: string;
  version: number;
  releaseNotes: string;
  manifest: Record<string, unknown>;
  checksum: string;
  status: "draft" | "published" | "deprecated" | "revoked";
  createdAt: string;
}

export interface EntitlementRecord {
  id: string;
  ownerId: string;
  packageId: string;
  packageVersion: number;
  status: "active" | "expired" | "revoked";
  seats: number;
  expiresAt?: string;
  createdAt: string;
}

export interface LicenseRecord {
  id: string;
  ownerId: string;
  packageId: string;
  entitlementId: string;
  status: "active" | "expired" | "revoked";
  seats: number;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface BootstrapTokenRecord {
  id: string;
  tokenHash: string;
  ownerId: string;
  assistantId: string;
  packageId?: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface DeviceSessionRecord {
  id: string;
  ownerId: string;
  assistantId: string;
  installationId: string;
  deviceName: string;
  sessionTokenHash: string;
  revokedAt?: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface DesktopBuildRecord {
  id: string;
  ownerId: string;
  assistantId: string;
  packageId?: string;
  platform: "win32" | "darwin" | "linux";
  architecture: "x64" | "arm64";
  status: "idle" | "validating" | "queued" | "building" | "packaging" | "validating_artifact" | "ready" | "downloading" | "failed" | "expired" | "cancelled";
  appId: string;
  productName: string;
  protocol: string;
  runtimeVersion: string;
  assistantVersion: number;
  brandingHash: string;
  idempotencyKey?: string;
  buildQueueId?: string;
  artifactPath?: string;
  artifactSize?: number;
  artifactSha256?: string;
  downloadTokenHash: string;
  error?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstallerDownloadRecord {
  id: string;
  ownerId: string;
  buildId: string;
  status: "issued" | "downloaded" | "expired" | "revoked";
  tokenHash: string;
  downloadedAt?: string;
  expiresAt: string;
  createdAt: string;
}

export interface DesktopRuntimeReleaseRecord {
  id: string;
  version: string;
  platform: "windows";
  architecture: "x64";
  channel: "development" | "stable";
  status: "building" | "ready" | "failed" | "retired";
  artifactKey: string;
  artifactPath?: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  signatureStatus: "unsigned-dev" | "signed" | "blocked";
  minimumApiVersion: string;
  manifestSchemaVersion: number;
  createdAt: string;
  publishedAt?: string;
  retiredAt?: string;
}

export interface AssistantSnapshotRecord {
  id: string;
  ownerId: string;
  assistantId: string;
  assistantVersion: number;
  displayName: string;
  icon?: string;
  iconDigest?: string;
  instructionDigest: string;
  manifestSchemaVersion: number;
  manifest: Record<string, unknown>;
  manifestDigest: string;
  signature: string;
  signatureKeyId: string;
  status: "published" | "retired";
  createdAt: string;
}

export interface AssistantInstallIntentRecord {
  id: string;
  ownerId: string;
  assistantId: string;
  snapshotId: string;
  runtimeReleaseId: string;
  platform: "windows";
  architecture: "x64";
  status: "created" | "runtime_required" | "awaiting_claim" | "claimed" | "activated" | "expired" | "revoked" | "failed";
  idempotencyKey: string;
  requestFingerprint: string;
  claimSecretHash: string;
  downloadTokenHash: string;
  downloadTokenHashes?: string[];
  expiresAt: string;
  claimedAt?: string;
  activatedAt?: string;
  revokedAt?: string;
  claimedDeviceId?: string;
  errorCode?: string;
  errorMessage?: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceAssistantRecord {
  id: string;
  deviceSessionId: string;
  ownerId: string;
  assistantId: string;
  snapshotId: string;
  assistantVersion: number;
  localProfileId: string;
  status: "active" | "revoked" | "removed";
  installedAt: string;
  lastSeenAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface PlatformPauseState {
  ownerId: string;
  globalPaused: boolean;
  assistantIds: string[];
  workflowIds: string[];
  updatedAt: string;
}

export interface PlatformState {
  workflows: WorkflowRecord[];
  workflowVersions: WorkflowVersionRecord[];
  workflowRuns: WorkflowRunRecord[];
  workflowSteps: WorkflowStepRecord[];
  permissionGrants: PermissionGrantRecord[];
  approvals: ApprovalRequestRecord[];
  auditEvents: AuditEventRecord[];
  undoRecords: UndoRecord[];
  memories: MemoryRecord[];
  memorySettings: MemorySettingRecord[];
  packages: AssistantPackageRecord[];
  packageVersions: PackageVersionRecord[];
  entitlements: EntitlementRecord[];
  licenses: LicenseRecord[];
  bootstrapTokens: BootstrapTokenRecord[];
  deviceSessions: DeviceSessionRecord[];
  desktopBuilds: DesktopBuildRecord[];
  installerDownloads: InstallerDownloadRecord[];
  desktopRuntimeReleases: DesktopRuntimeReleaseRecord[];
  assistantSnapshots: AssistantSnapshotRecord[];
  assistantInstallIntents: AssistantInstallIntentRecord[];
  deviceAssistants: DeviceAssistantRecord[];
  pauseStates: PlatformPauseState[];
}

export function emptyPlatformState(): PlatformState {
  return {
    workflows: [], workflowVersions: [], workflowRuns: [], workflowSteps: [], permissionGrants: [], approvals: [], auditEvents: [],
    undoRecords: [], memories: [], memorySettings: [], packages: [], packageVersions: [], entitlements: [], licenses: [],
    bootstrapTokens: [], deviceSessions: [], desktopBuilds: [], installerDownloads: [],
    desktopRuntimeReleases: [], assistantSnapshots: [], assistantInstallIntents: [], deviceAssistants: [],
    pauseStates: []
  };
}
