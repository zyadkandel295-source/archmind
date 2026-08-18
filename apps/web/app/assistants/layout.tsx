import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Assistants Workspace & Automation Hub',
  description:
    'Manage, customize, and orchestrate autonomous AI assistants. Configure custom instructions, knowledge retrieval, and automated multi-step workflows.',
  alternates: {
    canonical: '/assistants'
  },
  openGraph: {
    title: 'AI Assistants Workspace | AGÈNTIA',
    description: 'Deploy, chat with, and monitor customized AI assistants.'
  }
};

export default function AssistantsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
