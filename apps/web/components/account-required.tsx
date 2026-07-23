"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fadeUp } from "@/lib/motion";

interface AccountRequiredProps {
  returnTo?: string;
  title?: string;
  description?: string;
}

export function AccountRequired({
  returnTo = "/dashboard",
  title = "Create an account to continue",
  description = "The dashboard is only available after you sign in. Create a free account or log in to manage your assistants."
}: AccountRequiredProps) {
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  const signupHref = `/auth/login?signup=1&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-lg flex-col items-center justify-center px-4 py-16 text-center"
    >
      <Card className="w-full overflow-hidden">
        <div className="ink-panel flex flex-col items-center px-6 py-8 text-white">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="grid h-16 w-16 place-items-center rounded-xl border border-blue-400/40 bg-[#10233F]"
          >
            <LockKeyhole className="h-8 w-8 text-[#D9E8FF]" />
          </motion.div>
          <h1 className="mt-6 text-2xl font-black md:text-3xl">{title}</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">{description}</p>
        </div>
        <CardContent className="space-y-3 pt-6">
          <Link href={signupHref} className="block">
            <Button className="h-12 w-full">
              <UserPlus className="h-4 w-4" />
              Create account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={loginHref} className="block">
            <Button variant="secondary" className="h-12 w-full">
              <LogIn className="h-4 w-4" />
              I already have an account
            </Button>
          </Link>
          <Link href="/" className="block pt-2 text-sm font-semibold text-[#B7C0CE] transition hover:text-[#D9E8FF]">
            Back to home
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
