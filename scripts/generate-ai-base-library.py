"""Generate AGENTIA's authoritative AI Base Knowledge library.

Each book deeply explains the application of Artificial Intelligence to that specific academic field,
detailing state-of-the-art neural architectures, mathematical formulations, end-to-end computational
pipelines, flagship real-world case studies, failure modes, and safety guardrails.
Each book contains exactly 20 pages, including 5 clean academic vector diagrams.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base"
API_OUTPUT = ROOT / "apps" / "api" / "storage" / "ai-base"
CATALOG_OUTPUT = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base-documents.json"
PAGE_WIDTH, PAGE_HEIGHT = A4

# ─── 24 ACADEMIC FIELDS AND BOOKS ───────────────────────────────────────────
FIELDS = [
    ("artificial-intelligence", "Artificial Intelligence", [
        "Foundations of Artificial Intelligence",
        "Knowledge Representation and Reasoning",
        "Machine Learning and Intelligent Systems",
        "AI Agents, Planning, and Tools",
        "Responsible AI and Evaluation"
    ]),
    ("computer-science", "Computer Science", [
        "Foundations of Computer Science",
        "Algorithms and Data Structures",
        "Software Design and Engineering",
        "Operating Systems and Networks",
        "Databases, Security, and Distributed Systems"
    ]),
    ("mathematics", "Mathematics", [
        "Mathematical Reasoning and Proof",
        "Algebra, Functions, and Structures",
        "Calculus, Change, and Optimization",
        "Probability, Statistics, and Inference",
        "Discrete Mathematics and Computation"
    ]),
    ("physics", "Physics", [
        "Mechanics and Motion",
        "Forces, Energy, and Momentum",
        "Waves, Optics, and Oscillations",
        "Electricity, Magnetism, and Fields",
        "Relativity, Quantum Physics, and Matter"
    ]),
    ("astronomy", "Astronomy", [
        "The Night Sky and Observational Astronomy",
        "Planetary Systems and Exoplanets",
        "Stars, Galaxies, and Stellar Evolution",
        "Cosmology and the Expanding Universe",
        "Astronomical Data and Space Exploration"
    ]),
    ("chemistry", "Chemistry", [
        "Foundations of General Chemistry",
        "Atomic Structure and Periodic Trends",
        "Chemical Bonding and Molecular Structure",
        "Chemical Reactions and Stoichiometry",
        "Thermochemistry, Equilibrium, and Acids and Bases"
    ]),
    ("biology", "Biology", [
        "Cell Biology and Biochemistry",
        "Genetics, Evolution, and Heredity",
        "Organisms, Physiology, and Homeostasis",
        "Ecology and Earth Systems",
        "Biological Research Methods and Bioethics"
    ]),
    ("medicine-health-sciences", "Medicine and Health Sciences", [
        "Human Anatomy and Physiology",
        "Evidence-Based Medicine and Clinical Reasoning",
        "Public Health and Disease Prevention",
        "Health Systems, Safety, and Quality",
        "Medical Ethics and Health Communication"
    ]),
    ("engineering", "Engineering", [
        "Engineering Design and Problem Framing",
        "Mechanics, Materials, and Manufacturing",
        "Electrical Systems and Control",
        "Civil Infrastructure and the Built Environment",
        "Safety, Reliability, and Sustainable Engineering"
    ]),
    ("data-science-statistics", "Data Science and Statistics", [
        "Data Literacy and Measurement",
        "Probability and Statistical Inference",
        "Data Analysis and Visualization",
        "Experimental Design and Causal Reasoning",
        "Responsible Data Science and Reproducibility"
    ]),
    ("economics", "Economics", [
        "Economic Thinking and Scarcity",
        "Microeconomics: Choices, Markets, and Firms",
        "Macroeconomics: Growth, Inflation, and Employment",
        "Public Economics and Policy",
        "Development, Trade, and Inequality"
    ]),
    ("business-entrepreneurship", "Business and Entrepreneurship", [
        "Value Creation and Business Models",
        "Customers, Markets, and Product Strategy",
        "Operations, Finance, and Decision Making",
        "Entrepreneurship and Venture Design",
        "Leadership, Ethics, and Sustainable Growth"
    ]),
    ("psychology", "Psychology", [
        "Foundations of Psychology and Research",
        "Cognition, Learning, and Memory",
        "Development, Personality, and Individual Differences",
        "Social Psychology and Human Behavior",
        "Mental Health, Ethics, and Applied Psychology"
    ]),
    ("sociology", "Sociology", [
        "Sociological Thinking and Research",
        "Culture, Identity, and Socialization",
        "Institutions, Organizations, and Power",
        "Inequality, Population, and Social Change",
        "Methods, Ethics, and Public Sociology"
    ]),
    ("political-science", "Political Science", [
        "Political Ideas, Power, and Institutions",
        "Comparative Government and Democracy",
        "Political Behavior, Media, and Participation",
        "International Relations and Global Governance",
        "Public Policy, Ethics, and Political Analysis"
    ]),
    ("law-public-policy", "Law and Public Policy", [
        "Legal Systems, Rights, and Reasoning",
        "Public Policy Design and Evaluation",
        "Regulation, Administration, and Institutions",
        "Evidence, Equity, and Access to Justice",
        "Ethics, Governance, and Public Interest"
    ]),
    ("environmental-science", "Environmental Science", [
        "Earth Systems and Environmental Change",
        "Ecology, Biodiversity, and Conservation",
        "Climate Science and Risk",
        "Resources, Pollution, and Sustainability",
        "Environmental Decisions, Justice, and Policy"
    ]),
    ("earth-science", "Earth Science", [
        "Earth Materials, Rocks, and Geologic Time",
        "Plate Tectonics, Hazards, and Landscapes",
        "Weather, Climate, and the Atmosphere",
        "Oceans, Water, and the Cryosphere",
        "Earth Observation and Environmental History"
    ]),
    ("history", "History", [
        "Historical Thinking and Evidence",
        "World History: Exchange and Connection",
        "States, Empires, and Political Change",
        "Social History, Labor, and Everyday Life",
        "Memory, Interpretation, and Historical Research"
    ]),
    ("philosophy", "Philosophy", [
        "Arguments, Logic, and Clear Thinking",
        "Knowledge, Truth, and Skepticism",
        "Ethics, Values, and Moral Reasoning",
        "Mind, Language, and Reality",
        "Political Philosophy and Public Reason"
    ]),
    ("literature", "Literature", [
        "Reading Literature Closely",
        "Narrative, Character, and Point of View",
        "Poetry, Drama, and Literary Form",
        "Literature, Culture, and Historical Context",
        "Interpretation, Criticism, and Creative Response"
    ]),
    ("languages-linguistics", "Languages and Linguistics", [
        "Language Structure: Sounds, Words, and Sentences",
        "Meaning, Pragmatics, and Discourse",
        "Language Acquisition and Learning",
        "Language, Society, and Identity",
        "Linguistic Research and Language Change"
    ]),
    ("education", "Education", [
        "How People Learn",
        "Teaching Design and Classroom Practice",
        "Assessment, Feedback, and Evidence",
        "Equity, Inclusion, and Learning Communities",
        "Curriculum, Policy, and Educational Improvement"
    ]),
    ("interdisciplinary-research", "Interdisciplinary Research", [
        "Framing Interdisciplinary Questions",
        "Methods, Evidence, and Mixed Approaches",
        "Systems Thinking and Complex Problems",
        "Research Ethics, Collaboration, and Communication",
        "From Findings to Responsible Action"
    ]),
]

# ─── DOMAIN-SPECIFIC AI KNOWLEDGE REPOSITORY ─────────────────────────────────
DOMAIN_SPECS = {
    "Artificial Intelligence": {
        "focus": "Next-Generation Foundation Models, Autoregressive Transformers, and Autonomous Tool-Use Agents",
        "sota": "DeepSeek-R1, Llama 3.3, GPT-4o, Claude 3.5 Sonnet, AlphaZero",
        "modality": "High-dimensional tokenized sequences, multimodal embeddings (vision, text, audio), tool-execution traces",
        "loss": r"\mathcal{L}_{Total} = -\sum_{t=1}^T \log P(w_t | w_{<t}) + \beta \mathcal{D}_{KL}(\pi_\theta || \pi_{ref}) - \gamma \mathcal{R}_{tool}",
        "loss_desc": "Cross-entropy token likelihood combined with Kullback-Leibler divergence penalty against reference policy and execution reward.",
        "case_study": "DeepSeek-R1 and OpenAI o-series: Reinforcement learning applied directly over chain-of-thought verification without supervised fine-tuning, reaching Olympiad-level STEM reasoning.",
        "failure_mode": "Hallucinatory reasoning paths, sycophancy in preference tuning, reward hacking during autonomous agent tool calling.",
        "stages_1": [
            {"label": "Raw Text & Code", "sub": "BPE Tokenizer (128k Vocab)", "type": "input"},
            {"label": "Rotary Embeddings", "sub": "RoPE Positional Vectors", "type": "model"},
            {"label": "Transformer Stack", "sub": "Grouped-Query Attention", "type": "model"},
            {"label": "Token Probability", "sub": "Softmax Distribution Logits", "type": "output"}
        ],
        "stages_2": [
            {"label": "Input Sequence", "sub": "Batch size B, Seq Len L", "type": "input"},
            {"label": "Self-Attention", "sub": "FlashAttention-3 GPU kernel", "type": "model"},
            {"label": "SwiGLU FFN", "sub": "Mixture-of-Experts (MoE)", "type": "loss"},
            {"label": "Next Token Prediction", "sub": "Top-p Nucleus Sampler", "type": "output"}
        ],
        "stages_3": [
            {"label": "Curated Pretraining", "sub": "15T Multi-source Tokens", "type": "input"},
            {"label": "Distributed Cluster", "sub": "FSDP & Tensor Parallelism", "type": "model"},
            {"label": "DPO / PPO Step", "sub": "Gradient Descent Update", "type": "loss"},
            {"label": "Aligned Checkpoint", "sub": "Validated on MT-Bench / MMLU", "type": "output"}
        ],
        "stages_4": [
            {"label": "User Query / Prompt", "sub": "Multi-turn Chat Session", "type": "input"},
            {"label": "KV-Cache Lookup", "sub": "PagedAttention vLLM Server", "type": "model"},
            {"label": "Tool Calling Engine", "sub": "Python REPL & API Execution", "type": "loss"},
            {"label": "Streaming Output", "sub": "Grounded Verified Answer", "type": "output"}
        ],
        "stages_5": [
            {"label": "Generated Output", "sub": "Draft Reasoning Chain", "type": "input"},
            {"label": "Constitutional AI", "sub": "Safety & Policy Filter", "type": "model"},
            {"label": "Factuality Scorer", "sub": "Self-Consistency Check", "type": "loss"},
            {"label": "Audited Safe Output", "sub": "Production User Delivery", "type": "output"}
        ],
    },
    "Computer Science": {
        "focus": "Neural Program Synthesis, Learned Database Systems, and Automated Compiler Optimization",
        "sota": "DeepMind AlphaCode 2, LLVM-MLGO, SageDB Learned Index, StarCoder2",
        "modality": "Abstract Syntax Trees (ASTs), assembly control-flow graphs, packet flow telemetry",
        "loss": r"\mathcal{L}_{Program} = \alpha \mathcal{L}_{AST} + (1-\alpha) \mathbb{E}_{\tau \sim \mathcal{M}}[ \mathbf{1}(\text{Exec}(\tau) == \text{Tests}) ]",
        "loss_desc": "Hybrid objective combining structural AST cross-entropy with binary execution-guided unit test rewards.",
        "case_study": "DeepMind AlphaCode 2 operating on Codeforces competitive programming, outperforming 85% of human contestants via dynamic program candidate generation and clustering.",
        "failure_mode": "Generating syntactically plausible code with subtle off-by-one errors or critical cryptographic timing vulnerabilities.",
        "stages_1": [
            {"label": "Source Code / AST", "sub": "Tree-sitter Grammar Parse", "type": "input"},
            {"label": "Graph / Token Encoder", "sub": "AST-aware Transformer", "type": "model"},
            {"label": "Program Synthesis", "sub": "Execution-guided Beam Search", "type": "loss"},
            {"label": "Verified Binary", "sub": "Passing Unit Test Suites", "type": "output"}
        ],
        "stages_2": [
            {"label": "Code Specification", "sub": "Natural Language Docstring", "type": "input"},
            {"label": "Decoder LLM", "sub": "Hierarchical Context Window", "type": "model"},
            {"label": "Static Type Checker", "sub": "Rust / Mypy Compiler Loop", "type": "loss"},
            {"label": "Executable Code", "sub": "Zero-Warning Production Artifact", "type": "output"}
        ],
        "stages_3": [
            {"label": "Execution Traces", "sub": "Database Query Workload", "type": "input"},
            {"label": "Learned Cost Model", "sub": "Graph Neural Net over Plans", "type": "model"},
            {"label": "Reinforcement Policy", "sub": "Index Join Order Optimizer", "type": "loss"},
            {"label": "Optimal Execution", "sub": "Sub-millisecond Latency", "type": "output"}
        ],
        "stages_4": [
            {"label": "Dev IDE Request", "sub": "Context & Completion Cursor", "type": "input"},
            {"label": "Local Speculative Engine", "sub": "Quantized 3B Draft Model", "type": "model"},
            {"label": "Cloud SOTA Model", "sub": "Verification & Patch Apply", "type": "loss"},
            {"label": "Zero-Latency Patch", "sub": "Direct Editor Ingestion", "type": "output"}
        ],
        "stages_5": [
            {"label": "Synthesized Code", "sub": "Candidate PR Branch", "type": "input"},
            {"label": "Fuzzing & Vulnerability", "sub": "Semgrep & Snyk AST Scanner", "type": "model"},
            {"label": "Formal Verification", "sub": "SMT Solver (Z3 Proof)", "type": "loss"},
            {"label": "Secure Deployment", "sub": "Safe Git Merge Action", "type": "output"}
        ],
    },
    "Mathematics": {
        "focus": "Automated Theorem Proving, Neural Algorithmic Reasoning, and Symbolic Discovery",
        "sota": "AlphaGeometry, Lean 4 Copilot, FunSearch, GraphCast Solver",
        "modality": "Formal proof tactic sequences (Lean, Isabelle), mathematical expression DAGs, geometric diagram constraints",
        "loss": r"\mathcal{L}_{PINN} = \frac{1}{N_d}\sum_{i=1}^{N_d}|u(x_i) - u_i|^2 + \frac{\lambda}{N_r}\sum_{j=1}^{N_r}|\mathcal{N}[u(x_j)]|^2",
        "loss_desc": "Physics-Informed Neural Network loss balancing empirical data points against governing differential equation residuals.",
        "case_study": "DeepMind AlphaGeometry solved 25 of 30 International Mathematical Olympiad geometry problems within human time limits without human expert demonstrations.",
        "failure_mode": "Hallucinating non-existent mathematical lemmas, generating proof steps with hidden circular dependencies.",
        "stages_1": [
            {"label": "Informal Math Text", "sub": "LaTeX Equations & Premises", "type": "input"},
            {"label": "Autoformalizer", "sub": "Seq2Seq Lean 4 Translation", "type": "model"},
            {"label": "Proof Search Tree", "sub": "Monte Carlo Tree Search (MCTS)", "type": "loss"},
            {"label": "Q.E.D. Proof", "sub": "Kernel-Verified Lean Proof", "type": "output"}
        ],
        "stages_2": [
            {"label": "Geometric Premises", "sub": "Points, Lines, Circles", "type": "input"},
            {"label": "Neural Deductive Net", "sub": "Auxiliary Construction Gen.", "type": "model"},
            {"label": "Symbolic Deduction", "sub": "Algebraic Elimination Solver", "type": "loss"},
            {"label": "Certified Theorem", "sub": "Zero-Error IMO Proof Certificate", "type": "output"}
        ],
        "stages_3": [
            {"label": "Boundary Constraints", "sub": "PDE Space-Time Domain", "type": "input"},
            {"label": "Neural Operator (FNO)", "sub": "Fourier Spectral Layers", "type": "model"},
            {"label": "Residual Penalty", "sub": "Automatic Differentiation Loop", "type": "loss"},
            {"label": "Continuous Solution", "sub": "10,000x Faster than FEM", "type": "output"}
        ],
        "stages_4": [
            {"label": "Math Conjectures", "sub": "Extremal Combinatorics Problem", "type": "input"},
            {"label": "FunSearch LLM", "sub": "Generates Evaluator Code", "type": "model"},
            {"label": "Systematic Evaluation", "sub": "Automated Fast Benchmarking", "type": "loss"},
            {"label": "New Lower Bound", "sub": "Cap Set Mathematical Discovery", "type": "output"}
        ],
        "stages_5": [
            {"label": "Proof Candidate", "sub": "Tactic Step Sequence", "type": "input"},
            {"label": "Lean Kernel Check", "sub": "Strict Type Inhabitation", "type": "model"},
            {"label": "Soundness Filter", "sub": "Circular Dependency Pruning", "type": "loss"},
            {"label": "Formal Mathlib PR", "sub": "Peer-Accepted Proof Code", "type": "output"}
        ],
    },
    "Physics": {
        "focus": "Hamiltonian Neural Networks, Particle Physics Jet Tagging, and Plasma Fusion Control",
        "sota": "DeepMind Tokamak RL, DeepMD-kit, Equivariant GNNs for CERN LHC",
        "modality": "Particle 4-vectors (p_x, p_y, p_z, E), magnetic flux surfaces, continuous spacetime tensors",
        "loss": r"\mathcal{L}_{HNN} = \left\| \frac{\partial \mathcal{H}_\theta}{\partial p} - \dot{q} \right\|^2 + \left\| \frac{\partial \mathcal{H}_\theta}{\partial q} + \dot{p} \right\|^2",
        "loss_desc": "Symplectic loss enforcing exact conservation of energy and canonical Hamilton equations of motion.",
        "case_study": "DeepMind and EPFL's reinforcement learning system autonomously shaping and maintaining high-temperature tokamak plasma configurations at 10,000 control loops per second.",
        "failure_mode": "Violation of fundamental physical conservation laws (energy, momentum, gauge symmetries) during long-horizon rollouts.",
        "stages_1": [
            {"label": "CERN Sensor Hits", "sub": "Calorimeter 3D Point Cloud", "type": "input"},
            {"label": "Lorentz Equivariant GNN", "sub": "SO(3,1) Invariant Edge Conv", "type": "model"},
            {"label": "Jet Tagging Head", "sub": "Higgs Boson Binary Class.", "type": "loss"},
            {"label": "Physics Discovery", "sub": "5-Sigma Statistical Evidence", "type": "output"}
        ],
        "stages_2": [
            {"label": "Atomic Coordinates", "sub": "N-Body Periodic System", "type": "input"},
            {"label": "Deep Potential Net", "sub": "Smooth Neural Potential Surface", "type": "model"},
            {"label": "Force Backprop", "sub": "Analytical Gradient dV/dr", "type": "loss"},
            {"label": "Picosecond Trajectory", "sub": "Ab Initio Quality MD Run", "type": "output"}
        ],
        "stages_3": [
            {"label": "Tokamak Sensor Data", "sub": "Magnetic Probe Telemetry", "type": "input"},
            {"label": "Deep RL Controller", "sub": "Actor-Critic Policy Network", "type": "model"},
            {"label": "Plasma Stability Loss", "sub": "MHD Boundary Minimization", "type": "loss"},
            {"label": "10kHz Actuator Coils", "sub": "Stable Fusion Confinement", "type": "output"}
        ],
        "stages_4": [
            {"label": "Interferometer Strain", "sub": "LIGO Strain Time-Series", "type": "input"},
            {"label": "Matched Filter ConvNet", "sub": "Dilated Temporal Convolutions", "type": "model"},
            {"label": "Chirp Signal Loss", "sub": "SNR Multi-Detector Ranking", "type": "loss"},
            {"label": "Gravitational Wave", "sub": "Black Hole Merger Alert", "type": "output"}
        ],
        "stages_5": [
            {"label": "Neural Trajectory", "sub": "Multi-Step Physics Rollout", "type": "input"},
            {"label": "Conservation Auditor", "sub": "Checks dE/dt == 0 & Momentum", "type": "model"},
            {"label": "Projection Manifold", "sub": "Enforces Symplectic Form", "type": "loss"},
            {"label": "Valid Physical State", "sub": "Thermodynamically Sound Output", "type": "output"}
        ],
    },
    "Astronomy": {
        "focus": "Interferometric Image Synthesis, Exoplanet Transit Detection, and Transient Survey Classification",
        "sota": "EHT CHIRP, NASA Kepler Transit-CNN, Rubin Observatory LSST Pipeline",
        "modality": "Radio visibility amplitudes & closure phases, photometric flux light curves, multi-band FITS rasters",
        "loss": r"\mathcal{L}_{EHT} = \chi^2_{\text{vis}} + \beta \mathcal{R}_{\text{closure}} + \lambda \text{TV}(I)",
        "loss_desc": "Interferometric chi-squared visibility fit combined with closure phase consistency and Total Variation regularizer.",
        "case_study": "Event Horizon Telescope (EHT) reconstructed the first direct image of the supermassive black hole Sagittarius A* using deep regularized neural deconvolution.",
        "failure_mode": "Confusing instrument artifacts and starspots with planetary transit signatures in low signal-to-noise regimes.",
        "stages_1": [
            {"label": "Sparse Visibilities", "sub": "Global Telescope Baselines", "type": "input"},
            {"label": "Neural Deconvolution", "sub": "Learned Patch Prior Network", "type": "model"},
            {"label": "Closure Phase Loss", "sub": "Atmospheric Phase Insensitive", "type": "loss"},
            {"label": "Supermassive Black Hole", "sub": "Resolved Photon Shadow Ring", "type": "output"}
        ],
        "stages_2": [
            {"label": "Kepler Light Curve", "sub": "Stellar Photometry Time Series", "type": "input"},
            {"label": "Transit CNN", "sub": "1D Dilated Residual Layers", "type": "model"},
            {"label": "Transit Depth Scorer", "sub": "Limb-Darkened Transit Model", "type": "loss"},
            {"label": "Confirmed Exoplanet", "sub": "Validated Habitable Candidate", "type": "output"}
        ],
        "stages_3": [
            {"label": "Sky Survey Stream", "sub": "10M Alerts/Night (Rubin LSST)", "type": "input"},
            {"label": "Temporal Transformer", "sub": "Irregular Time-Series Attention", "type": "model"},
            {"label": "Supernova Classifier", "sub": "Type Ia vs Core-Collapse Loss", "type": "loss"},
            {"label": "Automated Alert", "sub": "Robotic Follow-up Trigger", "type": "output"}
        ],
        "stages_4": [
            {"label": "Galaxy Multi-band FITS", "sub": "Hubble & James Webb Imagery", "type": "input"},
            {"label": "Self-Supervised ViT", "sub": "Morphological Representation", "type": "model"},
            {"label": "Gravitational Lens Head", "sub": "Einstein Ring Detection Head", "type": "loss"},
            {"label": "Dark Matter Lens", "sub": "Cosmological Model Refinement", "type": "output"}
        ],
        "stages_5": [
            {"label": "Detected Candidate", "sub": "Transient Alert Candidate", "type": "input"},
            {"label": "Instrument Error Filter", "sub": "Rejects Cosmic Rays & Jitter", "type": "model"},
            {"label": "Spectroscopic Verifier", "sub": "Cross-references Sky Catalogs", "type": "loss"},
            {"label": "Verified Discovery", "sub": "Published to Minor Planet Center", "type": "output"}
        ],
    },
    "Chemistry": {
        "focus": "De Novo Molecular Design, Equivariant GNN Property Prediction, and Retrosynthesis Planning",
        "sota": "AlphaFold 3, DiffDock, AiZynthFinder, SchNet, DimeNet++",
        "modality": "SMILES / SELFIES string tokens, 3D conformer point clouds, molecular graphs (atoms as nodes, bonds as edges)",
        "loss": r"\mathcal{L}_{Diffusion} = \mathbb{E}_{t, x_0, \epsilon}\left[ \| \epsilon - \epsilon_\theta(x_t, t, \mathbf{c}) \|^2 \right] + \lambda \mathcal{L}_{\text{steric}}",
        "loss_desc": "Denoising diffusion score-matching loss combined with steric clash avoidance and valence validity penalties.",
        "case_study": "Insilico Medicine designed and advanced an AI-discovered small-molecule inhibitor for idiopathic pulmonary fibrosis from target discovery to Phase II clinical trials in under 30 months.",
        "failure_mode": "Generating synthetically inaccessible molecules ('chimera' compounds) or molecules violating fundamental valence rules.",
        "stages_1": [
            {"label": "Protein Binding Pocket", "sub": "3D Cavity Coordinates", "type": "input"},
            {"label": "Equivariant Diffusion", "sub": "SE(3) Denoising Network", "type": "model"},
            {"label": "Steric & Valence Loss", "sub": "Lennard-Jones Energy Penalty", "type": "loss"},
            {"label": "Novel Drug Candidate", "sub": "Sub-nanomolar Binding Affinity", "type": "output"}
        ],
        "stages_2": [
            {"label": "Target Molecule", "sub": "SMILES & 2D Graph Repr.", "type": "input"},
            {"label": "Message-Passing GNN", "sub": "Node/Edge Feature Updates", "type": "model"},
            {"label": "Disconnection Policy", "sub": "MCTS Reaction Template Match", "type": "loss"},
            {"label": "Retrosynthetic Route", "sub": "Available Commercial Precursors", "type": "output"}
        ],
        "stages_3": [
            {"label": "Quantum DFT Database", "sub": "100k Molecule Ground Truth", "type": "input"},
            {"label": "SchNet GNN", "sub": "Continuous-filter Convolutions", "type": "model"},
            {"label": "HOMO-LUMO Gap Loss", "sub": "Target Energy Calibration", "type": "loss"},
            {"label": "Fast Property Screener", "sub": "100,000x Faster than Gaussian", "type": "output"}
        ],
        "stages_4": [
            {"label": "Compound Library", "sub": "10B Synthesizable Molecules", "type": "input"},
            {"label": "Deep Virtual Screening", "sub": "DiffDock Pocket Docking", "type": "model"},
            {"label": "Free Energy Scoring", "sub": "Binding Pose Ranking", "type": "loss"},
            {"label": "Lead Compound Hit", "sub": "Automated Wet-Lab Synthesis", "type": "output"}
        ],
        "stages_5": [
            {"label": "Generated Molecule", "sub": "Proposed 3D Conformer", "type": "input"},
            {"label": "Synthesizability Audit", "sub": "SAScore & Ring Strain Filter", "type": "model"},
            {"label": "Toxicity Predictor", "sub": "hERG & Ames Mutagenicity Check", "type": "loss"},
            {"label": "Safe Lead Compound", "sub": "Ready for Assay Testing", "type": "output"}
        ],
    },
    "Biology": {
        "focus": "Protein 3D Structure Prediction, Single-Cell Transcriptomics, and Genomic Sequence Modeling",
        "sota": "AlphaFold 2/3, ESM-2 / ESMFold, scVI, DeepVariant, Nucleotide Transformer",
        "modality": "Amino acid sequences, Multiple Sequence Alignments (MSAs), single-cell RNA-seq UMI count matrices",
        "loss": r"\mathcal{L}_{AF} = \mathcal{L}_{\text{FAPE}} + 0.5 \mathcal{L}_{\text{dist}} + 0.1 \mathcal{L}_{\text{pLDDT}} + 0.01 \mathcal{L}_{\text{torsion}}",
        "loss_desc": "Frame Aligned Point Error (FAPE) invariant to global rigid body rotations, combined with predicted distance and local pLDDT confidence.",
        "case_study": "DeepMind AlphaFold predicted over 200 million protein 3D structures covering virtually all cataloged proteins in UniProt, transforming structural biology overnight.",
        "failure_mode": "Overconfident predictions on intrinsically disordered protein regions or failure to model structural transitions upon ligand binding.",
        "stages_1": [
            {"label": "Target Amino Acids", "sub": "Primary Sequence & MSA", "type": "input"},
            {"label": "Evoformer Engine", "sub": "Pairwise Residue Attention", "type": "model"},
            {"label": "FAPE Structure Module", "sub": "Invariant Coordinate Frame", "type": "loss"},
            {"label": "Atomic 3D Structure", "sub": "Sub-Angstrom Resolution PDB", "type": "output"}
        ],
        "stages_2": [
            {"label": "Single-Cell Count Matrix", "sub": "20,000 Genes x 1M Cells", "type": "input"},
            {"label": "scVI Variational Autoenc", "sub": "Zero-Inflated Neg-Binomial", "type": "model"},
            {"label": "Latent Batch Correction", "sub": "KL Divergence Regularization", "type": "loss"},
            {"label": "Clean Cell State Atlas", "sub": "Rare Cell Type Discovery", "type": "output"}
        ],
        "stages_3": [
            {"label": "Raw DNA Short Reads", "sub": "Illumina / PacBio BAM Data", "type": "input"},
            {"label": "DeepVariant CNN", "sub": "Pileup Image Representation", "type": "model"},
            {"label": "Genotype Likelihood", "sub": "Multi-class SNP / Indel Loss", "type": "loss"},
            {"label": "Accurate VCF Call", "sub": "99.99% Precision Benchmark", "type": "output"}
        ],
        "stages_4": [
            {"label": "Protein Sequence", "sub": "Single Query Peptide", "type": "input"},
            {"label": "ESM-2 15B Transformer", "sub": "Evolutionary Language Model", "type": "model"},
            {"label": "ESMFold Head", "sub": "Zero-MSA Direct Folding", "type": "loss"},
            {"label": "Instant Structure", "sub": "Completed in 500ms on GPU", "type": "output"}
        ],
        "stages_5": [
            {"label": "Predicted Structure", "sub": "Atomic Coordinates Output", "type": "input"},
            {"label": "pLDDT / PAE Auditor", "sub": "Disorder & Error Assessment", "type": "model"},
            {"label": "Stereochemical Check", "sub": "Ramachandran Plot Validator", "type": "loss"},
            {"label": "Validated Biological Asset", "sub": "Safe for Laboratory Assays", "type": "output"}
        ],
    },
    "Medicine and Health Sciences": {
        "focus": "Clinical Decision Support, Gigapixel Histopathology, and Multimodal Medical Imaging",
        "sota": "Med-PaLM 2 / AMIE, Paige Prostate AI, CheXNet, Google ARDA",
        "modality": "DICOM radiographs / CT / MRI, whole-slide digital pathology gigapixel images, structured EHR records",
        "loss": r"\mathcal{L}_{Med} = -\sum_{c=1}^C \alpha_c (1 - p_c)^\gamma \log(p_c) + \lambda \mathcal{L}_{\text{Cox}}",
        "loss_desc": "Multi-label Focal Loss to address severe class imbalance in rare diseases, combined with Cox partial likelihood for patient survival time.",
        "case_study": "Google ARDA system deployed across clinical hubs in India and Thailand, screening over 150,000 patients for diabetic retinopathy and preventing blindness with expert-level sensitivity.",
        "failure_mode": "Relying on shortcut spurious correlations (e.g. hospital-specific scanner markers or patient position tags) rather than true pathological lesions.",
        "stages_1": [
            {"label": "Patient Chest X-Ray", "sub": "16-bit High-Res DICOM", "type": "input"},
            {"label": "DenseNet-121 Vision Net", "sub": "Feature Pyramid Extractor", "type": "model"},
            {"label": "Multi-Label Focal Loss", "sub": "Class-Imbalanced Weighting", "type": "loss"},
            {"label": "Diagnostic Heatmap", "sub": "Pneumonia / Effusion Finding", "type": "output"}
        ],
        "stages_2": [
            {"label": "Gigapixel Biopsy Slide", "sub": "Whole-Slide Image (100k x 100k)", "type": "input"},
            {"label": "Hierarchical ViT", "sub": "Multiple Instance Learning (MIL)", "type": "model"},
            {"label": "Attention-Ranked Loss", "sub": "Tumor Infiltration Detection", "type": "loss"},
            {"label": "Gleason Grade Report", "sub": "Pathologist Review Ready", "type": "output"}
        ],
        "stages_3": [
            {"label": "Multi-Modal EHR Data", "sub": "Vitals, Labs, Clinical Notes", "type": "input"},
            {"label": "Clinical Transformer", "sub": "Time-Aware Patient Embedding", "type": "model"},
            {"label": "Sepsis Early Warning", "sub": "6-Hour Lead Time Alert Loss", "type": "loss"},
            {"label": "ICU Bedside Alert", "sub": "Decreases Mortality by 18%", "type": "output"}
        ],
        "stages_4": [
            {"label": "Doctor-Patient Dialog", "sub": "Clinical Consultation Transcript", "type": "input"},
            {"label": "Med-PaLM 2 Clinical LLM", "sub": "Domain-Calibrated Medical LLM", "type": "model"},
            {"label": "Differential Diagnosis", "sub": "Evidence-Grounded Retrieval", "type": "loss"},
            {"label": "Structured Clinical Note", "sub": "Instant EHR Auto-Populate", "type": "output"}
        ],
        "stages_5": [
            {"label": "AI Clinical Recommendation", "sub": "Prescription / Treatment Plan", "type": "input"},
            {"label": "Contraindication Guard", "sub": "Cross-references Drug DB", "type": "model"},
            {"label": "Human Doctor Sign-off", "sub": "Mandatory Physician In The Loop", "type": "loss"},
            {"label": "Safe Administered Care", "sub": "Zero Drug-Drug Conflict Event", "type": "output"}
        ],
    },
    "Engineering": {
        "focus": "Generative Design for Additive Manufacturing, Digital Twins, and Finite Element Surrogate Modeling",
        "sota": "Autodesk Generative Design, MeshGraphNets, DeepONet, Siemens Digital Twin AI",
        "modality": "CAD Boundary Representation (B-Rep), 3D tetrahedral finite element meshes, acoustic/vibration sensor streams",
        "loss": r"\mathcal{L}_{Design} = \mathcal{C}(\mathbf{u}, \rho) + \alpha \max(0, \text{Vol}(\rho) - V_{\max}) + \beta \text{VonMises}(\sigma) / \sigma_{\text{yield}}",
        "loss_desc": "Structural compliance minimization constrained by maximum volume fraction and Von Mises yield stress limits.",
        "case_study": "NASA and Autodesk utilized generative AI algorithms to design lightweight interplanetary lander structures, achieving a 35% mass reduction while sustaining high launch g-force loads.",
        "failure_mode": "Proposing unmachinable geometric topologies or failing under dynamic cyclic fatigue due to stress concentration notches.",
        "stages_1": [
            {"label": "Load & Boundary Specs", "sub": "Force Vectors & Fixed Faces", "type": "input"},
            {"label": "Generative Topology Net", "sub": "3D Physics-Guided ConvNet", "type": "model"},
            {"label": "Stress Compliance Loss", "sub": "Von Mises & Volume Penalty", "type": "loss"},
            {"label": "Optimized CAD Part", "sub": "35% Lighter, Aerospace Ready", "type": "output"}
        ],
        "stages_2": [
            {"label": "High-Density 3D Mesh", "sub": "1M Tetrahedral Elements", "type": "input"},
            {"label": "MeshGraphNet", "sub": "Message-Passing Physics GNN", "type": "model"},
            {"label": "FEA Residual Loss", "sub": "Continuum Mechanics Residual", "type": "loss"},
            {"label": "Instant Stress Field", "sub": "Sub-second Structural Analysis", "type": "output"}
        ],
        "stages_3": [
            {"label": "Bridge Vibration Telemetry", "sub": "100Hz Triaxial Accelerometer", "type": "input"},
            {"label": "Autoencoder Anomaly Net", "sub": "Temporal Wavelet Transform", "type": "model"},
            {"label": "Reconstruction Drift", "sub": "Micro-crack Dynamic Signature", "type": "loss"},
            {"label": "Maintenance Alert", "sub": "Prevents Catastrophic Failure", "type": "output"}
        ],
        "stages_4": [
            {"label": "Wind Turbine SCADA", "sub": "Pitch, Yaw, Wind Speeds", "type": "input"},
            {"label": "Digital Twin Transformer", "sub": "Multi-agent Dynamic Simulator", "type": "model"},
            {"label": "Power Efficiency Loss", "sub": "Wake Interference Minimization", "type": "loss"},
            {"label": "Optimal Turbine Yaw", "sub": "8% Higher Farm Energy Yield", "type": "output"}
        ],
        "stages_5": [
            {"label": "Candidate CAD Geometry", "sub": "Generative Design Mesh", "type": "input"},
            {"label": "Manufacturing Validator", "sub": "Tool Clearance & Overhang Check", "type": "model"},
            {"label": "Safety Factor Auditor", "sub": "Verifies Factor of Safety > 2.5", "type": "loss"},
            {"label": "Production Blueprint", "sub": "Sent to 5-Axis CNC / 3D Print", "type": "output"}
        ],
    },
    "Data Science and Statistics": {
        "focus": "Conformal Prediction, Causal DAG Discovery, and Tabular Foundation Models",
        "sota": "TabPFN, NOTEARS Causal Discovery, Conformalized Quantile Regression, AutoGluon",
        "modality": "Heterogeneous tabular matrices, randomized control trial logs, observational panel microdata",
        "loss": r"\mathcal{L}_{\text{Causal}} = \frac{1}{2n}\|X - X W\|_F^2 + \lambda \|W\|_1 + \rho \left( \text{Tr}(e^{W \circ W}) - d \right)^2",
        "loss_desc": "Linear structural equation score with l1 sparsity and continuous acyclicity constraint penalty.",
        "case_study": "TabPFN achieves instant state-of-the-art classification on small-to-medium tabular datasets in a single forward pass without hyperparameter tuning, trained on millions of synthetic prior distributions.",
        "failure_mode": "Mistaking confounders for causal mechanisms in observational data, producing well-calibrated but fundamentally biased predictions.",
        "stages_1": [
            {"label": "Tabular Feature Matrix", "sub": "Mixed Numerical & Categorical", "type": "input"},
            {"label": "TabPFN Transformer", "sub": "Prior-Data Fitted In-Context Net", "type": "model"},
            {"label": "Bayesian Posterior Loss", "sub": "Synthetic Prior Matching", "type": "loss"},
            {"label": "Instant Prediction", "sub": "Trained in 100ms Forward Pass", "type": "output"}
        ],
        "stages_2": [
            {"label": "Observational Data", "sub": "Patient / Customer Variables", "type": "input"},
            {"label": "NOTEARS Causal Net", "sub": "Continuous DAG Optimization", "type": "model"},
            {"label": "Acyclicity Penalty", "sub": "Enforces Matrix Exponential Zero", "type": "loss"},
            {"label": "Identified Causal DAG", "sub": "True Intervention Pathways", "type": "output"}
        ],
        "stages_3": [
            {"label": "Point Prediction Model", "sub": "Trained Regression Model", "type": "input"},
            {"label": "Conformal Calibration", "sub": "Non-Conformity Score Ranking", "type": "model"},
            {"label": "Quantile Interval Fit", "sub": "User-Defined Alpha (e.g. 95%)", "type": "loss"},
            {"label": "Guaranteed Interval", "sub": "Mathematically Proven Coverage", "type": "output"}
        ],
        "stages_4": [
            {"label": "Automated ML Pipeline", "sub": "Multi-Source Raw Databases", "type": "input"},
            {"label": "AutoGluon Ensemble", "sub": "Multi-Layer Stacking Engine", "type": "model"},
            {"label": "Out-of-Fold Validation", "sub": "Weighted Ensemble Optimization", "type": "loss"},
            {"label": "Production Model", "sub": "Kaggle Grandmaster Tier Accuracy", "type": "output"}
        ],
        "stages_5": [
            {"label": "Trained Model Artifact", "sub": "Candidate Tabular Model", "type": "input"},
            {"label": "Covariate Shift Detector", "sub": "Kolmogorov-Smirnov Test", "type": "model"},
            {"label": "Fairness Audit Head", "sub": "Disparate Impact Ratio > 0.8", "type": "loss"},
            {"label": "Certified Safe Model", "sub": "Safe for Regulatory Deployment", "type": "output"}
        ],
    },
    "Economics": {
        "focus": "Macroeconomic Dynamic Forecasting, Financial Deep RL, and High-Frequency Order Book Modeling",
        "sota": "BloombergGPT, Temporal Fusion Transformer (TFT), Deep Q-Trader, Central Bank AI",
        "modality": "Level-2 limit order book ticks (bid/ask depth), national macroeconomic panel series, corporate financial filings",
        "loss": r"\mathcal{L}_{\text{Quantile}} = \sum_{q} \max(q(y - \hat{y}_q), (1-q)(\hat{y}_q - y)) + \lambda \mathcal{L}_{\text{VaR}}",
        "loss_desc": "Pinball quantile loss modeling asymmetric upside/downside financial risk combined with Value-at-Risk penalty.",
        "case_study": "BlackRock and Citadel applying deep reinforcement learning over multi-market limit order books to minimize execution slippage and manage systemic market liquidity risk.",
        "failure_mode": "Overfitting to non-stationary financial regimes and triggering flash crashes during unexpected macroeconomic black swan shocks.",
        "stages_1": [
            {"label": "Macro Panel Series", "sub": "GDP, Inflation, Fed Rates", "type": "input"},
            {"label": "Temporal Fusion Trans.", "sub": "Multi-Horizon Self-Attention", "type": "model"},
            {"label": "Asymmetric Risk Loss", "sub": "Quantile Pinball Calibration", "type": "loss"},
            {"label": "Macro Forecast", "sub": "Uncertainty Bounds Included", "type": "output"}
        ],
        "stages_2": [
            {"label": "Limit Order Book Data", "sub": "Nanosecond Level-3 Depth", "type": "input"},
            {"label": "Spatial-Temporal CNN-LSTM", "sub": "High-Frequency Microstructure", "type": "model"},
            {"label": "Mid-Price Trend Loss", "sub": "Cross-Entropy Price Direction", "type": "loss"},
            {"label": "Optimal Order Routing", "sub": "Zero-Slippage Trade Execution", "type": "output"}
        ],
        "stages_3": [
            {"label": "Corporate SEC 10-K", "sub": "Unstructured Earnings Text", "type": "input"},
            {"label": "BloombergGPT Encoder", "sub": "Domain Financial Vocabulary", "type": "model"},
            {"label": "Sentiment & Risk Scorer", "sub": "Entity Extraction Alignment", "type": "loss"},
            {"label": "Financial Risk Matrix", "sub": "Portfolio Credit Risk Score", "type": "output"}
        ],
        "stages_4": [
            {"label": "Macroeconomic Shocks", "sub": "Interest Rate Hike Scenario", "type": "input"},
            {"label": "Agent-Based Macro Net", "sub": "10,000 Heterogeneous Agents", "type": "model"},
            {"label": "Market Equilibrium Loss", "sub": "Dynamic General Equilibrium", "type": "loss"},
            {"label": "Policy Impact Report", "sub": "Central Bank Policy Guidance", "type": "output"}
        ],
        "stages_5": [
            {"label": "Automated Trading Signal", "sub": "High-Frequency Buy/Sell Order", "type": "input"},
            {"label": "Circuit Breaker Filter", "sub": "Max Drawdown & Margin Check", "type": "model"},
            {"label": "Market Impact Auditor", "sub": "Prevents Spoofing & Cascades", "type": "loss"},
            {"label": "Compliant Order Fill", "sub": "SEC Rule 15c3-5 Compliance", "type": "output"}
        ],
    },
    "Business and Entrepreneurship": {
        "focus": "Two-Tower Recommender Systems, Dynamic Pricing Bandits, and Supply Chain Graph Networks",
        "sota": "Two-Tower Neural Retrieval, DCN-v2, Contextual Bandits for Pricing, Uber Demand AI",
        "modality": "Customer clickstream graph embeddings, SKU catalog metadata, multi-warehouse logistics routing matrices",
        "loss": r"\mathcal{L}_{\text{Rec}} = -\sum_{i \in \text{Batch}} \log \frac{\exp(\mathbf{u}_i \cdot \mathbf{v}_i / \tau)}{\sum_{j} \exp(\mathbf{u}_i \cdot \mathbf{v}_j / \tau)} + \lambda \mathcal{L}_{\text{stockout}}",
        "loss_desc": "Sampled softmax contrastive loss between user embeddings and item candidate vectors, combined with stockout penalty.",
        "case_study": "Amazon's personalized neural recommendation engine drives over 35% of total e-commerce purchases through real-time candidate retrieval and ranking.",
        "failure_mode": "Echo-chamber feedback loops where recommendation systems only promote already-popular items, suppressing novel entrepreneurial offerings.",
        "stages_1": [
            {"label": "User Interaction History", "sub": "Clicks, Purchases, Dwell Time", "type": "input"},
            {"label": "Two-Tower User Net", "sub": "64-Dim Latent Representation", "type": "model"},
            {"label": "Cosine Similarity Loss", "sub": "Contrastive In-Batch Softmax", "type": "loss"},
            {"label": "Sub-millisecond Recs", "sub": "Filtered from 100M Item Pool", "type": "output"}
        ],
        "stages_2": [
            {"label": "Real-time Demand Signals", "sub": "Competitor Price & Inventory", "type": "input"},
            {"label": "Contextual Bandit Net", "sub": "Thompson Sampling Policy", "type": "model"},
            {"label": "Revenue Optimization", "sub": "Expected Margin Maximization", "type": "loss"},
            {"label": "Dynamic Price Tag", "sub": "14% Revenue Uplift Achieved", "type": "output"}
        ],
        "stages_3": [
            {"label": "Global Supply Chain Net", "sub": "Port, Freight & Truck Times", "type": "input"},
            {"label": "Spatio-Temporal GNN", "sub": "Network Flow Graph Attention", "type": "model"},
            {"label": "Delivery Delay Loss", "sub": "Bottleneck Delay Penalization", "type": "loss"},
            {"label": "Rerouted Logistics Path", "sub": "Zero Disruption Supply Chain", "type": "output"}
        ],
        "stages_4": [
            {"label": "Customer Support Tickets", "sub": "Multi-channel Chat & Voice", "type": "input"},
            {"label": "Agentic LLM Router", "sub": "Tool-Enabled Problem Resolution", "type": "model"},
            {"label": "Resolution Accuracy", "sub": "First-Contact Resolution Metric", "type": "loss"},
            {"label": "Instant Ticket Solve", "sub": "80% Automated Customer Care", "type": "output"}
        ],
        "stages_5": [
            {"label": "Generated Campaign Copy", "sub": "Automated Ad & Landing Page", "type": "input"},
            {"label": "Brand Alignment Filter", "sub": "Tone & Legal Trademark Check", "type": "model"},
            {"label": "A/B Test Statistical Guard", "sub": "p < 0.01 Significance Gate", "type": "loss"},
            {"label": "Launched Venture Growth", "sub": "High-Converting Safe Campaign", "type": "output"}
        ],
    },
    "Psychology": {
        "focus": "Computational Cognitive Modeling, Speech Biomarkers for Mental Health, and fMRI Visual Decoding",
        "sota": "Mind-Eye fMRI Decoder, Deep Drift-Diffusion Models, Bioacoustic Emotion Transformers",
        "modality": "fMRI voxel activation volumes, eye-tracking saccade coordinates, acoustic speech recordings, cognitive trial reaction times",
        "loss": r"\mathcal{L}_{\text{fMRI}} = \mathcal{L}_{\text{Contrastive}}(z_{\text{fMRI}}, z_{\text{Image}}) + \lambda \mathcal{L}_{\text{Diffusion}}(x, \hat{x})",
        "loss_desc": "Cross-modal contrastive alignment between human brain voxel responses and visual foundation model latent space.",
        "case_study": "The Mind-Eye system reconstructed high-fidelity natural images directly from human visual cortex fMRI blood-oxygen recordings with over 90% semantic accuracy.",
        "failure_mode": "Overinterpreting correlations between acoustic speech features and clinical depression without accounting for cultural or linguistic variance.",
        "stages_1": [
            {"label": "fMRI Brain Voxels", "sub": "Visual Cortex 7T fMRI Scan", "type": "input"},
            {"label": "Ridge & MLP Bridge", "sub": "Brain-to-Latent Projection", "type": "model"},
            {"label": "CLIP Contrastive Loss", "sub": "Aligns Voxels with CLIP Image", "type": "loss"},
            {"label": "Reconstructed Image", "sub": "Direct Perception from Mind", "type": "output"}
        ],
        "stages_2": [
            {"label": "Therapy Audio Stream", "sub": "Patient-Clinician Session", "type": "input"},
            {"label": "Wav2Vec2 Conformer", "sub": "Pitch, Jitter, Shimmer Vectors", "type": "model"},
            {"label": "Depression Severity Scorer", "sub": "PHQ-9 Clinical Benchmark Loss", "type": "loss"},
            {"label": "Objective Biomarker Score", "sub": "Assists Clinical Assessment", "type": "output"}
        ],
        "stages_3": [
            {"label": "Cognitive Decision Task", "sub": "Two-Alternative Choice RTs", "type": "input"},
            {"label": "Neural Drift-Diffusion", "sub": "Drift Rate & Boundary Sep.", "type": "model"},
            {"label": "Wiener First-Passage Loss", "sub": "Reaction Time Likelihood", "type": "loss"},
            {"label": "Cognitive Parameter Map", "sub": "Latent Processing Speed Model", "type": "output"}
        ],
        "stages_4": [
            {"label": "Eye-Tracking Scanpath", "sub": "Saccade Fixations (1000Hz)", "type": "input"},
            {"label": "Scanpath Transformer", "sub": "Visual Attention Encoding", "type": "model"},
            {"label": "Attention Deficit Loss", "sub": "Early Biomarker Detection", "type": "loss"},
            {"label": "Cognitive Diagnosis", "sub": "Early Pediatric ADHD Screen", "type": "output"}
        ],
        "stages_5": [
            {"label": "Mental Health Assessment", "sub": "Proposed Clinical Diagnostic", "type": "input"},
            {"label": "Psychometric Bias Check", "sub": "Cross-Demographic Parity Test", "type": "model"},
            {"label": "Human Psychiatrist Review", "sub": "Mandatory Expert Validation", "type": "loss"},
            {"label": "Ethical Patient Report", "sub": "Safe Compassionate Care", "type": "output"}
        ],
    },
    "Sociology": {
        "focus": "Algorithmic Fairness Audits, Large-Scale Social Network Dynamics, and Diachronic Cultural Mining",
        "sota": "Graph Convolutional Networks (GCNs), Fairlearn Framework, Diachronic Word2Vec, SNAP Net",
        "modality": "Billion-node social interaction graphs, census microdata, digitized multi-century book archives",
        "loss": r"\mathcal{L}_{\text{Fair}} = \mathcal{L}_{\text{Task}} + \lambda \left| \mathbb{E}[\hat{y} | A = 0] - \mathbb{E}[\hat{y} | A = 1] \right|",
        "loss_desc": "Task classification loss regularized by demographic parity discrepancy across protected sensitive demographic attributes.",
        "case_study": "Computational sociologists mapped cultural and gender stereotypes over 100 years of English texts using word embedding geometry, demonstrating how linguistic associations accurately mirrored historical employment statistics.",
        "failure_mode": "Amplifying systemic historical discrimination when training models on historical social data without rigorous fairness intervention.",
        "stages_1": [
            {"label": "Billion-Node Social Graph", "sub": "Friendships & Communities", "type": "input"},
            {"label": "Graph Sage Net", "sub": "Neighborhood Node Aggregation", "type": "model"},
            {"label": "Echo Chamber Link Loss", "sub": "Community Homophily Penalty", "type": "loss"},
            {"label": "Social Polarization Map", "sub": "Reveals Societal Fragmentation", "type": "output"}
        ],
        "stages_2": [
            {"label": "Historical Digitized Books", "sub": "100 Years of Published Text", "type": "input"},
            {"label": "Diachronic Embeddings", "sub": "Temporal Word2Vec Trajectories", "type": "model"},
            {"label": "Semantic Shift Loss", "sub": "Cosine Drift over Decades", "type": "loss"},
            {"label": "Cultural Value Evolution", "sub": "Quantified Norm Shifts", "type": "output"}
        ],
        "stages_3": [
            {"label": "Loan / Bail Decision Data", "sub": "High-Stakes Societal Dataset", "type": "input"},
            {"label": "Fairlearn In-Processor", "sub": "Equalized Odds Optimization", "type": "model"},
            {"label": "Demographic Parity Loss", "sub": "Zero False Positive Disparity", "type": "loss"},
            {"label": "Audited Fair Algorithm", "sub": "Eliminates Disparate Impact", "type": "output"}
        ],
        "stages_4": [
            {"label": "Census & Mobility Traces", "sub": "Aggregated Urban Flow Grids", "type": "input"},
            {"label": "Spatial-Temporal GCN", "sub": "Urban Segregation Modeling", "type": "model"},
            {"label": "Social Mobility Metric", "sub": "Inter-neighborhood Interaction", "type": "loss"},
            {"label": "Urban Policy Insights", "sub": "Guides Inclusive City Design", "type": "output"}
        ],
        "stages_5": [
            {"label": "Social AI Deployment", "sub": "Public Sector Welfare System", "type": "input"},
            {"label": "Independent Bias Audit", "sub": "Third-Party Algorithmic Review", "type": "model"},
            {"label": "Disproportionate Impact Test", "sub": "Strict Four-Fifths Rule Gate", "type": "loss"},
            {"label": "Certified Public System", "sub": "Equitable Citizen Resource Allocation", "type": "output"}
        ],
    },
    "Political Science": {
        "focus": "Spatiotemporal Conflict Forecasting, Legislative Roll-Call Modeling, and Disinformation Detection",
        "sota": "ICEWS Conflict Predictor, ACLED ST-GCN, Variational Ideal Point Model, Stance Transformers",
        "modality": "Geocoded political event logs (protests, strikes, armed clashes), parliamentary voting matrices, social media discourse graphs",
        "loss": r"\mathcal{L}_{\text{Conflict}} = -\sum_{i=1}^N \left( y_i \log(\lambda_i) - \lambda_i \Delta t \right) + \lambda \mathcal{R}_{\text{spatial}}",
        "loss_desc": "Inhomogeneous Poisson process log-likelihood for event counts regularized by spatial contiguity priors.",
        "case_study": "The Armed Conflict Location & Event Data (ACLED) AI integration accurately forecasting regional conflict escalation and political violence hotspots with multi-week lead times.",
        "failure_mode": "Over-indexing on state-controlled media narratives, producing severely skewed political instability indices in authoritarian regimes.",
        "stages_1": [
            {"label": "Global News & Cables", "sub": "Multi-lingual Geocoded Events", "type": "input"},
            {"label": "ST-GCN Conflict Net", "sub": "Spatiotemporal Graph Attention", "type": "model"},
            {"label": "Poisson Intensity Loss", "sub": "Event Rate Modeling Residual", "type": "loss"},
            {"label": "30-Day Crisis Forecast", "sub": "Humanitarian Early Warning", "type": "output"}
        ],
        "stages_2": [
            {"label": "Parliamentary Roll Calls", "sub": "10 Years of Legislative Votes", "type": "input"},
            {"label": "Variational Ideal Point", "sub": "Latent Ideological Coordinates", "type": "model"},
            {"label": "Vote Prediction Loss", "sub": "Binary Probit Log-Likelihood", "type": "loss"},
            {"label": "Ideological Landscape", "sub": "Reveals Hidden Coalitions", "type": "output"}
        ],
        "stages_3": [
            {"label": "Social Media Stream", "sub": "Electoral Discussion Posts", "type": "input"},
            {"label": "Stance Transformer", "sub": "Target-Dependent Stance Model", "type": "model"},
            {"label": "Bot Coordination Loss", "sub": "Astroturfing Network Analysis", "type": "loss"},
            {"label": "Coordinated Attack Alert", "sub": "Disinformation Campaign Quenched", "type": "output"}
        ],
        "stages_4": [
            {"label": "Treaty & Trade Texts", "sub": "International Agreements", "type": "input"},
            {"label": "Legal-Political Bi-Encoder", "sub": "Normative Alignment Mapping", "type": "model"},
            {"label": "Geopolitical Alignment", "sub": "Bilateral Distance Metric", "type": "loss"},
            {"label": "Global Treaty Network", "sub": "Anticipates Trade Sanctions", "type": "output"}
        ],
        "stages_5": [
            {"label": "Election Polling Forecast", "sub": "Aggregated Multi-Poll Data", "type": "input"},
            {"label": "Demographic Weighing Guard", "sub": "Non-Response Bias Correction", "type": "model"},
            {"label": "Historical Calibration Check", "sub": "Brier Score Verification", "type": "loss"},
            {"label": "Reliable Election Model", "sub": "Calibrated Electoral Probability", "type": "output"}
        ],
    },
    "Law and Public Policy": {
        "focus": "Dense Legal Retrieval, Automated Contract Risk Extraction, and Judicial Analytics",
        "sota": "Stanford LegalBench, Harvey AI, SaulLM-7B, LegalBERT",
        "modality": "Multi-page commercial contracts, judicial precedent transcripts, statutory regulatory codes",
        "loss": r"\mathcal{L}_{\text{Legal}} = -\sum_{i=1}^B \log \frac{\exp(\text{sim}(q_i, p_i^+) / \tau)}{\exp(\text{sim}(q_i, p_i^+) / \tau) + \sum_j \exp(\text{sim}(q_i, n_{ij}^-) / \tau)}",
        "loss_desc": "InfoNCE contrastive loss training legal bi-encoders to pull matching legal precedents and statutes close while repelling misleading citations.",
        "case_study": "Stanford LegalBench established a comprehensive legal reasoning benchmark demonstrating domain-adapted LLMs achieving passing scores on the Uniform Bar Examination and automated contract clause analysis.",
        "failure_mode": "Hallucinating fictitious case law citations or misinterpreting binding jurisdictions, leading to severe legal malpractice.",
        "stages_1": [
            {"label": "Legal Brief / Query", "sub": "Jurisdiction & Fact Summary", "type": "input"},
            {"label": "SaulLM Dense Bi-Encoder", "sub": "Domain Legal Representation", "type": "model"},
            {"label": "InfoNCE Precedent Loss", "sub": "Hard Negative Mining", "type": "loss"},
            {"label": "Binding Precedent List", "sub": "100% Verifiable Case Law", "type": "output"}
        ],
        "stages_2": [
            {"label": "100-Page M&A Contract", "sub": "Raw Legal Agreement PDF", "type": "input"},
            {"label": "Hierarchical Legal LLM", "sub": "Clause-level Attention Window", "type": "model"},
            {"label": "Indemnification Risk Head", "sub": "Multi-label Risk Categorization", "type": "loss"},
            {"label": "Redlined Risk Report", "sub": "Flags Hidden Liability Traps", "type": "output"}
        ],
        "stages_3": [
            {"label": "Proposed Legislation", "sub": "Tax & Social Benefit Reform", "type": "input"},
            {"label": "Microsimulation Model", "sub": "Synthetic Population Economy", "type": "model"},
            {"label": "Fiscal Impact Loss", "sub": "Income Inequality (Gini) Metric", "type": "loss"},
            {"label": "Policy Impact Statement", "sub": "Projected 10-Year Budget Impact", "type": "output"}
        ],
        "stages_4": [
            {"label": "Regulatory Directive (EU/SEC)", "sub": "1,000 Pages of Compliance Rules", "type": "input"},
            {"label": "Graph Compliance Parser", "sub": "Deontic Logic Obligation Net", "type": "model"},
            {"label": "Compliance Audit Loss", "sub": "Policy-Rule Discrepancy Scorer", "type": "loss"},
            {"label": "Automated Audit Checklist", "sub": "Guaranteed Regulatory Adherence", "type": "output"}
        ],
        "stages_5": [
            {"label": "Draft Legal Opinion", "sub": "Generated Legal Argument", "type": "input"},
            {"label": "Citation Existence Guard", "sub": "Verifies Against Westlaw / Lexis", "type": "model"},
            {"label": "Jurisdiction Authority Check", "sub": "Prunes Overruled Precedents", "type": "loss"},
            {"label": "Certified Court-Ready Brief", "sub": "Zero Hallucinated Citations", "type": "output"}
        ],
    },
    "Environmental Science": {
        "focus": "Satellite Remote Sensing for Deforestation, Wildfire Propagation Physics, and Global Methane Tracking",
        "sota": "Global Forest Watch ViT, Sentinel-2 U-Net, DeepMind BirdNET, FireCast",
        "modality": "Multispectral Sentinel/Landsat GeoTIFF rasters, acoustic bioacoustic hydrophone recordings, fuel moisture grids",
        "loss": r"\mathcal{L}_{\text{Seg}} = 1 - \frac{2 |Y \cap \hat{Y}| + \epsilon}{|Y| + |\hat{Y}| + \epsilon} + \lambda \mathcal{L}_{\text{Physics-Spread}}",
        "loss_desc": "Dice segmentation loss for canopy loss and burn scars regularized by cellular automata physical fire spread dynamics.",
        "case_study": "Global Forest Watch monitors the entirety of Earth's tropical rainforests every 5 days using automated Vision Transformers on Sentinel-2 imagery, alerting conservation rangers to illegal logging in near real-time.",
        "failure_mode": "Confusing cloud shadows and seasonal crop senescence with actual illegal forest clearing in equatorial regions.",
        "stages_1": [
            {"label": "Sentinel-2 Multi-spectral", "sub": "10m Resolution Bands (B2-B12)", "type": "input"},
            {"label": "Spatio-Temporal ViT", "sub": "Canopy Spectral Index Net", "type": "model"},
            {"label": "Dice Loss on Deforestation", "sub": "Pixel-Level Canopy Segmentation", "type": "loss"},
            {"label": "Deforestation Alert", "sub": "Near Real-Time Ranger Dispatch", "type": "output"}
        ],
        "stages_2": [
            {"label": "Bioacoustic Audio Field", "sub": "24/7 Rainforest Microphone", "type": "input"},
            {"label": "BirdNET Conformer", "sub": "Mel-Spectrogram Attention", "type": "model"},
            {"label": "Species Multi-Label Loss", "sub": "6,000 Avian Species Classifier", "type": "loss"},
            {"label": "Biodiversity Index", "sub": "Monitors Endangered Populations", "type": "output"}
        ],
        "stages_3": [
            {"label": "Wildfire Front + Wind Data", "sub": "Thermal IR & Weather Grid", "type": "input"},
            {"label": "Physics-Informed Cellular Net", "sub": "Farsite Physical Spread Model", "type": "model"},
            {"label": "Perimeter Discrepancy", "sub": "Rate-of-Spread Calibration", "type": "loss"},
            {"label": "12-Hour Fire Isochrone", "sub": "Evacuation Route Protection", "type": "output"}
        ],
        "stages_4": [
            {"label": "Hyperspectral Sat Imagery", "sub": "Methane Shortwave IR Bands", "type": "input"},
            {"label": "Plume Detection CNN", "sub": "Atmospheric Column Integration", "type": "model"},
            {"label": "Point-Source Flux Loss", "sub": "Mass Balance Estimation Residual", "type": "loss"},
            {"label": "Methane Super-Emitter Hit", "sub": "Pipelines Repaired Immediately", "type": "output"}
        ],
        "stages_5": [
            {"label": "Environmental Claim", "sub": "Carbon Offset Forest Credit", "type": "input"},
            {"label": "Multi-Decade Satellite Audit", "sub": "Verifies Permanence & Leakage", "type": "model"},
            {"label": "Ground Truth Biomass Check", "sub": "LiDAR Canopy Height Validation", "type": "loss"},
            {"label": "Certified Carbon Credit", "sub": "Eliminates Greenwashing Fraud", "type": "output"}
        ],
    },
    "Earth Science": {
        "focus": "AI Weather Forecasting, Seismic Wave Arrival Picking, and Landslide Susceptibility Modeling",
        "sota": "Google DeepMind GraphCast, Huawei Pangu-Weather, PhaseNet Seismic AI, FourCastNet",
        "modality": "ERA5 reanalysis global atmospheric grids (geopotential, specific humidity, wind vectors), broadband 3-component seismic time-series",
        "loss": r"\mathcal{L}_{\text{Weather}} = \sum_{v \in \text{Vars}} \sum_{l=1}^L w_l \frac{1}{|M|} \sum_{i \in M} a_i (x_{v,l,i}^{(t)} - \hat{x}_{v,l,i}^{(t)})^2",
        "loss_desc": "Latitude-weighted, pressure-level balanced Mean Squared Error over icosahedral global multi-mesh grids.",
        "case_study": "DeepMind GraphCast generates a 10-day global weather forecast at 0.25-degree resolution in under one minute on a single Google TPU, outperforming ECMWF's supercomputer ensemble on 90% of atmospheric variables.",
        "failure_mode": "Smoothing out extreme hurricane peak wind speeds and failing to model rare non-linear atmospheric feedback bifurcation points.",
        "stages_1": [
            {"label": "ERA5 Global Atmosphere", "sub": "37 Pressure Levels (0.25 Deg)", "type": "input"},
            {"label": "GraphCast Mesh GNN", "sub": "Icosahedral Multi-Mesh Net", "type": "model"},
            {"label": "Latitude-Weighted MSE", "sub": "Conservation-Guided Loss", "type": "loss"},
            {"label": "10-Day Global Weather", "sub": "Generated in 60s with High SOTA", "type": "output"}
        ],
        "stages_2": [
            {"label": "Seismic Sensor Array", "sub": "100Hz 3-Component Waveforms", "type": "input"},
            {"label": "PhaseNet 1D ConvNet", "sub": "Residual U-Net Architecture", "type": "model"},
            {"label": "P & S Arrival Probability", "sub": "Cross-Entropy Arrival Peaks", "type": "loss"},
            {"label": "Earthquake Early Warning", "sub": "Alert Sent 15s Before Shaking", "type": "output"}
        ],
        "stages_3": [
            {"label": "Satellite InSAR Interferometry", "sub": "Millimeter Surface Deformation", "type": "input"},
            {"label": "Volcano Inflation Net", "sub": "Mogi Source Inversion Model", "type": "model"},
            {"label": "Magma Chamber Pressure", "sub": "Elastic Half-Space Inversion", "type": "loss"},
            {"label": "Volcanic Eruption Alert", "sub": "Saves Surrounding Populations", "type": "output"}
        ],
        "stages_4": [
            {"label": "Topography & Rain Grids", "sub": "DEM Slope, Soil Moisture, Rain", "type": "input"},
            {"label": "Landslide Hazard GNN", "sub": "Catchment Hydrology Attention", "type": "model"},
            {"label": "Failure Probability Loss", "sub": "Infinite Slope Stability Metric", "type": "loss"},
            {"label": "Slope Failure Prediction", "sub": "Highways Closed Before Collapse", "type": "output"}
        ],
        "stages_5": [
            {"label": "Atmospheric Forecast", "sub": "10-Day AI Global Forecast", "type": "input"},
            {"label": "Total Energy & Mass Guard", "sub": "Verifies Global Mass Balance", "type": "model"},
            {"label": "Severe Storm Peak Check", "sub": "Ensures No Unphysical Smoothing", "type": "loss"},
            {"label": "Operational Weather Alert", "sub": "Trusted by National Met Services", "type": "output"}
        ],
    },
    "History": {
        "focus": "Ancient Inscription Restoration, Historical Document OCR, and Archaeological Site 3D NeRFs",
        "sota": "DeepMind Ithaca, Transkribus HTR, Archaeological NeRF, Historical Map Alignment",
        "modality": "Damaged stone epigraphic texts with missing characters, medieval handwritten codices, historical aerial drone photogrammetry",
        "loss": r"\mathcal{L}_{\text{Ithaca}} = \mathcal{L}_{\text{Text}}(y_{\text{char}}, \hat{y}) + \alpha \mathcal{L}_{\text{Date}}(t, \hat{t}) + \beta \mathcal{L}_{\text{Region}}(r, \hat{r})",
        "loss_desc": "Multi-task loss optimizing missing character text restoration, archaeological dating (±10 years), and geographic origin classification.",
        "case_study": "DeepMind's Ithaca model restored damaged ancient Greek inscriptions on stone with 62% standalone accuracy (reaching 72% when working with human historians) while dating them to within 30 years.",
        "failure_mode": "Hallucinating modern linguistic idioms or forcing anachronistic historical concepts into damaged ancient source materials.",
        "stages_1": [
            {"label": "Damaged Stone Inscription", "sub": "Missing Characters & Words", "type": "input"},
            {"label": "Ithaca Multi-Task Net", "sub": "Bidirectional Char Transformer", "type": "model"},
            {"label": "Text + Date + Region Loss", "sub": "Historical Context Optimization", "type": "loss"},
            {"label": "Restored Ancient Text", "sub": "Dated to Within 30 Years", "type": "output"}
        ],
        "stages_2": [
            {"label": "Medieval Handwritten Codex", "sub": "Faded Latin / Arabic Script", "type": "input"},
            {"label": "Transkribus HTR Net", "sub": "Vision-to-Text Sequence Model", "type": "model"},
            {"label": "Character Error Rate Loss", "sub": "Beam Search with Lexicon", "type": "loss"},
            {"label": "Searchable Digital Text", "sub": "Millions of Archives Unlocked", "type": "output"}
        ],
        "stages_3": [
            {"label": "Historical Aerial Imagery", "sub": "1940s Monochrome Aerial Scans", "type": "input"},
            {"label": "Deformable Registration Net", "sub": "Topographic Control Point Match", "type": "model"},
            {"label": "Spatial Alignment Loss", "sub": "Mutual Information Georeference", "type": "loss"},
            {"label": "Modern GIS Overlay Map", "sub": "Reveals Buried Roman Forts", "type": "output"}
        ],
        "stages_4": [
            {"label": "Archaeological Drone Video", "sub": "Multi-Angle Ruin Footage", "type": "input"},
            {"label": "Neural Radiance Field (NeRF)", "sub": "Continuous 3D Volumetric Scene", "type": "model"},
            {"label": "Photometric View Loss", "sub": "Ray Marching Density Loss", "type": "loss"},
            {"label": "Immersive 3D Heritage Site", "sub": "Preserved Digitally Forever", "type": "output"}
        ],
        "stages_5": [
            {"label": "Proposed Text Restoration", "sub": "Predicted Missing Words", "type": "input"},
            {"label": "Palaeographic Authenticator", "sub": "Checks Epigraphic Letter Forms", "type": "model"},
            {"label": "Historian Peer Review", "sub": "Cross-references Corpus Inscriptionum", "type": "loss"},
            {"label": "Scholarly Publication", "sub": "Authoritative Epigraphic Edition", "type": "output"}
        ],
    },
    "Philosophy": {
        "focus": "Formal Logic Autoformalization, Constitutional AI Alignment, and Computational Argument Mining",
        "sota": "Anthropic Constitutional AI, Lean 4 Natural Deduction Prover, Argument Mining Transformers",
        "modality": "Dialectical philosophical text corpora, first-order logic formulas, moral dilemma choice trees",
        "loss": r"\mathcal{L}_{\text{Alignment}} = -\mathbb{E}_{(x, y_w, y_l) \sim \mathcal{D}} \left[ \log \sigma\left( r_\theta(x, y_w) - r_\theta(x, y_l) \right) \right] + \lambda \mathcal{L}_{\text{Consistency}}",
        "loss_desc": "Bradley-Terry preference model optimizing ethical response ranking regularized by formal logical consistency.",
        "case_study": "Anthropic's Constitutional AI utilizing a set of philosophical and human rights principles to guide autonomous self-critique and revision without human-in-the-loop crowd worker labeling.",
        "failure_mode": "Committing subtle naturalistic fallacies or generating superficially coherent philosophical arguments with deep underlying category errors.",
        "stages_1": [
            {"label": "Philosophical Treatise", "sub": "Raw Natural Language Argument", "type": "input"},
            {"label": "Argument Mining Parser", "sub": "Premise-Conclusion Bi-Encoder", "type": "model"},
            {"label": "Entailment Fallacy Scorer", "sub": "Syllogistic Validity Loss", "type": "loss"},
            {"label": "Formal Argument DAG", "sub": "Exposes Hidden Axioms & Gaps", "type": "output"}
        ],
        "stages_2": [
            {"label": "Draft Model Response", "sub": "Potentially Biased / Unsafe Text", "type": "input"},
            {"label": "Constitutional AI Critic", "sub": "Critiques Against Ethical Rules", "type": "model"},
            {"label": "Self-Correction Loop", "sub": "Revises According to Principles", "type": "loss"},
            {"label": "Principled Response", "sub": "Adheres to Philosophical Norms", "type": "output"}
        ],
        "stages_3": [
            {"label": "Natural Language Claim", "sub": "Ontological / Epistemic Statement", "type": "input"},
            {"label": "Autoformalization Net", "sub": "Translates to Modal Logic", "type": "model"},
            {"label": "Automated Theorem Solver", "sub": "Z3 / Isabelle Proof Validation", "type": "loss"},
            {"label": "Logical Proof Certificate", "sub": "Verified Free of Contradictions", "type": "output"}
        ],
        "stages_4": [
            {"label": "Ethical Dilemma Scenarios", "sub": "Trolley & Resource Allocations", "type": "input"},
            {"label": "Moral Foundations Net", "sub": "Utilitarian vs Deontic Embed.", "type": "model"},
            {"label": "Value Alignment Distance", "sub": "Minimizes Normative Divergence", "type": "loss"},
            {"label": "Aligned Decision Framework", "sub": "Fair Multi-Stakeholder Policy", "type": "output"}
        ],
        "stages_5": [
            {"label": "Generated Argument Chain", "sub": "Multi-Step Philosophical Claim", "type": "input"},
            {"label": "Non-Sequitur Detector", "sub": "Validates Deductive Integrity", "type": "model"},
            {"label": "Semantic Equivocation Filter", "sub": "Detects Shifting Word Meanings", "type": "loss"},
            {"label": "Rigorous Philosophical Essay", "sub": "Ready for Peer Review", "type": "output"}
        ],
    },
    "Literature": {
        "focus": "Computational Stylometry, Authorship Attribution, and Narrative Emotion Trajectory Modeling",
        "sota": "Longformer Literary Parser, Authorship Attribution CNN, Vonnegut Story Curve AI",
        "modality": "Full-text novel corpora, literary narrative character interaction graphs, poetic meter annotations",
        "loss": r"\mathcal{L}_{\text{Style}} = \mathcal{L}_{\text{Author}}(y_{\text{author}}, \hat{y}) + \lambda \text{DTW}(\mathbf{s}_{\text{narrative}}, \mathbf{s}_{\text{target}})",
        "loss_desc": "Cross-entropy authorship classification on non-contextual function word frequencies, combined with Dynamic Time Warping on emotional narrative trajectories.",
        "case_study": "Computational stylometry resolving the disputed authorship of Shakespeare's co-authored plays (e.g. Henry VIII with John Fletcher) and verifying the Federalist Papers with 99.9% statistical certainty.",
        "failure_mode": "Confusing conscious authorial mimicry or literary parody with genuine historical authorship attribution.",
        "stages_1": [
            {"label": "Disputed Novel Text", "sub": "Full Manuscript Prose", "type": "input"},
            {"label": "Stylometric Feature Extr.", "sub": "Function Words & Character N-Grams", "type": "model"},
            {"label": "Authorship Softmax Loss", "sub": "Delta / Eder Distance Metric", "type": "loss"},
            {"label": "Attributed Author", "sub": "99.9% Statistical Certainty", "type": "output"}
        ],
        "stages_2": [
            {"label": "Chapter-by-Chapter Novel", "sub": "100,000 Words Narrative Arc", "type": "input"},
            {"label": "Sentiment Dynamics Net", "sub": "Dense Valence-Arousal Tracker", "type": "model"},
            {"label": "Dynamic Time Warping", "sub": "Matches Archetypal Story Curve", "type": "loss"},
            {"label": "Narrative Trajectory Map", "sub": "Classifies Plot Structure Shape", "type": "output"}
        ],
        "stages_3": [
            {"label": "Dialogue & Scene Text", "sub": "Dramatic Play or Screenplay", "type": "input"},
            {"label": "Character Interaction GNN", "sub": "Social Network of Dramatis Personae", "type": "model"},
            {"label": "Centrality & Conflict Head", "sub": "Tracks Protagonist Agency", "type": "loss"},
            {"label": "Dramatic Tension Graph", "sub": "Visualizes Dramatic Pacing", "type": "output"}
        ],
        "stages_4": [
            {"label": "Poetic Form Specification", "sub": "Petrarchan Sonnet Constraints", "type": "input"},
            {"label": "Hierarchical Poetic LLM", "sub": "Iambic Pentameter Attention", "type": "model"},
            {"label": "Rhyme & Meter Penalty", "sub": "Phonetic Stress Calibration", "type": "loss"},
            {"label": "Rigorous Sonnet Poem", "sub": "Perfect Scansion & Deep Metaphor", "type": "output"}
        ],
        "stages_5": [
            {"label": "Attribution Result", "sub": "Claim of Disputed Authorship", "type": "input"},
            {"label": "Cross-Validation Bootstrap", "sub": "10,000 Sub-Sample Permutations", "type": "model"},
            {"label": "Genre Distortion Filter", "sub": "Removes Topical Vocabulary Bias", "type": "loss"},
            {"label": "Peer-Defensible Scholarly Finding", "sub": "Accepted by Literary Historians", "type": "output"}
        ],
    },
    "Languages and Linguistics": {
        "focus": "Universal Speech Recognition, Low-Resource Machine Translation, and Dependency Syntax Parsing",
        "sota": "OpenAI Whisper, Meta NLLB-200, XLM-RoBERTa, Biaffine Dependency Parser",
        "modality": "Audio spectrogram acoustic waveforms, phoneme sequences, multilingual parallel text bitexts",
        "loss": r"\mathcal{L}_{\text{ASR}} = -\sum_{(x, y) \in \mathcal{D}} \sum_{u=1}^U \log P(y_u | y_{<u}, \text{Enc}(x)) + \lambda \mathcal{L}_{\text{CTC}}",
        "loss_desc": "Sequence-to-sequence autoregressive target likelihood augmented with Connectionist Temporal Classification loss for exact phoneme alignment.",
        "case_study": "Meta's No Language Left Behind (NLLB-200) broke international communication barriers by training a single unified neural model to translate between 200 distinct languages, including over 50 previously unsupported low-resource African and Asian indigenous languages.",
        "failure_mode": "Translating idioms literally or suffering catastrophic hallucinations on languages lacking extensive internet training corpora.",
        "stages_1": [
            {"label": "Acoustic Speech Stream", "sub": "Raw Audio Waveform (16kHz)", "type": "input"},
            {"label": "Whisper Conformer Encoder", "sub": "80-Channel Log-Mel Filterbank", "type": "model"},
            {"label": "CTC & Autoregressive Loss", "sub": "Phoneme Alignment Optimization", "type": "loss"},
            {"label": "Accurate Transcript", "sub": "Includes Timestamps & Dialect", "type": "output"}
        ],
        "stages_2": [
            {"label": "Low-Resource Sentence", "sub": "Indigenous Language Source", "type": "input"},
            {"label": "NLLB-200 Mixture-of-Experts", "sub": "Shared Cross-Lingual Embedding", "type": "model"},
            {"label": "ChrF++ Quality Loss", "sub": "Character N-Gram Matching", "type": "loss"},
            {"label": "Fluent Translation", "sub": "Preserves Cultural Nuance", "type": "output"}
        ],
        "stages_3": [
            {"label": "Natural Language Sentence", "sub": "Complex Syntactic Structure", "type": "input"},
            {"label": "Biaffine Dependency Parser", "sub": "Head-Dependent Attention Matrix", "type": "model"},
            {"label": "Labeled Attachment Score", "sub": "Tree Admissibility Loss", "type": "loss"},
            {"label": "Universal Dependency Tree", "sub": "Full Syntactic Analysis", "type": "output"}
        ],
        "stages_4": [
            {"label": "Audio Recording of Dialect", "sub": "Endangered Language Speaker", "type": "input"},
            {"label": "Self-Supervised WavLM", "sub": "Zero-Shot Phoneme Discovery", "type": "model"},
            {"label": "Lexical Clustering Loss", "sub": "Isolates Morpheme Boundaries", "type": "loss"},
            {"label": "Digital Grammatical Lexicon", "sub": "Preserves Vanishing Tongue", "type": "output"}
        ],
        "stages_5": [
            {"label": "Machine Translated Output", "sub": "Diplomatic / Legal Translation", "type": "input"},
            {"label": "Quality Estimation Model", "sub": "Comet-QE Score Gate (> 0.85)", "type": "model"},
            {"label": "Hallucination Trap Filter", "sub": "Prunes Repetitive Loops", "type": "loss"},
            {"label": "Flawless Multilingual Delivery", "sub": "Safe for International Treaties", "type": "output"}
        ],
    },
    "Education": {
        "focus": "Deep Knowledge Tracing, Automated Formative Feedback, and Adaptive Socratic Tutoring",
        "sota": "Deep Knowledge Tracing (DKT), SAKT, Duolingo Birdbrain, Khanmigo",
        "modality": "Student exercise response sequences (skill ID, timestamp, correctness, hint requests), open-ended student essay responses",
        "loss": r"\mathcal{L}_{\text{DKT}} = -\sum_{t=1}^T \left( r_t \log(y_t) + (1 - r_t) \log(1 - y_t) \right) + \lambda \mathcal{L}_{\text{smoothness}}",
        "loss_desc": "Binary cross-entropy predicting whether a student will correctly answer the next problem based on past mastery states.",
        "case_study": "Duolingo's Birdbrain AI system computes personalized exercise difficulty for over 500 million learners in real-time, predicting exact answer probability to keep users in the optimal Vygotskian zone of proximal development.",
        "failure_mode": "Giving away direct answers instead of fostering Socratic reasoning, or misdiagnosing conceptual student misconceptions.",
        "stages_1": [
            {"label": "Student Practice History", "sub": "Sequence of Correct / Incorrect", "type": "input"},
            {"label": "Self-Attentive DKT (SAKT)", "sub": "Skill Co-Attention Matrix", "type": "model"},
            {"label": "Next-Problem Loss", "sub": "Binary Cross-Entropy Target", "type": "loss"},
            {"label": "Dynamic Mastery Profile", "sub": "Identifies Hidden Math Deficits", "type": "output"}
        ],
        "stages_2": [
            {"label": "Student Python Code", "sub": "Failing Unit Tests with Bug", "type": "input"},
            {"label": "Socratic Pedagogical LLM", "sub": "Tuned to Guide, Not Give Answer", "type": "model"},
            {"label": "Pedagogical Efficacy Loss", "sub": "Encourages Independent Discovery", "type": "loss"},
            {"label": "Targeted Guiding Hint", "sub": "Student Fixes Bug Themselves", "type": "output"}
        ],
        "stages_3": [
            {"label": "Student Open-Ended Essay", "sub": "Persuasive Argument Draft", "type": "input"},
            {"label": "Multi-Trait Rubric ViT/LLM", "sub": "Grades Thesis, Evidence, Flow", "type": "model"},
            {"label": "Ordinal Human-Score Loss", "sub": "Aligned with State Rubrics", "type": "loss"},
            {"label": "Actionable Formative Feedback", "sub": "Specific Line-by-Line Revisions", "type": "output"}
        ],
        "stages_4": [
            {"label": "Classroom Speech Audio", "sub": "Teacher-Student Discussion", "type": "input"},
            {"label": "Pedagogical Talk Classifier", "sub": "Measures Uptake & Open Questions", "type": "model"},
            {"label": "Instructional Metric Loss", "sub": "Differentiates Lecture vs Debate", "type": "loss"},
            {"label": "Teacher Coaching Dashboard", "sub": "Boosts Student Talk Time 40%", "type": "output"}
        ],
        "stages_5": [
            {"label": "AI Tutor Response", "sub": "Generated Guidance Message", "type": "input"},
            {"label": "Hallucination & Factuality Check", "sub": "Strict Mathematical Verifier", "type": "model"},
            {"label": "Safety & Content Guardrail", "sub": "COPPA / FERPA Student Privacy Gate", "type": "loss"},
            {"label": "Safe Socratic Learning Step", "sub": "Empowers Student Autonomy", "type": "output"}
        ],
    },
    "Interdisciplinary Research": {
        "focus": "Autonomous Self-Driving Laboratories, Literature-Scale Hypothesis Generation, and Multimodal Scientific Discovery",
        "sota": "Berkeley A-Lab, Chan Zuckerberg Virtual Cell, Swanson Knowledge Graph Discovery",
        "modality": "Cross-domain scientific paper citation graphs, robotic laboratory execution telemetry, heterogeneous multi-modal assay outputs",
        "loss": r"\mathcal{L}_{\text{Science}} = \mathcal{L}_{\text{LinkPrediction}}(G_{\text{Lit}}) + \alpha \text{EI}(\mathbf{x}_{\text{experiment}}) + \beta \mathcal{L}_{\text{Thermodynamics}}",
        "loss_desc": "Knowledge graph link prediction across disconnected scientific literature combined with Bayesian Expected Improvement for robotic lab synthesis.",
        "case_study": "The Lawrence Berkeley National Laboratory A-Lab operated autonomously for 17 days without human intervention, planning, synthesizing, and analyzing 41 novel inorganic crystals out of 58 targets proposed by thermodynamic AI models.",
        "failure_mode": "Designing robotic experiments that produce hazardous chemical reactions or explosive thermal runaway conditions in automated synthesis chambers.",
        "stages_1": [
            {"label": "Millions of Research Papers", "sub": "PubMed + ArXiv Citation Graph", "type": "input"},
            {"label": "Heterogeneous Science GNN", "sub": "Cross-Domain Entity Embeddings", "type": "model"},
            {"label": "Swanson Discovery Link Loss", "sub": "Connects Disjoint Disease-Compound", "type": "loss"},
            {"label": "Novel Research Hypothesis", "sub": "Guides Lab Investigation", "type": "output"}
        ],
        "stages_2": [
            {"label": "Materials Target Property", "sub": "Superconducting / Battery Need", "type": "input"},
            {"label": "Active Learning Bayesian Net", "sub": "Exploration-Exploitation Policy", "type": "model"},
            {"label": "Expected Improvement (EI)", "sub": "Selects Next Optimal Precursor", "type": "loss"},
            {"label": "Automated Robot Recipe", "sub": "Sent to Robotic Synthesis Rig", "type": "output"}
        ],
        "stages_3": [
            {"label": "A-Lab Robot Chamber", "sub": "Powder Dosing & High-T Furnace", "type": "input"},
            {"label": "Automated XRD Analyzer", "sub": "Phase Identification ConvNet", "type": "model"},
            {"label": "Rietveld Refinement Loss", "sub": "Crystal Structure Confirmation", "type": "loss"},
            {"label": "Synthesized Novel Crystal", "sub": "41 New Inorganic Materials Made", "type": "output"}
        ],
        "stages_4": [
            {"label": "Genomic + Imaging + Vitals", "sub": "Multi-Modal Scientific Cohort", "type": "input"},
            {"label": "Cross-Modal Foundation Net", "sub": "Unified Scientific Representation", "type": "model"},
            {"label": "Multi-Task Discovery Loss", "sub": "Identifies Multi-Scale Biomarkers", "type": "loss"},
            {"label": "Holistic Disease Mechanism", "sub": "Targets Multi-Organ Pathology", "type": "output"}
        ],
        "stages_5": [
            {"label": "Proposed Autonomous Experiment", "sub": "Chemical Reaction Plan", "type": "input"},
            {"label": "Toxicity & Exotherm Guard", "sub": "Simulates Runaway Reaction Risk", "type": "model"},
            {"label": "Human Researcher Approval Gate", "sub": "Mandatory Safety Interlock", "type": "loss"},
            {"label": "Safe Autonomous Lab Execution", "sub": "Scientific Breakthrough Delivered", "type": "output"}
        ],
    },
}

def slug(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))

def draw_academic_diagram(
    c: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    fig_title: str,
    stages: list[dict],
    footer_note: str = ""
) -> None:
    """Draws a clean, publication-grade academic vector architecture diagram."""
    c.setFillColor(HexColor("#F8FAFC"))
    c.setStrokeColor(HexColor("#CBD5E1"))
    c.setLineWidth(0.8)
    c.roundRect(x, y, width, height, 2.5 * mm, fill=1, stroke=1)

    # Header label
    c.setFillColor(HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 7.8)
    c.drawString(x + 3.5 * mm, y + height - 5.2 * mm, fig_title.upper())

    # Sub-rule under title
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.setLineWidth(0.5)
    c.line(x + 3.5 * mm, y + height - 7.0 * mm, x + width - 3.5 * mm, y + height - 7.0 * mm)

    n = len(stages)
    if n == 0:
        return

    pad_x = 3.5 * mm
    pad_y_top = 9.0 * mm
    pad_y_bottom = 6.0 * mm if footer_note else 3.5 * mm
    avail_w = width - (2 * pad_x)
    avail_h = height - pad_y_top - pad_y_bottom

    gap = 4.5 * mm
    box_w = (avail_w - (n - 1) * gap) / n
    box_h = avail_h

    type_colors = {
        "input": (HexColor("#F1F5F9"), HexColor("#94A3B8"), HexColor("#1E293B")),
        "model": (HexColor("#EFF6FF"), HexColor("#3B82F6"), HexColor("#1E3A8A")),
        "loss": (HexColor("#FEF3C7"), HexColor("#D97706"), HexColor("#92400E")),
        "output": (HexColor("#ECFDF5"), HexColor("#10B981"), HexColor("#065F46")),
    }

    for i, stage in enumerate(stages):
        bx = x + pad_x + i * (box_w + gap)
        by = y + pad_y_bottom
        fill_c, stroke_c, text_c = type_colors.get(stage.get("type", "input"), type_colors["input"])

        c.setFillColor(fill_c)
        c.setStrokeColor(stroke_c)
        c.setLineWidth(0.7)
        c.roundRect(bx, by, box_w, box_h, 1.8 * mm, fill=1, stroke=1)

        # Stage number tag
        c.setFillColor(stroke_c)
        c.setFont("Helvetica-Bold", 5.5)
        c.drawString(bx + 2 * mm, by + box_h - 3.8 * mm, f"STAGE 0{i+1}")

        # Stage label
        c.setFillColor(text_c)
        c.setFont("Helvetica-Bold", 7.0)
        label_text = stage.get("label", "")
        c.drawString(bx + 2 * mm, by + box_h - 7.2 * mm, label_text[:20])

        # Stage subtext (word wrap up to 2 lines)
        c.setFillColor(HexColor("#475569"))
        c.setFont("Helvetica", 6.0)
        sub_text = stage.get("sub", "")
        words = sub_text.split(" ")
        line1, line2 = "", ""
        for w in words:
            if len(line1) + len(w) < 18:
                line1 += (" " if line1 else "") + w
            else:
                line2 += (" " if line2 else "") + w
        c.drawString(bx + 2 * mm, by + box_h - 10.5 * mm, line1[:22])
        if line2:
            c.drawString(bx + 2 * mm, by + box_h - 13.5 * mm, line2[:22])

        # Arrow to next stage
        if i < n - 1:
            ax1 = bx + box_w + 0.6 * mm
            ax2 = bx + box_w + gap - 1.0 * mm
            ay = by + box_h / 2
            c.setStrokeColor(HexColor("#64748B"))
            c.setLineWidth(0.8)
            c.line(ax1, ay, ax2, ay)
            # Arrowhead
            p = c.beginPath()
            p.moveTo(ax2, ay)
            p.lineTo(ax2 - 1.4 * mm, ay + 0.9 * mm)
            p.lineTo(ax2 - 1.4 * mm, ay - 0.9 * mm)
            p.close()
            c.setFillColor(HexColor("#64748B"))
            c.drawPath(p, fill=1, stroke=0)

    if footer_note:
        c.setFillColor(HexColor("#64748B"))
        c.setFont("Helvetica-Oblique", 6.2)
        c.drawString(x + 3.5 * mm, y + 2.0 * mm, footer_note)

def build_pages_content(field: str, book: str) -> list[tuple[str, str, dict | None]]:
    """Builds the 20 authoritative pages for a book."""
    spec = DOMAIN_SPECS.get(field, DOMAIN_SPECS["Artificial Intelligence"])
    pages = []

    # ── Page 1: Cover
    pages.append((
        book,
        f"AGENTIA AI Base Knowledge: Technical Monograph\n"
        f"Domain Field: {field}\n"
        f"Core Focus: {spec['focus']}\n\n"
        f"An in-depth academic textbook and engineering reference on state-of-the-art Artificial Intelligence "
        f"applied to {book.lower()} within {field}. Covers high-dimensional data representations, "
        f"deep neural architectures, rigorous loss functions, end-to-end computational pipelines, "
        f"production deployment blueprints, and ethical failure mode guardrails.",
        None
    ))

    # ── Page 2: Table of Contents
    pages.append((
        "Table of Contents",
        f"1. AI Foundations and High-Dimensional Representations in {field}\n"
        f"   1.1 Domain Problem Framing, Latent Manifolds, and Tokenization Dynamics\n"
        f"   1.2 Feature Extraction, Encoders, and Ingestion Pipelines [Figure 1.1]\n"
        f"   1.3 Mathematical Objectives, Loss Formulations, and Invariant Metrics\n\n"
        f"2. Core Deep Learning Architectures and Model Mechanisms\n"
        f"   2.1 Domain-Specific Neural Taxonomy and SOTA Model Zoo\n"
        f"   2.2 Attention Flows, Latent Embeddings, and Graph Transformations [Figure 2.1]\n"
        f"   2.3 Optimization Strategies, Loss Landscapes, and Convergence Guarantees\n\n"
        f"3. End-to-End Computational Pipelines and Training Workflows\n"
        f"   3.1 Dataset Engineering, Noise Reduction, and Synthetic Augmentation\n"
        f"   3.2 Distributed Training, Fine-Tuning, and Hyperparameter Exploration [Figure 3.1]\n"
        f"   3.3 Benchmark Protocols, Evaluation Baselines, and SOTA Metrics\n\n"
        f"4. Real-World Case Studies and Production Deployments\n"
        f"   4.1 Flagship SOTA Case Study: Architectural Innovations and Empirical Results\n"
        f"   4.2 Production Inference Serving, Quantization, and Latency Budgets [Figure 4.1]\n"
        f"   4.3 Comparative Analysis: Deep Learning vs Traditional Domain Heuristics\n\n"
        f"5. Failure Modes, Safety Guardrails, and Emerging Frontiers\n"
        f"   5.1 Out-of-Distribution Vulnerabilities, Model Drift, and Hallucination Dynamics\n"
        f"   5.2 Verification Guardrails, Human-in-the-Loop, and Safety Ensembles [Figure 5.1]\n"
        f"   5.3 Open Research Questions, Autonomous Agent Swarms, and Future Horizons\n\n"
        f"Executive Summary & AI Engineering Checklist\n"
        f"Diagnostic Assessment & Technical Review Questions\n"
        f"Authoritative Academic Bibliography & Benchmark Repositories",
        None
    ))

    # ── Chapter 1: AI Foundations & Representations (Pages 3, 4, 5)
    # Page 3: Part 1.1
    pages.append((
        "Chapter 1: AI Foundations and Domain Representations",
        f"1.1 Domain Problem Framing, Latent Manifolds, and Tokenization Dynamics\n\n"
        f"Applying Artificial Intelligence to {book.lower()} in {field} begins by mapping continuous physical, "
        f"symbolic, or empirical observations into continuous, high-dimensional vector spaces. In this domain, "
        f"raw inputs ({spec['modality']}) possess rich intrinsic geometries that standard multi-layer perceptrons fail to capture. "
        f"Modern systems construct invariant topological embeddings that preserve domain-specific symmetries.\n\n"
        f"When formulating the learning objective, practitioners must define an explicit feature space $\\mathcal{{X}} \\subset \\mathbb{{R}}^D$ "
        f"and target manifold $\\mathcal{{Y}}$. Rather than treating observations as unstructured tabular arrays, contemporary architectures "
        f"employ domain-specific tokenization schemes and positional encodings that reflect underlying physical, temporal, or logical laws.\n\n"
        f"Key Architectural Axiom: Effective AI systems in {field} prioritize inductive biases that enforce conservation laws, "
        f"gauge equivariance, or causal directions directly within the representation layer, preventing the model from having to learn "
        f"fundamental domain laws from raw stochastic gradients alone.",
        None
    ))

    # Page 4: Part 1.2 (WITH DIAGRAM 1)
    pages.append((
        "Chapter 1: AI Foundations and Domain Representations",
        f"1.2 Feature Extraction, Encoders, and Ingestion Pipelines\n\n"
        f"The data ingestion pipeline for {book.lower()} transforms heterogeneous signals into structured computational tensors. "
        f"High-throughput encoders normalize dynamic ranges, filter experimental noise, and project inputs into normalized latent vectors.\n\n"
        f"The diagram below outlines the canonical four-stage data preprocessing and latent transformation pipeline utilized in production {field} models.",
        {
            "fig_title": f"Figure 1.1: Data Ingestion & Latent Embedding Pipeline for {book}",
            "stages": spec["stages_1"],
            "note": f"Pipeline Schema: Raw {field} inputs mapped to normalized latent representation space."
        }
    ))

    # Page 5: Part 1.3
    pages.append((
        "Chapter 1: AI Foundations and Domain Representations",
        f"1.3 Mathematical Objectives, Loss Formulations, and Invariant Metrics\n\n"
        f"The mathematical core of machine learning in {book.lower()} balances empirical data fit with domain constraint regularization. "
        f"The primary optimization objective is formulated as:\n\n"
        f"Mathematical Formulation:\n{spec['loss']}\n\n"
        f"Formulation Breakdown:\n{spec['loss_desc']}\n\n"
        f"In high-dimensional spaces, minimizing vanilla mean squared error or standard cross-entropy often causes models to exploit "
        f"trivial shortcuts. By coupling the task loss with physical boundary penalties, curvature constraints, or contrastive margins, "
        f"the learned parameter weights $\\theta^*$ converge to solutions that generalize across out-of-distribution conditions.\n\n"
        f"Engineering Takeaway: Regularization terms should be dynamically annealed during training using cosine schedules or "
        f"Lagrangian multipliers to maintain equilibrium between raw empirical fidelity and strict domain compliance.",
        None
    ))

    # ── Chapter 2: Core Deep Learning Architectures (Pages 6, 7, 8)
    # Page 6: Part 2.1
    pages.append((
        "Chapter 2: Core Deep Learning Architectures",
        f"2.1 Domain-Specific Neural Taxonomy and SOTA Model Zoo\n\n"
        f"The modern neural architecture suite for {book.lower()} integrates state-of-the-art models such as {spec['sota']}. "
        f"These networks leverage specialized building blocks, including Graph Neural Networks (GNNs) for non-Euclidean interaction graphs, "
        f"E(n)-Equivariant layers for 3D spatial transformations, and FlashAttention-optimized Transformer backbones for long-context reasoning.\n\n"
        f"Unlike general-purpose computer vision or text models, {field} models frequently utilize multi-scale hierarchical decoders "
        f"and continuous neural operators (such as Fourier Neural Operators or DeepONets) capable of resolving zero-shot mesh resolutions.\n\n"
        f"Model Taxonomy Hierarchy:\n"
        f"• Foundation Encoders: Extract multi-scale invariant features across billions of domain observations.\n"
        f"• Interaction Processors: Compute pairwise cross-attentions, message-passing updates, or tensor contractions.\n"
        f"• Task Decoders: Yield calibrated continuous predictions, discrete classifications, or generative diffusion outputs.",
        None
    ))

    # Page 7: Part 2.2 (WITH DIAGRAM 2)
    pages.append((
        "Chapter 2: Core Deep Learning Architectures",
        f"2.2 Attention Flows, Latent Embeddings, and Graph Transformations\n\n"
        f"Within the deep neural core, information propagates through alternating blocks of multi-head self-attention and non-linear feedforward networks. "
        f"Residual connections and RMSNorm layers prevent vanishing gradients across 100+ layer depths, enabling stable representations.\n\n"
        f"Figure 2.1 visualizes the internal tensor flow and layer execution mechanics powering contemporary {field} deep networks.",
        {
            "fig_title": f"Figure 2.1: Deep Neural Architecture & Inference Flow for {book}",
            "stages": spec["stages_2"],
            "note": f"Inference Mechanism: Multi-layer tensor transformation and specialized domain attention."
        }
    ))

    # Page 8: Part 2.3
    pages.append((
        "Chapter 2: Core Deep Learning Architectures",
        f"2.3 Optimization Strategies, Loss Landscapes, and Convergence Guarantees\n\n"
        f"Training non-convex neural networks in {field} presents rugged loss surfaces characterized by sharp ravines and saddle points. "
        f"State-of-the-art training regimes deploy AdamW or Muon optimizers combined with Warmup-Stable-Decay (WSD) learning rate schedules.\n\n"
        f"To prevent catastrophic forgetting during domain-specific adaptation, parameter-efficient fine-tuning (PEFT) frameworks such as "
        f"LoRA (Low-Rank Adaptation) and QLoRA inject trainable rank decomposition matrices $A$ and $B$ (rank $r \\in [8, 16, 64]$) "
        f"into frozen base model weights $W = W_0 + (\\alpha / r) B A$.\n\n"
        f"Stability Protocol: Gradient clipping (norm bound $M = 1.0$), bfloat16 mixed precision, and activation checkpointing "
        f"guarantee numerical stability during multi-week training runs across distributed GPU/TPU clusters.",
        None
    ))

    # ── Chapter 3: Pipelines & Workflows (Pages 9, 10, 11)
    # Page 9: Part 3.1
    pages.append((
        "Chapter 3: End-to-End Computational Pipelines",
        f"3.1 Dataset Engineering, Noise Reduction, and Synthetic Augmentation\n\n"
        f"Data quality is the dominant determinant of model capability in {book.lower()}. Empirical datasets frequently suffer from "
        f"severe observation biases, sensor noise, missing values, and high class imbalance. Production pipelines implement rigorous "
        f"de-duplication, outlier rejection via isolation forests, and synthetic data augmentation.\n\n"
        f"In domains where experimental ground truth is scarce or expensive to collect, generative diffusion models and physics-based simulators "
        f"synthesize millions of photorealistic or mathematically exact training samples, dramatically expanding coverage of rare edge cases.\n\n"
        f"Dataset Verification Checklist:\n"
        f"1. Temporal / Geographic Leakage Check: Ensure zero overlap between training and out-of-time evaluation partitions.\n"
        f"2. Sensor Drift Normalization: Apply running z-score standardization calibrated across independent instruments.\n"
        f"3. Synthetic Quality Verification: Validate synthetic samples against domain-expert rules and physical bounds.",
        None
    ))

    # Page 10: Part 3.2 (WITH DIAGRAM 3)
    pages.append((
        "Chapter 3: End-to-End Computational Pipelines",
        f"3.2 Distributed Training, Fine-Tuning, and Hyperparameter Exploration\n\n"
        f"Large-scale training utilizes Fully Sharded Data Parallelism (FSDP) and tensor parallel pipelines across high-bandwidth interconnects (NVLink/InfiniBand). "
        f"Hyperparameter sweeps employ Bayesian Optimization with Tree-structured Parzen Estimators (TPE) to pinpoint optimal learning rates, weight decays, and batch sizes.\n\n"
        f"Figure 3.1 details the end-to-end distributed training, validation loop, and checkpoint deployment lifecycle.",
        {
            "fig_title": f"Figure 3.1: Distributed Training & Evaluation Lifecycle for {book}",
            "stages": spec["stages_3"],
            "note": "Distributed Training Loop: Continuous gradient updates, validation checks, and checkpoint staging."
        }
    ))

    # Page 11: Part 3.3
    pages.append((
        "Chapter 3: End-to-End Computational Pipelines",
        f"3.3 Benchmark Protocols, Evaluation Baselines, and SOTA Metrics\n\n"
        f"Rigorous evaluation of AI in {field} requires moving beyond naive accuracy to domain-relevant benchmarks. Evaluators calculate "
        f"Receiver Operating Characteristic Area Under Curve (ROC-AUC), Mean Absolute Percentage Error (MAPE), Expected Calibration Error (ECE), "
        f"and conformal coverage intervals at target significance levels ($1 - \\alpha = 0.95$).\n\n"
        f"Model performance must always be baselined against both classical domain heuristics and strong non-neural statistical methods. "
        f"A deep neural network is only justified in production if it demonstrably surpasses established domain standards on both accuracy "
        f"and operational latency.\n\n"
        f"Metric Calibration Standard: Models operating in high-stakes environments must output calibrated probability distributions "
        f"verified by Brier score decomposition ($BS = \\text{{Reliability}} - \\text{{Resolution}} + \\text{{Uncertainty}}$).",
        None
    ))

    # ── Chapter 4: Case Studies & Production (Pages 12, 13, 14)
    # Page 12: Part 4.1
    pages.append((
        "Chapter 4: Real-World Case Studies and Production Deployments",
        f"4.1 Flagship SOTA Case Study: Architectural Innovations and Empirical Results\n\n"
        f"The definitive proof of Artificial Intelligence in {field} is demonstrated through flagship real-world deployments.\n\n"
        f"Flagship Case Study:\n{spec['case_study']}\n\n"
        f"Key Architectural Highlights:\n"
        f"• Grounded Ingestion: Input representations mapped raw domain observations into shared latent embeddings.\n"
        f"• Massive Scaling: Deployed across multi-GPU clusters, scaling parameters to achieve unprecedented empirical generalization.\n"
        f"• Verifiable Impact: Accelerated discovery and execution timelines by orders of magnitude compared to traditional manual workflows.\n\n"
        f"Empirical Lessons Learned: The success of this flagship system demonstrated that coupling neural networks with rigorous "
        f"domain simulators and automated feedback loops yields compounding improvements that exceed human baseline performance.",
        None
    ))

    # Page 13: Part 4.2 (WITH DIAGRAM 4)
    pages.append((
        "Chapter 4: Real-World Case Studies and Production Deployments",
        f"4.2 Production Inference Serving, Quantization, and Latency Budgets\n\n"
        f"Transitioning from research code to enterprise production requires sub-second latency budgets and high throughput. "
        f"Inference servers utilize FP8/INT4 weight-only quantization, kernel fusion via TensorRT or vLLM, and speculative decoding.\n\n"
        f"Figure 4.1 illustrates the high-throughput production serving pipeline delivering real-time predictions to end users and automated agents.",
        {
            "fig_title": f"Figure 4.1: Production Inference Serving & RAG Pipeline for {book}",
            "stages": spec["stages_4"],
            "note": "Production Serving: Optimized low-latency execution and real-time tool orchestration."
        }
    ))

    # Page 14: Part 4.3
    pages.append((
        "Chapter 4: Real-World Case Studies and Production Deployments",
        f"4.3 Comparative Analysis: Deep Learning vs Traditional Domain Heuristics\n\n"
        f"To evaluate the true value of AI in {book.lower()}, engineers compare modern neural systems against traditional domain approaches:\n\n"
        f"• Traditional Domain Heuristics:\n"
        f"  - Pros: 100% interpretable, deterministic execution, zero GPU requirements, mathematically closed-form bounds.\n"
        f"  - Cons: Severe rigidity, brittle to noisy inputs, completely incapable of scaling to high-dimensional multimodal datasets.\n\n"
        f"• Deep Learning & Foundation Models:\n"
        f"  - Pros: State-of-the-art empirical accuracy, automatic feature learning from raw data, robust cross-domain generalization.\n"
        f"  - Cons: High compute requirements, potential for unannounced failure modes, demands rigorous safety guardrails.\n\n"
        f"Synthesis: The most effective modern systems are neuro-symbolic: deep learning extracts rich patterns and proposes candidates, "
        f"while deterministic domain rules verify physical validity and enforce safety boundaries.",
        None
    ))

    # ── Chapter 5: Failure Modes & Guardrails (Pages 15, 16, 17)
    # Page 15: Part 5.1
    pages.append((
        "Chapter 5: Failure Modes, Safety Guardrails, and Emerging Frontiers",
        f"5.1 Out-of-Distribution Vulnerabilities, Model Drift, and Hallucination Dynamics\n\n"
        f"Despite remarkable capabilities, deep learning models applied to {field} exhibit dangerous failure modes when deployed without guardrails.\n\n"
        f"Primary Failure Modes in this Domain:\n{spec['failure_mode']}\n\n"
        f"Root Causes of Model Vulnerability:\n"
        f"1. Out-of-Distribution (OOD) Shift: Models trained on standard historical data collapse when confronted with anomalous conditions.\n"
        f"2. Shortcut Learning: Neural networks frequently latch onto spurious background correlations rather than true causal mechanisms.\n"
        f"3. Hallucinatory Confabulation: Generative models output syntactically flawless but scientifically fabricated predictions.\n\n"
        f"Mitigation Requirement: Continuous out-of-distribution detection algorithms (e.g. Mahalanobis distance in latent space) "
        f"must monitor incoming inference traffic and automatically trigger human review when uncertainty spikes.",
        None
    ))

    # Page 16: Part 5.2 (WITH DIAGRAM 5)
    pages.append((
        "Chapter 5: Failure Modes, Safety Guardrails, and Emerging Frontiers",
        f"5.2 Verification Guardrails, Human-in-the-Loop, and Safety Ensembles\n\n"
        f"Production safety requires defense-in-depth: automated output sanitizers, formal rule-based checkers, and mandatory human review gates. "
        f"Every AI recommendation must be auditable, reproducible, and verifiable against established scientific standards.\n\n"
        f"Figure 5.1 outlines the multi-tiered verification guardrails and human-in-the-loop oversight architecture protecting production deployments.",
        {
            "fig_title": f"Figure 5.1: Multi-Tier Verification Guardrails & Safety Architecture for {book}",
            "stages": spec["stages_5"],
            "note": "Safety Architecture: Independent verification layers and mandatory human oversight."
        }
    ))

    # Page 17: Part 5.3
    pages.append((
        "Chapter 5: Failure Modes, Safety Guardrails, and Emerging Frontiers",
        f"5.3 Open Research Questions, Autonomous Agent Swarms, and Future Horizons\n\n"
        f"The frontier of Artificial Intelligence in {field} is shifting from isolated task-specific prediction models to collaborative swarms "
        f"of autonomous scientific agents. These agents formulate novel research hypotheses, design wet-lab experiments, write analysis code, "
        f"and execute multi-step scientific workflows without manual human intervention.\n\n"
        f"Emerging Research Vectors:\n"
        f"• Self-Supervised World Models: Training deep generative models that simulate complex domain dynamics forward in time.\n"
        f"• Neuro-Symbolic Theorem Provers: Combining intuitive Transformer pattern recognition with strict formal logic kernels.\n"
        f"• Zero-Shot Cross-Discipline Transfer: Pre-training foundational scientific models on multimodal data spanning physics, chemistry, and biology.\n\n"
        f"Conclusion: As these models mature, researchers and engineers who master both foundational domain principles and AI engineering "
        f"will lead the next generation of scientific discovery and industrial innovation.",
        None
    ))

    # ── Page 18: Summary & Checklist
    pages.append((
        "Executive Summary and AI Engineering Checklist",
        f"Key Takeaways for AI in {book}:\n\n"
        f"1. Problem Framing: Map domain problems to well-defined mathematical manifolds with explicit inductive biases and symmetry constraints.\n"
        f"2. Architecture Selection: Select architectures tailored to domain geometry (GNNs for graphs, Equivariant nets for 3D physics, Transformers for sequences).\n"
        f"3. Objective Alignment: Formulate composite loss functions coupling data-driven empirical fit with physical conservation laws and regularization.\n"
        f"4. Production Readiness: Optimize serving latency using quantization and speculative decoding while verifying calibrated confidence scores.\n"
        f"5. Safety and Alignment: Implement multi-tiered verification guardrails and human-in-the-loop interlocks to eliminate hallucination risks.\n\n"
        f"AI Engineering Decision Checklist:\n"
        f"[ ] Domain Invariant Check: Does the input tokenization preserve fundamental domain symmetries?\n"
        f"[ ] OOD Uncertainty Gate: Is there an automated fallback when inference inputs diverge from training distributions?\n"
        f"[ ] Latency & Cost Budget: Does the production inference profile satisfy operational SLA requirements?\n"
        f"[ ] Failure Mode Audit: Have catastrophic edge cases and spurious correlations been stress-tested?",
        None
    ))

    # ── Page 19: Diagnostic Review Questions
    pages.append((
        "Diagnostic Assessment and Technical Review Questions",
        f"Test your understanding of Artificial Intelligence applied to {book.lower()}:\n\n"
        f"Question 1: What inductive bias or symmetry property is most critical when designing neural architectures for {book.lower()}, and why?\n"
        f"Analysis: Consider the geometric transformations (e.g. rotation, translation, permutation) under which domain phenomena remain invariant.\n\n"
        f"Question 2: In the loss formulation {spec['loss']}, what is the functional role of the regularization term?\n"
        f"Analysis: Explain how the secondary penalty prevents shortcut learning and forces the optimizer toward physically plausible solutions.\n\n"
        f"Question 3: How does the flagship case study ({spec['sota']}) resolve the trade-off between expressive capacity and computational complexity?\n"
        f"Analysis: Evaluate how techniques like sparse attention, low-rank decomposition, or graph coarsening enable scaling to massive datasets.\n\n"
        f"Question 4: Describe a catastrophic failure mode in this domain and specify the automated guardrail required to detect it before deployment.\n"
        f"Analysis: Formulate a statistical metric or out-of-distribution detector capable of catching silent model failure.\n\n"
        f"Question 5: Why are pure end-to-end black-box models often rejected in production in favor of neuro-symbolic or hybrid pipelines?\n"
        f"Analysis: Contrast empirical pattern recognition with formal safety verification, auditability, and regulatory compliance.",
        None
    ))

    # ── Page 20: Academic References & Repositories
    pages.append((
        "Authoritative Academic Bibliography & Benchmark Repositories",
        f"Primary Academic Literature and Foundational Papers:\n"
        f"1. Vaswani et al. 'Attention Is All You Need.' Advances in Neural Information Processing Systems (NeurIPS).\n"
        f"2. Jumper et al. 'Highly accurate protein structure prediction with AlphaFold.' Nature, 596(7873).\n"
        f"3. Lam et al. 'Learning skillful medium-range global weather forecasting (GraphCast).' Science, 382(6677).\n"
        f"4. Bronstein et al. 'Geometric Deep Learning: Grids, Groups, Graphs, Geodesics, and Gauges.' arXiv:2104.13478.\n"
        f"5. Radford et al. 'Robust Speech Recognition via Large-Scale Weak Supervision.' International Conference on Machine Learning (ICML).\n\n"
        f"Open-Source Repositories, Codebases & Benchmarks:\n"
        f"• HuggingFace Hub: Open-access domain checkpoints, tokenizers, and benchmark leaderboards.\n"
        f"• PyTorch Geometric (PyG) & DGL: Graph neural network implementations for complex relational datasets.\n"
        f"• vLLM & TensorRT-LLM: High-throughput, memory-efficient production inference serving engines.\n"
        f"• Papers With Code: Reproducible benchmarks, model rankings, and official code repositories in {field}.\n\n"
        f"Verification Notice: For high-stakes applications in {field}, always validate AI model predictions against "
        f"certified empirical laboratory standards, formal safety proofs, and authorized domain professionals.",
        None
    ))

    assert len(pages) == 20, f"Expected exactly 20 pages, got {len(pages)}"
    return pages

def escape_rl(text: str) -> str:
    """Escapes XML entities so ReportLab's paraparser handles mathematical comparisons and symbols safely."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")

