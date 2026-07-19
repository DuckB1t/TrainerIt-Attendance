"use client";

import { useEffect, useTransition, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { checkIn } from "./actions";
import {
  LogOut,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";

interface StatusInfo {
  type: "success" | "error";
  title: string;
  subtitle?: string;
}

function CheckInPageInner() {
  const { user, loading, role, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get("class");
  const sessionId = searchParams.get("session");
  const [isPending, startTransition] = useTransition();
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      const params = new URLSearchParams();
      if (classId) params.set("class", classId);
      if (sessionId) params.set("session", sessionId);
      router.replace(`/login?redirect=/check-in?${params.toString()}`);
    }
  }, [loading, user, router, classId, sessionId]);

  const handleCheckIn = () => {
    if (!classId || !sessionId) return;
    startTransition(async () => {
      const result = await checkIn(classId, sessionId);
      setStatusInfo({
        type: result.success ? "success" : "error",
        title: result.message,
      });
    });
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated — redirecting
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Admin redirect
  if (role === "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 gap-4">
        <p className="text-muted-foreground">Admins cannot record attendance.</p>
        <Button onClick={() => router.replace("/dashboard")} variant="outline">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  // Missing params
  if (!classId || !sessionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 gap-4">
        <p className="text-muted-foreground">Invalid QR code. Missing class or session info.</p>
        <Button onClick={() => router.replace("/student")} variant="outline">
          Back to Classes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <h1 className="text-sm font-medium text-primary">Trainers IT</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="rounded-full"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 animate-in fade-in animation-duration-700">
        <div className="flex w-full max-w-sm flex-col items-center gap-10">
          {/* User info */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="text-base font-medium">
              {user.displayName || user.email}
            </p>
          </div>

          {/* Status card */}
          {statusInfo ? (
            <div className="w-full animate-in zoom-in-95 fade-in animation-duration-300">
              <Card className="rounded-2xl">
                <CardContent className="flex flex-col items-center gap-5 py-10">
                  {statusInfo.type === "success" ? (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                      <XCircle className="h-10 w-10 text-red-500" />
                    </div>
                  )}
                  <p className="text-center text-lg font-medium leading-snug">
                    {statusInfo.title}
                  </p>
                  {statusInfo.subtitle && (
                    <p className="text-center text-sm text-muted-foreground">
                      {statusInfo.subtitle}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setStatusInfo(null)}
                    className="mt-2 rounded-xl"
                  >
                    {statusInfo.type === "success"
                      ? "Check in again"
                      : "Try again"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Button
              onClick={handleCheckIn}
              disabled={isPending}
              size="lg"
              className="h-16 w-full max-w-sm text-lg font-medium rounded-2xl transition-transform duration-200 active:scale-[0.98]"
            >
              {isPending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                "Check In"
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CheckInPageInner />
    </Suspense>
  );
}
