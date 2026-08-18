import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Base - Technical AI Knowledge, Research & Engineering Hub',
  description:
    'Comprehensive technical knowledge base and interactive textbook covering AI fundamentals, machine learning, deep learning, LLMs, computer vision, NLP, autonomous agents, math, and AI for science.',
  keywords: [
    'AI Base',
    'AI Research',
    'Machine Learning textbook',
    'Deep Learning tutorials',
    'Transformer architecture',
    'LLM engineering',
    'AI for Science',
    'AlphaFold',
    'PyTorch',
    'Neural Networks'
  ],
  alternates: {
    canonical: '/ai-base'
  },
  openGraph: {
    title: 'AI Base | AGÈNTIA Technical AI Hub',
    description:
      'Learn, research, build, and deploy Artificial Intelligence from fundamentals to state-of-the-art architectures.',
    url: 'https://agentia.ai/ai-base',
    type: 'article'
  }
};

export default function AIBaseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
