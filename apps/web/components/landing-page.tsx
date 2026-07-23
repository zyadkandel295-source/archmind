"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  FileSearch,
  Gauge,
  Globe2,
  LockKeyhole,
  MessageSquareText,
  Play,
  Share2,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { staggerContainer, staggerItem } from "@/lib/motion";

const capabilities = [
  { icon: Bot, title: "Custom builder", text: "Configure prompts, tone, response style, temperature, sharing options, and versioned behavior." },
  { icon: FileSearch, title: "Knowledge sources", text: "Upload text or documents, add links, import content, organize segments, and retrieve cited context." },
  { icon: MessageSquareText, title: "Streaming chat", text: "Real-time stream with stop, regenerate, formatted paragraphs, list blocks, and history." },
  { icon: Share2, title: "Deploy anywhere", text: "Secure shared links and iframe embeds for product sites, client portals, and support surfaces." },
  { icon: Activity, title: "Analytics", text: "Track messages, conversations, usage, assistant performance, and knowledge usage events." },
  { icon: ShieldCheck, title: "Secure workspace", text: "Isolated user workspaces, secure access controls, rate limits, security headers, and isolated integrations." }
];

const pipeline = ["Upload", "Extract", "Process", "Sync", "Retrieve", "Stream"];

const navItems = [
  { label: "Builder", href: "#builder" },
  { label: "Knowledge", href: "#knowledge" },
  { label: "Analytics", href: "#analytics" },
  { label: "Deploy", href: "#deploy" },
  { label: "Security", href: "#security" }
];

