"use client";

import { useEffect, useState } from "react";
import { BloubMascot } from "@/components/bloub-mascot";
import { DEFAULT_MASCOT_SESSION, type MascotSession } from "@/lib/mascot-session";

export function BloubOverlay() {
  const [session, setSession] = useState<MascotSession>(DEFAULT_MASCOT_SESSION);
  const [overlayKey, setOverlayKey] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("key") ?? "";
    setOverlayKey(key);
    if (!key) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        const response = await fetch("/api/overlay/session", {
          headers: { "X-Bloub-Key": key },
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = await response.json() as { session: MascotSession };
        if (!cancelled) setSession(result.session);
      } catch {
        // Keep the last frame while the local app server reconnects.
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void sync();
    const timer = window.setInterval(() => void sync(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="overlay-page" aria-label="MurMur stream overlay">
      {ready && <BloubMascot config={session.config} size={260} animate={session.running} />}
    </main>
  );
}