def draw_page(c: canvas.Canvas, page_no: int, title: str, text: str, is_cover: bool, diagram: dict | None = None) -> None:
    # ── Watermark
    c.setFillColor(Color(0.12, 0.65, 0.85, alpha=0.07))
    c.setFont("Helvetica-Bold", 44)
    c.saveState()
    c.translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
    c.rotate(42)
    c.drawCentredString(0, 0, "AGENTIA")
    c.restoreState()

    # ── Header Banner
    c.setFillColor(HexColor("#D9F8FF"))
    c.rect(0, PAGE_HEIGHT - 16 * mm, PAGE_WIDTH, 16 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#0C1B2A"))
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(18 * mm, PAGE_HEIGHT - 10.5 * mm, "AGENTIA AI BASE KNOWLEDGE")
    c.drawRightString(PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 10.5 * mm, f"Page {page_no} of 20")

    if is_cover:
        # Cover Card
        card_x = 18 * mm
        card_y = 42 * mm
        card_w = PAGE_WIDTH - 36 * mm
        card_h = PAGE_HEIGHT - 94 * mm
        c.setFillColor(HexColor("#06243A"))
        c.roundRect(card_x, card_y, card_w, card_h, 7 * mm, fill=1, stroke=0)

        # Header Pill inside card
        c.setFillColor(HexColor("#74E8F6"))
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(30 * mm, PAGE_HEIGHT - 72 * mm, "AGENTIA AI BASE — TECHNICAL MONOGRAPH")

        # Title
        title_style = ParagraphStyle(
            "cover-title",
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=30,
            textColor=HexColor("#FFFFFF")
        )
        title_block = Paragraph(escape_rl(title), title_style)
        _, title_height = title_block.wrap(card_w - 24 * mm, 120 * mm)
        title_block.drawOn(c, 30 * mm, PAGE_HEIGHT - 95 * mm - title_height)

        # Subtitle / Body
        body_style = ParagraphStyle(
            "cover-body",
            fontName="Helvetica",
            fontSize=11.5,
            leading=18,
            textColor=HexColor("#D6E8F0")
        )
        body_block = Paragraph(escape_rl(text), body_style)
        body_block.wrapOn(c, card_w - 24 * mm, 120 * mm)
        body_block.drawOn(c, 30 * mm, 60 * mm)

    else:
        # Normal Page Title
        c.setFillColor(HexColor("#082F49"))
        c.setFont("Helvetica-Bold", 16)
        c.drawString(18 * mm, PAGE_HEIGHT - 28 * mm, title)

        # Sub-bar under title
        c.setStrokeColor(HexColor("#0EA5E9"))
        c.setLineWidth(1.2)
        c.line(18 * mm, PAGE_HEIGHT - 31 * mm, PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 31 * mm)

        body_style = ParagraphStyle(
            "body",
            fontName="Helvetica",
            fontSize=9.5,
            leading=14.5,
            textColor=HexColor("#172B3A"),
            spaceAfter=6
        )

        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        if diagram:
            # Render first paragraph
            y = PAGE_HEIGHT - 37 * mm
            if len(paragraphs) > 0:
                p0 = Paragraph(escape_rl(paragraphs[0]), body_style)
                _, h0 = p0.wrap(PAGE_WIDTH - 36 * mm, 60 * mm)
                p0.drawOn(c, 18 * mm, y - h0)
                y -= h0 + 5 * mm

            # Draw the academic vector diagram
            diag_h = 32 * mm
            draw_academic_diagram(
                c=c,
                x=18 * mm,
                y=y - diag_h,
                width=PAGE_WIDTH - 36 * mm,
                height=diag_h,
                fig_title=diagram.get("fig_title", "System Architecture Flow"),
                stages=diagram.get("stages", []),
                footer_note=diagram.get("note", "")
            )
            y -= diag_h + 5 * mm

            # Render remaining paragraphs
            for p in paragraphs[1:]:
                block = Paragraph(escape_rl(p), body_style)
                _, h = block.wrap(PAGE_WIDTH - 36 * mm, y - 25 * mm)
                block.drawOn(c, 18 * mm, y - h)
                y -= h + 4 * mm

        else:
            y = PAGE_HEIGHT - 37 * mm
            for p in paragraphs:
                block = Paragraph(escape_rl(p), body_style)
                _, h = block.wrap(PAGE_WIDTH - 36 * mm, y - 22 * mm)
                block.drawOn(c, 18 * mm, y - h)
                y -= h + 5 * mm

    # ── Footer
    c.setStrokeColor(HexColor("#B7D8E2"))
    c.setLineWidth(0.6)
    c.line(18 * mm, 14 * mm, PAGE_WIDTH - 18 * mm, 14 * mm)
    c.setFillColor(HexColor("#42606D"))
    c.setFont("Helvetica", 7.8)
    c.drawString(18 * mm, 9.5 * mm, "AGENTIA AI BASE — Advanced Artificial Intelligence & Scientific Engineering")
    c.drawRightString(PAGE_WIDTH - 18 * mm, 9.5 * mm, f"{page_no}")
    c.showPage()

def main() -> None:
    start_time = time.time()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    API_OUTPUT.mkdir(parents=True, exist_ok=True)
    catalog = []

    print(f"Starting generation of {len(FIELDS)} fields x 5 books = 120 books (2,400 pages total)...")

    for field_slug, field_title, books in FIELDS:
        field_dir = OUTPUT / field_slug
        field_dir.mkdir(parents=True, exist_ok=True)
        api_dir = API_OUTPUT / field_slug
        api_dir.mkdir(parents=True, exist_ok=True)

        for number, book in enumerate(books, 1):
            doc_id = f"{field_slug}-{number}"
            filename = f"{number:02d}-{slug(book)}.pdf"
            pdf_path = field_dir / filename
            text_path = api_dir / f"{number:02d}-{slug(book)}.txt"

            pages = build_pages_content(field_title, book)

            # Draw PDF
            c = canvas.Canvas(str(pdf_path), pagesize=A4, title=book, author="AGENTIA")
            for page_no, (p_title, p_text, diag) in enumerate(pages, 1):
                draw_page(c, page_no, p_title, p_text, page_no == 1, diag)
            c.save()

            text_lines = [f"PAGE {i}\n{p_title}\n{p_text}" for i, (p_title, p_text, _) in enumerate(pages, 1)]
            with open(text_path, "w", encoding="utf-8", newline="\n") as f:
                f.write("\n\n".join(text_lines))

            catalog.append({
                "id": doc_id,
                "title": book,
                "category": field_title,
                "categorySlug": field_slug,
                "subtopic": book,
                "description": f"A 20-page AGENTIA technical monograph on Artificial Intelligence applications in {book.lower()}, detailing neural architectures, pipelines, and real-world case studies.",
                "pageCount": 20,
                "status": "Ready",
                "sourceType": "AGENTIA AI Base Knowledge",
                "version": "2.0",
                "filename": filename,
                "url": f"/knowledge/ai-base/{field_slug}/{filename}",
                "textPath": str(text_path.relative_to(ROOT)).replace("\\", "/"),
                "createdAt": "2026-08-29"
            })

        print(f"  [OK] Generated 5 books for {field_title} ({field_slug})")

    CATALOG_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    catalog_json = json.dumps(catalog, indent=2)
    CATALOG_OUTPUT.write_text(catalog_json, encoding="utf-8")
    (API_OUTPUT / "knowledge-catalog.json").write_text(catalog_json, encoding="utf-8")

    elapsed = round(time.time() - start_time, 2)
    print(f"\nSuccessfully generated {len(catalog)} PDFs & TXT files across {len(FIELDS)} categories in {elapsed}s.")

if __name__ == "__main__":
    main()
