import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { MathFormulaCard } from "@/components/ai-base/math-formula-card";
import { RagPipelineVisualizer } from "@/components/ai-base/interactive-visualizers";
import { BookOpen, Database } from "lucide-react";

export const metadata = {
  title: "Natural Language Processing & RAG | AGENTIA AI BASE",
  description: "Text Preprocessing, Word Embeddings, Word2Vec, GloVe, Vector Databases, Cosine Similarity, RAG Pipeline."
};

export default function NLPPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold mb-2">
            <BookOpen className="w-4 h-4" />
            SECTION 07
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Natural Language Processing & RAG Pipelines
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Text preprocessing, Word2Vec, GloVe, Dense Embeddings, Vector Database Indexing (HNSW), Cosine Similarity, and Retrieval-Augmented Generation (RAG).
          </p>
        </div>

        <MathFormulaCard
          equation="\cos(\theta) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|} = \frac{\sum_{i=1}^{n} A_i B_i}{\sqrt{\sum_{i=1}^{n} A_i^2} \sqrt{\sum_{i=1}^{n} B_i^2}}"
          latexName="Vector Cosine Similarity Formulation"
          variableBreakdown={[
            { variable: "\\mathbf{A}", meaning: "Dense vector embedding of query text" },
            { variable: "\\mathbf{B}", meaning: "Dense vector embedding of candidate knowledge chunk" },
            { variable: "\\cos(\\theta)", meaning: "Cosine of angle between vectors, ranging from -1 (opposite) to +1 (identical)" }
          ]}
          whyItExists="Measures semantic alignment direction between query and document vectors regardless of vector magnitude."
          howDerived="Derived from geometric inner product formula: A · B = ||A|| ||B|| cos(theta)."
          numericalExample={{
            input: "A = [1, 0, 1], B = [1, 1, 0]",
            stepByStep: "1. Dot product A·B = (1*1 + 0*1 + 1*0) = 1.\n2. ||A|| = sqrt(1^2 + 0^2 + 1^2) = sqrt(2). ||B|| = sqrt(2).\n3. cos(theta) = 1 / (sqrt(2) * sqrt(2)) = 1 / 2 = 0.5.",
            output: "Cosine Similarity = 0.50 (60-degree angle)"
          }}
          pythonCode={`import numpy as np

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))` }
        />

        <RagPipelineVisualizer />
      </main>
    </div>
  );
}
