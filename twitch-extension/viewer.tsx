import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BloubMascot } from "@/components/bloub-mascot";
import { CHAT_EXPRESSIONS } from "@/lib/chat-types";
import { DEFAULT_BLOUB, type BloubMascotConfig } from "@/lib/mascot-config";

type ExtensionAuth = { channelId: string; token: string };
type ExtensionHelper = {
  onAuthorized: (callback: (auth: ExtensionAuth) => void) => void;
  listen: (target: string, callback: (target: string, contentType: string, message: string) => void) => void;
  unlisten: (target: string, callback: (target: string, contentType: string, message: string) => void) => void;
  onVisibilityChanged?: (callback: (visible: boolean) => void) => void;
};

declare global {
  interface Window {
    Twitch?: { ext?: ExtensionHelper };
    MURMUR_EXTENSION_CONFIG?: { apiBaseUrl?: string };
  }
}

type ExtensionState = {
  ready: boolean;
  name?: string;
  config?: BloubMascotConfig;
  running?: boolean;
};

function apiBaseUrl() {
  const configured = window.MURMUR_EXTENSION_CONFIG?.apiBaseUrl?.trim();
  return (configured || window.location.origin).replace(/\/+$/, "");
}

function Viewer() {
  const [mascotConfig, setMascotConfig] = useState(DEFAULT_BLOUB);
  const [running, setRunning] = useState(true);
  const [state, setState] = useState<ExtensionState>({ ready: false });

  useEffect(() => {
    const helper = window.Twitch?.ext;
    if (!helper) return;

    let latestAuth: ExtensionAuth | null = null;
    const loadChannel = async (auth: ExtensionAuth) => {
      latestAuth = auth;
      try {
        const response = await fetch(`${apiBaseUrl()}/api/extension/state`, {
          headers: { Authorization: `Bearer ${auth.token}` },
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = await response.json() as ExtensionState;
        if (latestAuth?.token !== auth.token) return;
        setState(result);
        if (result.ready && result.config) setMascotConfig(result.config);
        if (typeof result.running === "boolean") setRunning(result.running);
      } catch {
        setState({ ready: false });
      }
    };

    const onAuthorized = (auth: ExtensionAuth) => { void loadChannel(auth); };
    const onBroadcast = (_target: string, _contentType: string, rawMessage: string) => {
      try {
        const message = JSON.parse(rawMessage) as { type?: string; expression?: string };
        if (message.type !== "mascot-expression" || !CHAT_EXPRESSIONS.includes(message.expression as (typeof CHAT_EXPRESSIONS)[number])) return;
        setMascotConfig((current) => ({ ...current, expression: message.expression as (typeof CHAT_EXPRESSIONS)[number] }));
      } catch {
        // Ignore malformed broadcast events and keep rendering the last valid expression.
      }
    };

    helper.onAuthorized(onAuthorized);
    helper.listen("broadcast", onBroadcast);
    return () => helper.unlisten("broadcast", onBroadcast);
  }, []);

  return (
    <main className="viewer-stage" aria-label={state.name ? `${state.name} mascot` : "MurMur mascot"}>
      <div className="viewer-glow" />
      <BloubMascot config={mascotConfig} size={260} animate={running} />
      <span className="sr-only">{state.ready ? "MurMur is connected" : "Waiting for MurMur setup"}</span>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Viewer />);
