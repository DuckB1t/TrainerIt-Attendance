import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Check if Admin SDK is configured before using it
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      console.warn("Firebase Admin SDK not configured (missing FIREBASE_PRIVATE_KEY)");
      return NextResponse.json(
        { error: "Server not configured. Please set up Firebase Admin SDK." },
        { status: 503 }
      );
    }

    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const userIsAdmin = await isAdmin(decodedToken.email ?? null);

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 7 * 1000; // 7 days
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn,
    });

    const response = NextResponse.json({
      status: "success",
      role: userIsAdmin ? "admin" : "student",
      email: decodedToken.email,
    });

    response.cookies.set("session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Session creation failed:", error);
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: "success" });
  response.cookies.delete("session");
  return response;
}
