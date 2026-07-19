"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import type { StudentAttendanceSummary, AttendanceStatus } from "@/types";

type SortKey = "name" | "present" | "absent" | "percentage";

interface Props {
  students: StudentAttendanceSummary[];
  sessionHeaders: string[];
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  if (status === "P") {
    return <Badge className="rounded-full px-2 py-0 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">P</Badge>;
  }
  if (status === "A") {
    return <Badge variant="destructive" className="rounded-full px-2 py-0 text-xs hover:bg-red-100">A</Badge>;
  }
  if (status === "H") {
    return <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100">H</Badge>;
  }
  return <span className="text-muted-foreground/30">—</span>;
}

function SortIndicator({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  return sortKey === col ? <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span> : null;
}

export function AttendanceTable({ students, sessionHeaders }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showSessions, setShowSessions] = useState(false);

  const filtered = students
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      if (sortKey === "present") return dir * (a.present - b.present);
      if (sortKey === "absent") return dir * (a.absent - b.absent);
      return dir * (a.percentage - b.percentage);
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="space-y-5 animate-in fade-in animation-duration-700">
      {/* Search + toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-10"
          />
        </div>
        {sessionHeaders.length > 0 && (
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="whitespace-nowrap text-sm text-muted-foreground hover:text-primary transition-colors rounded-xl border border-border hover:border-primary/30 px-3 py-2 h-10"
          >
            {showSessions ? "Hide" : "Show"} Sessions
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                Name <SortIndicator col="name" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              {showSessions && sessionHeaders.map((h) => (
                <TableHead key={h} className="text-center text-xs whitespace-nowrap">
                  {h}
                </TableHead>
              ))}
              <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("present")}>
                P <SortIndicator col="present" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("absent")}>
                A <SortIndicator col="absent" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead className="text-center">H</TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("percentage")}>
                % <SortIndicator col="percentage" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4 + sessionHeaders.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((student, i) => (
                <TableRow
                  key={student.email}
                  className="animate-in fade-in slide-in-from-bottom-1 animation-duration-400 fill-mode-backwards"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <p className="font-medium text-sm leading-snug">{student.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{student.email}</p>
                    </div>
                  </TableCell>
                  {showSessions && sessionHeaders.map((h) => {
                    const sessionId = h.match(/^(S\d+)/)?.[1] ?? h;
                    const status = student.sessions[sessionId] ?? "";
                    return (
                      <TableCell key={h} className="text-center">
                        <StatusBadge status={status} />
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <Badge variant="default" className="rounded-full px-2 py-0 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                      {student.present}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive" className="rounded-full px-2 py-0 text-xs hover:bg-red-100">
                      {student.absent}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs bg-muted text-muted-foreground dark:bg-muted/50 dark:text-muted-foreground hover:bg-muted">
                      {student.holiday}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={student.percentage >= 75 ? "default" : student.percentage >= 50 ? "secondary" : "destructive"}
                      className="rounded-full px-2 py-0 text-xs font-medium"
                    >
                      {student.total > 0 ? `${student.percentage}%` : "—"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span><StatusBadge status="P" /> Present</span>
        <span><StatusBadge status="A" /> Absent</span>
        <span><StatusBadge status="H" /> Holiday</span>
      </div>
    </div>
  );
}
