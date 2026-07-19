"use server";

import { getServerUser, isAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  listClassesWithStatus,
  createClass,
  deleteClass,
  openClassSession,
  closeClassSession,
  getCurrentSession,
} from "@/lib/classes";
import {
  ensureSheetTemplate,
  addSessionColumn,
  getSheetSessionCount,
} from "@/lib/google-sheets";
import { getAdminEmails } from "@/lib/auth";

export async function getDashboardData() {
  const user = await getServerUser();
  if (!user?.email || !(await isAdmin(user.email))) {
    return { error: "unauthorized" as const, classes: [], serviceAccountEmail: null };
  }

  const classes = await listClassesWithStatus();
  const serviceAccountEmail = await getServiceAccountEmail();

  return { classes, serviceAccountEmail };
}

export async function getServiceAccountEmail(): Promise<string | null> {
  try {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!json) return null;
    const parsed = JSON.parse(json);
    return parsed.client_email ?? null;
  } catch {
    return null;
  }
}

export async function addClassAction(
  name: string,
  sheetId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getServerUser();
  if (!user?.email || !(await isAdmin(user.email))) {
    return { success: false, error: "Unauthorized" };
  }

  if (!name.trim()) {
    return { success: false, error: "Class name is required" };
  }

  if (!/^[a-zA-Z0-9\-_]{20,}$/.test(sheetId)) {
    return { success: false, error: "Invalid spreadsheet ID format" };
  }

  try {
    await createClass(name.trim(), sheetId.trim(), user.email);

    // Auto-setup sheet template (Attendance + Summary tabs with headers)
    try {
      const template = await ensureSheetTemplate(sheetId.trim());
      const createdTabs = template.created;
      if (createdTabs.length > 0) {
        return { success: true, message: `Sheet template applied (${createdTabs.join(", ")} tab${createdTabs.length > 1 ? "s" : ""} created).` };
      }
      return { success: true, message: "Class added. Sheet template already exists." };
    } catch (templateErr) {
      console.error("Sheet template setup failed:", templateErr);
      return { success: true, message: "Class added, but sheet template setup failed. Make sure the service account has Editor access to the sheet." };
    }
  } catch {
    return { success: false, error: "Failed to create class" };
  }
}

export async function removeClassAction(
  classId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user?.email || !(await isAdmin(user.email))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await deleteClass(classId);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete class" };
  }
}

export async function startSessionAction(
  classId: string
): Promise<{ success: boolean; sessionLabel?: string; error?: string }> {
  const user = await getServerUser();
  if (!user?.email || !(await isAdmin(user.email))) {
    return { success: false, error: "Unauthorized" };
  }

  const db = getAdminDb();
  const classDoc = await db.collection("classes").doc(classId).get();
  if (!classDoc.exists) {
    return { success: false, error: "Class not found" };
  }

  const currentSession = await getCurrentSession(classId);
  if (currentSession?.isOpen) {
    return { success: false, error: "Session already open" };
  }

  // Determine next session number from sheet columns
  const sheetId = classDoc.data()!.sheetId;
  let nextNum = 1;
  try {
    nextNum = (await getSheetSessionCount(sheetId)) + 1;
  } catch {
    nextNum = 1;
  }

  const nowDate = new Date();
  const dateLabel = nowDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dhaka",
  });
  const sessionLabel = `S${nextNum} · ${dateLabel}`;

  let columnLetter = "D";
  try {
    await ensureSheetTemplate(sheetId);
    const result = await addSessionColumn(sheetId, nextNum, sessionLabel);
    columnLetter = result.columnLetter;
  } catch (error) {
    console.error("Failed to create session column:", error);
  }

  await openClassSession(classId, nextNum, sessionLabel, columnLetter);

  return { success: true, sessionLabel };
}

export async function stopSessionAction(
  classId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user?.email || !(await isAdmin(user.email))) {
    return { success: false, error: "Unauthorized" };
  }

  const session = await getCurrentSession(classId);
  if (!session?.isOpen) {
    return { success: false, error: "No open session" };
  }

  await closeClassSession(classId, session);
  return { success: true };
}

export async function applyTemplateToAllAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const user = await getServerUser();
  if (!user?.email || !(await isAdmin(user.email))) {
    return { success: false, error: "Unauthorized" };
  }

  const classes = await listClassesWithStatus();
  if (classes.length === 0) {
    return { success: true, message: "No classes to apply template to." };
  }

  const results: string[] = [];
  const errors: string[] = [];

  for (const { class: cls } of classes) {
    try {
      const template = await ensureSheetTemplate(cls.sheetId);
      const created = template.created;
      if (created.length > 0) {
        results.push(`${cls.name}: created ${created.join(", ")}`);
      } else {
        results.push(`${cls.name}: already set up`);
      }
    } catch {
      errors.push(cls.name);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: results.length > 0 ? results.join("; ") : undefined,
      error: `Template failed for: ${errors.join(", ")}`,
    };
  }

  return { success: true, message: results.join("; ") };
}
