import { AcademicSectionPage } from "@/components/ai-base/academic-section-page";
import { getAIBaseSection } from "@/lib/ai-base-library";

export const metadata = {
  title: "Nlp · AGENTIA AI BASE",
  description: "Academic AI knowledge, readable formulas, and a curated research library."
};

export default function Page() {
  const section = getAIBaseSection("nlp");
  if (!section) return null;
  return <AcademicSectionPage section={section} />;
}
