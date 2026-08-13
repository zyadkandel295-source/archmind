export interface EquationDetail {
  equation: string;
  latexName: string;
  variableBreakdown: { variable: string; meaning: string }[];
  whyItExists: string;
  howDerived: string;
  numericalExample: { input: string; stepByStep: string; output: string };
  pythonCode: string;
}

export interface AIBaseArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: "fundamentals" | "math" | "ml" | "deep-learning" | "llms" | "cv" | "nlp" | "agents" | "build";
  difficulty: "beginner" | "intermediate" | "advanced";
  overview: string;
  intuition: string;
  mathematicalFormulation: EquationDetail[];
  architecture?: string;
  algorithm?: string;
  pseudocode?: string;
  pythonImplementation?: string;
  bashCommands?: { command: string; explanation: string }[];
  complexity?: { time: string; space: string };
  failureModes?: string[];
  realWorldApplications?: string[];
  researchDirections?: string[];
}

export interface ScienceCategory {
  domain: string;
  title: string;
  overview: string;
  keyAlgorithms: string[];
  modelsUsed: string[];
  datasets: string[];
  workflows: { step: number; title: string; description: string }[];
  breakthroughs: string[];
  openProblems: string[];
}

export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  arxivId?: string;
  doi?: string;
  abstract: string;
  category: string;
  methodology: string;
  equations: string[];
  dataset: string;
  model: string;
  mainResult: string;
  limitations: string;
  codeUrl?: string;
}

export interface TimelineEvent {
  year: string;
  title: string;
  category: string;
  description: string;
  significance: string;
  keyPaperTitle?: string;
}

export class AIBaseService {

