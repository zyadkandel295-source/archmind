import type { RiskLevel, WorkflowAction } from "../platform-types";

export interface ActionPolicy {
  riskLevel: RiskLevel;
  reversible: boolean;
  approvalRequired: boolean;
  dataLeavesDevice: boolean;
  provider?: string;
}

const policies: Record<string, ActionPolicy> = {
  "file.read": { riskLevel: "sensitive_data_access", reversible: false, approvalRequired: true, dataLeavesDevice: false },
  "file.create": { riskLevel: "low_risk_reversible", reversible: true, approvalRequired: true, dataLeavesDevice: false },
  "file.update": { riskLevel: "low_risk_reversible", reversible: true, approvalRequired: true, dataLeavesDevice: false },
  "file.rename": { riskLevel: "low_risk_reversible", reversible: true, approvalRequired: true, dataLeavesDevice: false },
  "file.move": { riskLevel: "destructive_filesystem", reversible: true, approvalRequired: true, dataLeavesDevice: false },
  "data.extract": { riskLevel: "sensitive_data_access", reversible: false, approvalRequired: true, dataLeavesDevice: true, provider: "configured AI provider" },
  "csv.append": { riskLevel: "low_risk_reversible", reversible: true, approvalRequired: true, dataLeavesDevice: false },
  "document.generate": { riskLevel: "low_risk_reversible", reversible: true, approvalRequired: true, dataLeavesDevice: false },
  "notification.send": { riskLevel: "read_only", reversible: false, approvalRequired: false, dataLeavesDevice: false },
  "webhook.call": { riskLevel: "irreversible_external", reversible: false, approvalRequired: true, dataLeavesDevice: true, provider: "webhook recipient" },
  "approval.request": { riskLevel: "read_only", reversible: false, approvalRequired: false, dataLeavesDevice: false },
  "input.pause": { riskLevel: "read_only", reversible: false, approvalRequired: false, dataLeavesDevice: false }
};

export function getActionPolicy(type: string): ActionPolicy {
  return policies[type] ?? { riskLevel: "blocked", reversible: false, approvalRequired: true, dataLeavesDevice: false };
}

export function classifyAction(action: Omit<WorkflowAction, "riskLevel" | "requiresApproval">): WorkflowAction {
  const policy = getActionPolicy(action.type);
  return { ...action, riskLevel: policy.riskLevel, requiresApproval: policy.approvalRequired };
}

export function listActionPolicies() {
  return Object.entries(policies).map(([type, policy]) => ({ type, ...policy }));
}

export function actionPreview(action: WorkflowAction) {
  const policy = getActionPolicy(action.type);
  return {
    summary: action.name,
    actionType: action.type,
    resources: Object.entries(action.input)
      .filter(([key]) => /path|folder|url|recipient|file/i.test(key))
      .map(([key, value]) => ({ key, value })),
    expectedResult: previewResult(action.type),
    reversible: policy.reversible,
    undoExplanation: policy.reversible ? "ArchMind will capture the prior state and check for conflicts before undoing." : "Automatic undo is unavailable for this action.",
    dataLeavesDevice: policy.dataLeavesDevice,
    provider: policy.provider ?? null,
    riskLevel: policy.riskLevel,
    permission: `${action.type}:${String(action.input.path ?? action.input.folder ?? action.input.url ?? "this action")}`
  };
}

function previewResult(type: string) {
  if (type === "file.read") return "The approved file will be read.";
  if (type === "file.create") return "A new file will be created in the approved folder.";
  if (type === "file.update") return "The approved file content will change.";
  if (type === "file.rename" || type === "file.move") return "The approved file path will change.";
  if (type === "csv.append") return "One row will be appended to the approved CSV file.";
  if (type === "webhook.call") return "Data will be sent to the named webhook recipient.";
  return "The action will produce its declared output.";
}
