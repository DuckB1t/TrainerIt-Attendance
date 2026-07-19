import { getAdminDb } from "./firebase-admin";
import type { ClassDoc, SessionDoc } from "@/types";

// ─── Class CRUD ─────────────────────────────────────────

export async function createClass(
  name: string,
  sheetId: string,
  createdBy: string
): Promise<ClassDoc> {
  const db = getAdminDb();
  const ref = db.collection("classes").doc();
  const doc: ClassDoc = {
    id: ref.id,
    name: name.trim(),
    sheetId: sheetId.trim(),
    createdBy,
    createdAt: Date.now(),
  };
  await ref.set(doc);
  return doc;
}

export async function deleteClass(classId: string): Promise<void> {
  const db = getAdminDb();
  const batch = db.batch();

  // Delete session docs
  const sessionsSnap = await db
    .collection("classes")
    .doc(classId)
    .collection("sessions")
    .get();
  sessionsSnap.docs.forEach((d) => batch.delete(d.ref));

  // Delete attendance docs
  const attendanceSnap = await db
    .collection("classes")
    .doc(classId)
    .collection("attendance")
    .get();
  attendanceSnap.docs.forEach((d) => batch.delete(d.ref));

  // Delete class doc
  batch.delete(db.collection("classes").doc(classId));

  await batch.commit();
}

export async function getClass(classId: string): Promise<ClassDoc | null> {
  const db = getAdminDb();
  const doc = await db.collection("classes").doc(classId).get();
  if (!doc.exists) return null;
  return doc.data() as ClassDoc;
}

export async function listClasses(): Promise<ClassDoc[]> {
  const db = getAdminDb();
  const snap = await db.collection("classes").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as ClassDoc);
}

// ─── Session Helpers (class-scoped) ─────────────────────

export async function getCurrentSession(
  classId: string
): Promise<SessionDoc | null> {
  const db = getAdminDb();
  const doc = await db
    .collection("classes")
    .doc(classId)
    .collection("sessions")
    .doc("current")
    .get();
  if (!doc.exists) return null;
  return doc.data() as SessionDoc;
}

export async function checkAndAutoCloseSession(
  classId: string
): Promise<SessionDoc | null> {
  const session = await getCurrentSession(classId);
  if (!session || !session.isOpen) return session;

  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  const elapsed = Date.now() - session.createdAt;

  if (elapsed > THREE_HOURS_MS) {
    await closeClassSession(classId, session);
    return { ...session, isOpen: false, closedAt: Date.now() };
  }

  return session;
}

export async function openClassSession(
  classId: string,
  sessionNumber: number,
  sessionLabel: string,
  columnLetter: string
): Promise<SessionDoc> {
  const db = getAdminDb();
  const now = Date.now();

  const newSession: SessionDoc = {
    isOpen: true,
    sessionId: `session_${now}`,
    createdAt: now,
    columnLetter,
    sessionNumber,
    sessionLabel,
  };

  const sessionRef = db
    .collection("classes")
    .doc(classId)
    .collection("sessions");

  // Save as "current"
  await sessionRef.doc("current").set(newSession);
  // Save historical record
  await sessionRef.doc(newSession.sessionId).set(newSession);

  return newSession;
}

export async function closeClassSession(
  classId: string,
  session: SessionDoc
): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();
  const classRef = db.collection("classes").doc(classId);
  const sessionRef = classRef.collection("sessions");

  // Fill absences in sheet
  if (session.columnLetter) {
    const classDoc = await getClass(classId);
    if (classDoc?.sheetId) {
      try {
        const { fillAbsences } = await import("./google-sheets");
        await fillAbsences(classDoc.sheetId, session.columnLetter);
      } catch (error) {
        console.error("Failed to fill absences:", error);
      }
    }
  }

  // Update current session
  await sessionRef.doc("current").update({
    isOpen: false,
    closedAt: now,
  });

  // Update historical record
  await sessionRef.doc(session.sessionId).update({
    isOpen: false,
    closedAt: now,
  });
}

/**
 * Get all classes with their current session status.
 * Returns classes joined with session info for the dashboard.
 */
export async function listClassesWithStatus(): Promise<
  Array<{ class: ClassDoc; session: SessionDoc | null }>
> {
  const classes = await listClasses();
  const results = await Promise.all(
    classes.map(async (c) => {
      const session = await checkAndAutoCloseSession(c.id);
      return { class: c, session };
    })
  );
  return results;
}
