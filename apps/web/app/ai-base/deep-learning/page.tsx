import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { MathFormulaCard } from "@/components/ai-base/math-formula-card";
import { Brain, Layers, Sparkles } from "lucide-react";

export const metadata = {
  title: "Deep Learning Architectures | AGENTIA AI BASE",
  description: "MLPs, Backpropagation, CNNs, RNNs, LSTMs, VAEs, GANs, Diffusion Models, GNNs, Mixture of Experts."
};

export default function DeepLearningPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-violet-400 text-xs font-mono font-bold mb-2">
            <Brain className="w-4 h-4" />
            SECTION 04
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Deep Learning & Neural Network Architectures
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            From multi-layer perceptrons and automatic backpropagation gradients to Convolutional Networks, Variational Autoencoders, Diffusion Denoising Models, and Mixture of Experts.
          </p>
        </div>

        <MathFormulaCard
          equation="\frac{\partial L}{\partial W^{(l)}} = \delta^{(l)} (a^{(l-1)})^T, \quad \delta^{(l)} = \left(W^{(l+1)T} \delta^{(l+1)}\right) \odot f'(z^{(l)})"
          latexName="Multivariate Backpropagation Chain Rule Equation"
          variableBreakdown={[
            { variable: "\\frac{\\partial L}{\\partial W^{(l)}}", meaning: "Gradient matrix for weights at layer l" },
            { variable: "\\delta^{(l)}", meaning: "Delta error vector for layer l: delta^{(l)} = dL/dz^{(l)}" },
            { variable: "a^{(l-1)}", meaning: "Activation vector output from previous layer l-1" },
            { variable: "\\odot", meaning: "Hadamard element-wise vector product" }
          ]}
          whyItExists="Computes exact partial derivatives of loss with respect to every weight parameter in a deep network."
          howDerived="Derived via multivariate chain rule: dL/dW = (dL/dz) * (dz/dW) where dz/dW = a_prev."
          numericalExample={{
            input: "delta = [0.5, -0.2], a_prev = [1.0, 2.0]",
            stepByStep: "Outer product: [[0.5*1.0, 0.5*2.0], [-0.2*1.0, -0.2*2.0]] = [[0.5, 1.0], [-0.2, -0.4]]",
            output: "Weight Gradient Matrix dL/dW = [[0.5, 1.0], [-0.2, -0.4]]"
          }}
          pythonCode={`import numpy as np

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
        return self.z2`}
        />
      </main>
    </div>
  );
}
