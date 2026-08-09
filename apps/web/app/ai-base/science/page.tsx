import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { Atom, Dna, Activity, Stethoscope, Compass, Globe, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "AI + Scientific Research | AGENTIA AI BASE",
  description: "AI applications across Biology, Medicine, Chemistry, Physics, Astronomy, Climate Science, and Quantum Computing."
};

export default function SciencePage() {
  const domains = [
    {
      domain: "biology",
      title: "AI + Biology & Structural Genomics",
      icon: Dna,
      overview: "Revolutionizing 3D protein structure prediction, genomic sequence annotation, single-cell transcriptomics, and synthetic biology using deep learning transformers and graph neural networks.",
      keyAlgorithms: ["Evoformer Axial Attention", "Invariant Point Attention (IPA)", "Equivariant Graph Neural Networks (EGNN)", "Protein Language Models (ESM-2)"],
      modelsUsed: ["AlphaFold 2 & AlphaFold 3", "ESMFold", "RFdiffusion", "RoseTTAFold"],
      datasets: ["Protein Data Bank (PDB)", "UniProtKB", "GenBank", "OpenProteinSet"],
      workflows: [
        "1. Retrieve target amino acid sequence from UniProt database.",
        "2. Run Multiple Sequence Alignment (MSA) against UniRef90 to build evolutionary co-mutation matrix.",
        "3. Pass MSA & pairwise representation through 48 Evoformer attention blocks.",
        "4. Predict atomic 3D backbone coordinates and confidence metrics (pLDDT, PAE)."
      ],
      breakthroughs: [
        "AlphaFold 2 solved 50-year protein folding grand challenge predicting >200M 3D structures.",
        "RFdiffusion enables de novo functional protein design for targeted ligand binding."
      ]
    },
    {
      domain: "medicine",
      title: "AI + Medicine & Drug Discovery",
      icon: Stethoscope,
      overview: "Accelerating clinical trial matching, de novo small molecule design, digital pathology segmentation, radiological image analysis, and personalized oncology.",
      keyAlgorithms: ["3D Convolutional Segmentation", "Virtual Screening Docking Transformers", "Diffusion Molecule Generation", "Survival Analysis Cox Networks"],
      modelsUsed: ["Med-PaLM 2", "BioNeMo", "DiffDock", "PathOLD"],
      datasets: ["TCGA Cancer Genome", "MIMIC-III EHR Database", "ChEMBL Bioactivity", "PubChem"],
      workflows: [
        "1. Identify disease-causing protein target using genomic differential expression analysis.",
        "2. Screen billions of candidate molecules against target binding pocket with DiffDock.",
        "3. Optimize ADMET properties (Absorption, Distribution, Metabolism, Excretion, Toxicity).",
        "4. Generate automated synthesis pathways for wet-lab validation."
      ],
      breakthroughs: [
        "First AI-designed candidate small-molecule drugs entered Phase II human clinical trials.",
        "Super-human radiological stroke detection accuracy under 30 seconds."
      ]
    },
    {
      domain: "climate",
      title: "AI + Climate Science & Meteorology",
      icon: Globe,
      overview: "Predicting extreme weather events, global climate modeling, carbon capture optimization, and renewable energy grid scheduling.",
      keyAlgorithms: ["Spherical Graph Neural Networks", "Fourier Neural Operators (FNO)", "Spatiotemporal Diffusion Models"],
      modelsUsed: ["GraphCast (Google DeepMind)", "FourCastNet (NVIDIA)", "Pangu-Weather (Huawei)", "ClimaX"],
      datasets: ["ERA5 Atmospheric Reanalysis", "NOAA Global Historical Climatology", "CMIP6 Climate Models"],
      workflows: [
        "1. Ingest satellite, radar, and weather station measurements onto 0.25-degree spatial grid.",
        "2. Roll out GraphCast GNN for 10-day global weather simulation step-by-step.",
        "3. Run anomaly detection classifiers to predict tropical cyclone track and intensity."
      ],
      breakthroughs: [
        "GraphCast predicts 10-day global weather forecasts in 60 seconds with higher accuracy than ECMWF supercomputers.",
        "AI-optimized renewable energy grid dispatch reduced carbon emissions by 15%."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-teal-400 text-xs font-mono font-bold mb-2">
            <Atom className="w-4 h-4" />
            SECTION 07
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            AI + Scientific Research & STEM Applications
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Exploring how Deep Learning, Transformers, Graph Neural Networks, and Generative Models are revolutionizing fundamental scientific discovery across Structural Genomics, Medicine, Chemistry, Climate Modeling, Physics, and Astronomy.
          </p>
        </div>

        <div className="space-y-8">
          {domains.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.domain} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="p-2 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{d.title}</h2>
                    <p className="text-xs text-slate-400">{d.overview}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <span className="font-bold text-teal-400 uppercase tracking-wider text-[10px] block mb-2">Key Algorithms:</span>
                    <ul className="space-y-1 text-slate-300">
                      {d.keyAlgorithms.map((algo, i) => (
                        <li key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-teal-500">•</span> {algo}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <span className="font-bold text-cyan-400 uppercase tracking-wider text-[10px] block mb-2">Foundation Models:</span>
                    <ul className="space-y-1 text-slate-300">
                      {d.modelsUsed.map((m, i) => (
                        <li key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-cyan-500">•</span> {m}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <span className="font-bold text-blue-400 uppercase tracking-wider text-[10px] block mb-2">Primary Datasets:</span>
                    <ul className="space-y-1 text-slate-300">
                      {d.datasets.map((ds, i) => (
                        <li key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-blue-500">•</span> {ds}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Workflow Steps */}
                <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Scientific Workflow Steps:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {d.workflows.map((wf, i) => (
                      <div key={i} className="bg-slate-900/60 p-2.5 rounded border border-slate-800 font-mono text-[11px]">
                        {wf}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
