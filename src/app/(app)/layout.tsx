"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { LoadingState } from "@/components/ui";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, configured, session, needsOnboarding } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!configured) router.replace("/setup");
    else if (!session) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboarding");
  }, [loading, configured, session, needsOnboarding, router]);

  if (loading || !configured || !session || needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <LoadingState />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
