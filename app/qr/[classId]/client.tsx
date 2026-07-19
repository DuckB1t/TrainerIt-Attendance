"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

interface Props {
  classId: string;
}

export default function QRPageClient({ classId }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [sessionLabel, setSessionLabel] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/qr-session?classId=${classId}`);
      if (res.ok) {
        const data = await res.json();
        setIsOpen(data.isOpen);
        setSessionLabel(data.sessionLabel ?? "");
        setClassName(data.className ?? "");
        setExpired(data.isOpen === false && data.sessionId != null);

        if (data.isOpen && data.sessionId) {
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
          const qrUrl = `${baseUrl}/check-in?class=${classId}&session=${data.sessionId}`;
          const url = await QRCode.toDataURL(qrUrl, {
            width: 800,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          setQrDataUrl(url);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, [loadSession]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.location.href = "/dashboard";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white">
      {/* Exit button — fixed top-right */}
      <Button
        onClick={() => (window.location.href = "/dashboard")}
        variant="ghost"
        size="icon"
        className="fixed top-6 right-6 rounded-full text-gray-400 hover:text-primary z-10"
      >
        <LogOut className="h-5 w-5" />
      </Button>

      {/* Center content */}
      <div className="flex flex-col items-center gap-6 px-6">
        {/* Class name */}
        {className && (
          <p className="text-sm text-gray-400">{className}</p>
        )}

        {/* Status badge */}
        {expired ? (
          <Badge
            variant="secondary"
            className="px-6 py-1.5 text-base rounded-full tracking-wide bg-gray-100 text-gray-500"
          >
            EXPIRED
          </Badge>
        ) : (
          <Badge
            variant={isOpen ? "default" : "secondary"}
            className={`px-6 py-1.5 text-base rounded-full tracking-wide ${
              isOpen
                ? "bg-green-600 text-white hover:bg-green-600"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isOpen ? "OPEN" : "CLOSED"}
          </Badge>
        )}

        {/* QR area */}
        {loading ? (
          <div className="w-[min(55vw,320px)] aspect-square flex items-center justify-center rounded-3xl bg-gray-50">
            <Loader2 className="h-10 w-10 animate-spin text-gray-300" />
          </div>
        ) : isOpen && qrDataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qrDataUrl}
            alt="Scan to check in"
            className="w-[min(55vw,320px)] aspect-square rounded-2xl animate-in zoom-in-95 fade-in duration-500"
          />
        ) : (
          <div className="w-[min(55vw,320px)] aspect-square rounded-3xl bg-gray-50 flex items-center justify-center">
            <p className="text-lg text-gray-400 font-medium text-center px-6">
              {expired ? "Session Ended" : "No Active Session"}
            </p>
          </div>
        )}

        {/* Instruction text */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-base text-gray-500">
            {isOpen ? "Scan to check in" : "Waiting for session to start..."}
          </p>
          {sessionLabel && (
            <p className="text-sm text-gray-400">{sessionLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
