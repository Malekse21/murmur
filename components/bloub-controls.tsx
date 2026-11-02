"use client";

import { COLORS, SHAPES } from "@/lib/bloub/skins";
import { EXPRESSIONS } from "@/lib/bloub/expressions";
import { SEQUENCE } from "@/lib/bloub/states";
import type { BloubMascotConfig } from "@/lib/mascot-config";

const SHAPE_LABELS: Record<BloubMascotConfig["shape"], string> = {
  cercle: "Circle", galet: "Pebble", squircle: "Squircle", capsule: "Capsule",
  triangle: "Triangle", hexagone: "Hexagon", nuage: "Cloud", goutte: "Droplet",
};

export const EXPRESSION_LABELS: Record<BloubMascotConfig["expression"], string> = {
  neutre: "Neutral", attentif: "Attentive", surpris: "Surprised", excite: "Excited",
  heureux: "Happy", hilare: "Laughing", colere: "Angry", triste: "Sad",
  effraye: "Afraid", mefiant: "Skeptical", confus: "Confused", curieux: "Curious",
  fier: "Proud", timide: "Shy", blase: "Unimpressed", somnolent: "Sleepy",
};

export const STATE_LABELS: Record<string, string> = {
  idle: "Idle", thinking: "Thinking", wink: "Wink", wide: "Wide eyes", alert: "Alert",
  notify: "Notification", exclaim: "Exclaim", sleep: "Sleep", egg: "Egg",
  hexagon: "Hexagon", play: "Play", orbit: "Orbit", burst: "Burst", comet: "Comet",
};

export function BloubControls({
  config,
  onChange,
  heading = "APPEARANCE",
}: {
  config: BloubMascotConfig;
  onChange: (next: BloubMascotConfig) => void;
  heading?: string;
}) {
  const update = <K extends keyof BloubMascotConfig,>(key: K, value: BloubMascotConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <section className="card settings-card" aria-label="MurMur appearance settings">
      <div className="panel-heading"><span>{heading}</span></div>
      <label className="field-label" htmlFor="bloub-shape">Shape</label>
      <select id="bloub-shape" className="field-select" value={config.shape} onChange={(event) => update("shape", event.target.value as BloubMascotConfig["shape"])}>
        {SHAPES.map(({ id }) => <option key={id} value={id}>{SHAPE_LABELS[id]}</option>)}
      </select>

      <div className="field-label">Color</div>
      <div className="swatches" role="radiogroup" aria-label="Body color">
        {COLORS.map(({ id, hex }) => (
          <button
            key={id}
            className={`swatch ${config.color.toLowerCase() === hex.toLowerCase() ? "selected" : ""}`}
            type="button"
            style={{ background: hex }}
            role="radio"
            aria-checked={config.color.toLowerCase() === hex.toLowerCase()}
            aria-label={id}
            title={id}
            onClick={() => update("color", hex)}
          />
        ))}
        <label className="custom-color" title="Custom color">
          <span>Custom</span>
          <input aria-label="Custom body color" type="color" value={config.color} onChange={(event) => update("color", event.target.value)} />
        </label>
      </div>

      <label className="field-label" htmlFor="bloub-expression">Expression</label>
      <select id="bloub-expression" className="field-select" value={config.expression} onChange={(event) => update("expression", event.target.value as BloubMascotConfig["expression"])}>
        {EXPRESSIONS.map(({ id }) => <option key={id} value={id}>{EXPRESSION_LABELS[id]}</option>)}
      </select>

      <label className="field-label" htmlFor="bloub-state">Motion</label>
      <select id="bloub-state" className="field-select" value={config.state} onChange={(event) => update("state", event.target.value as BloubMascotConfig["state"])}>
        {SEQUENCE.map((state) => <option key={state} value={state}>{STATE_LABELS[state] ?? state}</option>)}
      </select>
    </section>
  );
}
