import type { Request } from "express";
import type { PlanName } from "@archmind/shared";

export interface AuthUser {
  id: string;
  firebaseUid?: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  plan: PlanName;
  assistantId?: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export interface UserRecord {
  id: string;
  firebaseUid?: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  passwordHash?: string;
  googleId?: string;
  googleRefreshToken?: string;
  googleAccessToken?: string;
  googleAccessTokenExpiresAt?: string;
  provider?: string;
  plan: PlanName;
  tokenUsage: number;
  lastLoginAt?: string;
  notionAccessToken?: string;
  notionWorkspaceId?: string;
  notionWorkspaceName?: string;
  notionWorkspaceIcon?: string;
  notionBotId?: string;
  notionConnectedAt?: string;
  credits?: number;
  creditsLastResetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantRecord {
  id: string;
  userId: string;
  createdByUserId: string;
  name: string;
  slug: string;
  description?: string;
  systemPrompt: string;
  tone: "professional" | "casual" | "teacher" | "custom";
  isPublic: boolean;
  visibility: "public" | "private";
  publicSlug?: string;
  model: string;
  temperature: number;
  icon?: string;
  color?: string;
  starterPrompts: string[];
  enabledTools: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantActionRecord {
  id: string;
  assistantId: string;
  name: string;
  type: "webhook" | "whatsapp_share" | "copy" | "mailto" | "external_url";
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceRecord {
  id: string;
  userId?: string;
  assistantId: string;
  type: "pdf" | "text" | "url" | "notion" | "md" | "docx" | "csv" | "json";
  name: string;
  originalFilename?: string;
  safeFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
  extractedTextLength?: number;
  errorMessage?: string;
  s3Key?: string;
  url?: string;
  status: "pending" | "uploading" | "processing" | "ready" | "error" | "failed";
  chunkCount: number;
  tokenCount: number;
  chunks: RetrievedChunk[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationRecord {
  id: string;
  assistantId: string;
  userId?: string;
  sessionId?: string;
  title?: string;
  messageCount: number;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokensUsed: number;
  sources: RetrievedChunk[];
  createdAt: string;
}

export interface AnalyticsEventRecord {
  id: string;
  assistantId: string;
  eventType: string;
  tokens: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RetrievedChunk {
  sourceId: string;
  sourceName: string;
  userId?: string;
  assistantId?: string;
  fileId?: string;
  filename?: string;
  chunkIndex?: number;
  page?: number;
  text: string;
  similarity: number;
}

export interface ExecutionBridgeLogRecord {
  id: string;
  assistantId: string;
  userId: string;
  timestamp: string;
  request: string;
  intent: string;
  extractedData: Record<string, unknown>;
  toolsPlanned: string[];
  toolsExecuted: Array<{
    name: string;
    params: Record<string, unknown>;
    success: boolean;
    response: unknown;
    timestamp: string;
    durationMs: number;
    retryCount: number;
  }>;
  status: "success" | "failed" | "pending_approval";
  errorMessage?: string;
  executionTimeMs: number;
}

export interface ExecutionApprovalRecord {
  id: string;
  logId: string;
  assistantId: string;
  userId: string;
  actionType: string;
  actionDescription: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface NotionActivityLogRecord {
  id: string;
  userId: string;
  operation: string;
  resourceId?: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
}

export interface NotionOAuthStateRecord {
  state: string;
  userId: string;
  createdAt: number;
}


