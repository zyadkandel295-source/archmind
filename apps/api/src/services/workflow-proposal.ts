import { randomUUID } from "node:crypto";
import type { WorkflowAction, WorkflowDefinition } from "../platform-types";
import { classifyAction, getActionPolicy } from "./risk-policy";

function action(type: string, name: string, input: Record<string, unknown>): WorkflowAction {
  return classifyAction({ id: randomUUID(), type, name, input });
}

export function proposeWorkflow(description: string) {
  const text = description.trim();
  const lower = text.toLowerCase();
  const questions: string[] = [];
  const actions: WorkflowAction[] = [];
  const quoted = [...text.matchAll(/["“]([^"”]+)["”]/g)].map((match) => match[1]).filter((value): value is string => Boolean(value));
  const folder = quoted.find((value) => /[\\/]|folder/i.test(value));

  let trigger: WorkflowDefinition["trigger"] = { type: "manual", config: {} };
  if (/new (file|invoice)|arrives? in|added to.*folder/.test(lower)) trigger = { type: "file_created", config: { folder: folder ?? "" } };
  else if (/file (changes|is modified)|modified file/.test(lower)) trigger = { type: "file_modified", config: { folder: folder ?? "" } };
  else if (/every |daily|weekly|monthly|schedule/.test(lower)) trigger = { type: "schedule", config: { expression: "" } };
  else if (/webhook/.test(lower)) trigger = { type: "webhook", config: {} };

  if (/read|invoice|document|file/.test(lower)) actions.push(action("file.read", "Read the approved file", { path: "{{trigger.filePath}}" }));
  if (/extract|invoice|fields?|company name|total|currency/.test(lower)) {
    const fields = ["companyName", "invoiceNumber", "date", "total", "tax", "currency"].filter((field) => lower.includes(field.toLowerCase()) || lower.includes("invoice") || lower.includes("extract"));
    actions.push(action("data.extract", "Extract the information you selected", { source: "{{steps.file.read.content}}", fields }));
  }
  if (/spreadsheet|csv|add (a )?row/.test(lower)) actions.push(action("csv.append", "Add a row to the approved spreadsheet", { path: "", values: "{{steps.data.extract}}" }));
  if (/rename/.test(lower)) actions.push(action("file.rename", "Rename the file consistently", { path: "{{trigger.filePath}}", newName: "{{steps.data.extract.invoiceNumber}}" }));
  if (/mov(?:e|ing)|processed folder/.test(lower)) actions.push(action("file.move", "Move the file to the approved folder", { path: "{{trigger.filePath}}", destinationFolder: "" }));
  if (/create (a )?file|generate (a )?document/.test(lower)) actions.push(action("file.create", "Create the requested file", { path: "", content: "" }));
  if (/notify|notification|tell me/.test(lower)) actions.push(action("notification.send", "Send you a notification", { message: "Workflow completed" }));
  if (/call .*webhook|send .*webhook/.test(lower)) actions.push(action("webhook.call", "Send data to the approved webhook", { url: "", payload: {} }));
  if (actions.length === 0) actions.push(action("notification.send", "Show the requested result", { message: text }));

  if ((trigger.type === "file_created" || trigger.type === "file_modified") && !trigger.config.folder) questions.push("Which folder may this automation watch?");
  if (actions.some((item) => ["csv.append", "file.create"].includes(item.type) && !item.input.path)) questions.push("Which file should ArchMind use for the output?");
  if (actions.some((item) => item.type === "file.move" && !item.input.destinationFolder)) questions.push("Which folder should processed files move into?");
  if (actions.some((item) => item.type === "webhook.call" && !item.input.url)) questions.push("What is the approved webhook address?");
  if (trigger.type === "schedule" && !trigger.config.expression) questions.push("What days and times should this run?");

  const definition: WorkflowDefinition = {
    trigger,
    conditions: [],
    actions,
    requiredConnections: actions.some((item) => item.type === "webhook.call") ? ["webhook"] : [],
    requiredPermissions: actions.map((item) => item.type),
    approvalPolicy: /ask me|confirm|approval/.test(lower) ? "always_ask" : "risk_based",
    errorBehavior: "stop",
    retryPolicy: { maxRetries: 2, backoffMs: 1000 },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    limits: { maxActions: 25, maxRuntimeMs: 120000, maxModelCalls: 3, maxDataBytes: 15 * 1024 * 1024 }
  };
  return { definition, questions, validation: validateWorkflow(definition) };
}

export function validateWorkflow(definition: WorkflowDefinition) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!definition.actions.length) errors.push("Add at least one action.");
  if (definition.actions.length > Math.min(definition.limits.maxActions, 25)) errors.push("The workflow has too many actions.");
  if (definition.limits.maxRuntimeMs > 10 * 60 * 1000 || definition.limits.maxRuntimeMs < 1000) errors.push("Maximum runtime must be between 1 second and 10 minutes.");
  const ids = new Set<string>();
  for (const item of definition.actions) {
    if (ids.has(item.id)) errors.push(`Action ID ${item.id} is duplicated.`);
    ids.add(item.id);
    if (getActionPolicy(item.type).riskLevel === "blocked") errors.push(`Action type ${item.type} is unsupported or blocked.`);
    for (const [key, value] of Object.entries(item.input)) {
      if ((/path|folder|url/i.test(key)) && value === "") warnings.push(`${item.name}: choose ${key} before activation.`);
    }
  }
  if (["file_created", "file_modified"].includes(definition.trigger.type) && !definition.trigger.config.folder) warnings.push("Choose an approved folder before activation.");
  return { valid: errors.length === 0, activationReady: errors.length === 0 && warnings.length === 0, errors, warnings };
}
