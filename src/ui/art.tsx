import type { CSSProperties } from "react";

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
      <path
        className="art-ray"
        d={`M${x + w * 0.66} ${y + h * 0.36} l${w * 0.22} ${-h * 0.08} M${x + w * 0.66} ${y + h * 0.36} l${w * 0.2} ${h * 0.12} M${x + w * 0.66} ${y + h * 0.36} l${-w * 0.05} ${-h * 0.22}`}
      />
      <rect
        className="art-wood"
        x={x - 6}
        y={y + h - 2}
        width={w + 12}
        height="7"
        rx="2"
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
      <rect className="art-shelf" x="18" y="98" width="124" height="8" rx="3" />
      <Window x={22} y={14} w={78} h={64} />
      <Plant x={128} y={78} s={0.9} />
      <Plant x={108} y={84} s={0.55} />
      <Spark x={14} y={18} s={4.5} />
      <Spark x={112} y={22} s={3} />
      <Spark x={146} y={48} s={2.6} />
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
      <rect className="art-shelf" x="22" y="96" width="70" height="6" rx="2" />
      <Broom x={40} y={80} />
      <Spray x={78} y={52} />
      <Spray x={102} y={60} />
      <Cloth x={70} y={90} />
      <Cloth x={108} y={96} />
      <Spark x={18} y={24} s={4.5} />
      <Spark x={132} y={30} s={3.4} />
      <Spark x={58} y={36} s={2.4} />
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
      <Plant x={78} y={80} s={1.45} />
      <Plant x={48} y={86} s={0.7} />
      <Plant x={112} y={88} s={0.62} />
      <Spark x={24} y={28} s={4.5} />
      <Spark x={128} y={34} s={3.2} />
      <Spark x={96} y={18} s={2.4} />
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
      <rect className="art-shelf" x="210" y="118" width="120" height="10" rx="4" />
      <Window x={24} y={16} w={132} h={82} />
      <Plant x={186} y={98} s={1.05} />
      <Plant x={214} y={104} s={0.62} />
      <rect className="art-shelf" x="248" y="72" width="108" height="40" rx="5" />
      <rect className="art-wood" x="258" y="80" width="14" height="24" rx="1" />
      <rect className="art-leaf" x="276" y="84" width="12" height="20" rx="1" />
      <rect className="art-cloth" x="294" y="78" width="22" height="10" rx="2" />
      <rect className="art-wood" x="322" y="86" width="18" height="18" rx="2" />
      <Broom x={400} y={102} />
      <Spray x={444} y={74} />
      <Cloth x={360} y={116} />
      <Spark x={176} y={24} s={5} />
      <Spark x={230} y={40} s={3} />
      <Spark x={370} y={28} s={4} />
      <Spark x={490} y={22} s={3.4} />
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
