"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { BloubMascot } from "@/components/bloub-mascot";
import { BloubControls } from "@/components/bloub-controls";
import { TwitchSetup } from "@/components/twitch-setup";
import { useMascotSession } from "@/components/use-mascot-session";

type Step = 1 | 2 | 3;

export function Onboarding() {
  const router = useRouter();
  const { session, setSession, ready } = useMascotSession();
  const [step, setStep] = useState<Step>(1);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    const queryStep = Number(new URLSearchParams(window.location.search).get("step"));
    if (queryStep === 2 || queryStep === 3) setStep(queryStep);
  }, []);

  const overlayUrl = `${origin}/overlay?key=${session.overlayKey}`;
  const updateName = (name: string) => setSession((current) => ({ ...current, name }));

  const copyOverlayUrl = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const finish = () => {
    router.push("/dashboard");
  };

  if (!ready) return null;

  return (
    <main className="flow-shell">
      <header className="flow-header">
        <Brand />
        <span className="status-chip">STEP 0{step} / 03</span>
      </header>

      {step === 1 && (
        <>
          <section className="flow-intro"><span className="eyebrow">CREATE</span><h1>Your mascot</h1></section>
          <div className="create-layout">
            <section className="card create-preview">
              <div className="panel-heading"><span>PREVIEW</span><span className="status-chip">{session.name || "MurMur"}</span></div>
              <div className="preview-stage"><div className="preview-glow" /><BloubMascot config={session.config} size={255} /></div>
            </section>
            <div className="create-settings">
              <section className="card settings-card name-card">
                <label className="field-label" htmlFor="mascot-name">Name</label>
                <input id="mascot-name" className="field-select" maxLength={24} value={session.name} onChange={(event) => updateName(event.target.value)} />
              </section>
              <BloubControls
                config={session.config}
                onChange={(config) => setSession((current) => ({ ...current, config }))}
              />
              <button className="button button-primary flow-next" type="button" onClick={() => setStep(2)}>Continue <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <section className="flow-intro"><span className="eyebrow">TWITCH</span><h1>Your channel</h1></section>
          <section className="card flow-card">
            <label className="field-label" htmlFor="twitch-channel">Channel name</label>
            <div className="channel-field"><span>twitch.tv/</span><input id="twitch-channel" className="field-select" autoComplete="off" value={session.twitchChannel} onChange={(event) => setSession((current) => ({ ...current, twitchChannel: event.target.value.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 25) }))} /></div>
            <TwitchSetup channel={session.twitchChannel} overlayKey={session.overlayKey} returnTo="onboarding" />
            <div className="flow-actions"><button className="button button-quiet" type="button" onClick={() => setStep(1)}>Back</button><button className="button button-primary" type="button" onClick={() => setStep(3)}>Continue <span aria-hidden="true">→</span></button></div>
          </section>
        </>
      )}

      {step === 3 && (
        <>
          <section className="flow-intro"><span className="eyebrow">OPTIONAL · OBS</span><h1>Add MurMur to your scene</h1></section>
          <section className="card flow-card obs-card">
            <p className="field-note twitch-note">You can use MurMur’s Twitch Extension without OBS. This browser source is optional.</p>
            <div className="panel-heading"><span>BROWSER SOURCE</span><span className={`status-chip ${session.obsConfigured ? "success-chip" : ""}`}>{session.obsConfigured ? "READY" : "SETUP"}</span></div>
            <div className="overlay-url"><code>{overlayUrl}</code><button className="button button-secondary" type="button" onClick={() => void copyOverlayUrl()}>{copied ? "Copied" : "Copy URL"}</button></div>
            <ol className="obs-steps">
              <li><span>01</span>Add a Browser Source</li>
              <li><span>02</span>Paste the URL</li>
              <li><span>03</span>Set canvas size and enable transparency</li>
            </ol>
            <label className="check-row"><input type="checkbox" checked={session.obsConfigured} onChange={(event) => setSession((current) => ({ ...current, obsConfigured: event.target.checked }))} /><span>Source added in OBS</span></label>
            <div className="flow-actions"><button className="button button-quiet" type="button" onClick={() => setStep(2)}>Back</button><button className="button button-primary" type="button" onClick={finish}>Open dashboard <span aria-hidden="true">→</span></button></div>
          </section>
        </>
      )}
    </main>
  );
}
