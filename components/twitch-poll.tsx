"use client";

import { useEffect, useState, type FormEvent } from "react";

type PollStatus = { connected: boolean; scopes?: string[] };

export function TwitchPoll({ overlayKey }: { overlayKey: string }) {
  const [status, setStatus] = useState<PollStatus>({ connected: false });
  const [title, setTitle] = useState("");
  const [firstChoice, setFirstChoice] = useState("");
  const [secondChoice, setSecondChoice] = useState("");
  const [duration, setDuration] = useState(300);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/twitch/status", { headers: { "X-Bloub-Key": overlayKey }, cache: "no-store" })
      .then((response) => response.json() as Promise<PollStatus>)
      .then((result) => { if (!cancelled) setStatus(result); })
      .catch(() => { if (!cancelled) setStatus({ connected: false }); });
    return () => { cancelled = true; };
  }, [overlayKey]);

  const createPoll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/twitch/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: overlayKey, title, choices: [firstChoice, secondChoice], duration }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Twitch could not create the poll.");
      setMessage("Poll is live in Twitch chat.");
      setTitle("");
      setFirstChoice("");
      setSecondChoice("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Twitch could not create the poll.");
    } finally {
      setWorking(false);
    }
  };

  const hasPollScope = status.scopes?.includes("channel:manage:polls") ?? false;

  return (
    <section className="card poll-card">
      <div className="panel-heading"><span>TWITCH POLL</span><span className="status-chip">LIVE CHAT</span></div>
      <form onSubmit={(event) => void createPoll(event)}>
        <label className="field-label" htmlFor="poll-title">Question</label>
        <input id="poll-title" className="field-select" maxLength={60} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should we do next?" />
        <div className="poll-choice-grid">
          <div><label className="field-label" htmlFor="poll-choice-a">Choice 1</label><input id="poll-choice-a" className="field-select" maxLength={25} required value={firstChoice} onChange={(event) => setFirstChoice(event.target.value)} /></div>
          <div><label className="field-label" htmlFor="poll-choice-b">Choice 2</label><input id="poll-choice-b" className="field-select" maxLength={25} required value={secondChoice} onChange={(event) => setSecondChoice(event.target.value)} /></div>
        </div>
        <label className="field-label" htmlFor="poll-duration">Duration</label>
        <select id="poll-duration" className="field-select" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
          <option value={60}>1 minute</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option>
        </select>
        <button className="button button-primary poll-submit" type="submit" disabled={!status.connected || !hasPollScope || working}>
          {working ? "Starting poll…" : "Start Twitch poll"}
        </button>
      </form>
      {!status.connected && <p className="field-note twitch-note">Connect the broadcaster account to create a poll.</p>}
      {status.connected && !hasPollScope && <p className="field-note twitch-note">Reconnect Twitch and approve poll permissions.</p>}
      <p className="field-note twitch-note">Polls require Twitch Affiliate or Partner status. Only one poll can run at a time.</p>
      {message && <p className="field-note twitch-note" role="status">{message}</p>}
    </section>
  );
}
