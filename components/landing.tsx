import Link from "next/link";
import { Brand } from "@/components/brand";
import { BloubMascot } from "@/components/bloub-mascot";
import { DEFAULT_BLOUB } from "@/lib/mascot-config";

export function Landing() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Main navigation">
          <Link href="/dashboard">Dashboard <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">YOUR STREAM, YOUR MURMUR</span>
          <h1>A little more you<br />on screen.</h1>
          <p>Make a mascot. Connect Twitch. Go live.</p>
          <Link className="button button-primary hero-button" href="/onboarding">
            Create your mascot <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="hero-mascot">
          <div className="hero-glow" />
          <BloubMascot config={DEFAULT_BLOUB} size={340} />
          <span className="hero-caption">MURMUR / 001</span>
        </div>
        <div className="hero-footer"><span>01 — CUSTOMIZE</span><span>02 — CONNECT</span><span>03 — GO LIVE</span></div>
      </section>
    </main>
  );
}
