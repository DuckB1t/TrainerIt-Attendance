import { google, type sheets_v4 } from "googleapis";
import { getAdminDb } from "./firebase-admin";
import type { AppSettings, StudentAttendanceSummary, AttendanceStatus } from "@/types";

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (!sheetsClient) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

/**
 * Get the configured spreadsheet ID from Firestore settings.
 * Configurable from Settings page — no env var required.
 */
export async function getSheetId(): Promise<string | null> {
  try {
    const db = getAdminDb();
    const doc = await db.collection("config").doc("settings").get();
    if (doc.exists) {
      const data = doc.data() as AppSettings;
      if (data.sheetId) return data.sheetId;
    }
  } catch {
    // Firestore read failed
  }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────

/** Convert 0-based column index to letter (0→A, 25→Z, 26→AA) */
function colIndexToLetter(index: number): string {
  let letter = "";
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

const MAX_SESSION_COLS = 50;

// ─── Template Setup ────────────────────────────────────────

/**
 * Ensure the spreadsheet has the correct structure:
 * - "Attendance" tab with Name | Email | session columns
 * - "Summary" tab with Name | Email | Present | Absent | Holiday | Total | %
 *
 * Students are auto-added on first check-in — no Students tab needed.
 */
export async function ensureSheetTemplate(
  spreadsheetId: string
): Promise<{ created: string[]; existing: string[] }> {
  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets ?? [];
  const existingNames = new Set(existingSheets.map((s) => s.properties?.title ?? ""));

  const created: string[] = [];
  const existing: string[] = [];
  const requests: sheets_v4.Schema$Request[] = [];

  // Create "Attendance" tab if missing
  if (existingNames.has("Attendance")) {
    existing.push("Attendance");
  } else {
    created.push("Attendance");
    requests.push({ addSheet: { properties: { title: "Attendance" } } });
  }

  // Create "Summary" tab if missing
  if (existingNames.has("Summary")) {
    existing.push("Summary");
  } else {
    created.push("Summary");
    requests.push({ addSheet: { properties: { title: "Summary" } } });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  // Only write headers for NEWLY created tabs
  if (created.includes("Attendance")) {
    const headerRow: string[] = ["Name", "Email"];
    for (let i = 0; i < MAX_SESSION_COLS; i++) {
      headerRow.push("");
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Attendance!A1",
      valueInputOption: "RAW",
      requestBody: { values: [headerRow] },
    });
  }

  if (created.includes("Summary")) {
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Summary!A1:G1",
      valueInputOption: "RAW",
      requestBody: { values: [["Name", "Email", "Present", "Absent", "Holiday", "Total", "%"]] },
    });

    // Write formulas for rows 2-100 (auto-calculates from Attendance)
    // Attendance session columns start at C (index 2) and go up to ZZ
    const formulaRows: string[][] = [];
    for (let row = 2; row <= 100; row++) {
      formulaRows.push([
        `=IF(Attendance!B${row}="","",Attendance!A${row})`,
        `=IF(Attendance!B${row}="","",Attendance!B${row})`,
        `=IF(Attendance!B${row}="","",COUNTIF(Attendance!C${row}:ZZ${row},"P"))`,
        `=IF(Attendance!B${row}="","",COUNTIF(Attendance!C${row}:ZZ${row},"A"))`,
        `=IF(Attendance!B${row}="","",COUNTIF(Attendance!C${row}:ZZ${row},"H"))`,
        `=IF(Attendance!B${row}="","",C${row}+D${row})`,
        `=IF(Attendance!B${row}="","",IF(F${row}>0,ROUND(C${row}/F${row}*100,0)&"%",""))`,
      ]);
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Summary!A2:G100",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: formulaRows },
    });
  }

  return { created, existing };
}

// ─── Session Column Operations ─────────────────────────────

/**
 * Add a new session column to the Attendance sheet.
 */
