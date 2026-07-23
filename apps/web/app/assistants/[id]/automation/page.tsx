import { AutomationClient } from "@/components/automation-client";

export default function AutomationPage({ params }: { params: { id: string } }) {
  return <AutomationClient assistantId={params.id} />;
}
