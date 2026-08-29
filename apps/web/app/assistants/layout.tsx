import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Assistants',
  description:
    'Manage, customize, and orchestrate autonomous AI assistants. Configure custom instructions, knowledge retrieval, and automated multi-step workflows.',
  alternates: {
    canonical: '/assistants'
  },
  openGraph: {
    title: 'AGENTIA Assistants',
    description: 'Deploy, chat with, and monitor customized AI assistants.'
  }
};

export default function AssistantsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