export async function addSessionColumn(
  spreadsheetId: string,
  _sessionNumber: number,
  sessionLabel: string
): Promise<{ columnLetter: string; header: string }> {
  const sheets = getSheetsClient();

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Attendance!A1:AZ1",
  });
  const headers = headerRes.data.values?.[0] ?? [];

  let nextColIndex = 2; // Start after Name, Email
  while (nextColIndex < headers.length && headers[nextColIndex] !== "") {
    nextColIndex++;
  }

  const columnLetter = colIndexToLetter(nextColIndex);
  const header = sessionLabel;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Attendance!${columnLetter}1`,
    valueInputOption: "RAW",
    requestBody: { values: [[header]] },
  });

  return { columnLetter, header };
}


/**
 * Check if a student email exists in the Attendance sheet.
 */
export async function isStudentRegistered(
  spreadsheetId: string,
  email: string
): Promise<boolean> {
  return (await findStudentRow(spreadsheetId, email)) !== -1;
}

/**
 * Mark a student as present in a session column.
 * Student must already exist in the sheet (email in column B).
 * Auto-fills name from Google profile or Firestore if missing in sheet.
 */
export async function markPresent(
  spreadsheetId: string,
  email: string,
  columnLetter: string,
  studentName?: string
): Promise<void> {
  const sheets = getSheetsClient();
  const rowIndex = await findStudentRow(spreadsheetId, email);
  if (rowIndex === -1) throw new Error("Student not registered in sheet");

  // Always try to fill name if column A is empty
  const nameRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Attendance!A${rowIndex}`,
  });
  const currentName = (nameRes.data.values?.[0]?.[0] ?? "").trim();

  if (!currentName) {
    let nameToWrite = studentName;

    // Try Firestore if no name provided
    if (!nameToWrite) {
      try {
        const db = getAdminDb();
        const snapshot = await db.collection("attendance")
          .where("studentEmail", "==", email)
          .limit(1)
          .get();
        if (!snapshot.empty) {
          nameToWrite = snapshot.docs[0].data().studentName ?? "";
        }
      } catch {
        // Firestore may be empty
      }
    }

    if (nameToWrite) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Attendance!A${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[nameToWrite]] },
      });
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Attendance!${columnLetter}${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["P"]] },
  });
}

/**
 * Fill absent marks for all students who didn't check in for a session.
 * Writes "A" in empty cells under the session column.
 */
