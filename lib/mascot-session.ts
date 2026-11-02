import { DEFAULT_BLOUB, type BloubMascotConfig } from "@/lib/mascot-config";

export type MascotSession = {
  overlayKey: string;
  name: string;
  config: BloubMascotConfig;
  twitchChannel: string;
  obsConfigured: boolean;
  running: boolean;
  chatbotEnabled: boolean;
};

export type SessionMessage =
  | { type: "request-session" }
  | { type: "session"; session: MascotSession };

export const MASCOT_SESSION_KEY = "bloub-studio-session";
export const MASCOT_SESSION_CHANNEL = "bloub-studio-session";

export const DEFAULT_MASCOT_SESSION: MascotSession = {
  overlayKey: "",
  name: "MurMur",
  config: DEFAULT_BLOUB,
  twitchChannel: "",
  obsConfigured: false,
  running: true,
  chatbotEnabled: false,
};

function newOverlayKey() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readMascotSession(): MascotSession {
  try {
    const raw = window.localStorage.getItem(MASCOT_SESSION_KEY);
    if (!raw) return { ...DEFAULT_MASCOT_SESSION, overlayKey: newOverlayKey() };
    const saved = JSON.parse(raw) as Partial<MascotSession>;
    return {
      ...DEFAULT_MASCOT_SESSION,
      ...saved,
      name: saved.name === "Bloub" ? "MurMur" : saved.name ?? DEFAULT_MASCOT_SESSION.name,
      overlayKey: saved.overlayKey && /^[A-Za-z0-9_-]{32,80}$/.test(saved.overlayKey) ? saved.overlayKey : newOverlayKey(),
      config: { ...DEFAULT_BLOUB, ...(saved.config ?? {}) },
    };
  } catch {
    return { ...DEFAULT_MASCOT_SESSION, overlayKey: newOverlayKey() };
  }
}

export function writeMascotSession(session: MascotSession) {
  window.localStorage.setItem(MASCOT_SESSION_KEY, JSON.stringify(session));
}
