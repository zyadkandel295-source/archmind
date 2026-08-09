import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { Wrench, CheckCircle2, AlertTriangle, Code } from "lucide-react";

export const metadata = {
  title: "Machine Learning Algorithms | AGENTIA AI BASE",
  description: "Linear/Logistic Regression, Decision Trees, Random Forests, SVM, k-NN, PCA, XGBoost, Reinforcement Learning."
};

export default function MachineLearningPage() {
  const algorithms = [
    { title: "Linear & Logistic Regression", math: "P(y=1|x) = sigmoid(w^T x + b)", complexity: "O(N * D)", failure: "Fails on non-linear decision boundaries without polynomial features." },
    { title: "Decision Trees & Random Forests", math: "Gini = 1 - sum(p_i^2)", complexity: "O(N * log N * D)", failure: "Individual trees overfit; Random Forests require high memory for large ensembles." },
    { title: "Support Vector Machines (SVM)", math: "min 0.5||w||^2 s.t. y_i(w^T x_i + b) >= 1", complexity: "O(N^2 * D)", failure: "Quadratic complexity in sample size N renders it unusable on massive datasets." },
    { title: "Gradient Boosting & XGBoost", math: "F_m(x) = F_{m-1}(x) + argmin sum(L(y, F_{m-1} + h))", complexity: "O(M * N * D)", failure: "Sensitive to hyperparameter tuning (learning rate, subsample ratio)." },
    { title: "k-Nearest Neighbors (k-NN)", math: "d(p,q) = sqrt(sum((p_i - q_i)^2))", complexity: "O(N * D) per query", failure: "Curse of dimensionality causes distance metrics to become uniform." },
    { title: "Principal Component Analysis (PCA)", math: "Cov(X) = (1/N) X^T X", complexity: "O(D^3) covariance decomposition", failure: "Captures only linear variance projections; misses complex manifold structures." }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono font-bold mb-2">
            <Wrench className="w-4 h-4" />
            SECTION 03
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Machine Learning Algorithms & Formulations
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Technical breakdowns of classic supervised and unsupervised algorithms: Mathematical formulations, pseudocode, time/space complexity, and common failure modes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {algorithms.map((a, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 hover:border-indigo-500/50 transition-all">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block">
                ALGORITHM 0{idx + 1}
              </span>
              <h3 className="text-sm font-bold text-slate-100">{a.title}</h3>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300">
                <span className="text-[10px] text-slate-500 block mb-1 font-sans font-bold">Formulation:</span>
                {a.math}
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-slate-400">Complexity: <span className="font-mono text-slate-200">{a.complexity}</span></div>
                <div className="text-rose-300/90 text-[11px] leading-tight flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{a.failure}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
