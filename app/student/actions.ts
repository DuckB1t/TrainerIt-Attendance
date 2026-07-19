"use server";

import { getServerUser } from "@/lib/auth";
import {
  listClassesWithStatus,
  checkAndAutoCloseSession,
} from "@/lib/classes";
import { isStudentRegistered } from "@/lib/google-sheets";
import { getClassDoc } from "@/lib/auth";

/**
 * List all classes with session status for the student view.
 */
export async function listStudentClasses(): Promise<
  Array<{
    id: string;
    name: string;
    hasOpenSession: boolean;
    sessionLabel?: string;
    sessionId?: string;
  }>
> {
  const classes = await listClassesWithStatus();
  return classes.map(({ class: cls, session }) => ({
    id: cls.id,
    name: cls.name,
    hasOpenSession: session?.isOpen ?? false,
    sessionLabel: session?.sessionLabel,
    sessionId: session?.sessionId,
  }));
}

/**
 * Validate that the current user is a student of the given class.
 * Returns the open session if valid, or an error message.
 */
export async function validateStudentOfClass(
  classId: string
): Promise<
  | { valid: true; sessionId: string; sessionLabel?: string }
  | { valid: false; error: string }
> {
  const user = await getServerUser();
  if (!user?.email) {
    return { valid: false, error: "Authentication failed. Please sign in again." };
  }

  const classDoc = await getClassDoc(classId);
  if (!classDoc) {
    return { valid: false, error: "Class not found." };
  }

  const session = await checkAndAutoCloseSession(classId);
  if (!session?.isOpen) {
    return {
      valid: false,
      error: "No active session for this class. Please try again later.",
    };
  }

  // Check if user's email exists in the class sheet
  const isStudent = await isStudentRegistered(classDoc.sheetId, user.email);
  if (!isStudent) {
    return {
      valid: false,
      error: "You are not a student of this class.",
    };
  }

  return {
    valid: true,
    sessionId: session.sessionId,
    sessionLabel: session.sessionLabel,
  };
}
