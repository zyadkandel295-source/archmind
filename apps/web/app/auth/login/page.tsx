"use client";

import { motion } from "framer-motion";
import { LockKeyhole, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
      <section>
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#93C5FD]">Welcome</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight text-white md:text-6xl">Secure access for every assistant workspace.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            Sign in to manage assistants, knowledge sources, analytics, and deployments from one protected workspace.
          </p>
        </Reveal>
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          animate="visible"
          className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2"
        >
          {[
            { icon: ShieldCheck, label: "Protected workspace" },
            { icon: Zap, label: "Fast, fluid experience" }
          ].map((item) => (
            <motion.div
              key={item.label}
              variants={staggerItem}
              className="interactive-lift rounded-lg border border-[#2A3545] bg-[#151B24] p-4 text-sm font-bold text-white shadow-sm"
            >
              <item.icon className="mb-3 h-5 w-5 text-[#93C5FD]" />
              {item.label}
            </motion.div>
          ))}
        </motion.div>
      </section>

      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45 }}>
        <Card className="overflow-hidden">
          <div className="ink-panel flex items-center justify-between border-b border-[#2A3545] px-5 py-4 text-white">
            <div className="flex items-center gap-2 text-sm font-black">
              <Sparkles className="h-4 w-4 text-[#93C5FD]" />
              ArchMind Access
            </div>
            <span className="rounded-full border border-blue-400/40 bg-[#10233F] px-2.5 py-1 text-xs font-bold text-[#D9E8FF]">Secure</span>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-6 w-6 text-emerald-300" />
              <div>
                <h2 className="text-xl font-bold text-white">Account access</h2>
                <p className="text-sm text-slate-300">Log in or create a new workspace.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <p className="mt-5 text-center text-sm text-slate-300">Continue with email or Google to get started.</p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
