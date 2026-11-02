"use client";

import { useCallback, useEffect, useState } from "react";

type TwitchStatus = {
  configured: boolean;
  groqConfigured: boolean;
  jevConfigured: boolean;
  extensionConfigured: boolean;
  extensionConfigIssues: string[];
  connected: boolean;
  login: string | null;
};

const EMPTY_STATUS: TwitchStatus = { configured: false, groqConfigured: false, jevConfigured: false, extensionConfigured: false, extensionConfigIssues: [], connected: false, login: null };

export function TwitchSetup({
  channel,
  overlayKey,
  returnTo,
  chatbotEnabled,
  onChatbotEnabledChange,
}: {
  channel: string;
  overlayKey: string;
  returnTo: "onboarding" | "dashboard";
  chatbotEnabled?: boolean;
  onChatbotEnabledChange?: (enabled: boolean) => void;
}) {
  const [status, setStatus] = useState<TwitchStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const sameChannel = Boolean(channel && status.login?.toLowerCase() === channel.toLowerCase());

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/twitch/status", { headers: { "X-Bloub-Key": overlayKey }, cache: "no-store" });
      if (!response.ok) throw new Error("Twitch status unavailable.");
      setStatus(await response.json() as TwitchStatus);
    } catch {
      setStatus(EMPTY_STATUS);
    } finally {
      setLoading(false);
    }
  }, [overlayKey]);

  useEffect(() => {
    void refresh();
    const result = new URLSearchParams(window.location.search).get("twitch");
    if (result === "account-mismatch") setMessage("Sign in with the channel account.");
    else if (result === "denied") setMessage("Twitch access was cancelled.");
    else if (result && result !== "connected") setMessage("Twitch setup failed. Check app settings and permissions.");
  }, [refresh]);

  const connect = () => {
    const next = returnTo === "dashboard" ? "dashboard" : "onboarding";
    window.location.assign(`/api/twitch/auth?key=${encodeURIComponent(overlayKey)}&channel=${encodeURIComponent(channel)}&next=${next}`);
  };

  const disconnect = async () => {
    setWorking(true);
    await fetch("/api/twitch/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: overlayKey }),
    }).catch(() => undefined);
    await refresh();
    setWorking(false);
  };

  const connected = status.connected && sameChannel;
  const label = loading ? "CHECKING" : connected ? `CONNECTED · @${status.login}` : status.connected ? "ACCOUNT MISMATCH" : status.configured ? "NOT CONNECTED" : "NEEDS SETUP";

  return (
    <div className={`twitch-setup ${onChatbotEnabledChange ? "twitch-setup-dashboard" : ""}`}>
      <div className="connection-row"><span>TWITCH</span><span className={`status-chip ${connected ? "success-chip" : ""}`}>{label}</span></div>

      {connected ? (
        <button className="button button-secondary twitch-action" type="button" disabled={working} onClick={() => void disconnect()}>{working ? "Disconnecting…" : "Disconnect Twitch"}</button>
      ) : status.configured && channel ? (
        <button className="button button-secondary twitch-action" type="button" disabled={loading || working} onClick={connect}>Connect {channel ? `@${channel}` : "Twitch"} <span aria-hidden="true">↗</span></button>
      ) : (
        <p className="field-note twitch-note">{status.configured ? "Add a channel name first." : "Add Twitch app keys in .env.local."}</p>
      )}

      {message && <p className="field-note twitch-note" role="status">{message}</p>}
      {connected && !status.groqConfigured && <p className="field-note twitch-note">Add GROQ_API_KEY in .env.local to enable replies.</p>}
      {connected && !status.jevConfigured && <p className="field-note twitch-note">Add TYPESAFE_API_KEY in .env.local to select chat expressions.</p>}
      {connected && !status.extensionConfigured && <p className="field-note twitch-note">{status.extensionConfigIssues.length ? status.extensionConfigIssues.join(" ") : "Check the Twitch Extension settings in .env.local."}</p>}
      {connected && onChatbotEnabledChange && (
        <label className="check-row chatbot-toggle">
          <input type="checkbox" checked={Boolean(chatbotEnabled)} disabled={!status.groqConfigured || !status.jevConfigured || !status.extensionConfigured} onChange={(event) => onChatbotEnabledChange(event.target.checked)} />
          <span>AI chat replies</span>
        </label>
      )}
      {connected && onChatbotEnabledChange && chatbotEnabled && <p className="field-note twitch-note">Keep the MurMur server and EventSub worker running. Enable Chat Capabilities in Twitch Extension settings.</p>}
    </div>
  );
}
