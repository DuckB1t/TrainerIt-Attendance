"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { fetchAttendanceSummary } from "./actions";
import { AttendanceTable } from "./attendance-table";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { StudentAttendanceSummary } from "@/types";

type Data = {
  students: StudentAttendanceSummary[];
  sessionHeaders: string[];
  sessionIds: string[];
};

function AttendancePageInner() {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get("class");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!classId) {
      setError("No class specified.");
      setDataLoading(false);
      return;
    }

    fetchAttendanceSummary(classId)
      .then((result) => {
        setData(result);
        setDataLoading(false);
      })
      .catch(() => {
        setError("Failed to load attendance data. Make sure the Sheet ID is configured.");
        setDataLoading(false);
      });
  }, [classId]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Attendance</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-xl"
        >
          Back
        </Button>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-20 pt-6">
        <div className="w-full max-w-5xl mx-auto">
          {dataLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="rounded-2xl border overflow-hidden">
                <div className="h-12 bg-muted/50" />
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-t">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-4 flex-1 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : data && (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                {data.students.length} student{data.students.length !== 1 ? "s" : ""} ·{" "}
                {data.sessionHeaders.length} session{data.sessionHeaders.length !== 1 ? "s" : ""}
              </p>
              <AttendanceTable
                students={data.students}
                sessionHeaders={data.sessionHeaders}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AttendancePageInner />
    </Suspense>
  );
}
