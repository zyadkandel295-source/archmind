import { notFound } from "next/navigation";
import { KnowledgeResourcePage } from "@/components/ai-base/knowledge-resource-page";
import { findKnowledgeResource } from "@/lib/knowledge-catalog";

export default function KnowledgeResourceRoute({ params }: { params: { field: string; resource: string } }) {
  const resource = findKnowledgeResource(params.field, params.resource);
  if (!resource) notFound();
  return <KnowledgeResourcePage resource={resource} />;
}
