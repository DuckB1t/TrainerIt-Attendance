"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getDashboardData,
  addClassAction,
  removeClassAction,
  startSessionAction,
  stopSessionAction,
  applyTemplateToAllAction,
} from "./actions";
import {
  LogOut,
  Loader2,
  Plus,
  X,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { ClassDoc, SessionDoc } from "@/types";

type ClassWithStatus = { class: ClassDoc; session: SessionDoc | null };

export default function DashboardPage() {
  const { user, loading, role, signOut } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassWithStatus[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add class form
  const [className, setClassName] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [isPending, startTransition] = useTransition();

  // Remove class
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Copied email
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      router.replace("/login");
    }
  }, [loading, user, role, router]);

  const loadData = async () => {
    try {
      const data = await getDashboardData();
      if (data.error) {
        setError("Unauthorized");
        return;
      }
      setClasses(data.classes);
      setServiceAccountEmail(data.serviceAccountEmail);
    } catch {
      setError("Failed to load data");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (role === "admin") {
      loadData();
    }
  }, [role]);

  const handleAddClass = () => {
    startTransition(async () => {
      const result = await addClassAction(className, sheetId);
      if (result.success) {
        setClassName("");
        setSheetId("");
        if (result.message) {
          setSuccessMessage(result.message);
          setTimeout(() => setSuccessMessage(null), 5000);
        }
        await loadData();
      } else {
        setError(result.error ?? "Failed");
        setTimeout(() => setError(null), 3000);
      }
    });
  };

  const handleApplyAllTemplates = () => {
    startTransition(async () => {
      const result = await applyTemplateToAllAction();
      if (result.message) {
        setSuccessMessage(result.message);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
      if (result.error) {
        setError(result.error);
        setTimeout(() => setError(null), 5000);
      }
    });
  };

  const handleRemoveClass = (classId: string) => {
    startTransition(async () => {
      const result = await removeClassAction(classId);
      if (result.success) {
        setClasses((prev) => prev.filter((c) => c.class.id !== classId));
      }
      setRemovingId(null);
    });
  };

  const handleStartSession = (classId: string) => {
    startTransition(async () => {
      const result = await startSessionAction(classId);
      if (result.success) {
        await loadData();
        // Open QR page in new tab
        window.open(`/qr/${classId}`, "_blank");
      } else {
        setError(result.error ?? "Failed");
        setTimeout(() => setError(null), 3000);
      }
    });
  };

  const handleStopSession = (classId: string) => {
    startTransition(async () => {
      const result = await stopSessionAction(classId);
      if (result.success) {
        await loadData();
      } else {
        setError(result.error ?? "Failed");
        setTimeout(() => setError(null), 3000);
      }
    });
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (loading || !user || role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          Trainers IT
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="rounded-full"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center px-6 pb-20 pt-8 animate-in fade-in animation-duration-700">
        <div className="w-full max-w-md space-y-6">
          {/* Admin info */}
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground">{user?.email}</span>
          </p>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 animate-in fade-in">{error}</p>
          )}

          {/* Success / template status */}
          {successMessage && (
            <p className="text-sm text-green-600 animate-in fade-in">{successMessage}</p>
          )}

          {/* Add Class Form */}
          <Card className="rounded-2xl">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Add Class</h2>
                <GuideDialog serviceAccountEmail={serviceAccountEmail} />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Class name"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="rounded-xl flex-1"
                />
                <Input
                  placeholder="Sheet ID"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  className="rounded-xl flex-1"
                />
                <Button
                  onClick={handleAddClass}
                  disabled={isPending || !className || !sheetId}
                  size="icon"
                  className="rounded-xl shrink-0"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Apply Template to All */}
          {classes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl w-full"
              onClick={handleApplyAllTemplates}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Apply Sheet Template to All Classes
            </Button>
          )}

          {/* Class List */}
          <div className="space-y-2">
            {dataLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : classes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No classes yet. Add one above.
              </p>
            ) : (
              classes.map(({ class: cls, session }) => {
                const isOpen = session?.isOpen ?? false;
                return (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          isOpen ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{cls.name}</p>
                        {session?.sessionLabel && (
                          <p className="text-xs text-muted-foreground truncate">
                            {session.sessionLabel}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOpen && (
                        <Button
                          onClick={() => window.open(`/qr/${cls.id}`, "_blank")}
                          size="sm"
                          className="rounded-xl"
                        >
                          Show QR
                        </Button>
                      )}
                      {isOpen ? (
                        <Button
                          onClick={() => handleStopSession(cls.id)}
                          disabled={isPending}
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Stop
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleStartSession(cls.id)}
                          disabled={isPending}
                          size="sm"
                          className="rounded-xl"
                        >
                          Start
                        </Button>
                      )}
                      {removingId === cls.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => handleRemoveClass(cls.id)}
                            disabled={isPending}
                            variant="destructive"
                            size="sm"
                            className="rounded-xl h-8 px-2"
                          >
                            Confirm
                          </Button>
                          <Button
                            onClick={() => setRemovingId(null)}
                            variant="ghost"
                            size="sm"
                            className="rounded-xl h-8 px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setRemovingId(cls.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Guide Dialog ───────────────────────────────────────

function GuideDialog({
  serviceAccountEmail,
}: {
  serviceAccountEmail: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (serviceAccountEmail) {
      navigator.clipboard.writeText(serviceAccountEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" />}>
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">How to Add a Class</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <ol className="space-y-3 list-decimal list-inside">
            <li>
              <span className="text-foreground font-medium">
                Create a Google Sheet
              </span>{" "}
              for this class (blank sheet is fine — the template is auto-created).
            </li>
            <li>
              <span className="text-foreground font-medium">
                Share the sheet
              </span>{" "}
              with the service account email below as an{" "}
              <span className="text-foreground font-medium">Editor</span>.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Copy the Sheet ID
              </span>{" "}
              from the URL — it&apos;s the long string between{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">/d/</code>{" "}
              and{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">/edit</code>.
            </li>
            <li>
              Enter the <span className="text-foreground font-medium">class name</span> and{" "}
              <span className="text-foreground font-medium">Sheet ID</span> in the form and click Add.
            </li>
          </ol>

          {serviceAccountEmail && (
            <div className="rounded-xl bg-muted p-3 space-y-1">
              <p className="text-xs font-medium text-foreground">
                Service Account Email:
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs break-all flex-1 font-mono">
                  {serviceAccountEmail}
                </p>
                <button
                  onClick={handleCopy}
                  className="rounded-lg p-1 hover:bg-background transition-colors shrink-0"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
