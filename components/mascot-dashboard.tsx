"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { useMascotSession } from "@/components/use-mascot-session";
import { BloubMascot } from "@/components/bloub-mascot";
import { TwitchSetup } from "@/components/twitch-setup";
import { TwitchPoll } from "@/components/twitch-poll";
import { EXPRESSION_LABELS, STATE_LABELS } from "@/components/bloub-controls";
import { EXPRESSIONS } from "@/lib/bloub/expressions";
import { SEQUENCE } from "@/lib/bloub/states";
import type { BloubMascotConfig } from "@/lib/mascot-config";

export function MascotDashboard() {
  const { session, setSession, ready } = useMascotSession();

  if (!ready) return null;

  const updateConfig = <K extends keyof BloubMascotConfig,>(key: K, value: BloubMascotConfig[K]) => {
    setSession((current) => ({ ...current, config: { ...current.config, [key]: value } }));
  };

  return (
    <main className="app-shell dashboard-shell">
      <header className="app-header">
        <Brand />
        <div className="header-actions">
          <span className={`status-chip ${session.running ? "success-chip" : ""}`}>{session.running && <span className="status-dot" />}{session.running ? "LIVE PREVIEW" : "PAUSED"}</span>
          <Link className="button button-secondary" href="/onboarding">Customize</Link>
        </div>
      </header>

      <section className="dashboard-intro">
        <div><span className="eyebrow">CONTROL ROOM</span><h1>{session.name || "MurMur"}</h1></div>
        <Link className="button button-secondary" href={`/overlay?key=${encodeURIComponent(session.overlayKey)}`} target="_blank" rel="noreferrer">Open overlay <span aria-hidden="true">↗</span></Link>
      </section>

      <div className="dashboard-grid">
        <section className="card dashboard-preview">
          <div className="panel-heading"><span>PREVIEW</span><span className={`status-chip ${session.running ? "success-chip" : ""}`}>{session.running ? "RUNNING" : "PAUSED"}</span></div>
          <div className="dashboard-stage"><div className="preview-glow" /><BloubMascot config={session.config} size={280} animate={session.running} /></div>
          <div className="preview-readout"><span>{session.config.shape}</span><span>{session.config.color}</span><span>{session.config.state}</span></div>
        </section>

        <div className="dashboard-side">
          <section className="card control-card">
            <div className="panel-heading"><span>CONTROLS</span></div>
            <button className={`button ${session.running ? "button-pause" : "button-primary"} run-toggle`} type="button" onClick={() => setSession((current) => ({ ...current, running: !current.running }))}>
              {session.running ? "Pause mascot" : "Start mascot"}
            </button>
            <label className="field-label" htmlFor="dashboard-expression">Expression</label>
            <select id="dashboard-expression" className="field-select" value={session.config.expression} onChange={(event) => updateConfig("expression", event.target.value as BloubMascotConfig["expression"])}>
              {EXPRESSIONS.map(({ id }) => <option key={id} value={id}>{EXPRESSION_LABELS[id]}</option>)}
            </select>
            <label className="field-label" htmlFor="dashboard-motion">Motion</label>
            <select id="dashboard-motion" className="field-select" value={session.config.state} onChange={(event) => updateConfig("state", event.target.value as BloubMascotConfig["state"])}>
              {SEQUENCE.map((state) => <option key={state} value={state}>{STATE_LABELS[state] ?? state}</option>)}
            </select>
          </section>

          <section className="card connections-card">
            <div className="panel-heading"><span>SETUP</span><Link className="text-button" href="/onboarding">Edit</Link></div>
            <div className="connection-row"><span>OBS · OPTIONAL</span><span className={`status-chip ${session.obsConfigured ? "success-chip" : ""}`}>{session.obsConfigured ? "SOURCE ADDED" : "NOT NEEDED FOR TWITCH"}</span></div>
            {session.twitchChannel && <p className="connection-detail">twitch.tv/{session.twitchChannel}</p>}
            <TwitchSetup
              channel={session.twitchChannel}
              overlayKey={session.overlayKey}
              returnTo="dashboard"
              chatbotEnabled={session.chatbotEnabled}
              onChatbotEnabledChange={(chatbotEnabled) => setSession((current) => ({ ...current, chatbotEnabled }))}
            />
          </section>
          <TwitchPoll overlayKey={session.overlayKey} />
        </div>
      </div>
    </main>
  );
}
