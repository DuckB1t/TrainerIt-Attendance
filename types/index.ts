// ─── Class ──────────────────────────────────────────────
export interface ClassDoc {
  id: string;
  name: string;
  sheetId: string;
  createdBy: string;
  createdAt: number; // ms timestamp
}

// ─── Session ────────────────────────────────────────────
export interface SessionDoc {
  isOpen: boolean;
  sessionId: string;
  createdAt: number; // ms timestamp
  closedAt?: number; // ms timestamp
  columnLetter?: string; // e.g. "D", "E"
  sessionNumber?: number;
  sessionLabel?: string; // e.g. "S1 · Jul 13"
}

// ─── Config ─────────────────────────────────────────────
export interface AdminConfig {
  emails: string[];
}

export interface AppSettings {
  sheetId: string;
}

// ─── Google Sheets ──────────────────────────────────────
export interface StudentRow {
  email: string;
  name?: string;
}

export type AttendanceStatus = "P" | "A" | "H" | "";

export interface StudentAttendanceSummary {
  name: string;
  email: string;
  sessions: Record<string, AttendanceStatus>;
  present: number;
  absent: number;
  holiday: number;
  total: number;
  percentage: number;
}

// ─── Auth ───────────────────────────────────────────────
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export type UserRole = "student" | "admin" | "unregistered";

export interface CheckInResult {
  success: boolean;
  message: string;
}