export function LandingPage() {
  return (
    <main className="arch-shell neural-grid min-h-screen text-slate-100">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-40 border-b border-[#2A3545] bg-[#0F141C] shadow-lg shadow-black/30"
      >
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="interactive-lift flex min-w-0 items-center gap-3 text-[clamp(1.05rem,2.4vw,1.25rem)] font-black text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/archmind-logo.png" alt="" className="size-[clamp(2.25rem,5vw,2.5rem)] shrink-0 rounded-lg border border-[#3A4658] bg-white object-cover" />
            <span>
              Arch<span className="text-[#93C5FD]">Mind</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="interactive-lift rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-[#B7C0CE] transition hover:border-[#3A4658] hover:bg-[#232D3B] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="hidden sm:block">
              <Button variant="secondary" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm">
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>

      <section className="border-b border-[#2A3545] bg-[#080B10] text-slate-100">
        <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-[clamp(2rem,5vw,3.5rem)] px-4 py-[clamp(2rem,6vw,4rem)] sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:px-8">
          <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible">
            <motion.div variants={staggerItem}>
              <Badge tone="new">Production assistant platform</Badge>
            </motion.div>
            <motion.h1 variants={staggerItem} className="mt-6 text-[clamp(3rem,9vw,4.5rem)] font-black leading-[1.02] tracking-normal text-white">
              ArchMind
            </motion.h1>
            <motion.p variants={staggerItem} className="mt-5 max-w-xl text-[clamp(1rem,2.2vw,1.25rem)] leading-8 text-slate-300">
              Build, tune, secure, and deploy custom assistants with streaming chat, secure knowledge bases, analytics, and embeddable experiences.
            </motion.p>
            <motion.div variants={staggerItem} className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button className="min-h-12 px-5">
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="secondary" className="min-h-12 px-5">
                  Create account
                  <Bot className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            <motion.div variants={staggerItem} className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm">
              {[
                ["Stream", "live responses"],
                ["Docs", "source citations"],
                ["Secure", "isolated sessions"]
              ].map(([label, value]) => (
                <div key={label} className="interactive-lift border-l-2 border-brand-600 pl-3">
                  <div className="font-black text-white">{label}</div>
                  <div className="mt-1 text-slate-300">{value}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <Reveal className="relative">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="ink-panel overflow-hidden rounded-[clamp(0.9rem,2.5vw,1.2rem)] border border-[#3A4658] shadow-2xl shadow-black/35"
            >
              <div className="flex items-center justify-between border-b border-[#2A3545] px-5 py-4">
                <div className="flex items-center gap-2 text-white">
                  <Bot className="h-5 w-5 text-[#93C5FD]" />
                  <span className="font-black">ArchMind Console</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
              </div>
              <div className="grid min-h-[clamp(24rem,52vw,32.5rem)] grid-cols-1 sm:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)]">
                <aside className="border-r border-[#2A3545] bg-[#0F141C] p-4 text-[#B7C0CE]">
                  <Link
                    href="/dashboard"
                    className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-blue-400/60 bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4" />
                    New chat
                  </Link>
                  <div className="mt-5 space-y-2">
                    {["Product Docs", "Sales Enablement", "Policy Tutor"].map((item, index) => (
                      <div
                        key={item}
                        className={`rounded-lg border px-3 py-3 text-sm transition ${
                          index === 0 ? "border-blue-400/50 bg-[#10233F] text-[#D9E8FF]" : "border-[#2A3545] bg-[#151B24] text-[#B7C0CE] hover:bg-[#232D3B] hover:text-white"
                        }`}
                      >
                        <div className="font-bold">{item}</div>
                        <div className="mt-1 text-xs text-slate-400">Standard - {index + 4} sources</div>
                      </div>
                    ))}
                  </div>
                </aside>
                <section className="flex flex-col bg-[#151B24]">
                  <div className="flex items-center justify-between border-b border-[#2A3545] px-5 py-4 text-white">
                    <div>
                      <div className="font-black">Product Docs Assistant</div>
                      <div className="text-xs text-slate-400">Streaming with secure connection</div>
                    </div>
                    <Badge tone="online">Live Stream</Badge>
                  </div>
                  <div className="flex-1 space-y-4 p-5 text-sm leading-6">
                    <div className="ml-auto max-w-[78%] rounded-xl border border-blue-400/70 bg-blue-600 px-4 py-3 text-white">
                      How do we explain deployment options to a new customer?
                    </div>
                    <div className="max-w-[84%] rounded-xl border border-[#3A4658] bg-[#1B2330] px-4 py-3 text-slate-100">
                      <p className="font-bold text-white">Deployment summary</p>
                      <p className="mt-2 text-slate-300">
                        We offer scalable cloud deployments, integrated load balancers, secure document storage, cache acceleration, web application firewalls, and real-time monitoring.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md border border-blue-400/35 bg-[#10233F] px-2 py-1 text-[#D9E8FF]">source: deployment.md</span>
                        <span className="rounded-md border border-emerald-400/35 bg-[#102018] px-2 py-1 text-emerald-200">confidence 0.92</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[#2A3545] p-4">
                    <div className="flex items-center gap-3 rounded-xl border border-[#3A4658] bg-[#0F141C] px-4 py-3 text-[#B7C0CE]">
                      <span className="flex-1">Ask a grounded question...</span>
                      <ArrowRight className="h-4 w-4 text-[#93C5FD]" />
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      <section id="builder" className="mx-auto max-w-7xl px-4 py-20 text-slate-100 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <Badge tone="online">Full platform surface</Badge>
          <h2 className="mt-4 text-3xl font-black text-white md:text-5xl">Everything needed to run serious assistants.</h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item) => (
            <StaggerItem key={item.title}>
              <article className="interactive-lift h-full rounded-lg border border-[#2A3545] bg-[#151B24] p-6 text-slate-100 shadow-soft">
                <item.icon className="h-6 w-6 text-[#93C5FD]" />
                <h3 className="mt-5 text-lg font-black text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.text}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section id="knowledge" className="ink-panel border-y border-[#2A3545] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <Reveal>
            <Badge tone="new">Knowledge flow</Badge>
            <h2 className="mt-4 text-3xl font-black md:text-5xl">Your knowledge flows into cited answers.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              ArchMind prepares secure storage, document processing, integrated intelligence, custom namespaces, and retrieval-backed replies with source metadata.
            </p>
          </Reveal>
          <Stagger className="grid gap-3 sm:grid-cols-3" stagger={0.05}>
            {pipeline.map((step, index) => (
              <StaggerItem key={step}>
                <div className="interactive-lift rounded-lg border border-[#2A3545] bg-[#151B24] p-5">
                  <div className="text-sm font-bold text-[#93C5FD]">0{index + 1}</div>
                  <div className="mt-3 text-xl font-black">{step}</div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section id="deploy" className="mx-auto max-w-7xl px-4 py-16 text-slate-100 sm:px-6 lg:px-8">
        <Reveal className="rounded-xl border border-[#3A4658] bg-[#151B24] p-8 text-center text-slate-100 shadow-soft md:p-12">
          <h2 className="text-2xl font-black text-white md:text-4xl">Deploy assistants anywhere</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
            Share secure links, embed on your site, and install shortcuts - all from the deploy screen on each assistant.
          </p>
          <Link href="/dashboard" className="mt-6 inline-flex">
            <Button>
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Reveal>
      </section>

      <section id="analytics" className="mx-auto grid max-w-7xl gap-8 px-4 py-20 text-slate-100 sm:px-6 lg:grid-cols-3 lg:px-8">
        <Stagger className="contents" stagger={0.08}>
          {[
            { icon: Gauge, title: "Operational metrics", text: "Monitor volume, conversations, assistant usage, and performance trends." },
            { icon: LockKeyhole, title: "Secure settings", text: "Integrations, billing, storage, and notification setups stay in protected, isolated environments." },
            { icon: Globe2, title: "Shared deployment", text: "Share assistants by custom links or embed them as controlled iframe experiences." }
          ].map((item) => (
            <StaggerItem key={item.title}>
              <div className="interactive-lift border-t-2 border-[#3B82F6] pt-6">
                <item.icon className="h-7 w-7 text-[#93C5FD]" />
                <h3 className="mt-5 text-2xl font-black text-white">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{item.text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <Reveal as="section" id="security" className="border-t border-[#2A3545] bg-[#0F141C] text-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-black text-white">Ready to build your first assistant?</h2>
            <p className="mt-2 text-slate-300">Get started in seconds. Create your custom assistant and share it with your team.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/assistants/new">
              <Button>
                Create assistant
                <Bot className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="secondary">
                View activity
                <Activity className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
