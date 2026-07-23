import { AIChatWorkspace } from "@/components/ai-chat-workspace";

export default function AssistantChatPage({ params }: { params: { id: string } }) {
  return <AIChatWorkspace assistantId={params.id} />;
}
