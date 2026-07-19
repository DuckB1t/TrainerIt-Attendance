import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getClass } from "@/lib/classes";

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "Missing classId" }, { status: 400 });
  }

  try {
    const [session, classDoc] = await Promise.all([
      getCurrentSession(classId),
      getClass(classId),
    ]);

    const className = classDoc?.name ?? null;

    if (!session) {
      return NextResponse.json({
        isOpen: false,
        sessionId: null,
        sessionLabel: null,
        className,
      });
    }
    return NextResponse.json({
      isOpen: session.isOpen,
      sessionId: session.sessionId,
      sessionLabel: session.sessionLabel ?? null,
      className,
    });
  } catch {
    return NextResponse.json({
      isOpen: false,
      sessionId: null,
      sessionLabel: null,
      className: null,
    });
  }
}
