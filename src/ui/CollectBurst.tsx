import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Award {
  xp: number;
  from: number;
  total: number;
  key: number;
}

const REDUCED = "(prefers-reduced-motion: reduce)";

function motionReduced() {
  return (
    typeof matchMedia === "function" && matchMedia(REDUCED).matches
  );
}

function useCount(from: number, to: number, reduced: boolean) {
  const [value, setValue] = useState(reduced ? to : from);
  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 700);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, reduced]);
  return value;
}

/** Sparkle in the app's green and gold. A fade stands in when motion is reduced. */
function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!active || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const paint = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width, height };
    };
    let size = paint();
    const style = getComputedStyle(document.documentElement);
    const colors = [
      style.getPropertyValue("--accent").trim() || "#a5d6b2",
      style.getPropertyValue("--gold").trim() || "#d5bd8b",
      "#f4f4f5",
    ];
    const originX = size.width * 0.5;
    const originY = size.height * 0.38;
    const pieces = Array.from({ length: 42 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 42 + Math.random() * 0.4;
      const speed = 2.2 + Math.random() * 4.4;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.6,
        spin: Math.random() * 6,
        size: 4 + Math.random() * 5,
        color: colors[index % colors.length],
        shape: index % 3,
      };
    });
    let frame = 0;
    const started = performance.now();
    const draw = (now: number) => {
      const t = (now - started) / 1100;
      if (t >= 1) return;
      size = paint();
      context.clearRect(0, 0, size.width, size.height);
      for (const piece of pieces) {
        const life = Math.max(0, 1 - t);
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.045;
        piece.spin += 0.15;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.spin);
        context.globalAlpha = life;
        context.fillStyle = piece.color;
        if (piece.shape === 0) {
          context.fillRect(
            -piece.size / 2,
            -piece.size / 2,
            piece.size,
            piece.size * 0.55,
          );
        } else if (piece.shape === 1) {
          context.beginPath();
          context.arc(0, 0, piece.size * 0.35, 0, Math.PI * 2);
          context.fill();
        } else {
          context.beginPath();
          context.moveTo(0, -piece.size * 0.6);
          context.lineTo(piece.size * 0.2, -piece.size * 0.15);
          context.lineTo(piece.size * 0.6, 0);
          context.lineTo(piece.size * 0.2, piece.size * 0.15);
          context.lineTo(0, piece.size * 0.6);
          context.lineTo(-piece.size * 0.2, piece.size * 0.15);
          context.lineTo(-piece.size * 0.6, 0);
          context.lineTo(-piece.size * 0.2, -piece.size * 0.15);
          context.closePath();
          context.fill();
        }
        context.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  if (!active) return null;
  return <canvas ref={ref} aria-hidden="true" />;
}

export function CollectBurst({
  award,
  onDone,
}: {
  award: Award;
  onDone: () => void;
}) {
  const reduced = motionReduced();
  const shown = useCount(award.from, award.total, reduced);
  useEffect(() => {
    const timer = window.setTimeout(onDone, reduced ? 1400 : 2600);
    return () => window.clearTimeout(timer);
  }, [award.key, onDone, reduced]);
  const host =
    document.querySelector("dialog[open]") ?? document.body;
  return createPortal(
    <div
      className={`collect-burst${reduced ? " is-reduced" : ""}`}
      role="status"
      data-reduced={reduced ? "true" : "false"}
      aria-label={`Plus ${award.xp} DA. Spolu ${award.total} DA.`}
    >
      <Confetti active={!reduced} />
      <p className="collect-award">
        <span className="collect-plus">+{award.xp} DA</span>
        <span className="collect-total">spolu {shown} DA</span>
      </p>
    </div>,
    host,
  );
}
