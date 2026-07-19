"use client";

import { Suspense, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { listStudentClasses, validateStudentOfClass } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Loader2, Circle, XCircle } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  hasOpenSession: boolean;
  sessionLabel?: string;
  sessionId?: string;
}

type PageState =
  | { type: "loading" }
  | { type: "classes"; classes: ClassItem[] }
  | { type: "validating"; classes: ClassItem[]; validatingClassId: string }
  | { type: "error-not-student"; classes: ClassItem[] }
  | { type: "error-no-session"; classes: ClassItem[] }
  | { type: "no-classes" };

function StudentPageInner() {
  const { user, loading: authLoading, role, signOut } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pageState, setPageState] = useState<PageState>({ type: "loading" });

  // Handle auth redirects + load classes on mount
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role === "admin") {
      router.replace("/dashboard");
      return;
    }

    startTransition(async () => {
      try {
        const classes = await listStudentClasses();
        setPageState(
          classes.length === 0
            ? { type: "no-classes" }
            : { type: "classes", classes }
        );
      } catch {
        setPageState({ type: "no-classes" });
      }
    });
  }, [user, authLoading, role, router]);

  // --- Handlers ---

  const handleClassClick = (cls: ClassItem) => {
    if (
      !cls.hasOpenSession ||
      !cls.sessionId ||
      pageState.type !== "classes"
    ) {
      return;
    }

    const currentClasses = pageState.classes;

    // Show loading spinner on this card immediately
    setPageState({
      type: "validating",
      classes: currentClasses,
      validatingClassId: cls.id,
    });

    startTransition(async () => {
      const result = await validateStudentOfClass(cls.id);

      if (!result.valid) {
        const isNotStudent = result.error.includes("not a student");
        // Re-fetch classes to get freshest session status
        try {
          const freshClasses = await listStudentClasses();
          setPageState(
            isNotStudent
              ? { type: "error-not-student", classes: freshClasses }
              : { type: "error-no-session", classes: freshClasses }
          );
        } catch {
          setPageState(
            isNotStudent
              ? { type: "error-not-student", classes: currentClasses }
              : { type: "error-no-session", classes: currentClasses }
          );
        }
        return;
      }

      // Validation passed — go to check-in
      router.push(`/check-in?class=${cls.id}&session=${result.sessionId}`);
    });
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const resetToClasses = async () => {
    setPageState({ type: "loading" });
    startTransition(async () => {
      try {
        const classes = await listStudentClasses();
        setPageState(
          classes.length === 0
            ? { type: "no-classes" }
            : { type: "classes", classes }
        );
      } catch {
        setPageState({ type: "no-classes" });
      }
    });
  };

  // --- Loading state (auth + initial classes fetch) ---

  if (authLoading || !user || pageState.type === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- Render helpers ---

  const renderClassList = (classes: ClassItem[]) => (
    <div className="space-y-3">
      {classes.map((cls) => {
        const isValidating =
          pageState.type === "validating" &&
          pageState.validatingClassId === cls.id;

        return (
          <div
            key={cls.id}
            onClick={() => handleClassClick(cls)}
            className={
              cls.hasOpenSession && !isValidating ? "cursor-pointer" : "cursor-default"
            }
          >
            <Card
              className={`rounded-2xl transition-all duration-200 ${
                cls.hasOpenSession && !isValidating
                  ? "hover:ring-2 hover:ring-primary/40 hover:shadow-md"
                  : "opacity-60"
              }`}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">{cls.name}</p>
                  <div className="flex items-center gap-1.5">
                    <Circle
                      className={`h-2.5 w-2.5 fill-current ${
                        cls.hasOpenSession ? "text-green-500" : "text-gray-400"
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        cls.hasOpenSession
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {cls.hasOpenSession ? "Active" : "No active session"}
                    </span>
                  </div>
                  {cls.hasOpenSession && cls.sessionLabel && (
                    <p className="text-xs text-muted-foreground">
                      {cls.sessionLabel}
                    </p>
                  )}
                </div>
                {isValidating && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );

  const renderErrorCard = ({
    message,
    showSignOut,
  }: {
    message: string;
    showSignOut: boolean;
  }) => (
    <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
      <div className="w-full max-w-sm animate-in zoom-in-95 fade-in animation-duration-300">
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-5 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <p className="text-center text-base font-medium leading-snug">
              {message}
            </p>
            <div className="mt-2 flex gap-3">
              <Button
                variant="outline"
                onClick={resetToClasses}
                className="rounded-xl"
              >
                See other classes
              </Button>
              {showSignOut && (
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="rounded-xl"
                >
                  Sign Out
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );

  // --- Page content based on state ---

  const renderMainContent = () => {
    switch (pageState.type) {
      case "no-classes":
        return (
          <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
            <p className="text-sm text-muted-foreground">
              No classes available yet.
            </p>
          </main>
        );

      case "classes":
        return (
          <main className="flex flex-1 flex-col px-6 pb-20 animate-in fade-in animation-duration-700">
            <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-4">
              {renderClassList(pageState.classes)}
            </div>
          </main>
        );

      case "validating":
        return (
          <main className="flex flex-1 flex-col px-6 pb-20 animate-in fade-in animation-duration-700">
            <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-4">
              {renderClassList(pageState.classes)}
            </div>
          </main>
        );

      case "error-not-student":
        return renderErrorCard({
          message: "You are not a student of this class.",
          showSignOut: true,
        });

      case "error-no-session":
        return renderErrorCard({
          message:
            "No active session for this class. Please try again later.",
          showSignOut: false,
        });

      default:
        return null;
    }
  };

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

      {/* User greeting */}
      {user && (
        <div className="px-6 pb-2">
          <p className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {user.email}
            </span>
          </p>
        </div>
      )}

      {renderMainContent()}

      {/* Bottom "Sign Out" text link (shown in list/validating states) */}
      {(pageState.type === "classes" || pageState.type === "validating") && (
        <div className="flex justify-center pb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-xs text-muted-foreground"
          >
            Sign Out
          </Button>
        </div>
      )}
    </div>
  );
}

export default function StudentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <StudentPageInner />
    </Suspense>
  );
}
