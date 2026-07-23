// ──────────────────────────────────────────────
// Route definitions shared between API and Web
// ──────────────────────────────────────────────

export interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  auth: boolean;
}

export const API_ROUTES: RouteDefinition[] = [
  { method: "GET",    path: "/api/health",                                        description: "Health check",                    auth: false },
  { method: "POST",   path: "/api/auth/firebase/session",                         description: "Firebase session login",          auth: false },
  { method: "POST",   path: "/api/auth/register",                                 description: "Register new user",               auth: false },
  { method: "POST",   path: "/api/auth/login",                                    description: "Login with email & password",     auth: false },
  { method: "GET",    path: "/api/auth/google",                                   description: "Start Google OAuth flow",         auth: false },
  { method: "GET",    path: "/api/auth/google/callback",                          description: "Google OAuth callback",           auth: false },
  { method: "POST",   path: "/api/auth/password-reset/request",                   description: "Request password reset",          auth: false },
  { method: "POST",   path: "/api/auth/password-reset/confirm",                   description: "Confirm password reset",          auth: false },
  { method: "POST",   path: "/api/auth/refresh",                                  description: "Refresh access token",            auth: false },

  { method: "GET",    path: "/api/assistants",                                    description: "List assistants",                 auth: true },
  { method: "POST",   path: "/api/assistants",                                    description: "Create assistant",                auth: true },
  { method: "GET",    path: "/api/assistants/:id",                                description: "Get assistant",                   auth: true },
  { method: "GET",    path: "/api/assistants/:id/sync",                           description: "Sync assistant settings via SSE", auth: true },
  { method: "PUT",    path: "/api/assistants/:id",                                description: "Update assistant",                auth: true },
  { method: "POST",   path: "/api/assistants/:id/duplicate",                      description: "Duplicate assistant",             auth: true },
  { method: "POST",   path: "/api/assistants/:id/conversations/clear",            description: "Clear conversations",             auth: true },
  { method: "DELETE", path: "/api/assistants/:id",                                description: "Delete assistant",                auth: true },
  { method: "GET",    path: "/api/assistants/:id/actions",                        description: "List actions",                    auth: true },
  { method: "POST",   path: "/api/assistants/:id/actions",                        description: "Create action",                   auth: true },
  { method: "PUT",    path: "/api/assistants/:id/actions/:actionId",              description: "Update action",                   auth: true },
  { method: "DELETE", path: "/api/assistants/:id/actions/:actionId",              description: "Delete action",                   auth: true },
  { method: "POST",   path: "/api/assistants/:id/sources/upload",                 description: "Upload source",                   auth: true },
  { method: "POST",   path: "/api/assistants/:id/sources/url",                    description: "Add URL source",                  auth: true },
  { method: "GET",    path: "/api/sources/:id/status",                            description: "Source status",                   auth: true },
  { method: "POST",   path: "/api/assistants/:id/knowledge/upload",               description: "Upload knowledge file",           auth: true },
  { method: "GET",    path: "/api/assistants/:id/knowledge",                      description: "List knowledge files",            auth: true },
  { method: "GET",    path: "/api/assistants/:id/knowledge/:fileId/status",       description: "Knowledge file status",           auth: true },
  { method: "DELETE", path: "/api/assistants/:id/knowledge/:fileId",              description: "Delete knowledge file",           auth: true },
  { method: "POST",   path: "/api/chat",                                          description: "Chat (AI direct)",                auth: true },
  { method: "POST",   path: "/api/chat/:assistantId",                             description: "Chat with assistant",             auth: true },
  { method: "POST",   path: "/api/assistants/:assistantId/chat",                  description: "Chat with assistant (alt)",       auth: true },
  { method: "GET",    path: "/api/assistants/:assistantId/conversations",         description: "List conversations",              auth: true },
  { method: "GET",    path: "/api/conversations/:id/messages",                    description: "List messages",                   auth: true },
  { method: "GET",    path: "/api/public/:slug",                                  description: "Get public assistant",            auth: true },
  { method: "GET",    path: "/api/analytics",                                     description: "Analytics overview",              auth: true },
  { method: "GET",    path: "/api/profile",                                       description: "Get profile",                     auth: true },
  { method: "PUT",    path: "/api/profile",                                       description: "Update profile",                  auth: true }
];
