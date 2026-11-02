"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_MASCOT_SESSION,
  MASCOT_SESSION_CHANNEL,
  type MascotSession,
  type SessionMessage,
  readMascotSession,
  writeMascotSession,
} from "@/lib/mascot-session";

type RemoteSource = "server" | "broadcast" | null;

export function useMascotSession() {
  const [session, setSession] = useState<MascotSession>(DEFAULT_MASCOT_SESSION);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef(session);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const remoteSourceRef = useRef<RemoteSource>(null);
  const lastWriteAtRef = useRef(0);
  sessionRef.current = session;

  useEffect(() => {
    let cancelled = false;
    const local = readMascotSession();
    setSession(local);
    void fetch("/api/overlay/session", {
      headers: { "X-Bloub-Key": local.overlayKey },
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as { session: MascotSession };
    }).then((result) => {
      if (!cancelled && result?.session) {
        const migratedName = result.session.name === "Bloub" ? "MurMur" : result.session.name;
        remoteSourceRef.current = migratedName === result.session.name ? "server" : null;
        setSession(migratedName === result.session.name ? result.session : { ...result.session, name: migratedName });
      }
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(MASCOT_SESSION_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<SessionMessage>) => {
      if (event.data?.type === "request-session") {
        channel.postMessage({ type: "session", session: sessionRef.current });
      } else if (event.data?.type === "session") {
        remoteSourceRef.current = "broadcast";
        setSession(event.data.session);
      }
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    if (!ready || !session.overlayKey) return;
    writeMascotSession(session);
    const remoteSource = remoteSourceRef.current;
    remoteSourceRef.current = null;
    if (remoteSource === "broadcast") return;
    channelRef.current?.postMessage({ type: "session", session });
    if (remoteSource === "server") return;
    lastWriteAtRef.current = Date.now();
    void fetch("/api/overlay/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: session.overlayKey, session }),
    }).catch(() => undefined);
  }, [ready, session]);

  useEffect(() => {
    if (!ready || !session.overlayKey) return;
    let cancelled = false;
    const syncFromServer = async () => {
      if (Date.now() - lastWriteAtRef.current < 1200) return;
      try {
        const response = await fetch("/api/overlay/session", {
          headers: { "X-Bloub-Key": sessionRef.current.overlayKey },
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = await response.json() as { session: MascotSession };
        if (cancelled || JSON.stringify(result.session) === JSON.stringify(sessionRef.current)) return;
        remoteSourceRef.current = "server";
        setSession(result.session);
      } catch {
        // The browser copy still works while the local app server is unavailable.
      }
    };
    const timer = window.setInterval(() => void syncFromServer(), 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready, session.overlayKey]);

  return { session, setSession, ready };
}
