import { AppExportClient } from "@/components/app-export-client";

export default function DeployAssistantPage({ params }: { params: { id: string } }) {
  return <AppExportClient assistantId={params.id} />;
}
