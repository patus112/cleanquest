import type { CSSProperties } from "react";
import type { State } from "../domain/model";

export function toneFor(s: Pick<State, "rooms">, roomId?: string) {
  const category = s.rooms.find((room) => room.id === roomId)?.category;
  return category ? `tone-${category}` : "";
}

function Spark({ x, y, s = 5 }: { x: number; y: number; s?: number }) {
  const k = s * 0.34;
  return (
    <path
      className="art-spark"
      d={`M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`}
    />
  );
}

function Window({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  return (
    <g>
      <rect className="art-sky" x={x} y={y} width={w} height={h} rx="5" />
      <circle
        className="art-sun"
        cx={x + w * 0.66}
        cy={y + h * 0.36}
        r={Math.min(w, h) * 0.16}
      />
      <path
        className="art-curtain"
        d={`M${x + 3} ${y + 3} Q${x + w * 0.16} ${y + h * 0.55} ${x + 3} ${y + h - 3}`}
      />
      <path
        className="art-curtain"
        d={`M${x + w - 3} ${y + 3} Q${x + w * 0.84} ${y + h * 0.5} ${x + w - 3} ${y + h - 3}`}
      />
      <path
        className="art-frame"
        d={`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`}
      />
      <rect
        className="art-framebox"
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
      />
    </g>
  );
}

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className="art-leaf"
        d="M0 0 C-16 -14 -22 -34 -6 -40 C-4 -22 -2 -10 0 0 Z"
      />
      <path
        className="art-leaf-dark"
        d="M0 0 C14 -16 24 -32 8 -42 C6 -22 2 -10 0 0 Z"
      />
      <path
        className="art-leaf"
        d="M0 -2 C-4 -20 8 -32 16 -26 C8 -16 4 -8 0 -2 Z"
      />
      <rect className="art-pot" x="-11" y="0" width="22" height="16" rx="3" />
    </g>
  );
}

function Broom({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path className="art-handle" d={`M${x} ${y} L${x + 26} ${y - 68}`} />
      <path
        className="art-bristle"
        d={`M${x - 12} ${y + 2} Q${x + 2} ${y - 18} ${x + 16} ${y - 4} Q${x + 4} ${y + 12} ${x - 12} ${y + 2} Z`}
      />
    </g>
  );
}

function Spray({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect className="art-bottle" x={x} y={y} width="16" height="28" rx="3" />
      <rect className="art-wood" x={x + 3} y={y - 7} width="10" height="8" rx="2" />
      <path className="art-frame" d={`M${x + 13} ${y - 4} h8`} />
      <circle className="art-spark" cx={x + 24} cy={y - 4} r="1.4" />
    </g>
  );
}

function Cloth({ x, y }: { x: number; y: number }) {
  return (
    <path
      className="art-cloth"
      d={`M${x} ${y} h34 l-4 16 h-28 z M${x + 6} ${y + 4} h18`}
    />
  );
}

export function SunnyWindow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`art ${className}`}
      viewBox="0 0 160 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect className="art-wall" width="160" height="120" rx="16" />
      <rect className="art-floor" y="92" width="160" height="28" />
      <Window x={28} y={16} w={72} h={62} />
      <Plant x={124} y={78} s={0.85} />
      <Spark x={18} y={22} s={4} />
      <Spark x={112} y={28} s={3} />
    </svg>
  );
}

export function TidyKit({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`art ${className}`}
      viewBox="0 0 160 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect className="art-wall" width="160" height="120" rx="16" />
      <rect className="art-floor" y="88" width="160" height="32" />
      <Broom x={46} y={78} />
      <Spray x={88} y={58} />
      <Cloth x={78} y={92} />
      <Spark x={24} y={28} s={4} />
      <Spark x={130} y={36} s={3.2} />
    </svg>
  );
}

export function PlantSprig({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`art ${className}`}
      viewBox="0 0 160 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect className="art-wall" width="160" height="120" rx="16" />
      <rect className="art-floor" y="96" width="160" height="24" />
      <Plant x={78} y={78} s={1.35} />
      <Spark x={28} y={32} s={4} />
      <Spark x={124} y={40} s={3} />
    </svg>
  );
}

export function HomeGlow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`art ${className}`}
      viewBox="0 0 520 150"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect className="art-wall" width="520" height="150" rx="18" />
      <rect className="art-floor" y="112" width="520" height="38" />
      <Window x={28} y={22} w={118} h={78} />
      <Plant x={186} y={96} />
      <rect className="art-wood" x="230" y="78" width="92" height="34" rx="4" />
      <rect className="art-cloth" x="242" y="70" width="28" height="10" rx="2" />
      <rect className="art-leaf" x="276" y="68" width="22" height="12" rx="2" />
      <Broom x={390} y={100} />
      <Spray x={430} y={78} />
      <Cloth x={360} y={118} />
      <Spark x={210} y={28} s={5} />
      <Spark x={340} y={36} s={3.5} />
      <Spark x={480} y={24} s={4} />
    </svg>
  );
}

export function ShineBurst() {
  return (
    <div className="shine-burst" aria-hidden="true">
      {Array.from({ length: 14 }, (_, n) => (
        <span key={n} style={{ "--n": n } as CSSProperties} />
      ))}
    </div>
  );
}