  // ─── ARTICLES DATABASE ──────────────────────
  getArticles(category?: string): AIBaseArticle[] {
    const articles: AIBaseArticle[] = [
      {
        id: "art-linear-regression",
        slug: "linear-regression-from-scratch",
        title: "Linear Regression & Gradient Descent",
        subtitle: "Mathematical formulation, closed-form ordinary least squares, and iterative optimization",
        category: "math",
        difficulty: "beginner",
        overview: "Linear regression models linear relationships between input features X and continuous target variable y by finding optimal weight vector w and bias b.",
        intuition: "Fits a hyper-dimensional plane through data points that minimizes the sum of squared vertical distances (residuals) from each point to the plane.",
        mathematicalFormulation: [
          {
            equation: "y = Xw + b",
            latexName: "Linear Model Hypothesis",
            variableBreakdown: [
              { variable: "y", meaning: "Target vector of dimensions (N, 1)" },
              { variable: "X", meaning: "Design matrix of input features of shape (N, D)" },
              { variable: "w", meaning: "Weight vector of shape (D, 1) representing feature coefficients" },
              { variable: "b", meaning: "Bias term (scalar scalar intercept)" }
            ],
            whyItExists: "Represents linear mapping from input vector space to target output space.",
            howDerived: "Derived from first-order Taylor expansion approximation of arbitrary smooth continuous target functions.",
            numericalExample: {
              input: "X = [[1, 2], [2, 3]], y = [5, 8], w = [1, 1], b = 1",
              stepByStep: "For point 1: y1_pred = (1*1 + 2*1) + 1 = 4. Error = 5 - 4 = 1.\nFor point 2: y2_pred = (2*1 + 3*1) + 1 = 6. Error = 8 - 6 = 2.",
              output: "Predicted y = [4, 6], Mean Squared Error = (1^2 + 2^2) / 2 = 2.5"
            },
            pythonCode: "import numpy as np\ndef predict(X, w, b):\n    return np.dot(X, w) + b"
          },
          {
            equation: "L(w,b) = \\frac{1}{2N} \\sum_{i=1}^{N} (y_i - (x_i^T w + b))^2",
            latexName: "Mean Squared Error (MSE) Loss Function",
            variableBreakdown: [
              { variable: "L(w,b)", meaning: "Scalar loss metric to minimize" },
              { variable: "N", meaning: "Total number of sample observations" },
              { variable: "y_i", meaning: "Actual target value for observation i" },
              { variable: "x_i^T w + b", meaning: "Predicted model output for observation i" }
            ],
            whyItExists: "Measures model discrepancy; squaring penalizes large outliers heavily and provides smooth convex gradients.",
            howDerived: "Assumes Gaussian additive noise y = Xw + b + epsilon where epsilon ~ N(0, sigma^2), maximizing log likelihood yields MSE.",
            numericalExample: {
              input: "N=2, Errors = [1.0, 2.0]",
              stepByStep: "Loss = 1 / (2 * 2) * (1.0^2 + 2.0^2) = 0.25 * (1 + 4) = 1.25",
              output: "MSE Loss = 1.25"
            },
            pythonCode: "def mse_loss(y_true, y_pred):\n    return np.mean((y_true - y_pred) ** 2) / 2.0"
          },
          {
            equation: "\\theta_{t+1} = \\theta_t - \\eta \\nabla_{\\theta} L(\\theta_t)",
            latexName: "Gradient Descent Parameter Update Rule",
            variableBreakdown: [
              { variable: "\\theta_{t+1}", meaning: "Updated model parameters at iteration t+1" },
              { variable: "\\theta_t", meaning: "Current model parameters at iteration t" },
              { variable: "\\eta", meaning: "Learning rate step hyperparameter" },
              { variable: "\\nabla_{\\theta} L(\\theta_t)", meaning: "Gradient vector of Loss with respect to parameters theta" }
            ],
            whyItExists: "Iteratively steps parameters in steepest descent direction towards local or global loss minimum.",
            howDerived: "Follows negative gradient vector derived from multivariable calculus partial derivatives.",
            numericalExample: {
              input: "theta_t = 3.0, learning rate eta = 0.1, gradient grad = 4.0",
              stepByStep: "theta_next = 3.0 - 0.1 * (4.0) = 3.0 - 0.4 = 2.6",
              output: "Updated theta_t+1 = 2.6"
            },
            pythonCode: "def update_weights(w, b, dw, db, lr):\n    w = w - lr * dw\n    b = b - lr * db\n    return w, b"
          }
        ],
        architecture: "Single linear projection layer with identity activation function.",
        algorithm: "Gradient Descent Optimization algorithm",
        pseudocode: "Initialize w, b\nFor epoch in 1..num_epochs:\n   y_pred = X @ w + b\n   error = y_pred - y\n   dw = (1/N) * X.T @ error\n   db = (1/N) * sum(error)\n   w = w - lr * dw\n   b = b - lr * db",
        pythonImplementation: `import numpy as np

class LinearRegressionScratch:
    def __init__(self, lr=0.01, epochs=1000):
        self.lr = lr
        self.epochs = epochs
        self.w = None
        self.b = None

    def fit(self, X, y):
        n_samples, n_features = X.shape
        self.w = np.zeros(n_features)
        self.b = 0.0

        for _ in range(self.epochs):
            y_pred = np.dot(X, self.w) + self.b
            dw = (1 / n_samples) * np.dot(X.T, (y_pred - y))
            db = (1 / n_samples) * np.sum(y_pred - y)

            self.w -= self.lr * dw
            self.b -= self.lr * db

    def predict(self, X):
        return np.dot(X, self.w) + self.b`,
        bashCommands: [
          { command: "pip install numpy matplotlib scikit-learn", explanation: "Installs core numerical linear algebra and benchmark libraries." },
          { command: "python -c 'import numpy as np; print(np.__version__)'", explanation: "Verifies numpy runtime installation." }
        ],
        complexity: { time: "O(N * D) per iteration", space: "O(D) memory" },
        failureModes: [
          "Multicollinearity: Highly correlated features cause singular non-invertible design matrix X^T X.",
          "Outlier Sensitivity: Squaring error terms gives disproportionate weight to extreme outliers.",
          "Feature Scale Instability: Gradient descent fails or oscillates if features are on vastly different scales."
        ],
        realWorldApplications: [
          "Financial Asset Pricing (Capital Asset Pricing Model - CAPM)",
          "Housing & Real Estate Price Valuation",
          "Medical Biomarker & Age Progression Estimation"
        ],
        researchDirections: [
          "Sparse Lasso Regularization (L1 penalty) for high-dimensional genomic feature selection.",
          "Quantile Regression for predicting non-symmetric uncertainty bounds."
        ]
      },
      {
        id: "art-transformers-attention",
        slug: "transformers-and-self-attention",
        title: "Transformers & Scaled Dot-Product Attention",
        subtitle: "Mathematical breakdown of Q, K, V projections, multi-head attention, and causal masking",
        category: "llms",
        difficulty: "advanced",
        overview: "The Transformer architecture relies on self-attention mechanisms to model contextual dependencies across arbitrary sequence lengths without recurrent step constraints.",
        intuition: "Each token queries every other token in the input sequence, computing affinity scores that dictate how much contextual representation to aggregate from other positions.",
        mathematicalFormulation: [
          {
            equation: "\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V",
            latexName: "Scaled Dot-Product Attention Formula",
            variableBreakdown: [
              { variable: "Q", meaning: "Query matrix of shape (Seq_len, d_k)" },
              { variable: "K", meaning: "Key matrix of shape (Seq_len, d_k)" },
              { variable: "V", meaning: "Value matrix of shape (Seq_len, d_v)" },
              { variable: "d_k", meaning: "Dimension of key vectors used for scaling variance" },
              { variable: "\\text{softmax}", meaning: "Row-wise softmax activation normalizing attention weights to sum to 1" }
            ],
            whyItExists: "Allows sequence elements to dynamically attend to every other element proportional to pairwise dot-product alignment.",
            howDerived: "Dot product QK^T measures inner-product similarity. Dividing by sqrt(d_k) keeps variance at 1, preventing softmax gradients from vanishing for large dimension sizes.",
            numericalExample: {
              input: "Q = [[1, 0]], K = [[1, 0], [0, 1]], V = [[10, 20], [30, 40]], d_k = 2",
              stepByStep: "1. QK^T = [[1*1 + 0*0, 1*0 + 0*1]] = [[1, 0]].\n2. Scale by sqrt(2)=1.414 -> [[0.707, 0]].\n3. Softmax([0.707, 0]) = [0.67, 0.33].\n4. Multiply V: 0.67*[10, 20] + 0.33*[30, 40] = [6.7+9.9, 13.4+13.2] = [16.6, 26.6].",
              output: "Attended Representation = [[16.6, 26.6]]"
            },
            pythonCode: "import torch\nimport torch.nn.functional as F\n\ndef scaled_dot_product_attention(Q, K, V, mask=None):\n    d_k = Q.size(-1)\n    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d_k ** 0.5)\n    if mask is not None:\n        scores = scores.masked_fill(mask == 0, -1e9)\n    attn_weights = F.softmax(scores, dim=-1)\n    return torch.matmul(attn_weights, V), attn_weights"
          }
        ],
        architecture: "Multi-Head Attention -> LayerNorm -> FeedForward (MLP) -> LayerNorm with Residual Connections",
        algorithm: "Autoregressive Next-Token Generation",
        pseudocode: "For each token in prompt:\n  Project X into Q, K, V\n  Compute Attention(Q, K, V)\n  Pass through Residual & LayerNorm\n  Pass through FFN & LayerNorm\n  Output logits over vocabulary space",
        pythonImplementation: `import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model=512, n_heads=8):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads

        self.q_proj = nn.Linear(d_model, d_model)
        self.k_proj = nn.Linear(d_model, d_model)
        self.v_proj = nn.Linear(d_model, d_model)
        self.out_proj = nn.Linear(d_model, d_model)

    def forward(self, x, mask=None):
        batch_size, seq_len, _ = x.shape
        Q = self.q_proj(x).view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)
        K = self.k_proj(x).view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)
        V = self.v_proj(x).view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.head_dim ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        attn = F.softmax(scores, dim=-1)
        out = torch.matmul(attn, V).transpose(1, 2).contiguous().view(batch_size, seq_len, self.d_model)
        return self.out_proj(out)`,
        bashCommands: [
          { command: "pip install torch transformers datasets accelerate", explanation: "Installs PyTorch and Hugging Face ecosystem for transformer modeling." }
        ],
        complexity: { time: "O(Seq_len^2 * d_model)", space: "O(Seq_len^2) attention matrix" },
        failureModes: [
          "Quadratic Context Complexity: O(N^2) memory footprint limits context window size without KV caching or flash attention.",
          "Hallucination under Out-of-Distribution Inputs: Autoregressive sampling lacks explicit factual verification bounds."
        ],
        realWorldApplications: [
          "Large Language Models (GPT-4, Claude, LLaMA, PHOENIX)",
          "Code Synthesis & Refactoring Engines",
          "Multimodal Vision-Language Models (CLIP, LLaVA)"
        ],
        researchDirections: [
          "FlashAttention-3: Hardware-aware kernel optimization bypassing HBM memory transfer bottlenecks.",
          "State Space Models (Mamba) & Linear Attention for infinite context execution."
        ]
      },
      {
        id: "art-backpropagation",
        slug: "backpropagation-and-chain-rule",
        title: "Backpropagation & Vector Calculus Chain Rule",
        subtitle: "Mathematical derivation of error gradient propagation across deep neural network layers",
        category: "deep-learning",
        difficulty: "intermediate",
        overview: "Backpropagation computes partial derivatives of loss with respect to every weight parameter in a neural network using reverse-mode automatic differentiation.",
        intuition: "Tells every single neuron in a complex network exactly how much it contributed to the final output error, so it can adjust its weight parameter.",
        mathematicalFormulation: [
          {
            equation: "\\frac{\\partial L}{\\partial W^{(l)}} = \\delta^{(l)} (a^{(l-1)})^T",
            latexName: "Layer Weight Gradient Equation",
            variableBreakdown: [
              { variable: "\\frac{\\partial L}{\\partial W^{(l)}}", meaning: "Gradient matrix for weights at layer l" },
              { variable: "\\delta^{(l)}", meaning: "Delta error vector for layer l: delta^{(l)} = \\frac{\\partial L}{\\partial z^{(l)}}" },
              { variable: "a^{(l-1)}", meaning: "Activation vector output from previous layer l-1" }
            ],
            whyItExists: "Provides exact weight update step needed for stochastic gradient descent.",
            howDerived: "Derived via multivariate chain rule: dL/dW = (dL/dz) * (dz/dW) where dz/dW = a_prev.",
            numericalExample: {
              input: "delta = [0.5, -0.2], a_prev = [1.0, 2.0]",
              stepByStep: "Outer product: [[0.5*1.0, 0.5*2.0], [-0.2*1.0, -0.2*2.0]] = [[0.5, 1.0], [-0.2, -0.4]]",
              output: "Weight Gradient Matrix dL/dW = [[0.5, 1.0], [-0.2, -0.4]]"
            },
            pythonCode: "def backward(self, delta_next, a_prev):\n    self.dW = np.outer(delta_next, a_prev)\n    self.db = delta_next\n    return np.dot(self.W.T, delta_next) * self.activation_derivative(a_prev)"
          }
        ],
        architecture: "Dense Multi-Layer Perceptron (MLP) with Sigmoid / ReLU activation",
        algorithm: "Reverse-mode Automatic Differentiation",
        pseudocode: "Forward Pass: compute z = Wx + b, a = f(z)\nCompute Output Loss Error delta_L = dL/da * f'(z)\nFor layer l = L-1 down to 1:\n   dW[l] = delta[l] @ a[l-1].T\n   delta[l-1] = (W[l].T @ delta[l]) * f'(z[l-1])",
        pythonImplementation: `import numpy as np

def relu(z): return np.maximum(0, z)
def relu_prime(z): return (z > 0).astype(float)

class SimpleMLP:
    def __init__(self, d_in, d_hidden, d_out):
        self.W1 = np.random.randn(d_hidden, d_in) * 0.01
        self.b1 = np.zeros((d_hidden, 1))
        self.W2 = np.random.randn(d_out, d_hidden) * 0.01
        self.b2 = np.zeros((d_out, 1))

    def forward(self, x):
        self.z1 = np.dot(self.W1, x) + self.b1
        self.a1 = relu(self.z1)
        self.z2 = np.dot(self.W2, self.a1) + self.b2
        self.a2 = self.z2
        return self.a2

    def backward(self, x, y, y_pred):
        m = x.shape[1]
        dz2 = y_pred - y
        dW2 = (1/m) * np.dot(dz2, self.a1.T)
        db2 = (1/m) * np.sum(dz2, axis=1, keepdims=True)

        da1 = np.dot(self.W2.T, dz2)
        dz1 = da1 * relu_prime(self.z1)
        dW1 = (1/m) * np.dot(dz1, x.T)
        db1 = (1/m) * np.sum(dz1, axis=1, keepdims=True)

        return dW1, db1, dW2, db2`,
        bashCommands: [
          { command: "python -c 'import torch; x=torch.tensor([2.0], requires_grad=True); y=x**2; y.backward(); print(x.grad)'", explanation: "Verifies PyTorch autograd engine computation." }
        ],
        complexity: { time: "O(W) linear in total weights", space: "O(W) activation cache" },
        failureModes: [
          "Vanishing Gradients: Deep Sigmoid/Tanh networks cause gradients to decay exponentially to 0.",
          "Exploding Gradients: Unbounded weight initialization causes gradients to overflow to Inf/NaN."
        ],
        realWorldApplications: [
          "Core optimization engine of PyTorch, TensorFlow, and JAX",
          "Backpropagation Through Time (BPTT) in Sequence Models"
        ],
        researchDirections: [
          "Forward-Forward Algorithm (Hinton): Local contrastive learning replacing backward error passes.",
          "Direct Feedback Alignment (DFA): Asymmetric random weight projection for parallel gradient propagation."
        ]
      },
      {
        id: "art-agent-react",
        slug: "ai-agents-react-architecture",
        title: "AI Agent ReAct & Autonomous Execution Loops",
        subtitle: "Reasoning + Acting execution loop with dynamic tool selection and reflection",
        category: "agents",
        difficulty: "intermediate",
        overview: "ReAct (Reason + Act) combines chain-of-thought reasoning with tool interaction loops, allowing LLMs to observe environment state, plan actions, invoke external APIs, and iterate.",
        intuition: "Instead of guessing answers, the agent acts like a human researcher: thinks about what tool to use, calls the tool, reads the result, and refines its next thought.",
        mathematicalFormulation: [
          {
            equation: "\\text{Step}_t = \\text{LLM}(\\text{Prompt} + \\sum_{i=1}^{t-1} [T_i, A_i, O_i])",
            latexName: "Agent State Transition Equation",
            variableBreakdown: [
              { variable: "T_i", meaning: "Thought generated at step i" },
              { variable: "A_i", meaning: "Action (tool name & input arguments) selected at step i" },
              { variable: "O_i", meaning: "Observation returned by external tool execution at step i" }
            ],
            whyItExists: "Maintains full state history context across iterative tool interaction turns.",
            howDerived: "Derived from Markov Decision Process (MDP) observation-action loop formulation.",
            numericalExample: {
              input: "Goal: 'Get stock price of AAPL and convert to EUR'",
              stepByStep: "Thought 1: 'I need to fetch AAPL price.' Action 1: get_stock('AAPL') -> Observation 1: '$220 USD'.\nThought 2: 'Now I convert $220 USD to EUR.' Action 2: convert_currency(220, 'USD', 'EUR') -> Observation 2: '201.5 EUR'.",
              output: "Final Answer: 'AAPL stock price is 201.5 EUR.'"
            },
            pythonCode: "def agent_step(history, tools):\n    prompt = format_react_prompt(history, tools)\n    response = llm.generate(prompt)\n    thought, action, args = parse_react_output(response)\n    return thought, action, args"
          }
        ],
        architecture: "LLM Orchestrator -> Tool Registry -> Execution Sandbox -> Memory State Store",
        algorithm: "ReAct Iterative Agent Loop",
        pseudocode: "while not completed and step < max_steps:\n   thought = llm.reason(history)\n   action, args = llm.decide_action(thought)\n   if action == 'final_answer':\n       return args\n   observation = execute_tool(action, args)\n   history.append(thought, action, observation)",
        pythonImplementation: `class ReActAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = {t.name: t for t in tools}

    def run(self, user_goal, max_steps=10):
        history = [f"Goal: {user_goal}"]
        for step in range(max_steps):
            prompt = "\\n".join(history) + "\\nThought:"
            response = self.llm.generate(prompt)

            if "Final Answer:" in response:
                return response.split("Final Answer:")[1].strip()

            tool_name, tool_input = self.parse_action(response)
            if tool_name in self.tools:
                obs = self.tools[tool_name].execute(tool_input)
                history.append(f"Thought: {response}\\nObservation: {obs}")
            else:
                history.append(f"Error: Tool {tool_name} not found.")

        return "Task failed to converge within max steps."`,
        bashCommands: [
          { command: "pip install langchain langgraph llama-index", explanation: "Installs agentic tool orchestration frameworks." }
        ],
        complexity: { time: "O(K * T) where K is steps and T is LLM inference latency", space: "O(K * Context_length)" },
        failureModes: [
          "Infinite Agent Loops: ReAct agents can get stuck repeating the same faulty tool call without loop detection.",
          "Tool Argument Misformatting: LLM generates invalid JSON parameters causing tool invocation crashes."
        ],
        realWorldApplications: [
          "Autonomous Coding & Repair Agents (Devin, SWE-bench systems)",
          "Enterprise Automated Support & API Integration Bots",
          "Scientific Workflow Execution & Literature Retrieval Agents"
        ],
        researchDirections: [
          "Multi-Agent Swarm Intelligence (AutoGen, CrewAI): Specialized subagents collaborating with hierarchy.",
          "Reflection & Self-Correction (Reflexion framework): Epistemic self-critique loop."
        ]
      }
    ];

    if (category) {
      return articles.filter((a) => a.category === category);
    }
    return articles;
  }

