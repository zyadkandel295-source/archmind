import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { MathFormulaCard } from "@/components/ai-base/math-formula-card";
import { AttentionMatrixVisualizer } from "@/components/ai-base/interactive-visualizers";
import { Zap, Cpu, Sparkles, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Transformers & LLMs | AGENTIA AI BASE",
  description: "Tokenization, Self-Attention, Multi-Head Attention, Pretraining, Instruction Tuning, RLHF, LoRA, KV Cache."
};

export default function LLMsPage() {
  const llmTopics = [
    { title: "Tokenization & BPE", desc: "Byte-Pair Encoding (BPE) and Tiktoken chunking text into sub-word tokens." },
    { title: "Embeddings & Positional Encoding", desc: "Mapping discrete token IDs to dense vector spaces with Rotary Position Embeddings (RoPE)." },
    { title: "Scaled Dot-Product Attention", desc: "Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V modeling global dependencies." },
    { title: "Multi-Head Attention (MHA)", desc: "Projecting queries, keys, and values into parallel subspaces for multi-perspective context." },
    { title: "Pretraining & Next-Token Prediction", desc: "Autoregressive causal language modeling on multi-trillion token datasets." },
    { title: "RLHF & Direct Preference Optimization (DPO)", desc: "Aligning raw pretrained model outputs with human preference reward signals." },
    { title: "Low-Rank Adaptation (LoRA & QLoRA)", desc: "Freezing base weights and updating rank decomposition matrices ΔW = BA." },
    { title: "KV Cache & Inference Sampling", desc: "Caching Key and Value projections to eliminate redundant O(N^2) recomputation during decoding." }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold mb-2">
            <Zap className="w-4 h-4" />
            SECTION 05
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Transformers & Large Language Models (LLMs)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Deep technical architecture breakdown of modern Foundation Models: Tokenization, Positional Encodings, Scaled Dot-Product Attention, Pretraining, Alignment (RLHF, DPO), Parameter-Efficient Fine-Tuning (LoRA, QLoRA), and KV-Cache decoding acceleration.
          </p>
        </div>

        {/* Transformer Pipeline Workflow */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            End-to-End Autoregressive Generation Flow
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {["Input Text", "BPE Tokens", "Dense Vector Embeddings", "Transformer Layer xN", "Vocabulary Logits", "Temperature & Top-p Sampling", "Generated Next Token"].map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-cyan-300 font-semibold">
                  {step}
                </span>
                {idx < 6 && <span className="text-slate-600 font-bold">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Scaled Dot Product Formula */}
        <MathFormulaCard
          equation="\text{Attention}(Q,K,V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V"
          latexName="Scaled Dot-Product Self-Attention Equation"
          variableBreakdown={[
            { variable: "Q", meaning: "Query matrix of shape (Seq_len, d_k)" },
            { variable: "K", meaning: "Key matrix of shape (Seq_len, d_k)" },
            { variable: "V", meaning: "Value matrix of shape (Seq_len, d_v)" },
            { variable: "d_k", meaning: "Dimension of key vectors used for scaling variance" },
            { variable: "\\text{softmax}", meaning: "Row-wise softmax activation normalizing attention weights to sum to 1" }
          ]}
          whyItExists="Allows sequence elements to dynamically attend to every other element proportional to pairwise dot-product alignment."
          howDerived="Dot product QK^T measures inner-product similarity. Dividing by sqrt(d_k) keeps variance at 1, preventing softmax gradients from vanishing for large dimension sizes."
          numericalExample={{
            input: "Q = [[1, 0]], K = [[1, 0], [0, 1]], V = [[10, 20], [30, 40]], d_k = 2",
            stepByStep: "1. QK^T = [[1*1 + 0*0, 1*0 + 0*1]] = [[1, 0]].\n2. Scale by sqrt(2)=1.414 -> [[0.707, 0]].\n3. Softmax([0.707, 0]) = [0.67, 0.33].\n4. Multiply V: 0.67*[10, 20] + 0.33*[30, 40] = [6.7+9.9, 13.4+13.2] = [16.6, 26.6].",
            output: "Attended Representation = [[16.6, 26.6]]"
          }}
          pythonCode={`import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d_k ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, -1e9)
    attn_weights = F.softmax(scores, dim=-1)
    return torch.matmul(attn_weights, V), attn_weights`}
        />

        {/* Interactive Heatmap */}
        <AttentionMatrixVisualizer />

        {/* Key LLM Concepts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {llmTopics.map((t, idx) => (
            <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 hover:border-cyan-500/50 transition-all">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                MODULE 0{idx + 1}
              </span>
              <h4 className="text-sm font-bold text-slate-100 mb-1.5">{t.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
