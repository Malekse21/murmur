"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BotEngine, type BotFrame } from "@/lib/bloub/engine";
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from "@/lib/bloub/expressions";
import { mixHex, SHAPE_BY_ID } from "@/lib/bloub/skins";
import { POSES, STATE_BY_ID, type StateId } from "@/lib/bloub/states";
import { DEMI_VIEWBOX, RAYON } from "@/lib/bloub/repere";
import type { BloubMascotConfig } from "@/lib/mascot-config";

const PAPER = "#0a0a0a";
const DEFAULT_INK = "#ededed";

export function BloubMascot({
  config,
  size = 220,
  className = "",
  animate = true,
}: {
  config: BloubMascotConfig;
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  const { shape, color, expression, state } = config;
  const engineRef = useRef<BotEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BotEngine(
      RAYON,
      state,
      SHAPE_BY_ID.get(shape)?.radii ?? null,
      EXPRESSION_BY_ID.get(expression) ?? EXPRESSION_BY_ID.get(DEFAULT_EXPRESSION) ?? null,
    );
  }
  const clock = useRef(0);
  const [frame, setFrame] = useState<BotFrame>(() => engineRef.current!.sample(0));
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const reactId = useId().replace(/:/g, "");
  const maskId = `bloub-mask-${reactId}`;
  const ink = /^#[\da-f]{6}$/i.test(color) ? color : DEFAULT_INK;
  const shouldAnimate = animate && !prefersReducedMotion;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(preference.matches);
    const update = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const engine = engineRef.current!;
    const now = clock.current;
    if (engine.state !== state) engine.setState(state, now);
    engine.setShape(SHAPE_BY_ID.get(shape)?.radii ?? null, now);
    engine.setExpression(EXPRESSION_BY_ID.get(expression) ?? null, now);

    if (!shouldAnimate) {
      const stateId = state as StateId;
      const frameTime = now + (POSES[stateId] ?? 0);
      setFrame(engine.sample(frameTime));
      return;
    }

    let request = 0;
    let previous = performance.now();
    let lastPaint = previous;
    const tick = (timestamp: number) => {
      const delta = Math.min((timestamp - previous) / 1000, 0.064);
      previous = timestamp;
      clock.current += Math.max(0, delta);
      if (timestamp - lastPaint >= 1000 / 30) {
        setFrame(engine.sample(clock.current));
        lastPaint = timestamp;
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [expression, shape, shouldAnimate, state]);

  const dots = (layer: "behind" | "front") =>
    frame.dots.map((dot, index) => {
      const behind = frame.dotsBehind;
      if ((layer === "behind") !== behind) return null;
      const fill = dot.color ?? (dot.depth === undefined ? ink : mixHex(PAPER, ink, dot.depth));
      if (dot.d) {
        return (
          <path
            key={`${layer}-${index}`}
            d={dot.d}
            transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`}
            fill={fill}
            opacity={dot.opacity}
          />
        );
      }
      return <circle key={`${layer}-${index}`} cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />;
    });

  return (
    <svg
      className={`bloub-mascot ${className}`}
      width={size}
      height={size}
      viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`}
      role="img"
      aria-label={`MurMur mascot, ${STATE_BY_ID.get(state)?.id ?? "idle"} animation`}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2}>
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, index) => (
            <path key={index} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
          ))}
          {frame.notch && <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />}
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${maskId}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((stop, index) => (
              <stop key={index} offset={index / Math.max(arc.grad.stops.length - 1, 1)} stopColor={stop} />
            ))}
          </linearGradient>
        ))}
      </defs>

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path key={`back-${arc.id}`} d={arc.back} stroke={`url(#${maskId}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />
        ))}
      </g>
      {dots("behind")}
      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={PAPER} />
        <g mask={`url(#${maskId})`}>
          <rect x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2} fill={ink} />
        </g>
      </g>
      {dots("front")}
      {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill="#52a8ff" />}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path key={`front-${arc.id}`} d={arc.front} stroke={`url(#${maskId}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />
        ))}
      </g>
    </svg>
  );
}