  getArticleBySlug(slug: string): AIBaseArticle | undefined {
    return this.getArticles().find((a) => a.slug === slug || a.id === slug);
  }

  // ─── AI IN SCIENCE DOMAINS ──────────────────
  getScienceDomains(): ScienceCategory[] {
    return [
      {
        domain: "biology",
        title: "AI + Biology & Structural Genomics",
        overview: "Revolutionizing protein structure prediction, genomic sequence annotation, single-cell transcriptomics, and synthetic biology using deep learning transformers and graph neural networks.",
        keyAlgorithms: ["Evoformer Attention", "Invariant Point Attention (IPA)", "Equivariant Graph Neural Networks (EGNN)", "Protein Language Models (ESM-2)"],
        modelsUsed: ["AlphaFold 2 & AlphaFold 3", "ESMFold", "RFdiffusion", "RoseTTAFold"],
        datasets: ["Protein Data Bank (PDB)", "UniProtKB", "GenBank", "OpenProteinSet"],
        workflows: [
          { step: 1, title: "Sequence Retrieval", description: "Fetch Target Amino Acid sequence from UniProt database." },
          { step: 2, title: "Multiple Sequence Alignment (MSA)", description: "Run HHblits against UniRef90 to build evolutionary co-mutation profile." },
          { step: 3, title: "Evoformer Processing", description: "Pass MSA and pairwise representation through 48 blocks of axial attention." },
          { step: 4, title: "3D Structure Prediction", description: "Predict atomic 3D backbone coordinates and confidence metrics (pLDDT, PAE)." }
        ],
        breakthroughs: [
          "AlphaFold 2 solved 50-year protein folding challenge predicting >200M 3D structures.",
          "RFdiffusion enables de novo functional protein design for target ligand binding."
        ],
        openProblems: [
          "Predicting dynamic protein conformational changes during drug binding.",
          "Modeling complex multi-protein macromolecular interactions."
        ]
      },
      {
        domain: "medicine",
        title: "AI + Medicine & Drug Discovery",
        overview: "Accelerating clinical trial matching, de novo small molecule design, digital pathology, radiological image analysis, and personalized oncology.",
        keyAlgorithms: ["3D Convolutional Segmentation", "Virtual Screening Docking Transformers", "Diffusion Molecule Generation", "Survival Analysis Cox Networks"],
        modelsUsed: ["Med-PaLM 2", "BioNeMo", "DiffDock", "PathOLD"],
        datasets: ["TCGA Cancer Genome", "MIMIC-III EHR Database", "ChEMBL Bioactivity", "PubChem"],
        workflows: [
          { step: 1, title: "Target Identification", description: "Identify disease-causing protein target using genomic differential expression analysis." },
          { step: 2, title: "Virtual Screening", description: "Screen billions of candidate molecules against target binding pocket with DiffDock." },
          { step: 3, title: "Property Optimization", description: "Optimize ADMET properties (Absorption, Distribution, Metabolism, Excretion, Toxicity)." },
          { step: 4, title: "Experimental Synthesis", description: "Generate automated synthesis pathways for wet-lab validation." }
        ],
        breakthroughs: [
          "First AI-designed candidate drugs entered Phase II human clinical trials.",
          "Super-human radiological stroke detection accuracy under 30 seconds."
        ],
        openProblems: [
          "Explainability and safety guarantees for clinical decision support systems.",
          "Out-of-distribution generalization across diverse hospital patient demographics."
        ]
      },
      {
        domain: "climate",
        title: "AI + Climate Science & Meteorology",
        overview: "Predicting extreme weather events, global climate modeling, carbon capture optimization, and renewable energy grid scheduling.",
        keyAlgorithms: ["Spherical Graph Neural Networks", "Fourier Neural Operators (FNO)", "Spatiotemporal Diffusion Models"],
        modelsUsed: ["GraphCast (Google DeepMind)", "FourCastNet (NVIDIA)", "Pangu-Weather (Huawei)", "ClimaX"],
        datasets: ["ERA5 Atmospheric Reanalysis", "NOAA Global Historical Climatology", "CMIP6 Climate Models"],
        workflows: [
          { step: 1, title: "Atmospheric Data Assimilation", description: "Ingest satellite, radar, and weather station measurements onto 0.25-degree spatial grid." },
          { step: 2, title: "Autoregressive Forecasting", description: "Roll out GraphCast GNN for 10-day global weather simulation step-by-step." },
          { step: 3, title: "Extreme Weather Detection", description: "Run anomaly detection classifiers to predict tropical cyclone track and intensity." }
        ],
        breakthroughs: [
          "GraphCast predicts 10-day global weather forecasts in 60 seconds with higher accuracy than ECMWF supercomputers.",
          "AI-optimized renewable energy grid dispatch reduced carbon emissions by 15%."
        ],
        openProblems: [
          "Long-term multi-decadal climate tipping point modeling.",
          "Fusing multi-resolution physical satellite constraints with neural representations."
        ]
      }
    ];
  }

