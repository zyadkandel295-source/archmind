import { AIChatWorkspace } from "@/components/ai-chat-workspace";

export default function PublicChatPage({ params }: { params: { slug: string } }) {
  return <AIChatWorkspace assistantId={params.slug} embedded />;
}
