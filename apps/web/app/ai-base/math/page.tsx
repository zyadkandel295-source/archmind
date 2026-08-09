import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { MathFormulaCard } from "@/components/ai-base/math-formula-card";
import { BookOpen, Variable, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Mathematics for AI | AGENTIA AI BASE",
  description: "Linear Algebra, Calculus, Probability, Statistics, Optimization, and Information Theory derivations for AI."
};

export default function MathForAIPage() {
  const mathFormulas = [
    {
      equation: "y = Xw + b",
      latexName: "1. Linear Model Hypothesis",
      variableBreakdown: [
        { variable: "y", meaning: "Target vector of dimensions (N, 1)" },
        { variable: "X", meaning: "Design matrix of input features of shape (N, D)" },
        { variable: "w", meaning: "Weight vector of shape (D, 1) representing feature coefficients" },
        { variable: "b", meaning: "Bias term (scalar intercept)" }
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
      latexName: "2. Mean Squared Error (MSE) Loss Function",
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
      latexName: "3. Gradient Descent Update Rule",
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
    },
    {
      equation: "P(A|B) = \\frac{P(B|A) P(A)}{P(B)}",
      latexName: "4. Bayes' Theorem for Probabilistic Inference",
      variableBreakdown: [
        { variable: "P(A|B)", meaning: "Posterior probability of hypothesis A given observation B" },
        { variable: "P(B|A)", meaning: "Likelihood of observing B given hypothesis A is true" },
        { variable: "P(A)", meaning: "Prior probability of hypothesis A before observing B" },
        { variable: "P(B)", meaning: "Marginal probability of evidence B across all hypotheses" }
      ],
      whyItExists: "Fundamental theorem for updating probability beliefs in light of new evidence.",
      howDerived: "Derived from conditional probability definition: P(A ∩ B) = P(A|B)P(B) = P(B|A)P(A).",
      numericalExample: {
        input: "P(Disease) = 0.01, P(Positive|Disease) = 0.99, P(Positive|No Disease) = 0.05",
        stepByStep: "1. P(Positive) = (0.99 * 0.01) + (0.05 * 0.99) = 0.0099 + 0.0495 = 0.0594.\n2. P(Disease|Positive) = 0.0099 / 0.0594 = 0.1667.",
        output: "Posterior Probability P(Disease|Positive) = 16.67%"
      },
      pythonCode: "def bayes_theorem(prior, likelihood, marginal):\n    return (likelihood * prior) / marginal"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold mb-2">
            <BookOpen className="w-4 h-4" />
            SECTION 02
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Mathematics for Artificial Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Rigorous mathematical foundations covering Linear Algebra, Multivariable Calculus, Probability Distributions, and Optimization. Includes variable breakdowns, derivations, step-by-step numerical examples, and Python code implementations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mathFormulas.map((item, idx) => (
            <MathFormulaCard key={idx} {...item} />
          ))}
        </div>
      </main>
    </div>
  );
}
