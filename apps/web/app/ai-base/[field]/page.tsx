import { notFound } from "next/navigation";
import { FieldHub } from "@/components/ai-base/field-hub";
import { getKnowledgeField } from "@/lib/knowledge-catalog";

export default function KnowledgeFieldPage({ params }: { params: { field: string } }) {
  const field = getKnowledgeField(params.field);
  if (!field) notFound();
  return <FieldHub field={field} />;
}
