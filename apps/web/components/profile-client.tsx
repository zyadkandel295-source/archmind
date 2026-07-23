"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { CalendarDays, Loader2, Mail, Save, UserCircle } from "lucide-react";
import { requestData } from "@/lib/data-client";
import { readSessionCredential, readRenewalCredential } from "@/lib/session-keys";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { useSessionStore } from "@/lib/session-store";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

interface Profile {
  id: string;
  firebaseUid?: string;
  email: string;
  displayName: string;
  photoURL: string;
  provider: string;
  plan: string;
  tokenUsage: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

interface ProfileResponse {
  profile: Profile;
  stats: {
    assistants: number;
    conversations: number;
    messages: number;
    sources: number;
  };
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ProfileClient() {
  const setSession = useSessionStore((state) => state.setSession);
  const [profile, setProfile] = useState<Profile>();
  const [stats, setStats] = useState<ProfileResponse["stats"]>();
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    let mounted = true;
    requestData<ProfileResponse>("/api/profile")
      .then((response) => {
        if (!mounted) return;
        setProfile(response.profile);
        setStats(response.stats);
        setDisplayName(response.profile.displayName ?? "");
        setPhotoURL(response.profile.photoURL ?? "");
      })
      .catch((error) => {
        toast({
          type: "error",
          title: "Profile failed to load",
          message: error instanceof Error ? error.message : "Try refreshing the page."
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const statCards = useMemo(
    () => [
      ["Assistants", stats?.assistants ?? 0],
      ["Conversations", stats?.conversations ?? 0],
      ["Messages", stats?.messages ?? 0],
      ["Sources", stats?.sources ?? 0]
    ],
    [stats]
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (isFirebaseConfigured()) {
        const user = getFirebaseAuth().currentUser;
        if (user) {
          await updateProfile(user, {
            displayName: displayName.trim() || null,
            photoURL: photoURL.trim() || null
          });
        }
      }

      const response = await requestData<{ profile: Profile }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: displayName.trim(),
          photoURL: photoURL.trim()
        })
      });
      setProfile(response.profile);
      setSession({
        accessToken: readSessionCredential() ?? "",
        refreshToken: readRenewalCredential(),
        email: response.profile.email,
        displayName: response.profile.displayName,
        photoURL: response.profile.photoURL
      });
      toast({ type: "success", title: "Profile saved", message: "Your account details were updated." });
    } catch (error) {
      toast({
        type: "error",
        title: "Profile save failed",
        message: error instanceof Error ? error.message : "Try again in a moment."
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-2xl font-black">Profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-300">We could not load your saved account data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Verified account</Badge>
            <Badge tone="blue">{profile.provider}</Badge>
            <Badge tone="slate">{profile.plan}</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-black md:text-5xl">My Profile</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Your identity is securely verified before ArchMind creates or updates your account profile.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#2A3545] bg-[#151B24] p-3 text-slate-100 shadow-sm">
          {profile.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoURL} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white">
              <UserCircle className="h-8 w-8" />
            </div>
          )}
          <div>
            <div className="font-black text-white">{profile.displayName || "No display name"}</div>
            <div className="text-sm text-slate-300">{profile.email}</div>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {statCards.map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <div className="text-3xl font-black">{formatNumber(Number(value))}</div>
              <p className="mt-1 text-sm font-semibold text-slate-300">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Account Details</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold">Display name</label>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving" : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Identity</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-300">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-[#93C5FD]" />
              <div>
                <div className="font-bold text-white">Email</div>
                <div className="break-all">{profile.email}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 text-[#93C5FD]" />
              <div>
                <div className="font-bold text-white">Last login</div>
                <div>{formatDate(profile.lastLoginAt)}</div>
              </div>
            </div>
            <div className="rounded-xl border border-[#2A3545] bg-[#151B24] p-4">
              <div className="font-bold text-white">Created</div>
              <div>{formatDate(profile.createdAt)}</div>
              <div className="mt-3 font-bold text-white">Updated</div>
              <div>{formatDate(profile.updatedAt)}</div>
            </div>
          </CardContent>
        </Card>
      </section>


    </motion.div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-4 h-12 w-72" />
        <Skeleton className="mt-4 h-5 w-full max-w-lg" />
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent>
              <Skeleton className="h-9 w-20" />
              <Skeleton className="mt-3 h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </section>
      <Card>
        <CardContent className="space-y-5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
