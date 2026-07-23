import { AssistantSettingsForm } from "@/components/assistant-settings-form";
import { Badge } from "@/components/ui/badge";

export default function AssistantSettingsPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div>
          <Badge tone="new">Assistant {params.id}</Badge>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">Assistant Settings</h1>
        </div>
      </div>
      <AssistantSettingsForm assistantId={params.id} />
    </main>
  );
}
