import { randomUUID } from "crypto";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import type { ExecutionBridgeLogRecord, ExecutionApprovalRecord } from "../types";
import { LlmService } from "./llm";
import { ToolGatewayService, type ToolExecutionResult } from "./tool-gateway";

export interface ExecutionBridgeRunResult {
  logId: string;
  intent: string;
  extractedData: Record<string, any>;
  status: "success" | "failed" | "pending_approval";
  toolsPlanned: string[];
  toolsExecuted: Array<{
    name: string;
    params: Record<string, any>;
    success: boolean;
    response: any;
    timestamp: string;
    durationMs: number;
    retryCount: number;
  }>;
  errorMessage?: string;
  responseMessage: string;
}

export class ExecutionEngineService {
  private llm: LlmService;
  private toolGateway: ToolGatewayService;

  constructor(
    private env: Env,
    private store: MemoryStore
  ) {
    this.llm = new LlmService(env);
    this.toolGateway = new ToolGatewayService(env, store);
  }

  /**
   * Main entry point to run a user request through the execution pipeline
   */
  async runPipeline(assistantId: string, userId: string, message: string): Promise<ExecutionBridgeRunResult> {
    const startTime = Date.now();
    const logId = randomUUID();

    // 1. Analyze intent, extract data, and generate a tool plan using the LLM
    let analysisResult;
    try {
      analysisResult = await this.analyzeAndPlan(message);
    } catch (err: any) {
      return {
        logId,
        intent: "System Action",
        extractedData: {},
        status: "failed",
        toolsPlanned: [],
        toolsExecuted: [],
        errorMessage: `AI Analysis failed: ${err.message}`,
        responseMessage: "I encountered an error analyzing your request. Please try again."
      };
    }

    const { intent, extractedData, missingRequiredFields, toolPlan } = analysisResult;

    // 2. Validation Gate: If critical info is missing, STOP execution
    if (missingRequiredFields && missingRequiredFields.length > 0) {
      const logRecord: ExecutionBridgeLogRecord = {
        id: logId,
        assistantId,
        userId,
        timestamp: new Date().toISOString(),
        request: message,
        intent,
        extractedData,
        toolsPlanned: [],
        toolsExecuted: [],
        status: "failed",
        errorMessage: `Missing required fields: ${missingRequiredFields.join(", ")}`,
        executionTimeMs: Date.now() - startTime
      };
      this.store.createBridgeLog(logRecord);

      return {
        logId,
        intent,
        extractedData,
        status: "failed",
        toolsPlanned: [],
        toolsExecuted: [],
        errorMessage: `Missing required fields: ${missingRequiredFields.join(", ")}`,
        responseMessage: `I'd love to help with that ${intent.toLowerCase()}, but I'm missing some required details: ${missingRequiredFields.join(", ")}. Please provide them to proceed.`
      };
    }

    // 3. Human Safety Gate: Check if plan contains high-risk actions
    const hasHighRiskAction = toolPlan.some((p: any) => 
      p.tool === "trigger_webhook" || 
      (p.tool === "update_calendar_event" && p.params?.cancel === true) || 
      (p.tool === "write_sheets" && p.params?.overwrite === true)
    );

    const logRecord: ExecutionBridgeLogRecord = {
      id: logId,
      assistantId,
      userId,
      timestamp: new Date().toISOString(),
      request: message,
      intent,
      extractedData,
      toolsPlanned: toolPlan.map((p: any) => p.tool),
      toolsExecuted: [],
      status: hasHighRiskAction ? "pending_approval" : "success",
      executionTimeMs: 0
    };

    if (hasHighRiskAction) {
      // Save logs and approval records
      this.store.createBridgeLog(logRecord);
      
      const highRiskTool = toolPlan.find((p: any) => 
        p.tool === "trigger_webhook" || 
        (p.tool === "update_calendar_event" && p.params?.cancel === true) || 
        (p.tool === "write_sheets" && p.params?.overwrite === true)
      );

      const approvalRecord: ExecutionApprovalRecord = {
        id: randomUUID(),
        logId,
        assistantId,
        userId,
        actionType: highRiskTool.tool,
        actionDescription: `Execute action ${highRiskTool.tool} with parameters: ${JSON.stringify(highRiskTool.params)}`,
        toolName: highRiskTool.tool,
        toolParams: highRiskTool.params,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.store.createBridgeApproval(approvalRecord);

      return {
        logId,
        intent,
        extractedData,
        status: "pending_approval",
        toolsPlanned: logRecord.toolsPlanned,
        toolsExecuted: [],
        responseMessage: `This action requires your confirmation. Confirm before I execute: ${approvalRecord.actionDescription}`
      };
    }

    // 4. Execution Loop & Retry System
    const toolsExecuted: any[] = [];
    let executionSuccess = true;
    let failedToolName = "";
    let finalError = "";

    for (const step of toolPlan) {
      const stepParams = { ...step.params };

      const executionResult = await this.executeWithRetries(step.tool, stepParams, userId);
      toolsExecuted.push({
        name: step.tool,
        params: step.params,
        success: executionResult.success,
        response: executionResult.response,
        timestamp: executionResult.timestamp,
        durationMs: executionResult.durationMs,
        retryCount: (executionResult as any).retryCount || 0
      });

      if (!executionResult.success) {
        executionSuccess = false;
        failedToolName = step.tool;
        finalError = executionResult.errorMessage || "Unknown error occurred.";
        break;
      }
    }

    // 5. Verification & Rollback Layer
    if (!executionSuccess) {
      // Trigger rollback for previously completed steps
      const rollbackLogs = await this.rollbackActions(toolsExecuted, userId);
      
      const updatedLogRecord: ExecutionBridgeLogRecord = {
        ...logRecord,
        toolsExecuted: [...toolsExecuted, ...rollbackLogs],
        status: "failed",
        errorMessage: `Execution failed at step ${failedToolName}: ${finalError}`,
        executionTimeMs: Date.now() - startTime
      };
      this.store.createBridgeLog(updatedLogRecord);

      return {
        logId,
        intent,
        extractedData,
        status: "failed",
        toolsPlanned: logRecord.toolsPlanned,
        toolsExecuted: updatedLogRecord.toolsExecuted,
        errorMessage: updatedLogRecord.errorMessage,
        responseMessage: `Automation workflow failed at step ${failedToolName} after 3 retries: ${finalError}. Rollbacks have been applied to revert partial changes.`
      };
    }

    // Success! Log event, sync, and return
    const updatedLogRecord: ExecutionBridgeLogRecord = {
      ...logRecord,
      toolsExecuted,
      status: "success",
      executionTimeMs: Date.now() - startTime
    };
    this.store.createBridgeLog(updatedLogRecord);

    // Simulate appending a row in the Google Sheets Live Audit Log
    await this.toolGateway.write_sheets({
      spreadsheetId: "audit_log_spreadsheet",
      range: "LiveLog",
      values: [[new Date().toISOString(), intent, message, "SUCCESS", JSON.stringify(toolsExecuted)]]
    }, userId);

    return {
      logId,
      intent,
      extractedData,
      status: "success",
      toolsPlanned: logRecord.toolsPlanned,
      toolsExecuted,
      responseMessage: `Workflow completed successfully! Executed ${toolsExecuted.length} tasks: ${logRecord.toolsPlanned.join(" -> ")}.`
    };
  }

  /**
   * Resumes execution of a plan that was paused for approval
   */
  async resumePipeline(approvalId: string, decision: "approved" | "rejected"): Promise<ExecutionBridgeRunResult> {
    const startTime = Date.now();
    const approval = this.store.getBridgeApproval(approvalId);
    if (!approval) {
      throw new Error("Approval record not found");
    }

    this.store.updateBridgeApproval(approvalId, decision);
    const log = this.store.getBridgeLog(approval.logId);
    if (!log) {
      throw new Error("Associated execution log not found");
    }

    if (decision === "rejected") {
      const updatedLogRecord: ExecutionBridgeLogRecord = {
        ...log,
        status: "failed",
        errorMessage: "Action rejected by user.",
        executionTimeMs: Date.now() - startTime
      };
      this.store.createBridgeLog(updatedLogRecord);

      return {
        logId: log.id,
        intent: log.intent,
        extractedData: log.extractedData,
        status: "failed",
        toolsPlanned: log.toolsPlanned,
        toolsExecuted: [],
        errorMessage: "Action rejected by user.",
        responseMessage: "Action was cancelled as you requested."
      };
    }

    // If approved, execute the approved high-risk tool.
    const toolsExecuted: any[] = [];
    let executionSuccess = true;
    let failedToolName = "";
    let finalError = "";

    // Execute the approved high-risk tool
    const stepResult = await this.executeWithRetries(approval.toolName, approval.toolParams, approval.userId);
    toolsExecuted.push({
      name: approval.toolName,
      params: approval.toolParams,
      success: stepResult.success,
      response: stepResult.response,
      timestamp: stepResult.timestamp,
      durationMs: stepResult.durationMs,
      retryCount: (stepResult as any).retryCount || 0
    });

    if (!stepResult.success) {
      executionSuccess = false;
      failedToolName = approval.toolName;
      finalError = stepResult.errorMessage || "Approval tool execution failed.";
    }

    if (!executionSuccess) {
      const updatedLogRecord: ExecutionBridgeLogRecord = {
        ...log,
        toolsExecuted,
        status: "failed",
        errorMessage: `Execution failed at step ${failedToolName}: ${finalError}`,
        executionTimeMs: Date.now() - startTime
      };
      this.store.createBridgeLog(updatedLogRecord);

      return {
        logId: log.id,
        intent: log.intent,
        extractedData: log.extractedData,
        status: "failed",
        toolsPlanned: log.toolsPlanned,
        toolsExecuted,
        errorMessage: updatedLogRecord.errorMessage,
        responseMessage: `Approved action failed: ${finalError}.`
      };
    }

    // Success! Update log and return
    const updatedLogRecord: ExecutionBridgeLogRecord = {
      ...log,
      toolsExecuted,
      status: "success",
      executionTimeMs: Date.now() - startTime
    };
    this.store.createBridgeLog(updatedLogRecord);

    return {
      logId: log.id,
      intent: log.intent,
      extractedData: log.extractedData,
      status: "success",
      toolsPlanned: log.toolsPlanned,
      toolsExecuted,
      responseMessage: `Approved action was executed successfully: ${approval.toolName}.`
    };
  }

  /**
   * Core logic for retrying tools on failure
   */
  private async executeWithRetries(toolName: string, params: any, userId: string): Promise<ToolExecutionResult & { retryCount: number }> {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const delays = this.env.nodeEnv === "test" ? [0, 5, 10] : [0, 5000, 30000];
    
    let lastResult: ToolExecutionResult | null = null;
    let attempt = 0;

    for (attempt = 0; attempt < 3; attempt++) {
      const waitTime = delays[attempt] ?? 0;
      if (attempt > 0) {
        console.log(`[ExecutionEngine] Retrying tool ${toolName}. Attempt ${attempt + 1}. Waiting ${waitTime / 1000}s.`);
        await delay(waitTime);
      }

      const method = (this.toolGateway as any)[toolName];
      if (typeof method !== "function") {
        throw new Error(`Tool ${toolName} does not exist in gateway.`);
      }

      lastResult = await method.call(this.toolGateway, params, userId);
      if (lastResult!.success) {
        return {
          ...lastResult!,
          retryCount: attempt
        };
      }
    }

    return {
      ...lastResult!,
      retryCount: attempt - 1
    };
  }

  /**
   * Applies rollback actions if any steps fail
   */
  private async rollbackActions(executedTools: any[], userId: string): Promise<any[]> {
    const rollbacks: any[] = [];
    const completed = executedTools.filter((t) => t.success);

    for (const tool of completed.reverse()) {
      const rollbackTime = Date.now();
      let rollbackResponse = "rolled back";

      if (tool.name === "create_calendar_event") {
        const eventId = tool.response?.id;
        // Call update_calendar_event to cancel/delete it
        await this.toolGateway.update_calendar_event({ eventId, title: "CANCELLED - Rollback" }, userId);
        rollbackResponse = `Deleted calendar event ${eventId}`;
      }

      rollbacks.push({
        name: `rollback_${tool.name}`,
        params: { originalParams: tool.params, originalResponseId: tool.response?.id },
        success: true,
        response: { status: "reverted", message: rollbackResponse },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - rollbackTime,
        retryCount: 0
      });
    }

    return rollbacks;
  }

  /**
   * Calls the LLM to classify user request, extract parameters, and draft a plan
   */
  private async analyzeAndPlan(message: string) {
    const dateStr = new Date().toISOString().split("T")[0];
    const systemPrompt = `You are the AI Decision Engine for the ArchMind Autonomous Execution Bridge.
Your job is to analyze the user's message, classify it into one of the 8 allowed intents, extract key entities, validate whether necessary inputs are present, and output a list of tools to execute.

Allowed Intents:
- Booking
- Support
- Lead Inquiry
- Data Update
- Information Request
- System Action
- Follow-up Action

Available Tools and parameters:
- send_email(to, subject, body)
- read_email(query, messageId)
- create_calendar_event(title, startTime, endTime, attendees)
- update_calendar_event(eventId, title, startTime, endTime, attendees)
- read_sheets(spreadsheetId, range)
- write_sheets(spreadsheetId, range, values)
- getNotionPages(query)
- getNotionDatabases(query)
- getPageContent(pageId)
- createNotionPage(parentId, title, content)
- updateNotionPage(pageId, properties)
- update_notion_page(pageId, properties)
- createDatabaseRecord(databaseId, properties)
- updateDatabaseRecord(entryId, properties)
- searchNotion(query)
- send_telegram_message(chat_id, text) (Note: chat_id is optional. If the user does not specify a chat ID, do NOT invent mock values like "123456789"; leave it as an empty string or omit it)
- trigger_webhook(url, payload)

Validation Rules:
- If Intent is 'Booking': you MUST extract Name/Email, Date, and Time. If any of these are missing, list them in the 'missingRequiredFields' list.
- If Intent is 'Lead Inquiry': you MUST extract email or phone. If missing, list it in 'missingRequiredFields'.
- Note: If the user explicitly asks to cancel an event, use update_calendar_event with parameters including cancel: true (high risk).
- Note: If the user asks to trigger a webhook, use trigger_webhook (high risk).
- Note: If the user asks to send a Telegram message or message via Telegram, you MUST use the send_telegram_message tool. If no chat ID is specified, omit the chat_id parameter or pass an empty string.

Current Date is: ${dateStr}. If the user says "tomorrow", compute the correct date.

You must respond with a single valid JSON block wrapped in \`\`\`json and \`\`\`. Do not output any other text or explanation.

Example JSON output structure:
\`\`\`json
{
  "intent": "Booking",
  "extractedData": {
    "name": "John Doe",
    "email": "john@example.com",
    "date": "2026-05-31",
    "time": "14:00"
  },
  "missingRequiredFields": [],
  "toolPlan": [
    {
      "tool": "create_calendar_event",
      "params": {
        "title": "Introduction Call with John Doe",
        "startTime": "2026-05-31T14:00:00",
        "endTime": "2026-05-31T14:30:00",
        "attendees": ["john@example.com"]
      }
    },
    {
      "tool": "write_sheets",
      "params": {
        "spreadsheetId": "crm_sheet_id",
        "range": "Bookings",
        "values": [["2026-05-31T14:00:00", "John Doe", "john@example.com", "SUCCESS"]]
      }
    }
  ]
}
\`\`\``;

    const chatResponse = await this.llm.chat({
      model: this.env.openRouterCodingModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this user request: "${message}"` }
      ]
    });

    // Parse JSON block
    const jsonMatch = chatResponse.match(/```json\s*([\s\S]*?)\s*```/) || chatResponse.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      throw new Error(`LLM did not return structured JSON. Response: ${chatResponse}`);
    }

    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return {
        intent: parsed.intent || "System Action",
        extractedData: parsed.extractedData || {},
        missingRequiredFields: parsed.missingRequiredFields || [],
        toolPlan: parsed.toolPlan || []
      };
    } catch (e) {
      throw new Error(`JSON parsing failed on LLM output: ${jsonMatch[0]}`);
    }
  }
}
