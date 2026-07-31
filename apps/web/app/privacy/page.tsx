import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy | AGENTIA",
  description: "Learn how AGENTIA protects your data, privacy, and account security."
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-200">
      <header className="border-b border-[#3A4658]/40 bg-[#0F141C]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to AGENTIA
          </Link>
          <div className="flex items-center gap-2 font-black tracking-tight text-white">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            AGENTIA Privacy Policy
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-[#3A4658]/50 bg-[#151B24] p-8 shadow-2xl md:p-12 space-y-8">
          <div>
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              Effective Date: July 31, 2026
            </span>
            <h1 className="mt-4 text-3xl font-black text-white md:text-4xl tracking-tight">Privacy Policy</h1>
            <p className="mt-3 text-slate-300 text-base leading-relaxed">
              At AGENTIA (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), accessible from <strong className="text-white">https://www.agentia-ai.cloud</strong>, 
              protecting the privacy and security of our users is our top priority. This Privacy Policy outlines how we collect, use, and safeguard your personal information when you use our platform and AI services.
            </p>
          </div>

          <hr className="border-[#3A4658]/40" />

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">1. Information We Collect</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              We collect minimal information necessary to deliver high-performance AI agent workflow services:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300">
              <li><strong className="text-slate-100">Account Credentials:</strong> Email address, display name, and authentication tokens provided when signing in directly or via Google OAuth.</li>
              <li><strong className="text-slate-100">AI Prompt & Workflow Data:</strong> Messages, prompts, and document context submitted to AGENTIA for execution by our AI model engine.</li>
              <li><strong className="text-slate-100">Technical Logs & Usage:</strong> IP address, browser metadata, rate limits, and daily execution credit usage for platform security and quota management.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">2. How We Use Your Information</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Your information is utilized strictly to provide, secure, and optimize AGENTIA services:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300">
              <li>Authenticating user sessions and safeguarding account security.</li>
              <li>Routing AI requests through our secure Groq backend infrastructure.</li>
              <li>Enforcing per-user daily token usage limits and quota credits.</li>
              <li>Improving model response accuracy, latency, and platform uptime.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">3. Data Protection & Security</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              We employ industry-standard encryption protocols (TLS/HTTPS in transit and AES-256 at rest). Sensitive credentials, secret API keys, and private knowledge stores are stored securely on isolated serverless infrastructure and are never exposed to browser clients or unauthorized third parties.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">4. Third-Party Integration</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              AGENTIA integrates with trusted third-party providers including Google OAuth for user authentication and Groq API for high-speed LLM inference. We do not sell, rent, or trade user data to any advertising or data brokers.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">5. Your Rights & Data Deletion</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              You have the right to access, update, or request the deletion of your account data and chat history at any time. To request account deletion or data removal, please contact our support team at <span className="text-cyan-400">zyadkandel295@gmail.com</span>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">6. Contact Us</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              If you have any questions or concerns regarding this Privacy Policy, please reach out to us:
            </p>
            <div className="rounded-xl border border-[#3A4658]/50 bg-[#0F141C] p-4 text-sm text-slate-300">
              <p><strong className="text-white">AGENTIA AI Support</strong></p>
              <p>Email: zyadkandel295@gmail.com</p>
              <p>Website: https://www.agentia-ai.cloud</p>
            </div>
          </section>

          <div className="pt-4 flex justify-between items-center border-t border-[#3A4658]/40">
            <Link href="/terms" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              Read Terms of Service &rarr;
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
