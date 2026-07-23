import { Database } from "lucide-react";
import { SourceUploader } from "@/components/source-uploader";
import { Badge } from "@/components/ui/badge";

export default function SourcesPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="online">Real file storage</Badge>
          <Badge tone="warning">Parser status</Badge>
          <Badge tone="new">Keyword retrieval</Badge>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Database className="h-8 w-8 text-brand-600" />
          <h1 className="text-3xl font-black md:text-5xl">Data Sources</h1>
        </div>
      </div>
      <SourceUploader assistantId={params.id} />
    </main>
  );
}
