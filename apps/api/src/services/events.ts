import { EventEmitter } from "events";

export const assistantEvents = new EventEmitter();

assistantEvents.setMaxListeners(100);

export function notifyAssistantUpdate(assistantId: string) {
  assistantEvents.emit("update", assistantId);
  publishAssistantEvent(assistantId, "assistant.updated");
}
export type AssistantEventType = "assistant.updated" | "conversation.updated" | "assistant.deleted";
export interface AssistantEvent { assistantId: string; type: AssistantEventType; occurredAt: string }
export function publishAssistantEvent(assistantId: string, type: AssistantEventType) { assistantEvents.emit("assistant-event", { assistantId, type, occurredAt: new Date().toISOString() } satisfies AssistantEvent); }

