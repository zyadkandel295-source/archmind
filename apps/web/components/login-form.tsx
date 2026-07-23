"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { KeyRound, LogIn, Mail, UserPlus } from "lucide-react";
import { recordActivity } from "@/lib/activity";
import { establishWorkspaceSession } from "@/lib/session-bridge";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { getPlatformBaseUrl } from "@/lib/platform";
import { useSessionStore } from "@/lib/session-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

type AuthMode = "login" | "register" | "forgot";

function signInErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
  if (code.includes("invalid-credential")) return "Invalid email or password.";
  if (code.includes("email-already-in-use")) return "This email is already registered.";
  if (code.includes("weak-password")) return "Use a stronger password with at least 6 characters.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was closed before it finished.";
  if (code.includes("configuration-not-found")) return "Sign-in is not available right now. Please try again later.";
  return error instanceof Error ? error.message : "Sign-in failed. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnToVal = params.get("returnTo");
    setReturnTo(returnToVal);
    if (params.get("signup") === "1") {
      setMode("register");
    }

    const errorParam = params.get("error");
    if (errorParam) {
      const friendlyMsg =
        errorParam === "google_oauth_error" || errorParam === "access_denied" || errorParam === "invalid_state"
          ? "Connection could not be completed."
          : "Something went wrong. Please try again.";
      setError(friendlyMsg);
      toast({ type: "error", title: "Sign-in failed", message: friendlyMsg });
      
      const cleanUrl = window.location.pathname + (returnToVal ? `?returnTo=${encodeURIComponent(returnToVal)}` : "");
      router.replace(cleanUrl);
    }

    const handoff = params.get("handoff");
    if (handoff) {
      const destination = params.get("returnTo");
      const cleanUrl = window.location.pathname + (destination ? `?returnTo=${encodeURIComponent(destination)}` : "");
      router.replace(cleanUrl);
      void (async () => {
        setLoading(true);
        try {
          const response = await fetch(`${getPlatformBaseUrl()}/api/auth/handoff/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: handoff })
          });
          const session = (await response.json()) as {
            accessToken?: string;
            refreshToken?: string;
            user?: { email?: string; displayName?: string; photoUrl?: string };
          };
          if (!response.ok || !session.accessToken || !session.refreshToken || !session.user?.email) {
            throw new Error("Connection could not be completed.");
          }
          setSession({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            email: session.user.email,
            displayName: session.user.displayName,
            photoURL: session.user.photoUrl
          });
          recordActivity("google_signin_completed", { email: session.user.email, handoff: true });
          router.replace(destination && destination.startsWith("/") ? destination : "/dashboard");
        } catch (err) {
          const friendlyMsg = signInErrorMessage(err);
          setError(friendlyMsg);
          toast({ type: "error", title: "Sign-in failed", message: friendlyMsg });
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    const legacySession = params.get("accessToken");
    const legacyRenewal = params.get("refreshToken");
    const legacyEmail = params.get("email");
    if (legacySession && legacyRenewal && legacyEmail) {
      setSession({ accessToken: legacySession, refreshToken: legacyRenewal, email: legacyEmail });
      recordActivity("google_signin_completed", { email: legacyEmail, legacy: true });
      const destination = params.get("returnTo");
      router.replace(destination && destination.startsWith("/") ? destination : "/dashboard");
    }
  }, [router, setSession]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(undefined);
    setMessage(undefined);
    if (nextMode !== "register") {
      setConfirmPassword("");
      setDisplayName("");
    }
  }

  async function completeSignIn(user: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>["user"], provider: string) {
    const session = await establishWorkspaceSession(user, provider);
    setSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      email: session.user.email,
      displayName: session.user.displayName,
      photoURL: session.user.photoUrl
    });
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    router.push(returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard");
  }

  async function startGoogleAuth() {
    setLoading(true);
    setError(undefined);
    setMessage(undefined);
    try {
      recordActivity(mode === "register" ? "google_signup_started" : "google_login_started", {});
      const params = new URLSearchParams();
      const destination = new URLSearchParams(window.location.search).get("returnTo");
      params.set("state", destination && destination.startsWith("/") ? destination : "login");
      window.location.assign(`${getPlatformBaseUrl()}/api/auth/google?${params.toString()}`);
    } catch (err) {
      const nextError = signInErrorMessage(err);
      setError(nextError);
      toast({ type: "error", title: "Google sign-in failed", message: nextError });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      if (!isFirebaseConfigured()) {
        throw new Error("Sign-in is not configured for this environment.");
      }
      const auth = getFirebaseAuth();
      await setPersistence(auth, browserLocalPersistence);

      if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setMessage("Password reset email sent. Check your inbox.");
        recordActivity("password_reset_requested", { email });
        toast({ type: "success", title: "Reset email sent", message: "Check your inbox for the password reset link." });
        return;
      }

      if (mode === "register" && password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const credential =
        mode === "register"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);

      if (mode === "register" && displayName.trim()) {
        await updateProfile(credential.user, { displayName: displayName.trim() });
        await credential.user.reload();
      }

      await completeSignIn(credential.user, "password");
      recordActivity(mode === "login" ? "signin_completed" : "signup_completed", { email: credential.user.email });
      toast({
        type: "success",
        title: mode === "login" ? "Welcome back" : "Account created",
        message: credential.user.email ?? "Your workspace is ready."
      });
    } catch (err) {
      const nextError = signInErrorMessage(err);
      setError(nextError);
      toast({ type: "error", title: "Sign-in failed", message: nextError });
    } finally {
      setLoading(false);
    }
  }

  const submitLabel =
    mode === "login"
      ? loading
        ? "Signing in"
        : "Sign in"
      : mode === "register"
        ? loading
          ? "Creating account"
          : "Create account"
        : loading
          ? "Sending reset"
          : "Send reset email";

  return (
    <form onSubmit={submit} className="space-y-4">
      {returnTo === "/dashboard" ? (
        <p className="rounded-lg border border-blue-400/45 bg-[#10233F] px-4 py-3 text-sm font-semibold leading-6 text-[#D9E8FF]">
          You need an account before you can open the dashboard. Create one below or sign in if you already have one.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#2A3545] bg-[#0F141C] p-1">
        {(["login", "register"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => switchMode(item)}
            className={`rounded-md px-3 py-2 text-sm font-bold transition ${
              mode === item ? "border border-blue-400/50 bg-[#10233F] text-[#D9E8FF] shadow-sm" : "border border-transparent text-[#B7C0CE] hover:border-[#3A4658] hover:bg-[#232D3B] hover:text-white"
            }`}
          >
            {item === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      {mode !== "forgot" ? (
        <Button type="button" variant="secondary" className="w-full" disabled={loading} onClick={startGoogleAuth}>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-sm font-black text-slate-950 ring-1 ring-slate-200">G</span>
          {mode === "register" ? "Sign up with Google" : "Continue with Google"}
        </Button>
      ) : null}

      {mode === "register" ? (
        <div>
          <label className="mb-2 block text-sm font-semibold">Display name</label>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Your name" />
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-semibold">Email</label>
        <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
      </div>

      {mode !== "forgot" ? (
        <div>
          <label className="mb-2 block text-sm font-semibold">Password</label>
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
        </div>
      ) : null}

      {mode === "register" ? (
        <div>
          <label className="mb-2 block text-sm font-semibold">Confirm password</label>
          <Input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" required />
        </div>
      ) : null}

      {mode === "login" ? (
        <button type="button" onClick={() => switchMode("forgot")} className="text-sm font-semibold text-[#93C5FD] hover:text-[#D9E8FF]">
          Forgot password?
        </button>
      ) : null}

      {mode === "forgot" ? (
        <button type="button" onClick={() => switchMode("login")} className="text-sm font-semibold text-slate-300 hover:text-white">
          Back to login
        </button>
      ) : null}

      {message ? <p className="rounded-lg border border-emerald-300/35 bg-emerald-400/[0.12] px-3 py-2 text-sm font-medium text-emerald-50">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/35 bg-red-500/[0.14] px-3 py-2 text-sm font-medium text-red-50">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {mode === "login" ? <LogIn className="h-4 w-4" /> : mode === "register" ? <UserPlus className="h-4 w-4" /> : mode === "forgot" ? <Mail className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}
