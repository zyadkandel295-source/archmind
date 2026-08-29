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
  pauseStates: PlatformPauseState[];
}

export function emptyPlatformState(): PlatformState {
  return {
    workflows: [], workflowVersions: [], workflowRuns: [], workflowSteps: [], permissionGrants: [], approvals: [], auditEvents: [],
    undoRecords: [], memories: [], memorySettings: [],
    pauseStates: []
  };
}
