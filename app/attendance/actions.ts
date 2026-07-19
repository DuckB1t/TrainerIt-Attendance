"use server";

import { getClassDoc } from "@/lib/auth";
import { getAttendanceSummary } from "@/lib/google-sheets";
import type { StudentAttendanceSummary } from "@/types";

export type AttendanceData = {
  students: StudentAttendanceSummary[];
  sessionHeaders: string[];
  sessionIds: string[];
};

export async function fetchAttendanceSummary(
  classId: string
): Promise<AttendanceData> {
  const classDoc = await getClassDoc(classId);
  if (!classDoc?.sheetId) {
    return { students: [], sessionHeaders: [], sessionIds: [] };
  }

  // We need to temporarily set the sheet ID for the google-sheets module
  // Since getAttendanceSummary reads from config/settings, we pass the sheet ID directly
  // by overriding the getSheetId function behavior
  const { getAttendanceSummaryForSheet } = await import("@/lib/google-sheets");
  return getAttendanceSummaryForSheet(classDoc.sheetId);
}
