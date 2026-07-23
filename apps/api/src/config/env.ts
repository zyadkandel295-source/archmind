import dotenv from "dotenv";
import path from "node:path";

try {
  for (const envPath of [path.resolve(process.cwd(), "..", "..", ".env"), path.resolve(process.cwd(), ".env")]) {
    dotenv.config({ path: envPath, override: false });
  }
} catch {
  // Ignore filesystem env resolution errors on serverless
}

export interface Env {
  nodeEnv: string;
  appUrl: string;
  port: number;
  corsOrigin: string;
  databaseUrl?: string;
  platformStore?: "postgres" | "memory";
  runMigrations?: boolean;
  redisUrl?: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtl: string;
  demoAuth: boolean;
  firebaseProjectId?: string;
  firebaseClientEmail?: string;
  firebasePrivateKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleCallbackUrl: string;
  googleRefreshToken?: string;
  llmProvider: "openrouter";
  openRouterApiKey?: string;
  openRouterDefaultModel: string;
  openRouterReasoningModel: string;
  openRouterCodingModel: string;
  openRouterVerifierModel: string;
  enableAnswerVerification: boolean;
  verifyMath: boolean;
  verifyCode: boolean;
  verifyResearch: boolean;
  s3Region?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  s3Bucket?: string;
  resendApiKey?: string;
  sentryDsn?: string;
  gmailApiToken?: string;
  googleCalendarApiToken?: string;
  googleSheetsApiToken?: string;
  notionIntegrationToken?: string;
  notionClientId?: string;
  notionClientSecret?: string;
  notionRedirectUri: string;
  telegramBotToken?: string;
  webhookSigningSecret?: string;
}

const getJwtSecret = (secretName: string, envVarName: string, _nodeEnv: string): string => {
  const secret = process.env[envVarName];
  if (!secret || secret.length < 32) {
    return `fallback-${secretName}-41ebb6deb48bee5467925c0ee53cbd20deb4294d10d89c490fa6956b64e820264867a1d8d01458eefd8f5a297a86514e2de35db6f630c95e2fd8f602f29d6301`;
  }
  return secret;
};

export function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  return {
    nodeEnv,
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    port: Number(process.env.API_PORT ?? 4000),
    corsOrigin: process.env.API_CORS_ORIGIN ?? "*",
    databaseUrl: process.env.DATABASE_URL,
    platformStore: (process.env.ARCHMIND_PLATFORM_STORE === "memory" ? "memory" : "postgres"),
    runMigrations: process.env.ARCHMIND_RUN_MIGRATIONS === "true",
    redisUrl: process.env.REDIS_URL,
    jwtAccessSecret: getJwtSecret("access-secret", "JWT_ACCESS_SECRET", nodeEnv),
    jwtRefreshSecret: getJwtSecret("refresh-secret", "JWT_REFRESH_SECRET", nodeEnv),
    jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
    demoAuth: process.env.ALLOW_DEMO_AUTH === "true",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/api/auth/google/callback",
    googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    llmProvider: "openrouter",
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openRouterDefaultModel: process.env.OPENROUTER_DEFAULT_MODEL ?? "openrouter/auto",
    openRouterReasoningModel: process.env.OPENROUTER_REASONING_MODEL ?? "deepseek/deepseek-r1:free",
    openRouterCodingModel: process.env.OPENROUTER_CODING_MODEL ?? "deepseek/deepseek-chat-v3-0324:free",
    openRouterVerifierModel: process.env.OPENROUTER_VERIFIER_MODEL ?? "openrouter/auto",
    enableAnswerVerification: process.env.ENABLE_ANSWER_VERIFICATION !== "false",
    verifyMath: process.env.VERIFY_MATH !== "false",
    verifyCode: process.env.VERIFY_CODE !== "false",
    verifyResearch: process.env.VERIFY_RESEARCH !== "false",
    s3Region: process.env.S3_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    s3Bucket: process.env.S3_BUCKET,
    resendApiKey: process.env.RESEND_API_KEY,
    sentryDsn: process.env.SENTRY_DSN,
    gmailApiToken: process.env.GMAIL_API_TOKEN,
    googleCalendarApiToken: process.env.GOOGLE_CALENDAR_API_TOKEN,
    googleSheetsApiToken: process.env.GOOGLE_SHEETS_API_TOKEN,
    notionIntegrationToken: process.env.NOTION_INTEGRATION_TOKEN,
    notionClientId: process.env.NOTION_CLIENT_ID,
    notionClientSecret: process.env.NOTION_CLIENT_SECRET,
    notionRedirectUri: process.env.NOTION_REDIRECT_URI ?? "http://localhost:4000/api/auth/notion/callback",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET
  };
}