export async function fillAbsences(
  spreadsheetId: string,
  columnLetter: string
): Promise<number> {
  const sheets = getSheetsClient();

  const emailRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Attendance!B2:B100",
  });
  const sessionRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Attendance!${columnLetter}2:${columnLetter}100`,
  });
  const emailRows = emailRes.data.values ?? [];
  const sessionRows = sessionRes.data.values ?? [];

  const updates: sheets_v4.Schema$ValueRange[] = [];
  let absentCount = 0;

  const maxRows = Math.max(emailRows.length, sessionRows.length);
  for (let i = 0; i < maxRows; i++) {
    const hasStudent = (emailRows[i]?.[0] ?? "") !== "";
    if (!hasStudent) continue;

    const cellValue = sessionRows[i]?.[0] ?? "";
    const rowNumber = i + 2;

    if (cellValue === "") {
      updates.push({
        range: `Attendance!${columnLetter}${rowNumber}`,
        values: [["A"]],
      });
      absentCount++;
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });
  }

  return absentCount;
}

/**
 * Mark a whole session as holiday — writes "H" for all students.
 */
export async function markSessionHoliday(
  spreadsheetId: string,
  columnLetter: string
): Promise<number> {
  const sheets = getSheetsClient();

  const emailRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Attendance!B2:B100",
  });
  const emailRows = emailRes.data.values ?? [];

  const updates: sheets_v4.Schema$ValueRange[] = [];
  let count = 0;

  for (let i = 0; i < emailRows.length; i++) {
    if ((emailRows[i]?.[0] ?? "") === "") continue;
    const rowNumber = i + 2;
    updates.push({
      range: `Attendance!${columnLetter}${rowNumber}`,
      values: [["H"]],
    });
    count++;
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });
  }

  return count;
}

// ─── Summary Tab ───────────────────────────────────────────

/**
 * Count how many session columns exist in the Attendance sheet.
 */
export async function getSheetSessionCount(spreadsheetId: string): Promise<number> {
  const sheets = getSheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Attendance!A1:AZ1",
  });
  const headers = headerRes.data.values?.[0] ?? [];
  let count = 0;
  for (let i = 2; i < headers.length; i++) {
    if ((headers[i] ?? "") !== "") count++;
    else break;
  }
  return count;
}

// ─── Attendance Summary Read ───────────────────────────────

/**
 * Read attendance data directly from the Summary tab.
 */
export async function getAttendanceSummary(): Promise<{
  students: StudentAttendanceSummary[];
  sessionHeaders: string[];
  sessionIds: string[];
}> {
  const sheets = getSheetsClient();
  const spreadsheetId = await getSheetId();
  if (!spreadsheetId) return { students: [], sessionHeaders: [], sessionIds: [] };

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Summary!A2:G100",
  });
  const rows = res.data.values ?? [];
  if (rows.length === 0) return { students: [], sessionHeaders: [], sessionIds: [] };

  const sessionHeaders: string[] = [];
  try {
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Attendance!A1:AZ1",
    });
    const headers = headerRes.data.values?.[0] ?? [];
    for (let i = 2; i < headers.length; i++) {
      const h = headers[i] ?? "";
      if (h === "") break;
      sessionHeaders.push(h);
    }
  } catch {
    // Fall back to empty session headers
  }

  const sessionIds = sessionHeaders.map((h) => {
    const match = h.match(/^(S\d+)/);
    return match ? match[1] : h;
  });

  const students: StudentAttendanceSummary[] = rows
    .filter((row) => (row?.[1] ?? "") !== "")
    .map((row) => {
      const name = row?.[0] ?? "";
      const email = row?.[1] ?? "";
      const present = parseInt(row?.[2] ?? "0", 10) || 0;
      const absent = parseInt(row?.[3] ?? "0", 10) || 0;
      const holiday = parseInt(row?.[4] ?? "0", 10) || 0;
      const total = parseInt(row?.[5] ?? "0", 10) || 0;
      const pctStr = (row?.[6] ?? "").replace("%", "");
      const percentage = pctStr ? parseInt(pctStr, 10) || 0 : 0;

      return {
        name,
        email,
        sessions: {} as Record<string, AttendanceStatus>,
        present,
        absent,
        holiday,
        total,
        percentage,
      };
    });

  return { students, sessionHeaders, sessionIds };
}

// ─── Class-Scoped Summary ───────────────────────────────

/**
 * Read attendance data from a specific sheet (class-scoped).
 * Same as getAttendanceSummary but takes sheetId directly.
 */
export async function getAttendanceSummaryForSheet(
  spreadsheetId: string
): Promise<{
  students: StudentAttendanceSummary[];
  sessionHeaders: string[];
  sessionIds: string[];
}> {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Summary!A2:G100",
  });
  const rows = res.data.values ?? [];
  if (rows.length === 0) return { students: [], sessionHeaders: [], sessionIds: [] };

  const sessionHeaders: string[] = [];
  try {
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Attendance!A1:AZ1",
    });
    const headers = headerRes.data.values?.[0] ?? [];
    for (let i = 2; i < headers.length; i++) {
      const h = headers[i] ?? "";
      if (h === "") break;
      sessionHeaders.push(h);
    }
  } catch {
    // Fall back to empty session headers
  }

  const sessionIds = sessionHeaders.map((h) => {
    const match = h.match(/^(S\d+)/);
    return match ? match[1] : h;
  });

  const students: StudentAttendanceSummary[] = rows
    .filter((row) => (row?.[1] ?? "") !== "")
    .map((row) => {
      const name = row?.[0] ?? "";
      const email = row?.[1] ?? "";
      const present = parseInt(row?.[2] ?? "0", 10) || 0;
      const absent = parseInt(row?.[3] ?? "0", 10) || 0;
      const holiday = parseInt(row?.[4] ?? "0", 10) || 0;
      const total = parseInt(row?.[5] ?? "0", 10) || 0;
      const pctStr = (row?.[6] ?? "").replace("%", "");
      const percentage = pctStr ? parseInt(pctStr, 10) || 0 : 0;

      return {
        name,
        email,
        sessions: {} as Record<string, AttendanceStatus>,
        present,
        absent,
        holiday,
        total,
        percentage,
      };
    });

  return { students, sessionHeaders, sessionIds };
}

// ─── Internal Helpers ──────────────────────────────────────

/**
 * Find the row number (1-indexed) of a student by email in the Attendance sheet.
 * Email is in column B (index 1).
 */
async function findStudentRow(
  spreadsheetId: string,
  email: string
): Promise<number> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Attendance!B2:B100",
  });
  const rows = res.data.values ?? [];
  const normalizedEmail = email.toLowerCase().trim();

  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").toLowerCase().trim() === normalizedEmail) {
      return i + 2; // sheet row (1-indexed, skip header)
    }
  }
  return -1;
}
