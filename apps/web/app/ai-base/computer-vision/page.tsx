import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { MathFormulaCard } from "@/components/ai-base/math-formula-card";
import { Eye, Layers } from "lucide-react";

export const metadata = {
  title: "Computer Vision | AGENTIA AI BASE",
  description: "Convolutional Neural Networks, Object Detection, Image Segmentation, Vision Transformers, CLIP."
};

export default function ComputerVisionPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold mb-2">
            <Eye className="w-4 h-4" />
            SECTION 06
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Computer Vision & Multimodal Perception
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Image Classification, Object Detection (YOLO, Faster R-CNN), Semantic Segmentation (U-Net), Vision Transformers (ViT), CLIP joint image-text embeddings, and Medical Imaging Analysis.
          </p>
        </div>

        <MathFormulaCard
          equation="(f * g)(x,y) = \sum_{i=-\infty}^{\infty} \sum_{j=-\infty}^{\infty} f(i,j) g(x-i, y-j)"
          latexName="2D Discrete Spatial Convolution Operation"
          variableBreakdown={[
            { variable: "f(i,j)", meaning: "Input image pixel intensity at location (i,j)" },
            { variable: "g(x,y)", meaning: "Convolutional kernel filter weights of size (K_h, K_w)" },
            { variable: "(f * g)(x,y)", meaning: "Output feature map activation at location (x,y)" }
          ]}
          whyItExists="Extracts translation-invariant spatial features (edges, textures, object parts) while sharing parameters across the image grid."
          howDerived="Derived from continuous 2D spatial cross-correlation operator."
          numericalExample={{
            input: "3x3 Image [[1,1,1],[1,1,1],[1,1,1]], 3x3 Edge Filter [[-1,0,1],[-1,0,1],[-1,0,1]]",
            stepByStep: "Sum of element-wise products: (-1*1 + 0*1 + 1*1) * 3 = 0.",
            output: "Feature Output = 0 (Uniform region detected)"
          }}
          pythonCode={`import torch
import torch.nn as nn

conv_layer = nn.Conv2d(in_channels=3, out_channels=16, kernel_size=3, stride=1, padding=1)
output = conv_layer(torch.randn(1, 3, 224, 224))` }
        />
      </main>
    </div>
  );
}