  // ─── RESEARCH PAPERS LIBRARY ────────────────
  getPapers(query?: string): ResearchPaper[] {
    const papers: ResearchPaper[] = [
      {
        id: "paper-attention",
        title: "Attention Is All You Need",
        authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin"],
        year: 2017,
        venue: "NeurIPS 2017",
        arxivId: "1706.03762",
        doi: "10.48550/arXiv.1706.03762",
        abstract: "We propose the Transformer, a model architecture eschewing recurrence and relying entirely on an attention mechanism to draw global dependencies between input and output.",
        category: "LLMs & Transformers",
        methodology: "Replaces recurrent and convolutional layers with Scaled Dot-Product Multi-Head Attention.",
        equations: ["Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V"],
        dataset: "WMT 2014 English-to-German & English-to-French translation datasets",
        model: "Transformer (Base: 65M params, Big: 213M params)",
        mainResult: "Achieved 28.4 BLEU on WMT 2014 Eng-to-Ger, improving over existing state of the art by >2 BLEU with 100x faster training.",
        limitations: "Quadratic memory complexity O(N^2) relative to sequence length N.",
        codeUrl: "https://github.com/tensorflow/tensor2tensor"
      },
      {
        id: "paper-alphafold2",
        title: "Highly accurate protein structure prediction with AlphaFold",
        authors: ["John Jumper", "Richard Evans", "Alexander Pritzel", "Tim Green", "Michael Figurnov", "Olaf Ronneberger", "et al."],
        year: 2021,
        venue: "Nature 596, 583–589 (2021)",
        doi: "10.1038/s41586-021-03819-2",
        abstract: "We present AlphaFold 2, a novel machine learning approach that incorporates physical and biological knowledge about protein structure, leveraging multi-sequence alignments into a deep learning architecture.",
        category: "AI + Science",
        methodology: "Evoformer network combining axial attention over MSA rows and columns with 3D Invariant Point Attention (IPA).",
        equations: ["pLDDT = \\sum_{d} p_d \\cdot \\text{score}(d)"],
        dataset: "Protein Data Bank (PDB) & UniRef90",
        model: "AlphaFold 2 (93M parameters)",
        mainResult: "Achieved median GDT_TS score of 92.4 out of 100 at CASP14 competition, matching experimental X-ray crystallography precision.",
        limitations: "High computational cost for MSA generation on ultra-long sequences.",
        codeUrl: "https://github.com/google-deepmind/alphafold"
      },
      {
        id: "paper-lora",
        title: "LoRA: Low-Rank Adaptation of Large Language Models",
        authors: ["Edward J. Hu", "Yelong Shen", "Phillip Wallis", "Zeyuan Allen-Zhu", "Yuanzhi Li", "Shean Wang", "Lu Wang", "Weizhu Chen"],
        year: 2021,
        venue: "ICLR 2022",
        arxivId: "2106.09685",
        abstract: "We propose Low-Rank Adaptation (LoRA), which freezes pretrained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture.",
        category: "LLMs & Fine-Tuning",
        methodology: "Decomposes weight updates Delta W = B * A where B is (d x r) and A is (r x k) with rank r << min(d, k).",
        equations: ["h = W_0 x + \\Delta W x = W_0 x + \\frac{\\alpha}{r} B A x"],
        dataset: "GLUE, WikiText-103, SQuAD benchmarks",
        model: "GPT-3 175B with LoRA adaptation",
        mainResult: "Reduces trainable parameters by 10,000x and GPU memory requirement by 3x with equal or superior performance to full fine-tuning.",
        limitations: "Cannot easily batch multiple different LoRA adapters in single forward pass without specialized kernels (S-LoRA).",
        codeUrl: "https://github.com/microsoft/LoRA"
      }
    ];

    if (query) {
      const q = query.toLowerCase();
      return papers.filter((p) => p.title.toLowerCase().includes(q) || p.abstract.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return papers;
  }

  // ─── AI TIMELINE ────────────────────────────
  getTimeline(): TimelineEvent[] {
    return [
      { year: "1950", title: "Turing Test Proposed", category: "Fundamentals", description: "Alan Turing publishes 'Computing Machinery and Intelligence' introducing the imitation game.", significance: "Established foundational philosophical question: Can machines think?" },
      { year: "1956", title: "Dartmouth Conference", category: "Fundamentals", description: "John McCarthy coins the term 'Artificial Intelligence' at Dartmouth workshop.", significance: "Birth of AI as a formal academic research discipline." },
      { year: "1986", title: "Backpropagation Popularized", category: "Deep Learning", description: "Rumelhart, Hinton, and Williams publish backpropagation learning for multi-layer neural networks.", significance: "Enabled training of multi-layer perceptrons overcoming Minsky's XOR limitation." },
      { year: "2012", title: "AlexNet Deep Learning Revolution", category: "Computer Vision", description: "Alex Krizhevsky wins ImageNet competition using GPU-trained CNN.", significance: "Catalyzed modern Deep Learning explosion over traditional statistical ML." },
      { year: "2017", title: "Transformer Architecture Introduced", category: "LLMs", description: "Google researchers publish 'Attention Is All You Need'.", significance: "Replaced RNNs and became the backbone for all modern LLMs and Multimodal models." },
      { year: "2020", title: "AlphaFold 2 Solves Protein Structure", category: "AI + Science", description: "DeepMind's AlphaFold 2 achieves atomic accuracy in 3D protein structure prediction at CASP14.", significance: "Major scientific breakthrough solving 50-year grand challenge in biology." },
      { year: "2022", title: "Generative AI & ChatGPT Explosion", category: "Generative AI", description: "OpenAI releases ChatGPT making conversational RLHF alignment accessible globally.", significance: "Shifted AI from academic research to mainstream global enterprise adoption." },
      { year: "2024-2026", title: "Autonomous Agents & Reasoning Breakthroughs", category: "Agents & Science", description: "Introduction of test-time compute reasoning models, autonomous multi-agent swarms, and AI science assistants.", significance: "Transition from simple text generation to autonomous reasoning and scientific discovery." }
    ];
  }

  // ─── GLOBAL AI SEARCH ROUTER ───────────────
  searchKnowledge(query: string) {
    const articles = this.getArticles().filter((a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.overview.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
    );

    const science = this.getScienceDomains().filter((s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.overview.toLowerCase().includes(query.toLowerCase())
    );

    const papers = this.getPapers(query);

    return {
      query,
      resultsCount: articles.length + science.length + papers.length,
      articles,
      science,
      papers
    };
  }

  // ─── AI RESEARCH AGENT SYNTHESIS ───────────
  async runResearchAgent(topic: string) {
    const matchedArticles = this.getArticles().slice(0, 2);
    const matchedPapers = this.getPapers(topic);

    const contextPrompt = `You are the lead AI Research Scientist for AGENTIA AI BASE.
Analyze the following research query: "${topic}".
Knowledge Context Available:
Articles: ${matchedArticles.map((a) => a.title + ": " + a.overview).join("\n")}
Papers: ${matchedPapers.map((p) => p.title + " (" + p.year + "): " + p.abstract).join("\n")}

Produce a structured, rigorous Technical Research Report containing:
1. Executive Summary & Problem Formulation
2. Mathematical Foundations & Core Equations
3. Comparative Analysis of Leading Methodologies
4. Scientific & Real-World Applications
5. Identified Research Gaps & Open Challenges
6. Source Citations & Recommended Further Reading

Maintain extreme technical depth, mathematical accuracy, and clarity.`;

    return {
      topic,
      reportMarkdown: `# Research Report: ${topic}

## 1. Executive Summary
This technical report synthesizes state-of-the-art methodology, mathematical formulations, and empirical findings regarding **${topic}**.

## 2. Mathematical Foundations
Key optimization formulation:
$$\\theta^* = \\arg\\min_{\\theta} \\mathbb{E}_{(x,y) \\sim \\mathcal{D}} [\\mathcal{L}(f_{\\theta}(x), y)]$$

Where $\\mathcal{L}$ represents the empirical task loss function and $f_{\\theta}$ denotes the parametric model projection.

## 3. Comparative Methodologies
- **Transformer Projections**: Scaled dot-product self-attention modeling long-range contextual tokens.
- **Low-Rank Adaptation (LoRA)**: Freezing base parameters and updating rank decomposition matrices $W = W_0 + \\frac{\\alpha}{r}BA$.

## 4. Open Problems & Gaps
1. Reducing quadratic memory footprint $O(N^2)$ for million-token context windows.
2. Formulating strict factual verification bounds for autonomous tool-use agents.

## 5. Citations & References
- Vaswani et al. (2017). *Attention Is All You Need*. NeurIPS.
- Hu et al. (2021). *LoRA: Low-Rank Adaptation of Large Language Models*. ICLR.`,
      retrievedArticles: matchedArticles.map((a) => ({ title: a.title, slug: a.slug })),
      retrievedPapers: matchedPapers.map((p) => ({ title: p.title, year: p.year, arxivId: p.arxivId, doi: p.doi }))
    };
  }
}
