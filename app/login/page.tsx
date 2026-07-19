"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

function LoginPageInner() {
  const { user, loading, role, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (!loading && user) {
      hasRedirected.current = true;
      if (role === "admin") {
        router.replace("/dashboard");
      } else if (redirectTo) {
        router.replace(redirectTo);
      } else {
        router.replace("/student");
      }
    }
  }, [user, loading, role, router, redirectTo]);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signIn();
    } catch {
      setError("Sign in failed. Please try again.");
      setSigningIn(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 gap-4">
        <p className="text-red-500 text-sm">{error}</p>
        <Button onClick={handleSignIn} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 animate-in fade-in animation-duration-700">
      <div className="flex w-full max-w-sm flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-primary">
            Trainers IT
          </h1>
          <p className="text-sm text-muted-foreground">
            Professional IT Training Institute
          </p>
          <p className="max-w-[260px] text-center text-muted-foreground leading-relaxed">
            Sign in to record your attendance
          </p>
        </div>

        <GoogleSignInButton onClick={handleSignIn} loading={signingIn} />

        <p className="text-center text-xs text-muted-foreground/60">
          Only Google accounts are supported
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
