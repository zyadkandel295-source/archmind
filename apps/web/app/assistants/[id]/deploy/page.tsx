import { DeployClient } from "@/components/deploy-client";

export default function DeployAssistantPage({ params }: { params: { id: string } }) {
  return <DeployClient assistantId={params.id} />;
}
