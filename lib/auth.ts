import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "./firebase-admin";
import type { AdminConfig, ClassDoc, SessionDoc } from "@/types";

export async function getServerUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  try {
    return await getAdminAuth().verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

export async function isAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    const db = getAdminDb();
    const doc = await db.collection("config").doc("admins").get();
    if (!doc.exists) return false;
    const data = doc.data() as AdminConfig;
    return data.emails
      .map((e) => e.toLowerCase().trim())
      .includes(email.toLowerCase().trim());
  } catch {
    return false;
  }
}

export async function getAdminEmails(): Promise<string[]> {
  try {
    const db = getAdminDb();
    const doc = await db.collection("config").doc("admins").get();
    if (!doc.exists) return [];
    const data = doc.data() as AdminConfig;
    return data.emails;
  } catch {
    return [];
  }
}

// ─── Class-scoped helpers ───────────────────────────────

export async function getClassDoc(classId: string): Promise<ClassDoc | null> {
  try {
    const db = getAdminDb();
    const doc = await db.collection("classes").doc(classId).get();
    if (!doc.exists) return null;
    return doc.data() as ClassDoc;
  } catch {
    return null;
  }
}

export async function getClassSession(
  classId: string
): Promise<SessionDoc | null> {
  try {
    const db = getAdminDb();
    const doc = await db
      .collection("classes")
      .doc(classId)
      .collection("sessions")
      .doc("current")
      .get();
    if (!doc.exists) return null;
    return doc.data() as SessionDoc;
  } catch {
    return null;
  }
}

/**
 * Validate that a class+session combination is valid for check-in.
 * Returns { valid, classDoc, session } or { valid: false, error }.
 */
export async function validateClassSession(
  classId: string,
  sessionId: string
): Promise<
  | { valid: true; classDoc: ClassDoc; session: SessionDoc }
  | { valid: false; error: string }
> {
  const classDoc = await getClassDoc(classId);
  if (!classDoc) {
    return { valid: false, error: "Class not found." };
  }

  const { checkAndAutoCloseSession } = await import("./classes");
  const session = await checkAndAutoCloseSession(classId);

  if (!session) {
    return { valid: false, error: "No active session for this class." };
  }

  if (!session.isOpen) {
    return { valid: false, error: "Attendance is currently closed." };
  }

  if (session.sessionId !== sessionId) {
    return {
      valid: false,
      error: "QR code has expired. Please scan the latest QR code.",
    };
  }

  return { valid: true, classDoc, session };
}
