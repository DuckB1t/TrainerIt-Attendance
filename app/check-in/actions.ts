"use server";

import { getServerUser, isAdmin, validateClassSession } from "@/lib/auth";
import { isStudentRegistered, markPresent } from "@/lib/google-sheets";
import { getAdminDb } from "@/lib/firebase-admin";
import type { CheckInResult } from "@/types";

export async function checkIn(
  classId: string,
  sessionId: string
): Promise<CheckInResult> {
  const user = await getServerUser();
  if (!user || !user.email) {
    return { success: false, message: "Authentication failed. Please sign in again." };
  }

  if (await isAdmin(user.email)) {
    return { success: false, message: "Admins cannot record attendance." };
  }

  // Validate class + session
  const validation = await validateClassSession(classId, sessionId);
  if (!validation.valid) {
    return { success: false, message: validation.error };
  }

  const { classDoc, session } = validation;

  if (!session.columnLetter) {
    return { success: false, message: "Session is not properly configured." };
  }

  // Firestore duplicate check (class-scoped)
  const db = getAdminDb();
  const attendanceDocId = `${session.sessionId}_${user.uid}`;
  const existingDoc = await db
    .collection("classes")
    .doc(classId)
    .collection("attendance")
    .doc(attendanceDocId)
    .get();

  if (existingDoc.exists) {
    return { success: false, message: "Already recorded." };
  }

  // Verify email exists in sheet
  if (!(await isStudentRegistered(classDoc.sheetId, user.email))) {
    return { success: false, message: "You are not registered for this class." };
  }

  // Mark present
  const studentName =
    (user as Record<string, unknown>).displayName as string | undefined;
  await markPresent(
    classDoc.sheetId,
    user.email,
    session.columnLetter,
    studentName
  );

  // Record in Firestore (class-scoped)
  await db
    .collection("classes")
    .doc(classId)
    .collection("attendance")
    .doc(attendanceDocId)
    .set({
      sessionId: session.sessionId,
      studentUid: user.uid,
      studentName: studentName ?? "",
      studentEmail: user.email,
      timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
    });

  return { success: true, message: "Attendance recorded successfully." };
}
