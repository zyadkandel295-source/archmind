import type { ComponentType } from "react";
import { Atom, BookOpen, Brain, Eye, FlaskConical, Library, Network, Sparkles, Terminal, Wrench, Zap } from "lucide-react";

export type ResearchPaper = {
  title: string;
  authors: string;
  year: number;
  venue: string;
  summary: string;
  url: string;
  tags: string[];
};

export type AIBaseSection = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  outcomes: string[];
  formulas: { name: string; expression: string; explanation: string }[];
  papers: ResearchPaper[];
};

export const AI_BASE_SECTIONS: AIBaseSection[] = [
  {
    slug: "fundamentals", title: "AI Fundamentals", eyebrow: "01 · Foundations", icon: Sparkles,
    description: "A structured map of artificial intelligence: representations, learning paradigms, model families, and the questions that define the field.",
    outcomes: ["Differentiate symbolic AI, machine learning, deep learning, and foundation models", "Choose an appropriate learning setup for a real problem", "Reason about data, objectives, generalization, and evaluation"],
    formulas: [{ name: "Expected risk", expression: "R(f) = E₍x,y₎ [ L(f(x), y) ]", explanation: "Training seeks a function whose expected loss is small on the data-generating distribution—not only on the examples seen during training." }],
    papers: [
      { title: "Computing Machinery and Intelligence", authors: "Alan M. Turing", year: 1950, venue: "Mind", summary: "Introduces the imitation game and frames machine intelligence as an experimentally testable question.", url: "https://doi.org/10.1093/mind/LIX.236.433", tags: ["history", "evaluation"] },
      { title: "A Logical Calculus of the Ideas Immanent in Nervous Activity", authors: "W. S. McCulloch · W. Pitts", year: 1943, venue: "Bulletin of Mathematical Biophysics", summary: "A foundational mathematical model showing how networks of simple units can implement logical computation.", url: "https://doi.org/10.1007/BF02478259", tags: ["neural networks", "theory"] },
      { title: "Deep Learning", authors: "Yann LeCun · Yoshua Bengio · Geoffrey Hinton", year: 2015, venue: "Nature", summary: "A landmark overview of representation learning and the architectures powering modern AI.", url: "https://doi.org/10.1038/nature14539", tags: ["survey", "representation"] }
    ]
  },
  {
    slug: "math", title: "Mathematics for AI", eyebrow: "02 · Mathematical toolkit", icon: BookOpen,
    description: "The compact mathematical language behind optimization, uncertainty, geometry, and learning dynamics.",
    outcomes: ["Read vectors, matrices, distributions, and gradients fluently", "Connect an objective function to its optimization update", "Diagnose conditioning, variance, and numerical stability"],
    formulas: [
      { name: "Gradient descent", expression: "θₜ₊₁ = θₜ − η ∇θ L(θₜ)", explanation: "Move parameters opposite the loss gradient; η controls the step size." },
      { name: "Cosine similarity", expression: "cos(θ) = (A · B) / (‖A‖ ‖B‖)", explanation: "Measures orientation rather than magnitude, making it useful for comparing embeddings." },
      { name: "Bayes' rule", expression: "P(A|B) = P(B|A) P(A) / P(B)", explanation: "Updates a prior belief with evidence and a normalizing probability." }
    ],
    papers: [
      { title: "A Survey of Optimization Methods from a Machine Learning Perspective", authors: "S. Sun et al.", year: 2019, venue: "arXiv", summary: "Organizes first-order, second-order, constrained, and adaptive optimization methods used in learning systems.", url: "https://arxiv.org/abs/1909.11893", tags: ["optimization", "survey"] },
      { title: "Adam: A Method for Stochastic Optimization", authors: "D. P. Kingma · J. Ba", year: 2015, venue: "ICLR", summary: "Introduces an adaptive optimizer using running estimates of first and second moments of gradients.", url: "https://arxiv.org/abs/1412.6980", tags: ["optimization", "training"] },
      { title: "Batch Normalization: Accelerating Deep Network Training", authors: "S. Ioffe · C. Szegedy", year: 2015, venue: "ICML", summary: "Normalizes intermediate activations to make deep optimization more stable and faster.", url: "https://arxiv.org/abs/1502.03167", tags: ["normalization", "numerics"] }
    ]
  },
  {
    slug: "machine-learning", title: "Machine Learning", eyebrow: "03 · Algorithms", icon: Wrench,
    description: "A practical and theoretical guide to supervised, unsupervised, and ensemble learning—from objective to deployment.",
    outcomes: ["Select models by task, inductive bias, and data regime", "Explain bias–variance trade-offs and evaluation leakage", "Compare interpretable baselines with high-capacity models"],
    formulas: [
      { name: "Logistic regression", expression: "P(y=1|x) = σ(wᵀx + b)", explanation: "Maps a linear score to a calibrated probability through the sigmoid function." },
      { name: "Gini impurity", expression: "Gini = 1 − Σᵢ pᵢ²", explanation: "Measures class mixing inside a decision-tree node; zero means perfectly pure." },
      { name: "Support-vector margin", expression: "min ½ ‖w‖²  subject to  yᵢ(wᵀxᵢ+b) ≥ 1", explanation: "Finds the widest separating margin while satisfying the training constraints." }
    ],
    papers: [
      { title: "Random Forests", authors: "Leo Breiman", year: 2001, venue: "Machine Learning", summary: "Defines an ensemble of randomized decision trees with strong accuracy and robust generalization.", url: "https://doi.org/10.1023/A:1010933404324", tags: ["ensembles", "trees"] },
      { title: "A Tutorial on Support Vector Machines", authors: "C. J. C. Burges", year: 1998, venue: "Data Mining and Knowledge Discovery", summary: "A clear mathematical treatment of maximum-margin classification and kernel methods.", url: "https://doi.org/10.1023/A:1012454916322", tags: ["kernels", "classification"] },
      { title: "XGBoost: A Scalable Tree Boosting System", authors: "T. Chen · C. Guestrin", year: 2016, venue: "KDD", summary: "Presents a scalable, regularized gradient-boosting system that became a standard tabular baseline.", url: "https://arxiv.org/abs/1603.02754", tags: ["boosting", "systems"] }
    ]
  },
  {
    slug: "deep-learning", title: "Deep Learning", eyebrow: "04 · Representation learning", icon: Brain,
    description: "How layered differentiable programs learn features, dynamics, and generative distributions from data.",
    outcomes: ["Trace forward and backward passes through common architectures", "Understand convolution, recurrence, residual paths, and latent variables", "Diagnose vanishing gradients, overfitting, and mode collapse"],
    formulas: [
      { name: "Backpropagation update", expression: "w ← w − η ∂L/∂w", explanation: "Each parameter receives a local derivative of the loss and is updated by gradient descent." },
      { name: "VAE evidence lower bound", expression: "ELBO = E_q[log p(x|z)] − KL(q(z|x) ‖ p(z))", explanation: "Balances faithful reconstruction with a latent distribution close to a prior." },
      { name: "GAN objective", expression: "min_G max_D  E[log D(x)] + E[log(1 − D(G(z)))]", explanation: "A generator and discriminator play a minimax game until generated and real samples become difficult to distinguish." }
    ],
    papers: [
      { title: "Deep Residual Learning for Image Recognition", authors: "K. He · X. Zhang · S. Ren · J. Sun", year: 2015, venue: "CVPR", summary: "Introduces residual skip connections, enabling much deeper networks to optimize reliably.", url: "https://arxiv.org/abs/1512.03385", tags: ["ResNet", "vision"] },
      { title: "Generative Adversarial Nets", authors: "I. Goodfellow et al.", year: 2014, venue: "NeurIPS", summary: "Frames generation as a two-player minimax game between a generator and discriminator.", url: "https://arxiv.org/abs/1406.2661", tags: ["generation", "GAN"] },
      { title: "Auto-Encoding Variational Bayes", authors: "D. P. Kingma · M. Welling", year: 2013, venue: "ICLR", summary: "Makes variational inference trainable with stochastic gradient methods and the reparameterization trick.", url: "https://arxiv.org/abs/1312.6114", tags: ["VAE", "probabilistic"] }
    ]
  },
  {
    slug: "llms", title: "LLMs & Transformers", eyebrow: "05 · Foundation models", icon: Zap,
    description: "The architecture, training objective, adaptation methods, and systems ideas behind modern language models.",
    outcomes: ["Explain self-attention, positional information, and autoregressive decoding", "Choose prompting, retrieval, fine-tuning, or preference optimization", "Estimate memory, latency, and quality trade-offs"],
    formulas: [
      { name: "Scaled dot-product attention", expression: "Attention(Q,K,V) = softmax(QKᵀ / √dₖ) V", explanation: "Scores query–key compatibility, normalizes it, and mixes value vectors." },
      { name: "LoRA adaptation", expression: "W′ = W₀ + (α/r) BA", explanation: "Freezes the base matrix and learns a low-rank update, reducing trainable parameters." },
      { name: "Next-token likelihood", expression: "L = − Σₜ log P(xₜ | x₍<t₎)", explanation: "Language models learn by assigning high probability to the next observed token." }
    ],
    papers: [
      { title: "Attention Is All You Need", authors: "A. Vaswani et al.", year: 2017, venue: "NeurIPS", summary: "Introduces the Transformer: parallel self-attention replaces recurrence for sequence modeling.", url: "https://arxiv.org/abs/1706.03762", tags: ["attention", "Transformer"] },
      { title: "BERT: Pre-training of Deep Bidirectional Transformers", authors: "J. Devlin et al.", year: 2018, venue: "NAACL", summary: "Shows that bidirectional masked-language pretraining transfers effectively to many NLP tasks.", url: "https://arxiv.org/abs/1810.04805", tags: ["pretraining", "NLP"] },
      { title: "LoRA: Low-Rank Adaptation of Large Language Models", authors: "E. J. Hu et al.", year: 2021, venue: "ICLR", summary: "Adapts large models with compact low-rank trainable matrices while preserving the base weights.", url: "https://arxiv.org/abs/2106.09685", tags: ["fine-tuning", "efficiency"] }
    ]
  },
  {
    slug: "nlp", title: "NLP & Retrieval", eyebrow: "06 · Language systems", icon: Network,
    description: "Represent language, retrieve evidence, and build grounded systems that expose their sources.",
    outcomes: ["Compare tokenization, embeddings, retrieval, and generation", "Design a citation-aware RAG pipeline", "Evaluate semantic similarity and factuality"],
    formulas: [{ name: "Embedding similarity", expression: "sim(A,B) = (A · B) / (‖A‖ ‖B‖)", explanation: "Nearest-neighbor retrieval often uses cosine similarity to rank semantically related vectors." }],
    papers: [
      { title: "Efficient Estimation of Word Representations in Vector Space", authors: "T. Mikolov et al.", year: 2013, venue: "arXiv", summary: "Introduces efficient word2vec objectives that learn useful distributional representations.", url: "https://arxiv.org/abs/1301.3781", tags: ["embeddings", "word2vec"] },
      { title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", authors: "P. Lewis et al.", year: 2020, venue: "NeurIPS", summary: "Combines a parametric generator with a non-parametric document index to ground answers in retrieved evidence.", url: "https://arxiv.org/abs/2005.11401", tags: ["RAG", "retrieval"] },
      { title: "GloVe: Global Vectors for Word Representation", authors: "J. Pennington · R. Socher · C. Manning", year: 2014, venue: "EMNLP", summary: "Learns word vectors from global co-occurrence statistics and provides strong semantic structure.", url: "https://nlp.stanford.edu/pubs/glove.pdf", tags: ["embeddings", "statistics"] }
    ]
  },
  {
    slug: "computer-vision", title: "Computer Vision", eyebrow: "07 · Perception", icon: Eye,
    description: "From pixels to objects, scenes, and actions: the representations and architectures that power visual intelligence.",
    outcomes: ["Choose between classification, detection, segmentation, and generation", "Understand convolutional and patch-based vision models", "Design evaluation around geometry, calibration, and shift"],
    formulas: [{ name: "2D convolution", expression: "(I * K)(i,j) = Σₘ Σₙ I(i−m, j−n) K(m,n)", explanation: "A learnable kernel scans local neighborhoods to detect reusable visual patterns." }],
    papers: [
      { title: "ImageNet Classification with Deep Convolutional Neural Networks", authors: "A. Krizhevsky · I. Sutskever · G. Hinton", year: 2012, venue: "NeurIPS", summary: "AlexNet demonstrated the impact of GPU-trained deep CNNs on large-scale visual recognition.", url: "https://papers.nips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks", tags: ["CNN", "ImageNet"] },
      { title: "U-Net: Convolutional Networks for Biomedical Image Segmentation", authors: "O. Ronneberger · P. Fischer · T. Brox", year: 2015, venue: "MICCAI", summary: "A symmetric encoder–decoder with skip connections that made precise biomedical segmentation practical.", url: "https://arxiv.org/abs/1505.04597", tags: ["segmentation", "U-Net"] },
      { title: "An Image is Worth 16x16 Words", authors: "A. Dosovitskiy et al.", year: 2020, venue: "ICLR", summary: "Shows that a pure Transformer over image patches can compete with convolutional vision models.", url: "https://arxiv.org/abs/2010.11929", tags: ["ViT", "attention"] }
    ]
  },
  {
    slug: "agents", title: "AI Agents", eyebrow: "08 · Orchestration", icon: Terminal,
    description: "Reasoning loops that observe, plan, call tools, verify results, and maintain useful state over a task.",
    outcomes: ["Separate planning, acting, memory, and verification", "Design safe tool contracts and bounded execution loops", "Measure success beyond a single model response"],
    formulas: [{ name: "ReAct loop", expression: "Thought → Action(tool, input) → Observation → Thought", explanation: "Interleaving reasoning with tool observations lets an agent adapt its plan to the world." }],
    papers: [
      { title: "ReAct: Synergizing Reasoning and Acting in Language Models", authors: "S. Yao et al.", year: 2022, venue: "ICLR", summary: "Interleaves verbal reasoning traces and actions so models can use external environments and tools.", url: "https://arxiv.org/abs/2210.03629", tags: ["reasoning", "tools"] },
      { title: "Toolformer: Language Models Can Teach Themselves to Use Tools", authors: "T. Schick et al.", year: 2023, venue: "NeurIPS", summary: "Shows how language models can learn when and how to call APIs such as calculators and search.", url: "https://arxiv.org/abs/2302.04761", tags: ["tool use", "self-supervision"] },
      { title: "Generative Agents: Interactive Simulacra of Human Behavior", authors: "J. S. Park et al.", year: 2023, venue: "UIST", summary: "Combines memory, reflection, and planning to produce believable long-horizon behavior in a simulated world.", url: "https://arxiv.org/abs/2304.03442", tags: ["memory", "simulation"] }
    ]
  },
  {
    slug: "science", title: "AI in Science", eyebrow: "09 · Discovery", icon: Atom,
    description: "How learned representations accelerate scientific inference while preserving uncertainty, provenance, and experimental validation.",
    outcomes: ["Match scientific questions to prediction, inverse problems, or simulation", "Track uncertainty and data provenance", "Distinguish benchmark gains from scientific evidence"],
    formulas: [{ name: "Bayesian posterior", expression: "p(θ|D) ∝ p(D|θ) p(θ)", explanation: "Combines a scientific prior with observed data to quantify uncertainty over hypotheses." }],
    papers: [
      { title: "Highly Accurate Protein Structure Prediction with AlphaFold", authors: "J. Jumper et al.", year: 2021, venue: "Nature", summary: "AlphaFold2 predicts protein structures with accuracy close to experimental methods across a benchmark of targets.", url: "https://doi.org/10.1038/s41586-021-03819-2", tags: ["biology", "structure"] },
      { title: "FourCastNet: A Global Data-driven High-resolution Weather Model", authors: "J. Pathak et al.", year: 2022, venue: "arXiv", summary: "Uses neural operators to provide fast, high-resolution global weather forecasting.", url: "https://arxiv.org/abs/2202.11214", tags: ["climate", "forecasting"] },
      { title: "A Deep Learning Approach to Antibiotic Discovery", authors: "J. M. Stokes et al.", year: 2020, venue: "Cell", summary: "Demonstrates a neural screening workflow that identified a structurally novel antibiotic candidate.", url: "https://doi.org/10.1016/j.cell.2020.01.021", tags: ["drug discovery", "biology"] }
    ]
  },
  {
    slug: "research", title: "Research Library", eyebrow: "10 · Literature desk", icon: Library,
    description: "A curated reading room connecting methods, evidence, datasets, and open questions across the AI stack.",
    outcomes: ["Start with canonical papers and follow their citation graph", "Extract claims, methods, data, and limitations", "Turn a reading list into an actionable research brief"],
    formulas: [{ name: "Evidence-weighted claim", expression: "Confidence ∝ quality × relevance × reproducibility", explanation: "A useful research summary weighs evidence quality and applicability—not citation count alone." }],
    papers: [
      { title: "Attention Is All You Need", authors: "A. Vaswani et al.", year: 2017, venue: "NeurIPS", summary: "The architectural starting point for the modern Transformer and most large language models.", url: "https://arxiv.org/abs/1706.03762", tags: ["canonical", "Transformer"] },
      { title: "Deep Residual Learning for Image Recognition", authors: "K. He et al.", year: 2015, venue: "CVPR", summary: "A canonical example of an architectural idea—residual learning—changing the optimization landscape.", url: "https://arxiv.org/abs/1512.03385", tags: ["canonical", "vision"] },
      { title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", authors: "P. Lewis et al.", year: 2020, venue: "NeurIPS", summary: "A canonical grounding pattern for systems that need current or inspectable knowledge.", url: "https://arxiv.org/abs/2005.11401", tags: ["canonical", "RAG"] }
    ]
  },
  {
    slug: "build", title: "Build AI Systems", eyebrow: "11 · Engineering", icon: FlaskConical,
    description: "Translate research ideas into reliable products with retrieval, evaluation, observability, and safe deployment.",
    outcomes: ["Define an evaluation set before tuning a model", "Choose between prompting, RAG, adapters, and full fine-tuning", "Ship with latency, cost, privacy, and failure monitoring"],
    formulas: [{ name: "Expected production cost", expression: "Cost = requests × (input tokens + output tokens) × unit price", explanation: "Simple cost accounting makes architecture trade-offs visible before a system reaches production." }],
    papers: [
      { title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", authors: "P. Lewis et al.", year: 2020, venue: "NeurIPS", summary: "Provides a principled blueprint for grounding generation in an editable external corpus.", url: "https://arxiv.org/abs/2005.11401", tags: ["RAG", "production"] },
      { title: "LoRA: Low-Rank Adaptation of Large Language Models", authors: "E. J. Hu et al.", year: 2021, venue: "ICLR", summary: "A practical route to domain adaptation when full model fine-tuning is too expensive.", url: "https://arxiv.org/abs/2106.09685", tags: ["adaptation", "efficiency"] },
      { title: "Hidden Technical Debt in Machine Learning Systems", authors: "D. Sculley et al.", year: 2015, venue: "NeurIPS", summary: "Explains why data dependencies, feedback loops, and operational glue dominate long-term ML system risk.", url: "https://papers.nips.cc/paper/5656-hidden-technical-debt-in-machine-learning-systems", tags: ["MLOps", "reliability"] }
    ]
  }
];

export function getAIBaseSection(slug: string) {
  return AI_BASE_SECTIONS.find((section) => section.slug === slug);
}
