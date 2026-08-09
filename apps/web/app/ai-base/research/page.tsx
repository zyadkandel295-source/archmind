import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { ResearchAgentUI } from "@/components/ai-base/research-agent-ui";
import { Library, FileText, ExternalLink, Calendar, User, Code, Tag } from "lucide-react";

export const metadata = {
  title: "AI Research Library & Agent | AGENTIA AI BASE",
  description: "ArXiv & DOI paper database, historical AI timeline, and autonomous research synthesis agent."
};

export default function ResearchPage() {
  const papers = [
    {
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin"],
      year: 2017,
      venue: "NeurIPS 2017",
      arxivId: "1706.03762",
      abstract: "We propose the Transformer, a model architecture eschewing recurrence and relying entirely on an attention mechanism to draw global dependencies between input and output.",
      category: "LLMs & Transformers",
      equation: "Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V",
      dataset: "WMT 2014 Eng-to-Ger",
      result: "Achieved 28.4 BLEU score with 100x faster GPU training speed."
    },
    {
      title: "Highly accurate protein structure prediction with AlphaFold",
      authors: ["John Jumper", "Richard Evans", "Alexander Pritzel", "Tim Green", "Michael Figurnov", "et al."],
      year: 2021,
      venue: "Nature 596, 583–589",
      doi: "10.1038/s41586-021-03819-2",
      abstract: "We present AlphaFold 2, a novel machine learning approach that incorporates physical and biological knowledge about protein structure into a deep learning architecture.",
      category: "AI + Science",
      equation: "pLDDT = sum(p_d * score(d))",
      dataset: "Protein Data Bank (PDB)",
      result: "Solved 50-year protein folding grand challenge matching experimental X-ray accuracy."
    },
    {
      title: "LoRA: Low-Rank Adaptation of Large Language Models",
      authors: ["Edward J. Hu", "Yelong Shen", "Phillip Wallis", "Zeyuan Allen-Zhu", "Yuanzhi Li", "Weizhu Chen"],
      year: 2021,
      venue: "ICLR 2022",
      arxivId: "2106.09685",
      abstract: "We propose Low-Rank Adaptation (LoRA), which freezes pretrained model weights and injects trainable rank decomposition matrices into each layer.",
      category: "LLMs & Fine-Tuning",
      equation: "h = W_0 x + (alpha / r) B A x",
      dataset: "GLUE & SQuAD benchmarks",
      result: "Reduces trainable parameters by 10,000x and GPU memory by 3x."
    }
  ];

  const timelineEvents = [
    { year: "1950", title: "Turing Test Proposed", category: "Fundamentals", desc: "Alan Turing introduces the imitation game." },
    { year: "1956", title: "Dartmouth Conference", category: "Fundamentals", desc: "John McCarthy coins the term Artificial Intelligence." },
    { year: "1986", title: "Backpropagation Popularized", category: "Deep Learning", desc: "Rumelhart & Hinton demonstrate backprop on multi-layer neural networks." },
    { year: "2012", title: "AlexNet ImageNet Breakthrough", category: "Computer Vision", desc: "GPU-trained CNN ignites modern deep learning revolution." },
    { year: "2017", title: "Transformer Architecture", category: "LLMs", desc: "Attention Is All You Need eliminates recurrent step constraints." },
    { year: "2020", title: "AlphaFold 2 Solves Protein Folding", category: "AI + Science", desc: "DeepMind achieves atomic accuracy in 3D protein structure prediction." },
    { year: "2022", title: "Generative AI & ChatGPT", category: "Generative AI", desc: "RLHF conversational LLM alignment adopted globally." }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold mb-2">
            <Library className="w-4 h-4" />
            SECTION 08
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            AI Research Library & Research Agent
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Search peer-reviewed papers, arXiv preprints, historical milestones, extracted equations, datasets, results, and invoke the AI Research Agent for autonomous synthesis reports.
          </p>
        </div>

        {/* AI Research Agent Component */}
        <ResearchAgentUI />

        {/* Peer-Reviewed Papers Section */}
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileText className="w-5 h-5 text-cyan-400" />
            Curated Research Papers & Methodologies
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {papers.map((p, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 hover:border-cyan-500/50 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                      {p.category}
                    </span>
                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" /> {p.year}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 leading-snug">{p.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{p.abstract}</p>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300">
                    <span className="text-[10px] text-slate-500 block mb-1 font-sans font-bold">Key Equation:</span>
                    {p.equation}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Result: {p.result}</div>
                  {p.arxivId && (
                    <a
                      href={`https://arxiv.org/abs/${p.arxivId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-mono text-[10px] mt-1"
                    >
                      arXiv:{p.arxivId} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Research Timeline */}
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Historical AI Research Milestones (1950 - 2026)
          </h2>

          <div className="relative border-l-2 border-cyan-500/40 ml-4 pl-6 space-y-6">
            {timelineEvents.map((t, idx) => (
              <div key={idx} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-cyan-500 border-4 border-slate-950 group-hover:scale-125 transition-transform" />
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-1 hover:border-cyan-500/40 transition-all">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-cyan-400 font-extrabold text-sm">{t.year}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400 font-semibold">{t.category}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">{t.title}</h4>
                  <p className="text-slate-300 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
